from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.negative_space.detectors import (
    FindingCandidate,
    detect_ns001,
    detect_ns002,
    detect_ns003,
    detect_ns004,
    detect_ns005,
)
from app.analytics.negative_space.rules import RULE_DEFINITIONS
from app.models.models import (
    Alert,
    AnalyticsRun,
    Asset,
    Case,
    CSEEntity,
    Escalation,
    Finding,
    FindingEvidence,
    IngestionBatch,
    Investigation,
    SupervisoryRule,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _run_code() -> str:
    return f'RUN-NS-{_now():%Y%m%d%H%M%S}-{uuid4().hex[:6].upper()}'


def seed_negative_space_rules(db: Session) -> int:
    inserted = 0
    for rule_code, definition in RULE_DEFINITIONS.items():
        if db.scalar(select(SupervisoryRule).where(SupervisoryRule.rule_code == rule_code)) is None:
            db.add(SupervisoryRule(rule_code=rule_code, name=definition['name'], category='NEGATIVE_SPACE', description=definition['description'], severity=definition['severity'], weight=1.0, enabled=True, parameters_json=definition['parameters']))
            inserted += 1
    if inserted:
        db.flush()
    return inserted


def _records(db: Session, model, cse_id: int, batch_id: int | None = None):
    query = select(model).where(model.cse_id == cse_id)
    if batch_id is not None and hasattr(model, 'ingestion_batch_id'):
        query = query.where(model.ingestion_batch_id == batch_id)
    return db.scalars(query).all()


def run_negative_space(db: Session, *, cse_code: str | None = None, ingestion_batch_code: str | None = None) -> tuple[AnalyticsRun, str, int, int]:
    cse = db.scalar(select(CSEEntity).where(CSEEntity.cse_code == cse_code.upper())) if cse_code else None
    if cse_code and cse is None:
        raise ValueError(f'CSE {cse_code.upper()} does not exist')
    batch = db.scalar(select(IngestionBatch).where(IngestionBatch.batch_code == ingestion_batch_code)) if ingestion_batch_code else None
    if ingestion_batch_code and batch is None:
        raise ValueError(f'Ingestion batch {ingestion_batch_code} does not exist')
    if batch and batch.cse_id and cse and batch.cse_id != cse.id:
        raise ValueError('CSE and ingestion batch scopes do not match')
    scoped_cse_id = cse.id if cse else (batch.cse_id if batch else None)
    if scoped_cse_id is None:
        raise ValueError('A CSE or a CSE-linked ingestion batch is required')
    if batch is None:
        latest_batch = db.scalar(select(IngestionBatch).where(IngestionBatch.cse_id == scoped_cse_id).order_by(IngestionBatch.created_at.desc()))
        batch = latest_batch
    period = batch.assessment_period if batch else None
    if not period:
        raise ValueError('A meaningful assessment period is required; provide an ingestion batch with assessment_period')
    run = AnalyticsRun(run_code=_run_code(), cse_id=scoped_cse_id, ingestion_batch_id=batch.id, run_type='NEGATIVE_SPACE', status='PROCESSING', started_at=_now())
    db.add(run)
    db.flush()
    try:
        seed_negative_space_rules(db)
        rules = db.scalars(select(SupervisoryRule).where(SupervisoryRule.category == 'NEGATIVE_SPACE', SupervisoryRule.enabled.is_(True))).all()
        rule_map = {rule.rule_code: rule for rule in rules}
        batch_id = batch.id
        assets = _records(db, Asset, scoped_cse_id)
        alerts = _records(db, Alert, scoped_cse_id, batch_id)
        cases = _records(db, Case, scoped_cse_id, batch_id)
        investigations = _records(db, Investigation, scoped_cse_id)
        escalations = _records(db, Escalation, scoped_cse_id)
        candidates: list[FindingCandidate] = []
        if 'NS-001' in rule_map:
            candidates.extend(detect_ns001(assets, alerts, period, rule_map['NS-001'].parameters_json or {}))
        if 'NS-002' in rule_map:
            candidates.extend(detect_ns002(alerts, scoped_cse_id, period, rule_map['NS-002'].parameters_json or {}))
        if 'NS-003' in rule_map:
            candidates.extend(detect_ns003(db, alerts, period, rule_map['NS-003'].parameters_json or {}))
        if 'NS-004' in rule_map:
            candidates.extend(detect_ns004(db, alerts, period, rule_map['NS-004'].parameters_json or {}))
        if 'NS-005' in rule_map and alerts == [] and cases == [] and investigations == [] and escalations == []:
            candidates.extend(detect_ns005(scoped_cse_id, alerts, cases, investigations, escalations, period, rule_map['NS-005'].parameters_json or {}))
        findings_created = 0
        for index, candidate in enumerate(candidates, start=1):
            rule = rule_map[candidate.rule_code]
            existing = db.scalar(select(Finding.id).where(Finding.analytics_run_id == run.id, Finding.rule_id == rule.id, Finding.cse_id == candidate.cse_id, Finding.title == candidate.title))
            if existing:
                continue
            finding = Finding(finding_code=f'{candidate.rule_code}-{run.id:05d}-{index:03d}', cse_id=candidate.cse_id, analytics_run_id=run.id, rule_id=rule.id, category='NEGATIVE_SPACE', severity=candidate.severity, title=candidate.title, description=candidate.description, explanation=candidate.explanation, status='OPEN', detected_at=run.started_at)
            db.add(finding)
            db.flush()
            for evidence_index, evidence in enumerate(candidate.evidence, start=1):
                db.add(FindingEvidence(evidence_code=f'EVD-NS-{run.id:05d}-{index:03d}-{evidence_index:02d}', finding_id=finding.id, record_type=evidence.record_type, record_id=evidence.record_id, summary=evidence.summary))
            findings_created += 1
        run.status = 'COMPLETED'
        run.completed_at = _now()
        db.commit()
        return run, period, len(rule_map), findings_created
    except Exception:
        db.rollback()
        failed_run = db.get(AnalyticsRun, run.id)
        if failed_run:
            failed_run.status = 'FAILED'
            failed_run.completed_at = _now()
            db.commit()
        raise
