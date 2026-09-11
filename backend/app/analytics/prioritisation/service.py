from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.models import AnalyticsRun, AttentionScore, CSEEntity, Finding, FindingEvidence, IngestionBatch, PrioritisedSample

SEVERITY_WEIGHT = {'LOW': 1.0, 'MEDIUM': 2.0, 'HIGH': 3.0, 'CRITICAL': 4.0}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def priority_level(score: float) -> str:
    score = float(score)
    if score >= 85:
        return 'CRITICAL'
    if score >= 70:
        return 'HIGH'
    if score >= 45:
        return 'MODERATE'
    return 'LOW'


def _record_evidence(db: Session, cse_id: int):
    findings = db.scalars(
        select(Finding)
        .where(Finding.cse_id == cse_id, Finding.status != 'RESOLVED')
        .order_by(Finding.score_contribution.desc().nullslast(), Finding.detected_at.desc())
    ).all()
    if not findings:
        return []
    evidence_items = db.scalars(
        select(FindingEvidence)
        .where(FindingEvidence.finding_id.in_([finding.id for finding in findings]))
        .order_by(FindingEvidence.created_at.desc())
    ).all()
    return findings, evidence_items


def _build_reason(signal_names: list[str], record_type: str, record_id: str, attention_total: float | None) -> str:
    unique_signals = sorted(set(signal_names))
    if len(unique_signals) > 1:
        signal_text = ', '.join(unique_signals)
        context = 'multiple analytical signals'
        base = f'{record_type.title()} {record_id} is recommended for review because it is linked to {context}: {signal_text}.'
    else:
        signal_text = unique_signals[0] if unique_signals else 'supervisory signal'
        base = f'{record_type.title()} {record_id} is recommended for review because it matches {signal_text.lower()} evidence.'
    if attention_total is not None:
        return f'{base} Current attention score for this CSE is {attention_total:.1f}, which reinforces the review priority.'
    return base


def run_prioritisation(db: Session, *, cse_code: str, ingestion_batch_code: str | None = None) -> tuple[AnalyticsRun, list[PrioritisedSample]]:
    cse = db.scalar(select(CSEEntity).where(CSEEntity.cse_code == cse_code.upper()))
    if cse is None:
        raise ValueError(f'CSE {cse_code.upper()} does not exist')

    batch = None
    if ingestion_batch_code:
        batch = db.scalar(select(IngestionBatch).where(IngestionBatch.batch_code == ingestion_batch_code.upper()))
        if batch is None:
            raise ValueError(f'Ingestion batch {ingestion_batch_code.upper()} does not exist')

    run = AnalyticsRun(
        run_code=f'RUN-PRIO-{_now():%Y%m%d%H%M%S}-{uuid4().hex[:6].upper()}',
        cse_id=cse.id,
        ingestion_batch_id=batch.id if batch else None,
        run_type='PRIORITISATION',
        status='PROCESSING',
        started_at=_now(),
    )
    db.add(run)
    db.flush()

    try:
        existing = db.scalars(select(PrioritisedSample).where(PrioritisedSample.cse_id == cse.id)).all()
        for sample in existing:
            db.delete(sample)

        record_data = _record_evidence(db, cse.id)
        if not record_data:
            run.status = 'COMPLETED'
            run.completed_at = _now()
            db.commit()
            return run, []

        findings, evidence_items = record_data
        if not findings or not evidence_items:
            run.status = 'COMPLETED'
            run.completed_at = _now()
            db.commit()
            return run, []

        attention_score = db.scalar(
            select(AttentionScore)
            .where(AttentionScore.cse_id == cse.id)
            .order_by(AttentionScore.calculated_at.desc(), AttentionScore.id.desc())
        )
        attention_total = float(attention_score.total_score) if attention_score else None

        records: dict[tuple[str, str], dict] = {}
        for finding in findings:
            for evidence in [item for item in evidence_items if item.finding_id == finding.id]:
                key = (evidence.record_type.upper(), evidence.record_id)
                bucket = records.setdefault(
                    key,
                    {
                        'record_type': evidence.record_type.upper(),
                        'record_id': evidence.record_id,
                        'signal_names': [],
                        'severity': 'LOW',
                        'evidence_count': 0,
                        'score_total': 0.0,
                    },
                )
                bucket['signal_names'].append(finding.category)
                bucket['evidence_count'] += 1
                bucket['score_total'] += float(finding.score_contribution or 0)
                if SEVERITY_WEIGHT.get(finding.severity.upper(), 0.0) > SEVERITY_WEIGHT.get(bucket['severity'].upper(), 0.0):
                    bucket['severity'] = finding.severity.upper()

        samples: list[PrioritisedSample] = []
        for key, record in sorted(records.items(), key=lambda item: item[1]['score_total'], reverse=True):
            record_type, record_id = key
            signal_names = record['signal_names']
            severity_weight = SEVERITY_WEIGHT.get(record['severity'], 1.0)
            signal_count = len(set(signal_names))
            evidence_weight = min(20.0, record['evidence_count'] * 10.0)
            attention_component = (attention_total / 100.0) * 20.0 if attention_total is not None else 0.0
            score = min(100.0, 15.0 + severity_weight * 18.0 + signal_count * 12.0 + evidence_weight + (record['score_total'] * 0.35) + attention_component)
            sample = PrioritisedSample(
                cse_id=cse.id,
                analytics_run_id=run.id,
                rank=0,
                record_type=record_type,
                record_id=record_id,
                priority_score=float(round(score, 2)),
                severity=record['severity'],
                reason=_build_reason(signal_names, record_type, record_id, attention_total),
                review_status='PENDING_REVIEW',
            )
            samples.append(sample)

        samples.sort(key=lambda item: item.priority_score, reverse=True)
        for index, sample in enumerate(samples, start=1):
            sample.rank = index

        db.add_all(samples)
        run.status = 'COMPLETED'
        run.completed_at = _now()
        db.commit()
        return run, samples
    except Exception:
        db.rollback()
        failed = db.get(AnalyticsRun, run.id)
        if failed is not None:
            failed.status = 'FAILED'
            failed.completed_at = _now()
            db.commit()
        raise
