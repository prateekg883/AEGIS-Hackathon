from datetime import datetime, timezone
from statistics import median
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.anomalies.detectors import MetricSnapshot, detect_closure_anomaly, detect_ratio_anomaly, detect_volume_anomalies
from app.analytics.anomalies.rules import RULE_DEFINITIONS
from app.models.models import Alert, AnalyticsRun, Case, CaseAlertLink, CSEEntity, Finding, FindingEvidence, IngestionBatch, Investigation, SupervisoryRule


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _code(prefix: str) -> str:
    return f'{prefix}-{_now():%Y%m%d%H%M%S}-{uuid4().hex[:6].upper()}'


def seed_anomaly_rules(db: Session) -> int:
    inserted = 0
    for rule_code, definition in RULE_DEFINITIONS.items():
        if db.scalar(select(SupervisoryRule).where(SupervisoryRule.rule_code == rule_code)) is None:
            db.add(SupervisoryRule(rule_code=rule_code, name=definition['name'], category='ANOMALY', description=definition['description'], severity=definition['severity'], weight=1.0, enabled=True, parameters_json=definition['parameters']))
            inserted += 1
    if inserted:
        db.flush()
    return inserted


def _period_batches(db: Session, cse_id: int, period: str | None = None) -> list[IngestionBatch]:
    query = select(IngestionBatch).where(IngestionBatch.cse_id == cse_id)
    if period is not None:
        query = query.where(IngestionBatch.assessment_period == period)
    return db.scalars(query.order_by(IngestionBatch.created_at)).all()


def _batch_ids(batches: list[IngestionBatch]) -> set[int]:
    return {batch.id for batch in batches}


def _metric_set(db: Session, cse_id: int, period: str, batches: list[IngestionBatch]) -> dict[str, float | None]:
    ids = _batch_ids(batches)
    alerts = db.scalars(select(Alert).where(Alert.cse_id == cse_id, Alert.ingestion_batch_id.in_(ids))).all() if ids else []
    cases = db.scalars(select(Case).where(Case.cse_id == cse_id, Case.ingestion_batch_id.in_(ids))).all() if ids else []
    case_ids = {case.id for case in cases}
    investigations = db.scalars(select(Investigation).where(Investigation.cse_id == cse_id, Investigation.case_id.in_(case_ids))).all() if case_ids else []
    alert_ids = {alert.id for alert in alerts}
    escalations = db.scalars(select('Escalation')).all() if False else []
    closed_durations = [(alert.closed_time - alert.created_time).total_seconds() / 60 for alert in alerts if alert.closed_time]
    return {
        'alerts': float(len(alerts)), 'cases': float(len(cases)), 'investigations': float(len(investigations)), 'escalations': float(len(escalations)),
        'alert_to_case_ratio': len(alerts) / len(cases) if cases else float(len(alerts)),
        'median_closure_minutes': median(closed_durations) if closed_durations else None,
        'period': period,
        '_alerts': alerts, '_cases': cases, '_investigations': investigations,
    }


def _find_period(db: Session, cse_id: int, batch: IngestionBatch | None) -> str:
    if batch:
        return batch.assessment_period
    latest = db.scalar(select(IngestionBatch).where(IngestionBatch.cse_id == cse_id).order_by(IngestionBatch.created_at.desc()))
    if latest is None or not latest.assessment_period:
        raise ValueError('A meaningful assessment period is required')
    return latest.assessment_period


def run_anomaly_analysis(db: Session, *, cse_code: str | None = None, ingestion_batch_code: str | None = None) -> tuple[AnalyticsRun, str, int, int, str | None]:
    cse = db.scalar(select(CSEEntity).where(CSEEntity.cse_code == cse_code.upper())) if cse_code else None
    batch = db.scalar(select(IngestionBatch).where(IngestionBatch.batch_code == ingestion_batch_code)) if ingestion_batch_code else None
    if cse_code and cse is None:
        raise ValueError(f'CSE {cse_code.upper()} does not exist')
    if ingestion_batch_code and batch is None:
        raise ValueError(f'Ingestion batch {ingestion_batch_code} does not exist')
    if batch and cse and batch.cse_id != cse.id:
        raise ValueError('CSE and ingestion batch scopes do not match')
    scoped_cse_id = cse.id if cse else (batch.cse_id if batch else None)
    if scoped_cse_id is None:
        raise ValueError('A CSE or CSE-linked ingestion batch is required')
    period = _find_period(db, scoped_cse_id, batch)
    current_batches = [batch] if batch else _period_batches(db, scoped_cse_id, period)
    historical = _period_batches(db, scoped_cse_id)
    current = _metric_set(db, scoped_cse_id, period, current_batches)
    historical_metrics = [_metric_set(db, scoped_cse_id, item.assessment_period, [item]) for item in historical if item.id not in _batch_ids(current_batches)]
    run = AnalyticsRun(run_code=_code('RUN-AN'), cse_id=scoped_cse_id, ingestion_batch_id=batch.id if batch else None, run_type='ANOMALY', status='PROCESSING', started_at=_now())
    db.add(run)
    db.flush()
    try:
        seed_anomaly_rules(db)
        rules = {rule.rule_code: rule for rule in db.scalars(select(SupervisoryRule).where(SupervisoryRule.category == 'ANOMALY', SupervisoryRule.enabled.is_(True))).all()}
        candidates = []
        if 'AN-001' in rules:
            candidates.extend(detect_volume_anomalies(current, historical_metrics, (rules['AN-001'].parameters_json or {}).get('z_score_threshold', 2.0), (rules['AN-001'].parameters_json or {}).get('minimum_history_periods', 2)))
        if 'AN-002' in rules:
            candidate = detect_ratio_anomaly(current['alert_to_case_ratio'], [item['alert_to_case_ratio'] for item in historical_metrics], (rules['AN-002'].parameters_json or {}).get('z_score_threshold', 2.0), (rules['AN-002'].parameters_json or {}).get('minimum_history_periods', 2))
            if candidate:
                candidates.append(candidate)
        if 'AN-003' in rules:
            medians = [item['median_closure_minutes'] for item in historical_metrics if item['median_closure_minutes'] is not None]
            candidate = detect_closure_anomaly(current['median_closure_minutes'], medians, (rules['AN-003'].parameters_json or {}).get('z_score_threshold', 2.0), (rules['AN-003'].parameters_json or {}).get('minimum_history_periods', 2))
            if candidate:
                candidates.append(candidate)
        created = 0
        for index, candidate in enumerate(candidates, start=1):
            finding = Finding(finding_code=f'{candidate.rule_code}-{run.id:05d}-{index:03d}', cse_id=scoped_cse_id, analytics_run_id=run.id, rule_id=rules[candidate.rule_code].id, category='ANOMALY', severity=candidate.severity, title=candidate.title, description=candidate.description, explanation=candidate.explanation, status='OPEN', detected_at=run.started_at)
            db.add(finding)
            db.flush()
            db.add(FindingEvidence(evidence_code=f'EVD-AN-{run.id:05d}-{index:03d}', finding_id=finding.id, record_type='ALERT', record_id='METRIC-CONTEXT', summary=candidate.evidence_summary + f' Assessment period={period}.'))
            created += 1
        run.status = 'COMPLETED'
        run.completed_at = _now()
        db.commit()
        note = 'Insufficient historical baseline; anomaly rules produced no baseline-based finding.' if len(historical_metrics) < 2 else None
        return run, period, len(rules), created, note
    except Exception:
        db.rollback()
        failed = db.get(AnalyticsRun, run.id)
        if failed:
            failed.status = 'FAILED'
            failed.completed_at = _now()
            db.commit()
        raise
