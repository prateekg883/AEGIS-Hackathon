import csv
import io
import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.ingestion.normalizers import boolean, code, enum, number, text, timestamp
from app.ingestion.schemas import IngestionError, IngestionResult
from app.ingestion.validators import canonical_row, infer_record_type, validate_duplicates, validate_shape
from app.models.models import (
    Alert,
    Asset,
    Case,
    CaseAlertLink,
    CSEEntity,
    Escalation,
    IngestionBatch,
    Investigation,
)

RECORD_TYPES = {'CSE', 'ASSET', 'ALERT', 'CASE', 'CASE_ALERT_LINK', 'INVESTIGATION', 'ESCALATION'}


def parse_upload(content: bytes, source_name: str) -> tuple[str, list[dict]]:
    suffix = source_name.lower().rsplit('.', 1)[-1] if '.' in source_name else ''
    text_content = None
    for enc in ('utf-8-sig', 'utf-8', 'latin-1', 'cp1252'):
        try:
            text_content = content.decode(enc)
            break
        except Exception:
            continue
    if text_content is None:
        text_content = content.decode('utf-8', errors='ignore')

    if suffix == 'json':
        try:
            payload = json.loads(text_content)
            if isinstance(payload, dict):
                payload = payload.get('records') or payload.get('data') or [payload]
            if isinstance(payload, list) and all(isinstance(item, dict) for item in payload):
                return 'JSON', payload
        except Exception:
            pass

    if suffix == 'csv':
        try:
            reader = csv.DictReader(io.StringIO(text_content))
            rows = [row for row in reader if any(v and str(v).strip() for v in row.values())]
            if rows:
                return 'CSV', rows
        except Exception:
            pass

    # Universal format detection fallback for XML, XLSX, TSV, TXT, LOG, Syslog, CEF, LEEF, Parquet
    try:
        from app.normalization.detector import detect_format
        from app.normalization.field_mapper import FieldMapper
        fmt_name, parser = detect_format(content, source_name)
        raw_rows = parser.parse(content, source_name)
        if raw_rows:
            mapper = FieldMapper()
            mapped = [mapper.map_record(r, idx)[0] for idx, r in enumerate(raw_rows, 1)]
            return fmt_name, mapped
    except Exception as exc:
        raise ValueError(f"Failed to parse file: {str(exc)}")

    raise ValueError('Unsupported file format or unable to extract structured records')


def _error(row: int, field: str | None, message: str) -> dict:
    return {'row': row, 'field': field, 'error': message}


def _required_cse(db: Session, row: dict, row_number: int) -> tuple[CSEEntity | None, dict | None]:
    cse_code = code(row.get('cse_code')) if row.get('cse_code') else 'CSE-07'
    cse = db.scalar(select(CSEEntity).where(CSEEntity.cse_code == cse_code))
    if cse is None:
        return None, _error(row_number, 'cse_code', f'CSE {cse_code} does not exist')
    return cse, None


def _optional_asset(db: Session, row: dict, cse: CSEEntity, row_number: int) -> tuple[Asset | None, dict | None]:
    asset_code = code(row.get('asset_code')) if row.get('asset_code') else None
    if not asset_code:
        return None, None
    asset = db.scalar(select(Asset).where(Asset.asset_code == asset_code))
    if asset is None:
        try:
            asset = Asset(
                asset_code=asset_code,
                cse_id=cse.id,
                name=f'Node {asset_code}',
                asset_type='SERVER',
                criticality='HIGH',
                expected_monitoring=True,
            )
            db.add(asset)
            db.flush()
            return asset, None
        except Exception:
            return None, None
    if asset.cse_id != cse.id:
        return None, _error(row_number, 'asset_code', f'Asset {asset_code} belongs to another CSE')
    return asset, None


def _domain_exists(db: Session, model, field: str, value: str) -> bool:
    return db.scalar(select(model.id).where(getattr(model, field) == value)) is not None


def _parse_value(row: dict, field: str, converter, row_number: int, *, optional: bool = False):
    value = row.get(field)
    if optional and (value is None or (isinstance(value, str) and not value.strip())):
        return None, None
    try:
        return converter(value), None
    except (TypeError, ValueError):
        return None, _error(row_number, field, f'Invalid {field} value')


def _auto_fill_kaggle_fields(record_type: str, row: dict, row_number: int) -> dict:
    row = dict(row)
    if not row.get('cse_code'):
        asset = str(row.get('asset_code') or row.get('destination') or '').upper()
        if asset.startswith('EN-') or 'HIST' in asset or 'SCADA' in asset or 'GRID' in asset:
            row['cse_code'] = 'CSE-07'
        elif asset.startswith('TR-') or 'TRANS' in asset or 'RAIL' in asset:
            row['cse_code'] = 'CSE-03'
        elif asset.startswith('PL-') or asset.startswith('IC-') or 'PLC' in asset:
            row['cse_code'] = 'CSE-05'
        elif asset.startswith('172.16.5') or asset.startswith('FIN-') or 'BANK' in asset:
            row['cse_code'] = 'CSE-02'
        elif asset.startswith('10.0.1') or asset.startswith('TEL-') or 'COMM' in asset:
            row['cse_code'] = 'CSE-01'
        else:
            row['cse_code'] = 'CSE-07'

    if record_type == 'ALERT':
        if not row.get('alert_code'):
            row['alert_code'] = f'ALT-KAG-{row_number}-{uuid4().hex[:4].upper()}'
        
        raw_sev = str(row.get('severity') or '').upper()
        if raw_sev in ('NONE', 'INFO', 'INFORMATIONAL', 'BENIGN', ''):
            row['severity'] = 'LOW'
        elif 'CRIT' in raw_sev:
            row['severity'] = 'CRITICAL'
        elif 'HIGH' in raw_sev:
            row['severity'] = 'HIGH'
        elif 'MED' in raw_sev:
            row['severity'] = 'MEDIUM'
        elif 'LOW' in raw_sev:
            row['severity'] = 'LOW'
        else:
            row['severity'] = 'HIGH'

        if not row.get('category'):
            row['category'] = 'TELEMETRY'
        if not row.get('title'):
            row['title'] = row.get('description') or f'Telemetry Event {row["alert_code"]}'
        if not row.get('description'):
            row['description'] = row.get('title') or 'Automated telemetry ingestion record.'
        if not row.get('created_time'):
            row['created_time'] = datetime.now(timezone.utc).isoformat()
        if not row.get('status'):
            row['status'] = 'OPEN'
    elif record_type == 'ASSET':
        if not row.get('asset_code'):
            row['asset_code'] = f'EN-NODE-{row_number}'
        if not row.get('name'):
            row['name'] = f'Infrastructure Node {row["asset_code"]}'
        if not row.get('asset_type'):
            row['asset_type'] = 'SERVER'
        if not row.get('criticality'):
            row['criticality'] = 'HIGH'
        if not row.get('expected_monitoring'):
            row['expected_monitoring'] = 'true'
    elif record_type == 'CASE':
        if not row.get('case_code'):
            row['case_code'] = f'CASE-KAG-{row_number}'
        if not row.get('title'):
            row['title'] = f'Incident Triage {row["case_code"]}'
        if not row.get('description'):
            row['description'] = 'Operational incident triage case.'
        if not row.get('severity'):
            row['severity'] = 'HIGH'
        if not row.get('status'):
            row['status'] = 'OPEN'
        if not row.get('opened_time'):
            row['opened_time'] = datetime.now(timezone.utc).isoformat()
    return row


def _create_record(db: Session, record_type: str, row: dict, row_number: int):
    if record_type == 'CSE':
        cse_code = code(row['cse_code'])
        if _domain_exists(db, CSEEntity, 'cse_code', cse_code):
            return None, _error(row_number, 'cse_code', f'CSE {cse_code} already exists')
        return CSEEntity(cse_code=cse_code, name=text(row['name']), sector=text(row['sector']), criticality=enum(row['criticality']), assessment_status=enum(row['assessment_status'])), None

    if record_type == 'CASE_ALERT_LINK':
        case_code, alert_code = code(row['case_code']), code(row['alert_code'])
        case = db.scalar(select(Case).where(Case.case_code == case_code))
        alert = db.scalar(select(Alert).where(Alert.alert_code == alert_code))
        if case is None:
            return None, _error(row_number, 'case_code', f'Case {case_code} does not exist')
        if alert is None:
            return None, _error(row_number, 'alert_code', f'Alert {alert_code} does not exist')
        if db.scalar(select(CaseAlertLink.id).where(CaseAlertLink.case_id == case.id, CaseAlertLink.alert_id == alert.id)):
            return None, _error(row_number, 'case_code', 'Case-alert relationship already exists')
        return CaseAlertLink(case_id=case.id, alert_id=alert.id), None

    cse, issue = _required_cse(db, row, row_number)
    if issue:
        return None, issue

    if record_type == 'ASSET':
        asset_code = code(row['asset_code'])
        if _domain_exists(db, Asset, 'asset_code', asset_code):
            return None, _error(row_number, 'asset_code', f'Asset {asset_code} already exists')
        expected, issue = _parse_value(row, 'expected_monitoring', boolean, row_number)
        if issue:
            return None, issue
        return Asset(asset_code=asset_code, cse_id=cse.id, name=text(row['name']), asset_type=text(row['asset_type']), criticality=enum(row['criticality']), expected_monitoring=expected), None

    if record_type == 'ALERT':
        alert_code = code(row['alert_code'])
        if _domain_exists(db, Alert, 'alert_code', alert_code):
            return None, _error(row_number, 'alert_code', f'Alert {alert_code} already exists')
        asset, issue = _optional_asset(db, row, cse, row_number)
        if issue:
            return None, issue
        values = {}
        for field in ('created_time', 'acknowledged_time', 'closed_time'):
            values[field], issue = _parse_value(row, field, timestamp, row_number, optional=field != 'created_time')
            if issue:
                return None, issue
        return Alert(alert_code=alert_code, cse_id=cse.id, asset_id=asset.id if asset else None, severity=enum(row['severity']), category=text(row['category']), title=text(row['title']), description=text(row['description']), status=enum(row['status']), disposition=text(row.get('disposition'), null=True), analyst=text(row.get('analyst'), null=True), **values), None

    if record_type == 'CASE':
        case_code = code(row['case_code'])
        if _domain_exists(db, Case, 'case_code', case_code):
            return None, _error(row_number, 'case_code', f'Case {case_code} already exists')
        opened, issue = _parse_value(row, 'opened_time', timestamp, row_number)
        if issue:
            return None, issue
        closed, issue = _parse_value(row, 'closed_time', timestamp, row_number, optional=True)
        if issue:
            return None, issue
        return Case(case_code=case_code, cse_id=cse.id, title=text(row['title']), description=text(row['description']), severity=enum(row['severity']), status=enum(row['status']), opened_time=opened, closed_time=closed, assigned_analyst=text(row.get('assigned_analyst'), null=True)), None

    if record_type == 'INVESTIGATION':
        investigation_code = code(row['investigation_code'])
        if _domain_exists(db, Investigation, 'investigation_code', investigation_code):
            return None, _error(row_number, 'investigation_code', f'Investigation {investigation_code} already exists')
        case = db.scalar(select(Case).where(Case.case_code == code(row['case_code'])))
        if case is None:
            return None, _error(row_number, 'case_code', f'Case {code(row["case_code"])} does not exist')
        if case.cse_id != cse.id:
            return None, _error(row_number, 'case_code', f'Case {case.case_code} belongs to another CSE')
        values = {}
        for field in ('started_time', 'completed_time'):
            values[field], issue = _parse_value(row, field, timestamp, row_number, optional=True)
            if issue:
                return None, issue
        return Investigation(investigation_code=investigation_code, case_id=case.id, cse_id=cse.id, status=enum(row['status']), analyst=text(row.get('analyst'), null=True), notes=text(row.get('notes'), null=True), **values), None

    if record_type == 'ESCALATION':
        escalation_code = code(row['escalation_code'])
        if _domain_exists(db, Escalation, 'escalation_code', escalation_code):
            return None, _error(row_number, 'escalation_code', f'Escalation {escalation_code} already exists')
        case = db.scalar(select(Case).where(Case.case_code == code(row['case_code'])))
        if case is None:
            return None, _error(row_number, 'case_code', f'Case {code(row["case_code"])} does not exist')
        alert = None
        if row.get('alert_code'):
            alert = db.scalar(select(Alert).where(Alert.alert_code == code(row['alert_code'])))
            if alert is None:
                return None, _error(row_number, 'alert_code', f'Alert {code(row["alert_code"])} does not exist')
        values = {}
        for field in ('escalated_time', 'resolved_time'):
            values[field], issue = _parse_value(row, field, timestamp, row_number, optional=True)
            if issue:
                return None, issue
        return Escalation(escalation_code=escalation_code, case_id=case.id, alert_id=alert.id if alert else None, cse_id=cse.id, status=enum(row['status']), escalation_level=enum(row.get('escalation_level')) if row.get('escalation_level') else None, reason=text(row.get('reason'), null=True), **values), None


    return None, _error(row_number, 'record_type', 'Unsupported record type')


def ingest_records(db: Session, *, records: list[dict], record_type: str, source_type: str, source_name: str, assessment_period: str) -> IngestionResult:
    record_type = (record_type or 'AUTO').upper()
    if record_type in {'AUTO', 'AUTO_DETECT', 'UNKNOWN', ''}:
        record_type = infer_record_type(records, source_name)

    batch_code = f'BATCH-{datetime.now(timezone.utc):%Y%m%d%H%M%S}-{uuid4().hex[:6].upper()}'
    batch = IngestionBatch(batch_code=batch_code, cse_id=None, source_type=source_type, source_name=source_name, assessment_period=assessment_period, record_count=len(records), status='PROCESSING')
    db.add(batch)
    errors: list[dict] = []
    normalized_rows = []
    row_numbers = []
    if record_type not in RECORD_TYPES:
        record_type = 'ALERT'

    for index, raw in enumerate(records, start=2):
        row = canonical_row(raw)
        row = _auto_fill_kaggle_fields(record_type, row, index)
        shape_errors = validate_shape(record_type, row, index) if record_type in RECORD_TYPES else []
        errors.extend(shape_errors)
        if not shape_errors:
            normalized_rows.append(row)
            row_numbers.append(index)
    errors.extend(validate_duplicates(record_type, normalized_rows, row_numbers))
    invalid_rows = {item['row'] for item in errors}
    accepted = 0
    try:
        for row, row_number in zip(normalized_rows, row_numbers):
            if row_number in invalid_rows:
                continue
            entity, issue = _create_record(db, record_type, row, row_number)
            if issue:
                errors.append(issue)
                continue
            db.add(entity)
            db.flush()
            if batch.cse_id is None and record_type != 'CSE' and hasattr(entity, 'cse_id'):
                batch.cse_id = entity.cse_id
            accepted += 1
        batch.status = 'COMPLETED' if not errors else ('PARTIAL' if accepted else 'FAILED')
        batch.ingested_at = datetime.now(timezone.utc)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        failed_batch = IngestionBatch(batch_code=batch_code, source_type=source_type, source_name=source_name, assessment_period=assessment_period, record_count=len(records), status='FAILED', ingested_at=datetime.now(timezone.utc))
        db.add(failed_batch)
        db.commit()
        errors.append(_error(0, None, 'Database persistence failed; no records were committed'))
        accepted = 0
        batch = failed_batch
    return IngestionResult(batch_code=batch_code, status=batch.status, record_type=record_type, total_records=len(records), accepted_records=accepted, rejected_records=len(records) - accepted, errors=[IngestionError(**item) for item in errors])


def failed_upload_result(db: Session, *, record_type: str, source_type: str, source_name: str, assessment_period: str, message: str) -> IngestionResult:
    batch_code = f'BATCH-{datetime.now(timezone.utc):%Y%m%d%H%M%S}-{uuid4().hex[:6].upper()}'
    batch = IngestionBatch(batch_code=batch_code, source_type=source_type, source_name=source_name, assessment_period=assessment_period, record_count=0, status='FAILED', ingested_at=datetime.now(timezone.utc))
    db.add(batch)
    db.commit()
    return IngestionResult(batch_code=batch_code, status='FAILED', record_type=record_type.upper(), total_records=0, accepted_records=0, rejected_records=0, errors=[IngestionError(row=0, field=None, error=message)])
