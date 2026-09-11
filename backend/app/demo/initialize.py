from __future__ import annotations

from app.analytics.anomalies.service import run_anomaly_analysis
from app.analytics.attention.service import run_attention_score
from app.analytics.execution_gaps.service import run_execution_gaps
from app.analytics.negative_space.service import run_negative_space
from app.analytics.peer_benchmark.service import run_peer_benchmark
from app.analytics.prioritisation.service import run_prioritisation
from app.db.session import SessionLocal
from app.ingestion.service import ingest_records
from app.reports.service import generate_assessment_report
from app.models.models import CSEEntity
from sqlalchemy import select

PERIOD = 'Q2 2026'


def _ingest(db, records: list[dict], record_type: str, source_name: str):
    result = ingest_records(db, records=records, record_type=record_type, source_type='JSON', source_name=source_name, assessment_period=PERIOD)
    if result.status not in {'COMPLETED', 'PARTIAL'} or result.accepted_records == 0:
        raise RuntimeError(f'{record_type} demo data could not be initialized: {result.errors}')
    return result


def initialize_demo() -> None:
    db = SessionLocal()
    try:
        if db.scalar(select(CSEEntity).where(CSEEntity.cse_code == 'CSE-07')) is not None:
            print('Demo data already initialized; no changes made.')
            return

        _ingest(db, [
            {'cse_code': 'CSE-07', 'name': 'National Energy Systems', 'sector': 'Energy', 'criticality': 'CRITICAL', 'assessment_status': 'ACTIVE'},
            {'cse_code': 'CSE-03', 'name': 'National Transport Grid', 'sector': 'Transport', 'criticality': 'HIGH', 'assessment_status': 'ACTIVE'},
        ], 'CSE', 'demo-cse.json')
        _ingest(db, [
            {'asset_code': 'EN-SCADA-01', 'cse_code': 'CSE-07', 'name': 'SCADA Control Node', 'asset_type': 'SERVER', 'criticality': 'CRITICAL', 'expected_monitoring': 'true'},
            {'asset_code': 'EN-SCADA-04', 'cse_code': 'CSE-07', 'name': 'Grid Monitoring Node', 'asset_type': 'SERVER', 'criticality': 'CRITICAL', 'expected_monitoring': 'true'},
            {'asset_code': 'TR-OPS-14', 'cse_code': 'CSE-03', 'name': 'Transport Operations Node', 'asset_type': 'SERVER', 'criticality': 'HIGH', 'expected_monitoring': 'true'},
        ], 'ASSET', 'demo-assets.json')
        alert_result = _ingest(db, [
            {'alert_code': 'ALT-1092', 'cse_code': 'CSE-07', 'asset_code': 'EN-SCADA-01', 'severity': 'CRITICAL', 'category': 'ACCESS', 'title': 'Suspicious privileged access', 'description': 'Privileged access requires supervisory review.', 'created_time': '2026-06-18T08:42:00Z', 'acknowledged_time': '2026-06-18T08:45:00Z', 'closed_time': '2026-06-18T08:53:00Z', 'status': 'CLOSED', 'analyst': 'A. Sharma'},
            {'alert_code': 'ALT-1093', 'cse_code': 'CSE-07', 'asset_code': 'EN-SCADA-01', 'severity': 'HIGH', 'category': 'TRANSFER', 'title': 'Unusual outbound transfer', 'description': 'Outbound transfer requires manual review.', 'created_time': '2026-06-18T09:12:00Z', 'acknowledged_time': '2026-06-18T09:20:00Z', 'status': 'OPEN', 'analyst': 'R. Iyer'},
            {'alert_code': 'ALT-1076', 'cse_code': 'CSE-03', 'asset_code': 'TR-OPS-14', 'severity': 'HIGH', 'category': 'POLICY', 'title': 'Endpoint policy deviation', 'description': 'Policy deviation requires review.', 'created_time': '2026-06-16T13:06:00Z', 'acknowledged_time': '2026-06-16T13:20:00Z', 'closed_time': '2026-06-16T16:42:00Z', 'status': 'CLOSED', 'analyst': 'M. Das'},
        ], 'ALERT', 'demo-alerts.json')
        _ingest(db, [
            {'case_code': 'CASE-284', 'cse_code': 'CSE-07', 'title': 'Privileged access review', 'description': 'Review of ALT-1092.', 'severity': 'CRITICAL', 'status': 'CLOSED', 'opened_time': '2026-06-18T08:45:00Z', 'closed_time': '2026-06-18T08:53:00Z', 'assigned_analyst': 'A. Sharma'},
            {'case_code': 'CASE-285', 'cse_code': 'CSE-07', 'title': 'Outbound transfer review', 'description': 'Review of ALT-1093.', 'severity': 'HIGH', 'status': 'OPEN', 'opened_time': '2026-06-18T09:20:00Z', 'assigned_analyst': 'R. Iyer'},
            {'case_code': 'CASE-276', 'cse_code': 'CSE-03', 'title': 'Policy deviation review', 'description': 'Review of ALT-1076.', 'severity': 'HIGH', 'status': 'CLOSED', 'opened_time': '2026-06-16T13:20:00Z', 'closed_time': '2026-06-16T16:42:00Z', 'assigned_analyst': 'M. Das'},
        ], 'CASE', 'demo-cases.json')
        _ingest(db, [
            {'case_code': 'CASE-284', 'alert_code': 'ALT-1092'},
            {'case_code': 'CASE-285', 'alert_code': 'ALT-1093'},
            {'case_code': 'CASE-276', 'alert_code': 'ALT-1076'},
        ], 'CASE_ALERT_LINK', 'demo-links.json')
        _ingest(db, [
            {'investigation_code': 'INV-771', 'case_code': 'CASE-284', 'cse_code': 'CSE-07', 'status': 'IN_PROGRESS', 'started_time': '2026-06-18T08:46:00Z', 'completed_time': '2026-06-18T08:52:00Z', 'analyst': 'A. Sharma', 'notes': 'Access verified; closure evidence incomplete.'},
            {'investigation_code': 'INV-772', 'case_code': 'CASE-285', 'cse_code': 'CSE-07', 'status': 'IN_PROGRESS', 'started_time': '2026-06-18T09:22:00Z', 'analyst': 'R. Iyer', 'notes': 'Pending review.'},
            {'investigation_code': 'INV-768', 'case_code': 'CASE-276', 'cse_code': 'CSE-03', 'status': 'COMPLETED', 'started_time': '2026-06-16T13:30:00Z', 'completed_time': '2026-06-16T16:35:00Z', 'analyst': 'M. Das', 'notes': 'Policy exception documented.'},
        ], 'INVESTIGATION', 'demo-investigations.json')
        _ingest(db, [
            {'escalation_code': 'ESC-193', 'case_code': 'CASE-285', 'alert_code': 'ALT-1093', 'cse_code': 'CSE-07', 'status': 'OPEN', 'escalation_level': 'L2', 'reason': 'High severity transfer requires supervisory review.', 'escalated_time': '2026-06-18T09:24:00Z'},
            {'escalation_code': 'ESC-188', 'case_code': 'CASE-276', 'alert_code': 'ALT-1076', 'cse_code': 'CSE-03', 'status': 'RESOLVED', 'escalation_level': 'L2', 'reason': 'Policy exception required approval.', 'escalated_time': '2026-06-16T13:41:00Z', 'resolved_time': '2026-06-16T16:40:00Z'},
        ], 'ESCALATION', 'demo-escalations.json')

        alert_batch = alert_result.batch_code
        run_execution_gaps(db, cse_code='CSE-07', ingestion_batch_code=alert_batch)
        run_negative_space(db, cse_code='CSE-07', ingestion_batch_code=alert_batch)
        run_anomaly_analysis(db, cse_code='CSE-07', ingestion_batch_code=alert_batch)
        run_peer_benchmark(db, cse_code='CSE-07', ingestion_batch_code=alert_batch)
        run_attention_score(db, cse_code='CSE-07', ingestion_batch_code=alert_batch)
        run_prioritisation(db, cse_code='CSE-07')
        generate_assessment_report(db, cse_code='CSE-07', assessment_period=PERIOD)
        print('Demo data initialized for CSE-07 and CSE-03 (Q2 2026).')
    finally:
        db.close()


if __name__ == '__main__':
    initialize_demo()
