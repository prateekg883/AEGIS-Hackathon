import unittest
from datetime import datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.analytics.negative_space.rules import RULE_DEFINITIONS
from app.analytics.negative_space.service import run_negative_space, seed_negative_space_rules
from app.db.base import Base
from app.models.models import Alert, Asset, AnalyticsRun, Case, CaseAlertLink, CSEEntity, Escalation, Finding, FindingEvidence, IngestionBatch, SupervisoryRule


class NegativeSpaceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.cse = CSEEntity(cse_code='CSE-07', name='Synthetic Energy Entity', sector='Energy', criticality='CRITICAL', assessment_status='ACTIVE')
        other = CSEEntity(cse_code='CSE-02', name='Synthetic Finance Entity', sector='Finance', criticality='HIGH', assessment_status='ACTIVE')
        self.db.add_all([self.cse, other])
        self.db.flush()
        self.batch = IngestionBatch(batch_code='BATCH-NS-001', cse_id=self.cse.id, source_type='CSV', source_name='synthetic.csv', assessment_period='Q2 2026', record_count=3, status='COMPLETED')
        self.db.add(self.batch)
        self.db.flush()
        self.asset = Asset(asset_code='EN-MISSING-01', cse_id=self.cse.id, name='Unobserved critical asset', asset_type='SERVER', criticality='CRITICAL', expected_monitoring=True)
        self.db.add(self.asset)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _alert(self, code='ALT-NS-001', severity='CRITICAL', category='NETWORK', asset_id=None):
        alert = Alert(alert_code=code, cse_id=self.cse.id, asset_id=asset_id, ingestion_batch_id=self.batch.id, severity=severity, category=category, title='Synthetic alert', description='Synthetic submitted record', created_time=datetime(2026, 6, 18, 8, 0, tzinfo=timezone.utc), status='OPEN')
        self.db.add(alert)
        self.db.commit()
        return alert

    def test_rules_are_seedable_and_exact(self):
        self.assertEqual(set(RULE_DEFINITIONS), {'NS-001', 'NS-002', 'NS-003', 'NS-004', 'NS-005'})
        self.assertEqual(seed_negative_space_rules(self.db), 5)
        self.assertEqual(self.db.scalar(select(SupervisoryRule).where(SupervisoryRule.rule_code == 'NS-001')).category, 'NEGATIVE_SPACE')

    def test_all_negative_space_rules_create_cautious_findings(self):
        run, period, rules, created = run_negative_space(self.db, ingestion_batch_code=self.batch.batch_code)
        findings = self.db.scalars(select(Finding).where(Finding.analytics_run_id == run.id)).all()
        codes = {finding.rule.rule_code for finding in findings}
        self.assertEqual(period, 'Q2 2026')
        self.assertEqual(rules, 5)
        self.assertGreaterEqual(created, 4)
        self.assertTrue({'NS-001', 'NS-002', 'NS-005'}.issubset(codes))
        self.assertTrue(all(finding.category == 'NEGATIVE_SPACE' for finding in findings))
        self.assertTrue(all('submitted' in finding.explanation.lower() or 'observed' in finding.explanation.lower() for finding in findings))
        self.assertGreater(len(self.db.scalars(select(FindingEvidence)).all()), 0)

    def test_ns003_and_ns004_are_satisfied_when_relationship_evidence_exists(self):
        alert = self._alert(asset_id=self.asset.id)
        case = Case(case_code='CASE-NS-001', cse_id=self.cse.id, title='Synthetic case', description='Submitted case evidence', severity='CRITICAL', status='OPEN', opened_time=datetime(2026, 6, 18, 8, 1, tzinfo=timezone.utc))
        self.db.add(case)
        self.db.flush()
        self.db.add(CaseAlertLink(case_id=case.id, alert_id=alert.id))
        self.db.add(Escalation(escalation_code='ESC-NS-001', case_id=case.id, alert_id=alert.id, cse_id=self.cse.id, status='OPEN', escalation_level='L2'))
        self.db.commit()
        run, _, _, _ = run_negative_space(self.db, cse_code='CSE-07')
        codes = {finding.rule.rule_code for finding in self.db.scalars(select(Finding).where(Finding.analytics_run_id == run.id)).all()}
        self.assertNotIn('NS-003', codes)
        self.assertNotIn('NS-004', codes)

    def test_cse_scope_isolated(self):
        other = self.db.scalar(select(CSEEntity).where(CSEEntity.cse_code == 'CSE-02'))
        self.db.add(IngestionBatch(batch_code='BATCH-NS-002', cse_id=other.id, source_type='CSV', source_name='other.csv', assessment_period='Q2 2026', record_count=1, status='COMPLETED'))
        self.db.commit()
        run, _, _, _ = run_negative_space(self.db, cse_code='CSE-07')
        self.assertEqual(run.cse_id, self.cse.id)
        self.assertTrue(all(finding.cse_id == self.cse.id for finding in self.db.scalars(select(Finding)).all()))

    def test_disabled_rule_is_skipped(self):
        seed_negative_space_rules(self.db)
        rule = self.db.scalar(select(SupervisoryRule).where(SupervisoryRule.rule_code == 'NS-001'))
        rule.enabled = False
        self.db.commit()
        run_negative_space(self.db, ingestion_batch_code=self.batch.batch_code)
        codes = {finding.rule.rule_code for finding in self.db.scalars(select(Finding)).all()}
        self.assertNotIn('NS-001', codes)

    def test_period_is_required_and_invalid_scope_fails(self):
        self.db.delete(self.batch)
        self.db.commit()
        with self.assertRaises(ValueError):
            run_negative_space(self.db, cse_code='CSE-07')
        with self.assertRaises(ValueError):
            run_negative_space(self.db, cse_code='CSE-99')

    def test_run_status_is_completed(self):
        run, _, _, _ = run_negative_space(self.db, ingestion_batch_code=self.batch.batch_code)
        saved = self.db.get(AnalyticsRun, run.id)
        self.assertEqual(saved.status, 'COMPLETED')
        self.assertIsNotNone(saved.completed_at)


if __name__ == '__main__':
    unittest.main()
