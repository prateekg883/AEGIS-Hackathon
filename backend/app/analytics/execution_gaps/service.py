from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.execution_gaps.detectors import (
    FindingCandidate,
    detect_eg001,
    detect_eg002,
    detect_eg003,
    detect_eg004,
    detect_eg005,
    detect_eg006,
)
from app.analytics.execution_gaps.rules import RULE_DEFINITIONS
from app.models.models import (
    Alert,
    AnalyticsRun,
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


def _code(prefix: str) -> str:
    return f'{prefix}-{_now():%Y%m%d%H%M%S}-{uuid4().hex[:6].upper()}'


def seed_execution_gap_rules(db: Session) -> int:
    inserted = 0
    for rule_code, definition in RULE_DEFINITIONS.items():
        rule = db.scalar(select(SupervisoryRule).where(SupervisoryRule.rule_code == rule_code))
        if rule is None:
            db.add(SupervisoryRule(rule_code=rule_code, name=definition['name'], category='EXECUTION_GAP', description=definition['description'], severity=definition['severity'], weight=definition['weight'], enabled=True, parameters_json=definition['parameters']))
            inserted += 1
    if inserted:
        db.flush()
    return inserted


def _scoped_records(db: Session, model, cse_id: int | None, ingestion_batch_id: int | None):
    query = select(model)
    if cse_id is not None and hasattr(model, 'cse_id'):
        query = query.where(model.cse_id == cse_id)
    if ingestion_batch_id is not None and hasattr(model, 'ingestion_batch_id'):
        query = query.where(model.ingestion_batch_id == ingestion_batch_id)
    return db.scalars(query).all()


def run_execution_gaps(db: Session, *, cse_code: str | None = None, ingestion_batch_code: str | None = None) -> tuple[AnalyticsRun, int, int]:
    started = _now()
    cse = db.scalar(select(CSEEntity).where(CSEEntity.cse_code == cse_code.upper())) if cse_code else None
    if cse_code and cse is None:
        raise ValueError(f'CSE {cse_code.upper()} does not exist')
    batch = db.scalar(select(IngestionBatch).where(IngestionBatch.batch_code == ingestion_batch_code)) if ingestion_batch_code else None
    if ingestion_batch_code and batch is None:
        raise ValueError(f'Ingestion batch {ingestion_batch_code} does not exist')
    if batch and batch.cse_id and cse and batch.cse_id != cse.id:
        raise ValueError('CSE and ingestion batch scopes do not match')
    scoped_cse_id = cse.id if cse else (batch.cse_id if batch else None)
    run = AnalyticsRun(run_code=_code('RUN-EG'), cse_id=scoped_cse_id, ingestion_batch_id=batch.id if batch else None, run_type='EXECUTION_GAP', status='PROCESSING', started_at=started)
    db.add(run)
    db.flush()
    try:
        seed_execution_gap_rules(db)
        rules = db.scalars(select(SupervisoryRule).where(SupervisoryRule.category == 'EXECUTION_GAP', SupervisoryRule.enabled.is_(True))).all()
        rule_map = {rule.rule_code: rule for rule in rules}
        alerts = _scoped_records(db, Alert, scoped_cse_id, batch.id if batch else None)
        investigations = _scoped_records(db, Investigation, scoped_cse_id, None)
        candidates: list[FindingCandidate] = []
        if 'EG-001' in rule_map:
            candidates.extend(detect_eg001(alerts, rule_map['EG-001'].parameters_json or {}))
        if 'EG-002' in rule_map:
            candidates.extend(detect_eg002(db, alerts, rule_map['EG-002'].parameters_json or {}))
        if 'EG-003' in rule_map:
            candidates.extend(detect_eg003(db, alerts))
        if 'EG-004' in rule_map:
            candidates.extend(detect_eg004(db, alerts, rule_map['EG-004'].parameters_json or {}))
        if 'EG-005' in rule_map:
            candidates.extend(detect_eg005(investigations, rule_map['EG-005'].parameters_json or {}))
        if 'EG-006' in rule_map:
            candidates.extend(detect_eg006(db, alerts, investigations, rule_map['EG-006'].parameters_json or {}))
        findings_created = 0
        for index, candidate in enumerate(candidates, start=1):
            existing = db.scalar(select(Finding.id).where(Finding.analytics_run_id == run.id, Finding.rule_id == rule_map[candidate.rule_code].id, Finding.cse_id == candidate.cse_id, Finding.title == candidate.title))
            if existing:
                continue
            finding = Finding(finding_code=f'{candidate.rule_code}-{run.id:05d}-{index:03d}', cse_id=candidate.cse_id, analytics_run_id=run.id, rule_id=rule_map[candidate.rule_code].id, category='EXECUTION_GAP', severity=candidate.severity, title=candidate.title, description=candidate.description, explanation=candidate.explanation, status='OPEN', detected_at=started)
            db.add(finding)
            db.flush()
            for evidence_index, evidence in enumerate(candidate.evidence, start=1):
                db.add(FindingEvidence(evidence_code=f'EVD-EG-{run.id:05d}-{index:03d}-{evidence_index:02d}', finding_id=finding.id, record_type=evidence.record_type, record_id=evidence.record_id, summary=evidence.summary))
            findings_created += 1
        run.status = 'COMPLETED'
        run.completed_at = _now()
        db.commit()
        return run, len(rule_map), findings_created
    except Exception:
        db.rollback()
        failed_run = db.get(AnalyticsRun, run.id)
        if failed_run:
            failed_run.status = 'FAILED'
            failed_run.completed_at = _now()
            db.commit()
        raise
