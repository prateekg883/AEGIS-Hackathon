from collections.abc import Mapping
from typing import Any

from app.ingestion.normalizers import code, enum

REQUIRED_FIELDS = {
    'CSE': ('cse_code', 'name', 'sector', 'criticality', 'assessment_status'),
    'ASSET': ('asset_code', 'cse_code', 'name', 'asset_type', 'criticality', 'expected_monitoring'),
    'ALERT': ('alert_code', 'cse_code', 'severity', 'category', 'title', 'description', 'created_time', 'status'),
    'CASE': ('case_code', 'cse_code', 'title', 'description', 'severity', 'status', 'opened_time'),
    'CASE_ALERT_LINK': ('case_code', 'alert_code'),
    'INVESTIGATION': ('investigation_code', 'case_code', 'cse_code', 'status'),
    'ESCALATION': ('escalation_code', 'case_code', 'cse_code', 'status'),
}

SEVERITIES = {'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE', 'INFO', 'INFORMATIONAL'}
STATUSES = {
    'CSE': {'ASSESSED', 'ACTIVE', 'INACTIVE', 'PENDING'},
    'ASSET': {'ACTIVE', 'INACTIVE'},
    'ALERT': {'OPEN', 'CLOSED', 'ACKNOWLEDGED', 'RESOLVED'},
    'CASE': {'OPEN', 'CLOSED', 'UNDER_REVIEW', 'RESOLVED'},
    'CASE_ALERT_LINK': set(),
    'INVESTIGATION': {'OPEN', 'IN_PROGRESS', 'COMPLETE', 'PARTIAL', 'CLOSED'},
    'ESCALATION': {'OPEN', 'RESOLVED', 'CLOSED'},
}

ALIASES = {
    'cse_code': ('cse_code', 'CSECode', 'cse_id', 'CSE', 'entity', 'entity_id', 'organization', 'org_id', 'cse_name'),
    'asset_code': ('asset_code', 'AssetCode', 'asset_id', 'AssetID', 'device_id', 'host', 'hostname', 'destination', 'target', 'node', 'src_ip', 'source_ip', 'dest_ip', 'destination_ip', 'ip_address', 'server'),
    'alert_code': ('alert_code', 'AlertCode', 'alert_id', 'AlertID', 'record_id', 'RecordID', 'event_id', 'id', 'Id', 'ID', 'threat_id', 'incident_id', 'log_id', 'alert_num'),
    'case_code': ('case_code', 'CaseCode', 'case_id', 'CaseID', 'ticket_id', 'ticket_no', 'incident_no', 'case_no'),
    'investigation_code': ('investigation_code', 'InvestigationCode', 'investigation_id', 'InvestigationID', 'inv_id', 'audit_id'),
    'escalation_code': ('escalation_code', 'EscalationCode', 'escalation_id', 'EscalationID', 'esc_id'),
    'record_type': ('record_type', 'RecordType', 'type', 'Type', 'record'),
    'name': ('name', 'Name', 'asset_name', 'host_name', 'device_name', 'entity_name'),
    'sector': ('sector', 'Sector', 'industry', 'domain'),
    'criticality': ('criticality', 'Criticality', 'priority', 'impact', 'tier'),
    'assessment_status': ('assessment_status', 'AssessmentStatus', 'status', 'Status', 'state'),
    'asset_type': ('asset_type', 'AssetType', 'device_type', 'type', 'category'),
    'expected_monitoring': ('expected_monitoring', 'ExpectedMonitoring', 'monitored', 'is_monitored', 'monitoring'),
    'severity': ('severity', 'Severity', 'triage_priority', 'TriagePriority', 'threat_level', 'priority', 'level', 'Level', 'impact', 'alert_severity'),
    'category': ('category', 'Category', 'attack_cat', 'attack_type', 'event_type', 'signature', 'threat_type', 'classification', 'label'),
    'title': ('title', 'Title', 'alert_name', 'event_name', 'signature_name', 'attack_name', 'rule_name', 'name'),
    'description': ('description', 'Description', 'message', 'details', 'summary', 'info', 'log_message', 'payload', 'notes'),
    'created_time': ('created_time', 'CreatedTime', 'created_at', 'Created', 'timestamp', 'Timestamp', 'datetime', 'time', 'date', 'logged_at', 'event_time'),
    'acknowledged_time': ('acknowledged_time', 'AcknowledgedTime', 'acknowledged_at', 'Acknowledged', 'ack_time'),
    'closed_time': ('closed_time', 'ClosedTime', 'closed_at', 'Closed', 'resolved_at', 'end_time'),
    'status': ('status', 'Status', 'state', 'resolution', 'disposition_status'),
    'disposition': ('disposition', 'Disposition', 'action', 'outcome'),
    'analyst': ('analyst', 'Analyst', 'assigned_to', 'owner', 'operator', 'user'),
    'opened_time': ('opened_time', 'OpenedTime', 'opened_at', 'Opened', 'start_time'),
    'assigned_analyst': ('assigned_analyst', 'AssignedAnalyst', 'analyst', 'Analyst', 'assigned_to', 'owner'),
    'notes': ('notes', 'Notes', 'comments', 'remarks', 'investigation_notes'),
    'started_time': ('started_time', 'StartedTime', 'started_at', 'Started'),
    'completed_time': ('completed_time', 'CompletedTime', 'completed_at', 'Completed'),
    'escalation_level': ('escalation_level', 'EscalationLevel', 'level', 'Level', 'tier'),
    'reason': ('reason', 'Reason', 'justification', 'cause'),
    'escalated_time': ('escalated_time', 'EscalatedTime', 'escalated_at', 'Escalated'),
    'resolved_time': ('resolved_time', 'ResolvedTime', 'resolved_at', 'Resolved'),
}


def infer_record_type(rows: list[Mapping[str, Any]], source_name: str = '') -> str:
    name_lower = source_name.lower()
    if 'asset' in name_lower:
        return 'ASSET'
    if 'case_alert' in name_lower or 'link' in name_lower:
        return 'CASE_ALERT_LINK'
    if 'case' in name_lower:
        return 'CASE'
    if 'escalat' in name_lower:
        return 'ESCALATION'
    if 'investigat' in name_lower:
        return 'INVESTIGATION'
    if 'cse' in name_lower or 'entity' in name_lower:
        return 'CSE'

    if not rows:
        return 'ALERT'

    first_row = {str(k).strip().lower(): v for k, v in rows[0].items()}
    all_keys = set(first_row.keys())

    if any(k in all_keys for k in ('escalation_code', 'escalated_to', 'escalated_time')):
        return 'ESCALATION'
    if any(k in all_keys for k in ('investigation_code', 'notes', 'started_time')):
        return 'INVESTIGATION'
    if 'case_code' in all_keys and 'alert_code' in all_keys and len(all_keys) <= 3:
        return 'CASE_ALERT_LINK'
    if any(k in all_keys for k in ('asset_code', 'asset_type', 'expected_monitoring', 'hostname')):
        return 'ASSET'
    if any(k in all_keys for k in ('case_code', 'ticket_id', 'incident_no', 'opened_time')):
        return 'CASE'
    if 'sector' in all_keys and 'name' in all_keys and 'alert_code' not in all_keys and 'title' not in all_keys:
        return 'CSE'

    # Default for Kaggle security logs, network intrusion datasets, firewall logs
    return 'ALERT'


def canonical_row(row: Mapping[str, Any]) -> dict[str, Any]:
    by_name = {str(key).strip(): value for key, value in row.items()}
    by_name_lower = {str(key).strip().lower(): value for key, value in row.items()}
    result: dict[str, Any] = {}
    for field, aliases in ALIASES.items():
        for alias in aliases:
            if alias in by_name:
                result[field] = by_name[alias]
                break
            elif alias.lower() in by_name_lower:
                result[field] = by_name_lower[alias.lower()]
                break
    return result



def validate_shape(record_type: str, row: Mapping[str, Any], row_number: int) -> list[dict[str, Any]]:
    errors = []
    for field in REQUIRED_FIELDS[record_type]:
        value = row.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            errors.append({'row': row_number, 'field': field, 'error': 'Required field is missing'})
    if record_type != 'CASE_ALERT_LINK' and row.get('severity') is not None and enum(row['severity']) not in SEVERITIES:
        errors.append({'row': row_number, 'field': 'severity', 'error': 'Invalid severity value'})
    if record_type in STATUSES and row.get('status') is not None and enum(row['status']) not in STATUSES[record_type]:
        errors.append({'row': row_number, 'field': 'status', 'error': 'Invalid status value'})
    return errors


def validate_duplicates(record_type: str, rows: list[dict[str, Any]], row_numbers: list[int]) -> list[dict[str, Any]]:
    field = {'CSE': 'cse_code', 'ASSET': 'asset_code', 'ALERT': 'alert_code', 'CASE': 'case_code', 'INVESTIGATION': 'investigation_code', 'ESCALATION': 'escalation_code'}.get(record_type)
    if not field:
        return []
    seen: dict[str, int] = {}
    errors = []
    for row, row_number in zip(rows, row_numbers):
        value = code(row.get(field)) if row.get(field) is not None else ''
        if value and value in seen:
            errors.append({'row': row_number, 'field': field, 'error': f'Duplicate {field} in upload; first seen on row {seen[value]}'})
        elif value:
            seen[value] = row_number
    return errors
