from datetime import datetime, timezone
from statistics import mean, median
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.peer_benchmark.rules import RULE_DEFINITIONS
from app.models.models import Alert, AnalyticsRun, Case, CSEEntity, Escalation, Finding, FindingEvidence, IngestionBatch, Investigation, PeerMetric, SupervisoryRule


def _now(): return datetime.now(timezone.utc)
def _code(): return f'RUN-PB-{_now():%Y%m%d%H%M%S}-{uuid4().hex[:6].upper()}'

def seed_peer_rules(db: Session) -> int:
    count = 0
    for code, item in RULE_DEFINITIONS.items():
        if db.scalar(select(SupervisoryRule).where(SupervisoryRule.rule_code == code)) is None:
            db.add(SupervisoryRule(rule_code=code, name=item['name'], category='PEER_DEVIATION', description=item['description'], severity=item['severity'], weight=1.0, enabled=True, parameters_json=item['parameters'])); count += 1
    if count: db.flush()
    return count

def _metrics(db, cse_id, batch_id):
    alerts = db.scalars(select(Alert).where(Alert.cse_id == cse_id, Alert.ingestion_batch_id == batch_id)).all()
    cases = db.scalars(select(Case).where(Case.cse_id == cse_id, Case.ingestion_batch_id == batch_id)).all()
    case_ids = {case.id for case in cases}
    investigations = db.scalars(select(Investigation).where(Investigation.cse_id == cse_id, Investigation.case_id.in_(case_ids))).all() if case_ids else []
    escalations = db.scalars(select(Escalation).where(Escalation.cse_id == cse_id, Escalation.case_id.in_(case_ids))).all() if case_ids else []
    return {'alerts': float(len(alerts)), 'cases': float(len(cases)), 'investigations': float(len(investigations)), 'escalations': float(len(escalations)), 'alert_to_case_ratio': len(alerts) / len(cases) if cases else float(len(alerts))}

def run_peer_benchmark(db: Session, *, cse_code: str | None = None, ingestion_batch_code: str | None = None):
    cse = db.scalar(select(CSEEntity).where(CSEEntity.cse_code == cse_code.upper())) if cse_code else None
    batch = db.scalar(select(IngestionBatch).where(IngestionBatch.batch_code == ingestion_batch_code)) if ingestion_batch_code else None
    if cse_code and cse is None: raise ValueError(f'CSE {cse_code.upper()} does not exist')
    if ingestion_batch_code and batch is None: raise ValueError(f'Ingestion batch {ingestion_batch_code} does not exist')
    scoped_id = cse.id if cse else (batch.cse_id if batch else None)
    if scoped_id is None: raise ValueError('A CSE or CSE-linked ingestion batch is required')
    if batch is None: batch = db.scalar(select(IngestionBatch).where(IngestionBatch.cse_id == scoped_id).order_by(IngestionBatch.created_at.desc()))
    if batch is None or not batch.assessment_period: raise ValueError('A meaningful assessment period is required')
    peer_batches = db.scalars(select(IngestionBatch).where(IngestionBatch.assessment_period == batch.assessment_period, IngestionBatch.cse_id.is_not(None))).all()
    grouped = {item.cse_id: _metrics(db, item.cse_id, item.id) for item in peer_batches}
    if scoped_id not in grouped: grouped[scoped_id] = _metrics(db, scoped_id, batch.id)
    run = AnalyticsRun(run_code=_code(), cse_id=scoped_id, ingestion_batch_id=batch.id, run_type='PEER_BENCHMARK', status='PROCESSING', started_at=_now()); db.add(run); db.flush()
    try:
        seed_peer_rules(db); rule = db.scalar(select(SupervisoryRule).where(SupervisoryRule.rule_code == 'PB-001', SupervisoryRule.enabled.is_(True)))
        peers = [metrics for entity, metrics in grouped.items() if entity != scoped_id]
        values = grouped[scoped_id]; created = 0
        for metric in ('alerts', 'cases', 'investigations', 'escalations', 'alert_to_case_ratio'):
            value = values[metric]; peer_values = [item[metric] for item in peers]
            if not peer_values: continue
            average, med = mean(peer_values), median(peer_values); deviation = value - med; ratio = abs(deviation) / max(abs(med), 1)
            percentile = 100 * sum(peer_value <= value for peer_value in peer_values) / len(peer_values)
            db.add(PeerMetric(cse_id=scoped_id, analytics_run_id=run.id, metric_name=metric, entity_value=value, peer_average=average, peer_median=med, percentile=percentile, deviation=deviation, unit='count' if metric in {'alerts','cases','investigations','escalations'} else 'ratio', assessment_period=batch.assessment_period));
            if rule and ratio >= (rule.parameters_json or {}).get('deviation_ratio', .5):
                finding = Finding(finding_code=f'PB-001-{run.id:05d}-{created+1:03d}', cse_id=scoped_id, analytics_run_id=run.id, rule_id=rule.id, category='PEER_DEVIATION', severity='MEDIUM', title='Submitted activity deviates materially from the peer baseline', description=f'{metric} differs from comparable CSEs in {batch.assessment_period}.', explanation=f'For {batch.assessment_period}, the entity value for {metric} is {value:g}; peer average is {average:.2f} and peer median is {med:.2f}. Deviation is {deviation:.2f}. This may warrant supervisory review and is not a compliance conclusion.', status='OPEN', detected_at=run.started_at); db.add(finding); db.flush(); db.add(FindingEvidence(evidence_code=f'EVD-PB-{run.id:05d}-{created+1:03d}', finding_id=finding.id, record_type='PEER_METRIC', record_id=metric, summary=f'Assessment period={batch.assessment_period}; entity={value:g}; peer average={average:.2f}; peer median={med:.2f}; deviation={deviation:.2f}.')); created += 1
        run.status='COMPLETED'; run.completed_at=_now(); db.commit(); return run, batch.assessment_period, 1, created, len(peers)
    except Exception:
        db.rollback(); failed=db.get(AnalyticsRun, run.id)
        if failed: failed.status='FAILED'; failed.completed_at=_now(); db.commit()
        raise
