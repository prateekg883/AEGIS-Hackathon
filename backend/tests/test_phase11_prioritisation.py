import unittest
from datetime import datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.models import Alert, AttentionScore, CSEEntity, Finding, FindingEvidence, IngestionBatch, PrioritisedSample, SupervisoryRule
from app.analytics.prioritisation.service import priority_level, run_prioritisation


class Phase11PrioritisationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.cse = CSEEntity(cse_code='CSE-11', name='Phase 11 Utility', sector='Utilities', criticality='CRITICAL', assessment_status='ACTIVE')
        self.peer = CSEEntity(cse_code='CSE-22', name='Peer Utility', sector='Utilities', criticality='CRITICAL', assessment_status='ACTIVE')
        self.db.add_all([self.cse, self.peer])
        self.db.flush()
        self.batch = IngestionBatch(batch_code='BATCH-P11', cse_id=self.cse.id, source_type='CSV', source_name='phase11.csv', assessment_period='Q4 2026', record_count=3, status='COMPLETED')
        self.db.add(self.batch)
        self.db.flush()

        self.rule = SupervisoryRule(rule_code='EG-001', name='Example rule', category='EXECUTION_GAP', description='Example epoch', severity='HIGH', weight=1.0, enabled=True, parameters_json={})
        self.db.add(self.rule)
        self.db.flush()

        self.alert = Alert(
            alert_code='ALT-P11-1',
            cse_id=self.cse.id,
            ingestion_batch_id=self.batch.id,
            severity='CRITICAL',
            category='NETWORK',
            title='Prioritised alert',
            description='Test alert',
            created_time=datetime(2026, 10, 1, 8, tzinfo=timezone.utc),
            acknowledged_time=datetime(2026, 10, 1, 8, 5, tzinfo=timezone.utc),
            closed_time=datetime(2026, 10, 1, 8, 13, tzinfo=timezone.utc),
            status='CLOSED',
            disposition='Reviewed',
            analyst='Analyst A',
        )
        self.db.add(self.alert)
        self.db.flush()

        self.finding = Finding(
            finding_code='EG-001-P11-1',
            cse_id=self.cse.id,
            rule_id=self.rule.id,
            category='EXECUTION_GAP',
            severity='CRITICAL',
            title='Critical alert closed too quickly',
            description='Alert closed below the configured threshold.',
            explanation='Alert closed below threshold.',
            status='OPEN',
            score_contribution=22.0,
            detected_at=datetime.now(timezone.utc),
        )
        self.db.add(self.finding)
        self.db.flush()

        self.db.add(FindingEvidence(
            evidence_code='EVD-P11-001',
            finding_id=self.finding.id,
            record_type='ALERT',
            record_id='ALT-P11-1',
            summary='Alert closed in 8 minutes without escalation evidence.',
            evidence_reference='ALT-P11-1',
        ))

        self.db.add(AttentionScore(
            cse_id=self.cse.id,
            analytics_run_id=None,
            total_score=82.0,
            attention_level='CRITICAL',
            execution_gap_score=78.0,
            negative_space_score=61.0,
            anomaly_score=52.0,
            peer_deviation_score=0.0,
            calculated_at=datetime.now(timezone.utc),
        ))
        self.db.commit()

    def test_priority_score_and_levels(self):
        _, samples = run_prioritisation(self.db, cse_code='CSE-11')
        self.assertTrue(samples)
        self.assertGreater(samples[0].priority_score, 70)
        self.assertEqual(priority_level(samples[0].priority_score), 'CRITICAL')

    def test_cross_signal_convergence_and_reason_generation(self):
        second = Finding(
            finding_code='NS-001-P11-1',
            cse_id=self.cse.id,
            rule_id=self.rule.id,
            category='NEGATIVE_SPACE',
            severity='HIGH',
            title='Expected monitoring absent',
            description='Critical asset missing monitoring evidence.',
            explanation='No monitoring evidence was observed.',
            status='OPEN',
            score_contribution=18.0,
            detected_at=datetime.now(timezone.utc),
        )
        self.db.add(second)
        self.db.flush()
        self.db.add(FindingEvidence(
            evidence_code='EVD-P11-002',
            finding_id=second.id,
            record_type='ALERT',
            record_id='ALT-P11-1',
            summary='Same alert also matches a negative-space signal.',
            evidence_reference='ALT-P11-1',
        ))
        self.db.commit()

        _, samples = run_prioritisation(self.db, cse_code='CSE-11')
        self.assertTrue(samples)
        self.assertIn('multiple analytical signals', samples[0].reason.lower())

    def test_empty_data_and_unknown_handling(self):
        empty = run_prioritisation(self.db, cse_code='CSE-22')
        self.assertEqual(empty[1], [])

    def test_duplicate_prevention_and_filters(self):
        run_prioritisation(self.db, cse_code='CSE-11')
        run_prioritisation(self.db, cse_code='CSE-11')
        rows = self.db.scalars(select(PrioritisedSample).where(PrioritisedSample.cse_id == self.cse.id)).all()
        self.assertEqual(len(rows), 1)

        filtered = self.db.scalars(select(PrioritisedSample).where(PrioritisedSample.record_type == 'ALERT', PrioritisedSample.review_status == 'PENDING_REVIEW')).all()
        self.assertTrue(filtered)


if __name__ == '__main__':
    unittest.main()
