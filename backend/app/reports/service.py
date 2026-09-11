from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.models import AssessmentReport, AttentionScore, AuditLog, CSEEntity, Finding, FindingEvidence, IngestionBatch, PeerMetric, PrioritisedSample


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _report_code(cse_code: str, assessment_period: str) -> str:
    stamp = assessment_period.upper().replace(' ', '-')
    return f'RPT-{cse_code.upper()}-{stamp}-{uuid4().hex[:6].upper()}'


def _filter_period(records: list[Any], assessment_period: str | None) -> list[Any]:
    if not assessment_period:
        return records
    return [item for item in records if getattr(item, 'assessment_period', None) == assessment_period]


def _summarise_findings(db: Session, cse_id: int, category: str) -> list[dict[str, Any]]:
    findings = db.scalars(
        select(Finding)
        .where(Finding.cse_id == cse_id, Finding.category == category, Finding.status != 'RESOLVED')
        .order_by(Finding.score_contribution.desc().nullslast(), Finding.detected_at.desc())
    ).all()
    rows: list[dict[str, Any]] = []
    for finding in findings:
        rows.append({
            'finding_code': finding.finding_code,
            'title': finding.title,
            'severity': finding.severity,
            'description': finding.description,
            'status': finding.status,
            'score_contribution': float(finding.score_contribution) if finding.score_contribution is not None else None,
            'evidence_count': len(finding.evidence),
            'record_links': [
                {'record_type': evidence.record_type, 'record_id': evidence.record_id, 'evidence_code': evidence.evidence_code}
                for evidence in finding.evidence
            ],
        })
    return rows


def _serialise_peer_metrics(db: Session, cse_id: int, assessment_period: str) -> list[dict[str, Any]]:
    metrics = db.scalars(
        select(PeerMetric)
        .where(PeerMetric.cse_id == cse_id)
        .order_by(PeerMetric.created_at.desc())
    ).all()
    if assessment_period:
        metrics = [item for item in metrics if item.assessment_period == assessment_period]
    rows: list[dict[str, Any]] = []
    for metric in metrics[:5]:
        rows.append({
            'metric_name': metric.metric_name,
            'entity_value': float(metric.entity_value),
            'peer_average': float(metric.peer_average) if metric.peer_average is not None else None,
            'peer_median': float(metric.peer_median) if metric.peer_median is not None else None,
            'percentile': float(metric.percentile) if metric.percentile is not None else None,
            'deviation': float(metric.deviation) if metric.deviation is not None else None,
            'unit': metric.unit,
        })
    return rows


def _serialise_priority_samples(db: Session, cse_id: int) -> list[dict[str, Any]]:
    samples = db.scalars(
        select(PrioritisedSample)
        .where(PrioritisedSample.cse_id == cse_id)
        .order_by(PrioritisedSample.rank.asc())
    ).all()
    return [{
        'rank': sample.rank,
        'record_type': sample.record_type,
        'record_id': sample.record_id,
        'priority_score': float(sample.priority_score),
        'severity': sample.severity,
        'reason': sample.reason,
        'review_status': sample.review_status,
    } for sample in samples[:5]]


def _report_summary(cse: CSEEntity, assessment_period: str, attention_level: str, total_score: float, findings_count: int) -> str:
    return (
        f'{cse.cse_code} for {assessment_period} shows {attention_level} supervisory attention '
        f'with a total score of {total_score:.1f} and {findings_count} active analytical findings. '
        f'This report is designed to support human review and is not a compliance verdict.'
    )


def _store_report(db: Session, cse: CSEEntity, period: str, payload: dict[str, Any]) -> AssessmentReport:
    existing = db.scalar(
        select(AssessmentReport)
        .where(AssessmentReport.cse_id == cse.id, AssessmentReport.assessment_period == period)
        .order_by(AssessmentReport.created_at.desc())
    )
    if existing is not None:
        existing.title = payload['title']
        existing.status = 'GENERATED'
        existing.summary = payload['summary']
        existing.generated_at = _now()
        db.flush()
        return existing

    item = AssessmentReport(
        report_code=_report_code(cse.cse_code, period),
        cse_id=cse.id,
        analytics_run_id=payload.get('analytics_run_id'),
        assessment_period=period,
        title=payload['title'],
        status='GENERATED',
        summary=payload['summary'],
        generated_at=_now(),
    )
    db.add(item)
    db.flush()
    return item


def _report_payload(db: Session, report: AssessmentReport) -> dict[str, Any]:
    cse = report.cse
    findings = db.scalars(select(Finding).where(Finding.cse_id == cse.id, Finding.status != 'RESOLVED')).all()
    attention = db.scalar(
        select(AttentionScore)
        .where(AttentionScore.cse_id == cse.id)
        .order_by(AttentionScore.calculated_at.desc(), AttentionScore.id.desc())
    )
    peer_metrics = _serialise_peer_metrics(db, cse.id, report.assessment_period)
    samples = _serialise_priority_samples(db, cse.id)
    evidence_count = sum(len(finding.evidence) for finding in findings)
    data_limitations = []
    if not peer_metrics:
        data_limitations.append('Insufficient submitted data for peer comparison; peer context remains unavailable.')
    if not any(item['category'] == 'NEGATIVE_SPACE' for item in [{'category': finding.category} for finding in findings]):
        data_limitations.append('Insufficient submitted data for negative-space review; the current submitted dataset does not include that analytical dimension.')
    if not evidence_count:
        data_limitations.append('No evidence records were linked to the current findings; traceability remains limited.')
    manual_verification_areas = [
        'Verify that all execution-gap findings reflect complete alert lifecycle records before drawing a conclusion.',
        'Confirm that negative-space observations represent genuine omissions rather than intake gaps.',
        'Review prioritised samples with the human supervisor before actioning any operational conclusion.',
    ]

    payload = {
        'report_id': report.id,
        'report_code': report.report_code,
        'cse_code': cse.cse_code,
        'assessment_period': report.assessment_period,
        'title': report.title,
        'report_status': report.status,
        'summary': report.summary,
        'assessment_scope': {
            'entity_name': cse.name,
            'sector': cse.sector,
            'criticality': cse.criticality,
            'assessment_status': cse.assessment_status,
        },
        'supervisory_attention': {
            'attention_level': attention.attention_level if attention else 'LOW',
            'total_score': float(attention.total_score) if attention else 0.0,
            'execution_gap_score': float(attention.execution_gap_score) if attention else 0.0,
            'negative_space_score': float(attention.negative_space_score) if attention else 0.0,
            'anomaly_score': float(attention.anomaly_score) if attention else 0.0,
            'peer_deviation_score': float(attention.peer_deviation_score) if attention else 0.0,
            'source': 'attention_score' if attention else 'unavailable',
        },
        'execution_gap_observations': _summarise_findings(db, cse.id, 'EXECUTION_GAP'),
        'negative_space_observations': _summarise_findings(db, cse.id, 'NEGATIVE_SPACE'),
        'peer_benchmarking': peer_metrics,
        'priority_manual_review_samples': samples,
        'evidence_traceability': bool(evidence_count),
        'manual_verification_areas': manual_verification_areas,
        'data_limitations': data_limitations or ['No material data limitations were identified in the submitted records.'],
    }
    return payload


def generate_assessment_report(db: Session, *, cse_code: str, assessment_period: str | None = None) -> dict[str, Any]:
    cse = db.scalar(select(CSEEntity).where(CSEEntity.cse_code == cse_code.upper()))
    if cse is None:
        raise ValueError(f'CSE {cse_code.upper()} does not exist')

    latest_batch = db.scalar(
        select(IngestionBatch)
        .where(IngestionBatch.cse_id == cse.id)
        .order_by(IngestionBatch.created_at.desc())
    )
    period = assessment_period or (latest_batch.assessment_period if latest_batch and latest_batch.assessment_period else 'Q4 2026')

    findings = db.scalars(select(Finding).where(Finding.cse_id == cse.id, Finding.status != 'RESOLVED')).all()
    attention = db.scalar(
        select(AttentionScore)
        .where(AttentionScore.cse_id == cse.id)
        .order_by(AttentionScore.calculated_at.desc(), AttentionScore.id.desc())
    )
    title = f'{cse.cse_code} supervisory assessment report - {period}'
    process_payload = {
        'title': title,
        'summary': _report_summary(cse, period, (attention.attention_level if attention else 'LOW'), float(attention.total_score) if attention else 0.0, len(findings)),
        'analytics_run_id': attention.analytics_run_id if attention else None,
    }
    report = _store_report(db, cse, period, process_payload)
    payload = _report_payload(db, report)
    db.add(AuditLog(
        action='REPORT_GENERATED',
        entity_type='assessment_report',
        entity_id=report.report_code,
        details_json={'cse_code': cse.cse_code, 'assessment_period': period, 'attention_level': payload['supervisory_attention']['attention_level']},
        created_at=_now(),
    ))
    db.commit()
    return payload


def list_assessment_reports(db: Session, *, cse_code: str | None = None) -> list[dict[str, Any]]:
    query = select(AssessmentReport)
    if cse_code:
        cse = db.scalar(select(CSEEntity).where(CSEEntity.cse_code == cse_code.upper()))
        if cse is None:
            return []
        query = query.where(AssessmentReport.cse_id == cse.id)
    rows = db.scalars(query.order_by(AssessmentReport.created_at.desc())).all()
    return [{
        'report_id': row.id,
        'report_code': row.report_code,
        'cse_code': row.cse.cse_code if row.cse else 'UNKNOWN',
        'assessment_period': row.assessment_period,
        'title': row.title,
        'report_status': row.status,
    } for row in rows]


def get_assessment_report(db: Session, report_id: int | str) -> dict[str, Any]:
    if isinstance(report_id, str):
        report = db.scalar(select(AssessmentReport).where(AssessmentReport.report_code == report_id.upper()))
    else:
        report = db.get(AssessmentReport, report_id)
    if report is None:
        raise ValueError(f'Assessment report {report_id} not found')
    payload = _report_payload(db, report)
    payload['report_status'] = report.status
    return payload
