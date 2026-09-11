import unittest
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.analytics.anomalies.detectors import detect_ratio_anomaly, detect_volume_anomalies
from app.analytics.anomalies.service import run_anomaly_analysis, seed_anomaly_rules
from app.analytics.attention.service import attention_level, finding_component_data, run_attention_score, score_components
from app.analytics.peer_benchmark.service import run_peer_benchmark
from app.db.base import Base
from app.models.models import Alert, AnalyticsRun, AttentionScore, Case, CSEEntity, Finding, IngestionBatch, PeerMetric, SupervisoryRule


class Phase89Tests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.cse = CSEEntity(cse_code='CSE-07', name='Synthetic Energy', sector='Energy', criticality='CRITICAL', assessment_status='ACTIVE')
        self.peer = CSEEntity(cse_code='CSE-03', name='Synthetic Transport', sector='Transport', criticality='HIGH', assessment_status='ACTIVE')
        self.db.add_all([self.cse, self.peer]); self.db.flush()
        self.current = IngestionBatch(batch_code='BATCH-CURRENT', cse_id=self.cse.id, source_type='CSV', source_name='current.csv', assessment_period='Q2 2026', record_count=8, status='COMPLETED')
        self.history1 = IngestionBatch(batch_code='BATCH-HISTORY-1', cse_id=self.cse.id, source_type='CSV', source_name='history1.csv', assessment_period='Q4 2025', record_count=1, status='COMPLETED')
        self.history2 = IngestionBatch(batch_code='BATCH-HISTORY-2', cse_id=self.cse.id, source_type='CSV', source_name='history2.csv', assessment_period='Q1 2026', record_count=1, status='COMPLETED')
        self.peer_batch = IngestionBatch(batch_code='BATCH-PEER', cse_id=self.peer.id, source_type='CSV', source_name='peer.csv', assessment_period='Q2 2026', record_count=2, status='COMPLETED')
        self.db.add_all([self.current, self.history1, self.history2, self.peer_batch]); self.db.flush()
        self.db.commit()

    def tearDown(self):
        self.db.close(); self.engine.dispose()

    def _add_alerts(self, cse_id, batch_id, count, prefix):
        created = datetime(2026, 6, 18, 8, tzinfo=timezone.utc)
        for index in range(count):
            self.db.add(Alert(alert_code=f'{prefix}-{index}', cse_id=cse_id, ingestion_batch_id=batch_id, severity='HIGH', category='NETWORK', title='Synthetic', description='Synthetic', created_time=created, closed_time=created + timedelta(minutes=30), status='CLOSED'))
        self.db.commit()

    def test_statistical_detectors_need_baseline_and_detect_volume(self):
        self.assertEqual(detect_volume_anomalies({'alerts': 100, 'cases': 1}, [{'alerts': 10, 'cases': 1}, {'alerts': 11, 'cases': 1}], 2, 2)[0].rule_code, 'AN-001')
        self.assertEqual(detect_volume_anomalies({'alerts': 100, 'cases': 1}, [{'alerts': 10, 'cases': 1}], 2, 2), [])
        self.assertIsNotNone(detect_ratio_anomaly(10, [1, 1.2], 2, 2))

    def test_anomaly_run_uses_history_and_persists_finding(self):
        self._add_alerts(self.cse.id, self.current.id, 100, 'CURRENT')
        self._add_alerts(self.cse.id, self.history1.id, 10, 'H1')
        self._add_alerts(self.cse.id, self.history2.id, 11, 'H2')
        run, period, rules, created, note = run_anomaly_analysis(self.db, ingestion_batch_code=self.current.batch_code)
        self.assertEqual((period, rules), ('Q2 2026', 3)); self.assertGreater(created, 0); self.assertEqual(run.status, 'COMPLETED')
        self.assertTrue(all(f.category == 'ANOMALY' for f in self.db.scalars(select(Finding).where(Finding.analytics_run_id == run.id)).all()))

    def test_peer_benchmark_persists_metrics_and_deviation(self):
        self._add_alerts(self.cse.id, self.current.id, 10, 'CURRENT')
        self._add_alerts(self.peer.id, self.peer_batch.id, 2, 'PEER')
        run, period, rules, created, peers = run_peer_benchmark(self.db, ingestion_batch_code=self.current.batch_code)
        self.assertEqual((period, rules, peers), ('Q2 2026', 1, 1)); self.assertEqual(run.status, 'COMPLETED')
        self.assertGreater(len(self.db.scalars(select(PeerMetric)).all()), 0)

    def test_attention_score_is_weighted_bounded_and_persisted(self):
        unknown = score_components({'EXECUTION_GAP': 5, 'NEGATIVE_SPACE': 0, 'ANOMALY': None, 'PEER_DEVIATION': None}, available={'EXECUTION_GAP', 'NEGATIVE_SPACE'}, severity_totals={'EXECUTION_GAP': 20, 'NEGATIVE_SPACE': 0})
        self.assertEqual(unknown['ANOMALY'], None)
        self.assertEqual(unknown['PEER_DEVIATION'], None)
        self.assertEqual(unknown['total'], 100.0)
        self.assertEqual(attention_level(98), 'CRITICAL'); self.assertEqual(attention_level(76), 'HIGH'); self.assertEqual(attention_level(20), 'NORMAL')
        self.assertEqual(attention_level(76, {'CRITICAL': 75, 'HIGH': 50, 'MODERATE': 25}), 'CRITICAL')
        self.assertEqual(attention_level(20, {'CRITICAL': 75, 'HIGH': 50, 'MODERATE': 25}), 'LOW')
        self.db.add(Finding(finding_code='EG-1', cse_id=self.cse.id, category='EXECUTION_GAP', severity='HIGH', title='x', description='x', explanation='x', status='OPEN', detected_at=datetime.now(timezone.utc)))
        self.db.add(Finding(finding_code='NS-1', cse_id=self.cse.id, category='NEGATIVE_SPACE', severity='HIGH', title='x', description='x', explanation='x', status='OPEN', detected_at=datetime.now(timezone.utc)))
        self.db.commit()
        run, score, counts = run_attention_score(self.db, cse_code='CSE-07', ingestion_batch_code=self.current.batch_code)
        self.assertEqual(run.status, 'COMPLETED'); self.assertTrue(0 <= score.total_score <= 100); self.assertIsNotNone(self.db.scalar(select(AttentionScore).where(AttentionScore.id == score.id)))

    def test_severity_aware_normalization_and_missing_components(self):
        low = score_components({'EXECUTION_GAP': 1}, available={'EXECUTION_GAP'}, severity_totals={'EXECUTION_GAP': 1})
        critical = score_components({'EXECUTION_GAP': 1}, available={'EXECUTION_GAP'}, severity_totals={'EXECUTION_GAP': 4})
        self.assertGreater(critical['total'], low['total'])
        counts, _, available = finding_component_data(self.db, self.cse.id)
        self.assertIsNone(counts['ANOMALY'])
        self.assertIsNone(counts['PEER_DEVIATION'])
        self.assertNotIn('ANOMALY', available)
        self.assertNotIn('PEER_DEVIATION', available)

    def test_cse_scope_and_disabled_rules(self):
        seed_anomaly_rules(self.db)
        rule = self.db.scalar(select(SupervisoryRule).where(SupervisoryRule.rule_code == 'AN-001')); rule.enabled = False; self.db.commit()
        self._add_alerts(self.cse.id, self.current.id, 100, 'CLOSED')
        run_anomaly_analysis(self.db, cse_code='CSE-07')
        self.assertFalse(self.db.scalars(select(Finding).where(Finding.rule_id == rule.id)).all())


if __name__ == '__main__':
    unittest.main()
