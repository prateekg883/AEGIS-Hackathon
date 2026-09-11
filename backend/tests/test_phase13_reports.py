import unittest
from datetime import datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.models import (
    Alert,
    AssessmentReport,
    AttentionScore,
    CSEEntity,
    Escalation,
    Finding,
    FindingEvidence,
    IngestionBatch,
    Investigation,
    PeerMetric,
    PrioritisedSample,
    SupervisoryRule,
)
from app.reports.service import generate_assessment_report, list_assessment_reports, get_assessment_report


class Phase13ReportTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

        self.cse = CSEEntity(cse_code='CSE-13', name='Phase 13 Utility', sector='Utilities', criticality='CRITICAL', assessment_status='ACTIVE')
        self.db.add(self.cse)
        self.db.flush()

        self.batch = IngestionBatch(
            batch_code='BATCH-REPORT-01',
            cse_id=self.cse.id,
            source_type='CSV',
            source_name='phase13.csv',
            assessment_period='Q4 2026',
            record_count=4,
            status='COMPLETED',
            ingested_at=datetime.now(timezone.utc),
        )
        self.db.add(self.batch)
        self.db.flush()

        self.rule = SupervisoryRule(
            rule_code='EG-001',
            name='High severity alert closed too quickly',
            category='EXECUTION_GAP',
            description='Example execution gap rule.',
            severity='HIGH',
            weight=1.0,
            enabled=True,
            parameters_json={},
        )
        self.db.add(self.rule)
        self.db.flush()

        alert = Alert(
            alert_code='ALT-REPORT-001',
            cse_id=self.cse.id,
            asset_id=None,
            ingestion_batch_id=self.batch.id,
            severity='HIGH',
            category='NETWORK',
            title='Closed too quickly',
            description='Alert closed in under threshold.',
            created_time=datetime(2026, 10, 1, 9, tzinfo=timezone.utc),
            acknowledged_time=datetime(2026, 10, 1, 9, 2, tzinfo=timezone.utc),
            closed_time=datetime(2026, 10, 1, 9, 8, tzinfo=timezone.utc),
            status='CLOSED',
            disposition='Review',
            analyst='Analyst 1',
        )
        self.db.add(alert)
        self.db.flush()

        finding = Finding(
            finding_code='EG-001-REPORT-1',
            cse_id=self.cse.id,
            analytics_run_id=None,
            rule_id=self.rule.id,
            category='EXECUTION_GAP',
            severity='HIGH',
            title='Critical alert closed without full review',
            description='Alert closed quickly without escalation evidence.',
            explanation='Alert was closed quickly and evidence was incomplete.',
            status='OPEN',
            score_contribution=18.0,
            detected_at=datetime.now(timezone.utc),
        )
        self.db.add(finding)
        self.db.flush()
        self.db.add(FindingEvidence(
            evidence_code='EVD-REPORT-001',
            finding_id=finding.id,
            record_type='ALERT',
            record_id='ALT-REPORT-001',
            summary='Alert closed in under threshold. Evidence was incomplete.',
            evidence_reference='ALT-REPORT-001',
        ))

        case = __import__('app.models.models', fromlist=['Case']).Case(
            case_code='CASE-REPORT-001',
            cse_id=self.cse.id,
            ingestion_batch_id=self.batch.id,
            title='Example case',
            description='Example case description',
            severity='HIGH',
            status='OPEN',
            opened_time=datetime(2026, 10, 2, 8, tzinfo=timezone.utc),
            assigned_analyst='Analyst 2',
        )
        self.db.add(case)
        self.db.flush()
        investigation = Investigation(
            investigation_code='INV-REPORT-001',
            case_id=case.id,
            cse_id=self.cse.id,
            status='IN_PROGRESS',
            analyst='Analyst 3',
            started_time=datetime.now(timezone.utc),
            notes='Example note',
        )
        self.db.add(investigation)
        self.db.flush()
        self.db.add(Escalation(
            escalation_code='ESC-REPORT-001',
            case_id=investigation.case_id,
            alert_id=alert.id,
            cse_id=self.cse.id,
            status='OPEN',
            escalation_level='CRITICAL',
            reason='Manual supervisory review needed.',
            escalated_time=datetime.now(timezone.utc),
        ))

        self.db.add(AttentionScore(
            cse_id=self.cse.id,
            analytics_run_id=None,
            total_score=77.0,
            attention_level='HIGH',
            execution_gap_score=32.0,
            negative_space_score=20.0,
            anomaly_score=15.0,
            peer_deviation_score=10.0,
            calculated_at=datetime.now(timezone.utc),
        ))

        self.db.add(PeerMetric(
            cse_id=self.cse.id,
            analytics_run_id=None,
            metric_name='alerts',
            entity_value=7.0,
            peer_average=5.0,
            peer_median=4.0,
            percentile=80.0,
            deviation=3.0,
            unit='count',
            assessment_period='Q4 2026',
        ))

        self.db.add(PrioritisedSample(
            cse_id=self.cse.id,
            analytics_run_id=None,
            rank=1,
            record_type='ALERT',
            record_id='ALT-REPORT-001',
            priority_score=88.0,
            severity='HIGH',
            reason='High severity alert with incomplete evidence trail.',
            review_status='PENDING_REVIEW',
        ))

        self.db.commit()

    def test_generate_report_includes_core_sections_and_attention(self):
        report = generate_assessment_report(self.db, cse_code='CSE-13', assessment_period='Q4 2026')
        self.assertEqual(report['report_status'], 'GENERATED')
        self.assertEqual(report['cse_code'], 'CSE-13')
        self.assertIn('supervisory_attention', report)
        self.assertEqual(report['supervisory_attention']['attention_level'], 'HIGH')
        self.assertIn('execution_gap_observations', report)
        self.assertIn('negative_space_observations', report)
        self.assertIn('peer_benchmarking', report)
        self.assertIn('priority_manual_review_samples', report)
        self.assertTrue(report['evidence_traceability'])
        self.assertTrue(report['manual_verification_areas'])

    def test_list_and_get_report_use_stored_scope(self):
        generate_assessment_report(self.db, cse_code='CSE-13', assessment_period='Q4 2026')
        reports = list_assessment_reports(self.db, cse_code='CSE-13')
        self.assertEqual(len(reports), 1)
        found = get_assessment_report(self.db, reports[0]['report_id'])
        self.assertEqual(found['cse_code'], 'CSE-13')
        self.assertEqual(found['report_status'], 'GENERATED')
        self.assertIn('assessment_scope', found)

    def test_unknown_data_is_preserved_without_zero_inflation(self):
        empty = generate_assessment_report(self.db, cse_code='CSE-13', assessment_period='Q4 2026')
        self.assertNotEqual(empty['data_limitations'], [])
        self.assertIn('Insufficient submitted data', ' '.join(empty['data_limitations']))

    def test_invalid_cse_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'CSE UNKNOWN does not exist'):
            generate_assessment_report(self.db, cse_code='UNKNOWN', assessment_period='Q4 2026')

    def test_report_without_findings_or_optional_analytics(self):
        cse = CSEEntity(cse_code='CSE-EMPTY', name='Empty Utility', sector='Utilities', criticality='LOW', assessment_status='ACTIVE')
        self.db.add(cse)
        self.db.commit()

        report = generate_assessment_report(self.db, cse_code='CSE-EMPTY', assessment_period='Q1 2026')

        self.assertEqual(report['report_status'], 'GENERATED')
        self.assertEqual(report['execution_gap_observations'], [])
        self.assertEqual(report['negative_space_observations'], [])
        self.assertEqual(report['peer_benchmarking'], [])
        self.assertEqual(report['priority_manual_review_samples'], [])
        self.assertFalse(report['evidence_traceability'])
        self.assertTrue(report['data_limitations'])


if __name__ == '__main__':
    unittest.main()
