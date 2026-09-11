import unittest
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.analytics.execution_gaps.rules import RULE_DEFINITIONS
from app.analytics.execution_gaps.service import run_execution_gaps, seed_execution_gap_rules
from app.db.base import Base
from app.models.models import Alert, Asset, Case, CaseAlertLink, CSEEntity, Finding, FindingEvidence, Investigation, SupervisoryRule


class ExecutionGapTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.cse = CSEEntity(cse_code='CSE-07', name='Synthetic Energy Entity', sector='Energy', criticality='CRITICAL', assessment_status='ACTIVE')
        other = CSEEntity(cse_code='CSE-02', name='Synthetic Finance Entity', sector='Finance', criticality='HIGH', assessment_status='ACTIVE')
        self.db.add_all([self.cse, other])
        self.db.flush()
        self.asset = Asset(asset_code='EN-TEST-01', cse_id=self.cse.id, name='Test asset', asset_type='SERVER', criticality='HIGH', expected_monitoring=True)
        self.db.add(self.asset)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _add_alert(self, code, *, minutes=5, severity='CRITICAL', acknowledged=True, asset=True, case=None):
        created = datetime(2026, 6, 18, 8, 0, tzinfo=timezone.utc)
        alert = Alert(alert_code=code, cse_id=self.cse.id, asset_id=self.asset.id if asset else None, severity=severity, category='ACCESS', title='Synthetic alert', description='Synthetic test alert', created_time=created, acknowledged_time=created + timedelta(minutes=1) if acknowledged else None, closed_time=created + timedelta(minutes=minutes), status='CLOSED')
        self.db.add(alert)
        self.db.flush()
        if case:
            self.db.add(CaseAlertLink(case_id=case.id, alert_id=alert.id))
        return alert

    def test_rules_are_seedable_and_have_exact_phase_set(self):
        self.assertEqual(set(RULE_DEFINITIONS), {'EG-001', 'EG-002', 'EG-003', 'EG-004', 'EG-005', 'EG-006'})
        self.assertEqual(seed_execution_gap_rules(self.db), 6)
        self.assertEqual(self.db.scalar(select(SupervisoryRule).where(SupervisoryRule.rule_code == 'EG-003')).category, 'EXECUTION_GAP')

    def test_run_creates_findings_and_evidence_for_triggered_rules(self):
        case = Case(case_code='CASE-284', cse_id=self.cse.id, title='Synthetic case', description='Case', severity='CRITICAL', status='CLOSED', opened_time=datetime(2026, 6, 18, 8, 1, tzinfo=timezone.utc), closed_time=datetime(2026, 6, 18, 8, 8, tzinfo=timezone.utc))
        self.db.add(case)
        self.db.flush()
        alerts = [self._add_alert(f'ALT-10{i}', minutes=5, case=case if i == 0 else None) for i in range(1, 7)]
        self.db.add(Investigation(investigation_code='INV-1', case_id=case.id, cse_id=self.cse.id, status='PARTIAL', notes='same narrative for review'))
        self.db.add(Investigation(investigation_code='INV-2', case_id=case.id, cse_id=self.cse.id, status='PARTIAL', notes='same narrative for review'))
        self.db.add(Investigation(investigation_code='INV-3', case_id=case.id, cse_id=self.cse.id, status='PARTIAL', notes='same narrative for review'))
        self.db.commit()
        run, rules, created = run_execution_gaps(self.db, cse_code='CSE-07')
        findings = self.db.scalars(select(Finding).where(Finding.analytics_run_id == run.id)).all()
        self.assertEqual(run.status, 'COMPLETED')
        self.assertEqual(rules, 6)
        self.assertGreaterEqual(created, 4)
        self.assertTrue({finding.rule.rule_code for finding in findings}.issuperset({'EG-001', 'EG-002', 'EG-003', 'EG-004', 'EG-005', 'EG-006'}))
        self.assertTrue(all(finding.category == 'EXECUTION_GAP' and finding.explanation for finding in findings))
        self.assertGreater(len(self.db.scalars(select(FindingEvidence)).all()), 0)

    def test_cse_scope_does_not_mix_records(self):
        other = self.db.scalar(select(CSEEntity).where(CSEEntity.cse_code == 'CSE-02'))
        self._add_alert('ALT-OTHER', minutes=1)
        self.db.add(Alert(alert_code='ALT-OTHER-CSE', cse_id=other.id, severity='CRITICAL', category='ACCESS', title='Other', description='Other', created_time=datetime(2026, 6, 18, tzinfo=timezone.utc), closed_time=datetime(2026, 6, 18, 0, 1, tzinfo=timezone.utc), status='CLOSED'))
        self.db.commit()
        run, _, _ = run_execution_gaps(self.db, cse_code='CSE-07')
        self.assertEqual(run.cse_id, self.cse.id)
        self.assertTrue(all(finding.cse_id == self.cse.id for finding in self.db.scalars(select(Finding)).all()))

    def test_disabled_rule_is_skipped(self):
        seed_execution_gap_rules(self.db)
        rule = self.db.scalar(select(SupervisoryRule).where(SupervisoryRule.rule_code == 'EG-003'))
        rule.enabled = False
        self._add_alert('ALT-DISABLED', minutes=1)
        self.db.commit()
        run_execution_gaps(self.db, cse_code='CSE-07')
        codes = {finding.rule.rule_code for finding in self.db.scalars(select(Finding)).all()}
        self.assertNotIn('EG-003', codes)

    def test_invalid_cse_fails_before_run(self):
        with self.assertRaises(ValueError):
            run_execution_gaps(self.db, cse_code='CSE-99')


if __name__ == '__main__':
    unittest.main()
