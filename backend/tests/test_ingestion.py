import json
import unittest
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.db.base import Base
from app.ingestion.normalizers import timestamp
from app.ingestion.service import ingest_records, parse_upload
from app.main import app
from app.db.session import get_db
from app.models.models import Alert, Asset, Case, CaseAlertLink, CSEEntity, IngestionBatch

FIXTURES = Path(__file__).parent / 'data'


class IngestionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        cse = CSEEntity(cse_code='CSE-07', name='Test Energy Entity', sector='Energy', criticality='CRITICAL', assessment_status='ACTIVE')
        self.db.add(cse)
        self.db.commit()
        self.db.add(Asset(asset_code='EN-SCADA-01', cse_id=cse.id, name='Test SCADA', asset_type='CONTROL_SYSTEM', criticality='CRITICAL', expected_monitoring=True))
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_csv_and_json_parsing(self):
        csv_type, csv_records = parse_upload((FIXTURES / 'assets.csv').read_bytes(), 'assets.csv')
        json_type, json_records = parse_upload((FIXTURES / 'alerts.json').read_bytes(), 'alerts.json')
        self.assertEqual(csv_type, 'CSV')
        self.assertEqual(json_type, 'JSON')
        self.assertEqual(len(csv_records), 2)
        self.assertEqual(json_records[0]['alert_code'], 'ALT-1092')

    def test_cse_upload_creates_bootstrap_batch(self):
        result = ingest_records(self.db, records=[{'cse_code': 'CSE-08', 'name': 'Test Defence Entity', 'sector': 'Defence', 'criticality': 'High', 'assessment_status': 'Active'}], record_type='CSE', source_type='CSV', source_name='cses.csv', assessment_period='Q2 2026')
        batch = self.db.scalar(select(IngestionBatch).where(IngestionBatch.batch_code == result.batch_code))
        self.assertEqual(result.status, 'COMPLETED')
        self.assertIsNone(batch.cse_id)
        self.assertIsNotNone(self.db.scalar(select(CSEEntity).where(CSEEntity.cse_code == 'CSE-08')))

    def test_assets_normalize_and_persist(self):
        result = ingest_records(self.db, records=[{'asset_code': ' en-test-01 ', 'cse_code': ' cse-07 ', 'name': ' Test Asset ', 'asset_type': 'server', 'criticality': 'high', 'expected_monitoring': 'yes'}], record_type='ASSET', source_type='CSV', source_name='assets.csv', assessment_period='Q2 2026')
        asset = self.db.scalar(select(Asset).where(Asset.asset_code == 'EN-TEST-01'))
        self.assertEqual(result.status, 'COMPLETED')
        self.assertTrue(asset.expected_monitoring)
        self.assertEqual(asset.cse_id, 1)

    def test_alert_timestamp_and_enum_normalization(self):
        result = ingest_records(self.db, records=[json.loads((FIXTURES / 'alerts.json').read_text())['records'][0]], record_type='ALERT', source_type='JSON', source_name='alerts.json', assessment_period='Q2 2026')
        alert = self.db.scalar(select(Alert).where(Alert.alert_code == 'ALT-1092'))
        self.assertEqual(result.accepted_records, 1)
        self.assertEqual(alert.severity, 'CRITICAL')
        self.assertEqual(alert.status, 'CLOSED')
        self.assertIsNotNone(timestamp('2026-06-18T08:42:00+05:30').tzinfo)

    def test_missing_required_and_invalid_values_are_rejected(self):
        result = ingest_records(self.db, records=[{'alert_code': 'ALT-BAD', 'cse_code': 'CSE-07', 'severity': 'urgent', 'category': 'ACCESS', 'title': 'Bad', 'description': 'Bad', 'created_time': '2026-06-18T08:42:00', 'status': 'unknown'}], record_type='ALERT', source_type='CSV', source_name='bad.csv', assessment_period='Q2 2026')
        self.assertEqual(result.status, 'FAILED')
        self.assertEqual(result.accepted_records, 0)
        fields = {error.field for error in result.errors}
        self.assertIn('severity', fields)
        self.assertIn('status', fields)
        self.assertEqual(self.db.scalar(select(Alert)), None)
        self.assertIsNotNone(self.db.scalar(select(IngestionBatch).where(IngestionBatch.batch_code == result.batch_code)))

    def test_unknown_cse_is_rejected(self):
        result = ingest_records(self.db, records=[{'asset_code': 'A-1', 'cse_code': 'CSE-99', 'name': 'Unknown', 'asset_type': 'server', 'criticality': 'HIGH', 'expected_monitoring': 'true'}], record_type='ASSET', source_type='JSON', source_name='assets.json', assessment_period='Q2 2026')
        self.assertEqual(result.status, 'FAILED')
        self.assertIn('CSE CSE-99 does not exist', result.errors[0].error)

    def test_duplicate_code_does_not_overwrite(self):
        first = {'asset_code': 'A-1', 'cse_code': 'CSE-07', 'name': 'Original', 'asset_type': 'server', 'criticality': 'HIGH', 'expected_monitoring': 'true'}
        ingest_records(self.db, records=[first], record_type='ASSET', source_type='JSON', source_name='assets.json', assessment_period='Q2 2026')
        result = ingest_records(self.db, records=[{**first, 'name': 'Changed'}], record_type='ASSET', source_type='JSON', source_name='assets.json', assessment_period='Q2 2026')
        asset = self.db.scalar(select(Asset).where(Asset.asset_code == 'A-1'))
        self.assertEqual(result.status, 'FAILED')
        self.assertIn('already exists', result.errors[0].error)
        self.assertEqual(asset.name, 'Original')

    def test_case_alert_relationship_resolves_and_prevents_duplicates(self):
        case = {'case_code': 'CASE-284', 'cse_code': 'CSE-07', 'title': 'Test case', 'description': 'Test', 'severity': 'CRITICAL', 'status': 'OPEN', 'opened_time': '2026-06-18T08:45:00+05:30'}
        alert = {'alert_code': 'ALT-1092', 'cse_code': 'CSE-07', 'severity': 'CRITICAL', 'category': 'ACCESS', 'title': 'Test alert', 'description': 'Test', 'created_time': '2026-06-18T08:42:00+05:30', 'status': 'OPEN'}
        ingest_records(self.db, records=[case], record_type='CASE', source_type='CSV', source_name='cases.csv', assessment_period='Q2 2026')
        ingest_records(self.db, records=[alert], record_type='ALERT', source_type='CSV', source_name='alerts.csv', assessment_period='Q2 2026')
        link = ingest_records(self.db, records=[{'case_code': 'case-284', 'alert_code': 'alt-1092'}], record_type='CASE_ALERT_LINK', source_type='CSV', source_name='links.csv', assessment_period='Q2 2026')
        duplicate = ingest_records(self.db, records=[{'case_code': 'CASE-284', 'alert_code': 'ALT-1092'}], record_type='CASE_ALERT_LINK', source_type='CSV', source_name='links.csv', assessment_period='Q2 2026')
        self.assertEqual(link.accepted_records, 1)
        self.assertEqual(duplicate.status, 'FAILED')
        self.assertEqual(len(self.db.scalars(select(CaseAlertLink)).all()), 1)

    def test_invalid_timestamp_rolls_back_records_but_keeps_failed_batch(self):
        result = ingest_records(self.db, records=[{'case_code': 'CASE-BAD', 'cse_code': 'CSE-07', 'title': 'Bad case', 'description': 'Bad', 'severity': 'HIGH', 'status': 'OPEN', 'opened_time': 'not-a-timestamp'}], record_type='CASE', source_type='CSV', source_name='bad.csv', assessment_period='Q2 2026')
        self.assertEqual(result.status, 'FAILED')
        self.assertEqual(self.db.scalar(select(Case)), None)
        self.assertEqual(self.db.scalar(select(IngestionBatch).where(IngestionBatch.batch_code == result.batch_code)).status, 'FAILED')

    def test_upload_and_batch_status_endpoints(self):
        def override_db():
            yield self.db

        app.dependency_overrides[get_db] = override_db
        try:
            client = TestClient(app)
            response = client.post('/api/ingestion/upload', data={'record_type': 'ASSET', 'cse_code': 'CSE-07', 'assessment_period': 'Q2 2026'}, files={'file': ('assets.csv', b'asset_code,name,asset_type,criticality,expected_monitoring\nAPI-ASSET-01,API Asset,SERVER,HIGH,true\n', 'text/csv')})
            self.assertEqual(response.status_code, 200)
            result = response.json()
            self.assertEqual(result['status'], 'COMPLETED')
            batch_response = client.get(f"/api/ingestion/batches/{result['batch_code']}")
            self.assertEqual(batch_response.status_code, 200)
            self.assertEqual(batch_response.json()['batch_code'], result['batch_code'])
        finally:
            app.dependency_overrides.clear()


if __name__ == '__main__':
    unittest.main()
