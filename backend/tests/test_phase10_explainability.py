import unittest
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.models import (
    Alert,
    AttentionScore,
    CSEEntity,
    Finding,
    FindingEvidence,
    IngestionBatch,
    SupervisoryRule,
)


class Phase10ExplainabilityTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.client = TestClient(app)
        app.dependency_overrides[get_db] = lambda: self.db

        self.cse = CSEEntity(cse_code='CSE-99', name='Example Utility', sector='Utilities', criticality='CRITICAL', assessment_status='ACTIVE')
        self.db.add(self.cse)
        self.db.flush()

        self.batch = IngestionBatch(batch_code='BATCH-P10', cse_id=self.cse.id, source_type='CSV', source_name='p10.csv', assessment_period='Q3 2026', record_count=5, status='COMPLETED')
        self.db.add(self.batch)
        self.db.flush()

        self.rule = SupervisoryRule(rule_code='EG-001', name='High severity alert closed too quickly', category='EXECUTION_GAP', description='Example rule', severity='HIGH', weight=1.0, enabled=True, parameters_json={'high_minutes': 10, 'critical_minutes': 15})
        self.db.add(self.rule)
        self.db.flush()

        self.finding = Finding(
            finding_code='EG-001-0001',
            cse_id=self.cse.id,
            rule_id=self.rule.id,
            category='EXECUTION_GAP',
            severity='HIGH',
            title='Potentially insufficient investigation due to unusually short closure time',
            description='Alert closed unusually quickly.',
            explanation='Alert was closed below threshold.',
            status='OPEN',
            score_contribution=5.0,
            detected_at=datetime.now(timezone.utc),
        )
        self.db.add(self.finding)
        self.db.flush()

        self.db.add(FindingEvidence(
            evidence_code='EVD-TEST-001',
            finding_id=self.finding.id,
            record_type='ALERT',
            record_id='ALT-1092',
            summary='Alert ALT-1092 was closed in 8 minutes against a 10-minute threshold.',
            evidence_reference='ALT-1092',
        ))

        self.db.add(Alert(
            alert_code='ALT-1092',
            cse_id=self.cse.id,
            ingestion_batch_id=self.batch.id,
            severity='HIGH',
            category='NETWORK',
            title='Rapid closure alert',
            description='Synthetic alert',
            created_time=datetime(2026, 7, 1, 9, 0, tzinfo=timezone.utc),
            closed_time=datetime(2026, 7, 1, 9, 8, tzinfo=timezone.utc),
            status='CLOSED',
            disposition='Reviewed',
            analyst='analyst',
        ))

        self.db.add(AttentionScore(
            cse_id=self.cse.id,
            analytics_run_id=None,
            total_score=67.4,
            attention_level='HIGH',
            execution_gap_score=78.0,
            negative_space_score=61.0,
            anomaly_score=52.0,
            peer_deviation_score=0.0,
            calculated_at=datetime.now(timezone.utc),
        ))
        self.db.commit()

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()
        self.engine.dispose()

    def test_finding_explanation_payload_includes_fact_interpretation_and_guidance(self):
        response = self.client.get(f'/api/analytics/findings/{self.finding.finding_code}/explanation')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['finding_code'], self.finding.finding_code)
        self.assertEqual(payload['rule_code'], 'EG-001')
        self.assertIn('fact', payload['explanation'])
        self.assertIn('interpretation', payload['explanation'])
        self.assertIn('manual_verification', payload['explanation'])
        self.assertTrue(payload['evidence'])
        self.assertTrue(payload['manual_verification_guidance'])

    def test_evidence_endpoint_returns_traceable_records(self):
        response = self.client.get(f'/api/analytics/findings/{self.finding.finding_code}/evidence')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['evidence'])
        self.assertEqual(payload['evidence'][0]['record_type'], 'ALERT')
        self.assertIn('ALT-1092', payload['evidence'][0]['record_id'])

    def test_attention_score_explanation_handles_unavailable_components(self):
        response = self.client.get(f'/api/analytics/attention-score/{self.cse.cse_code}/explanation')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['attention_level'], 'HIGH')
        self.assertIn('execution_gap', payload['component_breakdown'])
        self.assertIn('peer_deviation', payload['component_breakdown'])
        self.assertEqual(payload['component_breakdown']['peer_deviation']['status'], 'unavailable')
        self.assertIn('insufficient', payload['component_breakdown']['peer_deviation']['reason'])


if __name__ == '__main__':
    unittest.main()
