from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.models import AuditLog, AttentionScore, CSEEntity, Finding, FindingEvidence, PeerMetric


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _assessment_period_for_finding(db: Session, finding: Finding) -> str:
    if finding.analytics_run and finding.analytics_run.ingestion_batch and finding.analytics_run.ingestion_batch.assessment_period:
        return finding.analytics_run.ingestion_batch.assessment_period
    latest = db.scalar(
        select(Finding)
        .join(CSEEntity)
        .where(Finding.cse_id == finding.cse_id)
        .order_by(Finding.detected_at.desc())
    )
    if latest and latest.analytics_run and latest.analytics_run.ingestion_batch and latest.analytics_run.ingestion_batch.assessment_period:
        return latest.analytics_run.ingestion_batch.assessment_period
    return 'Unavailable'


def _rule_code(finding: Finding) -> str:
    return finding.rule.rule_code if finding.rule else 'UNKNOWN'


def _evidence_metadata(finding: Finding) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for evidence in finding.evidence:
        items.append({
            'evidence_code': evidence.evidence_code,
            'record_type': evidence.record_type,
            'record_id': evidence.record_id,
            'summary': evidence.summary,
            'evidence_reference': evidence.evidence_reference,
            'relationship_to_finding': 'direct record supporting the finding',
        })
    if not items:
        items.append({
            'evidence_code': 'NONE',
            'record_type': 'UNKNOWN',
            'record_id': 'NONE',
            'summary': 'No optional evidence was linked to this finding.',
            'evidence_reference': None,
            'relationship_to_finding': 'missing evidence',
        })
    return items


def _rule_specific_context(rule_code: str, finding: Finding) -> tuple[str, str, list[str], list[str], str | None, str | None, str | None]:
    fact = finding.description or finding.title
    interpretation = finding.explanation or 'The submitted evidence is consistent with a human-review signal.'
    guidance = [
        'Supervisor should verify whether the submitted records represent the relevant assessment-period activity.',
        'Review the linked source record(s) before drawing operational conclusions.',
    ]
    data_limitations: list[str] = []
    observed_value = expected_value = deviation = None

    if rule_code.startswith('EG-'):
        fact = f'FACT: {fact}'
        interpretation = f'INTERPRETATION: {interpretation}'
        guidance = [
            'Verify whether the submitted alert population is complete for the assessment period.',
            'Review the associated investigation or escalation record to confirm whether the evidence chain is complete.',
        ]
        if rule_code == 'EG-001':
            observed_value = 'Alert closure duration below the configured threshold.'
            expected_value = 'Configured closure threshold for the alert severity.'
            deviation = 'Closure duration was materially shorter than expected.'
        elif rule_code == 'EG-003':
            observed_value = 'Critical alert closed with no escalation evidence.'
            expected_value = 'Escalation evidence should be present for closed critical alerts.'
            deviation = 'Escalation evidence was absent from the submitted records.'
    elif rule_code.startswith('NS-'):
        fact = f'FACT: {fact}'
        interpretation = f'INTERPRETATION: {interpretation}'
        guidance = [
            'Confirm whether the omitted activity is genuinely absent or simply absent from submitted records.',
            'Validate the completeness of monitoring and case records for the relevant assessment period.',
        ]
        data_limitations = ['Insufficient data was available for this analytical dimension.']
        if rule_code in {'NS-001', 'NS-002'}:
            observed_value = 'No submitted evidence was observed for the expected monitoring or activity category.'
            expected_value = 'Monitoring or activity evidence should be present for the relevant operational expectation.'
            deviation = 'The expected evidence pattern was not observed in the submitted records.'
    elif rule_code.startswith('AN-'):
        fact = f'FACT: {fact}'
        interpretation = f'INTERPRETATION: {interpretation}'
        guidance = [
            'Review the historical baseline and confirm that the reported period is comparable.',
            'Check whether changes in operational scope or reporting completeness explain the deviation.',
        ]
        observed_value = 'Selected period metric deviated from the entity baseline.'
        expected_value = 'Historical baseline values for the same metric.'
        deviation = 'The current period differed materially from the historical pattern.'
    elif rule_code == 'PB-001':
        fact = f'FACT: {fact}'
        interpretation = f'INTERPRETATION: {interpretation}'
        guidance = [
            'Validate whether the observed peer deviation reflects operational scope differences instead of a true control issue.',
            'Review peer comparability assumptions before acting on the difference.',
        ]
        observed_value = 'Entity metric deviated materially from peer comparators.'
        expected_value = 'Comparable peer metric distribution for the same assessment period.'
        deviation = 'The entity value differed materially from the peer median or average.'
    else:
        guidance = [
            'Supervisor should review the linked evidence before making a conclusion.',
            'Confirm whether the result is explained by submitted data completeness or genuine operational activity.',
        ]

    manual_verification = 'MANUAL VERIFICATION: ' + ' '.join(guidance)
    return fact, interpretation, guidance, data_limitations, observed_value, expected_value, deviation, manual_verification


def build_finding_explanation(db: Session, finding_code: str) -> dict[str, Any]:
    finding = db.scalar(select(Finding).where(Finding.finding_code == finding_code.upper()))
    if finding is None:
        raise ValueError(f'Finding {finding_code.upper()} not found')

    rule_code = _rule_code(finding)
    assessment_period = _assessment_period_for_finding(db, finding)
    evidence_items = _evidence_metadata(finding)
    fact, interpretation, guidance, data_limitations, observed_value, expected_value, deviation, manual_verification = _rule_specific_context(rule_code, finding)

    payload = {
        'finding_code': finding.finding_code,
        'rule_code': rule_code,
        'cse': finding.cse.cse_code if finding.cse else 'UNKNOWN',
        'assessment_period': assessment_period,
        'category': finding.category,
        'severity': finding.severity,
        'title': finding.title,
        'explanation': {
            'fact': fact,
            'interpretation': interpretation,
            'manual_verification': manual_verification,
        },
        'reason': finding.description,
        'supporting_metrics': [
            {'metric': 'score_contribution', 'value': finding.score_contribution},
            {'metric': 'severity', 'value': finding.severity},
        ],
        'observed_value': observed_value,
        'expected_value': expected_value,
        'deviation': deviation,
        'evidence': evidence_items,
        'data_limitations': data_limitations or ['No material limitation was identified in the submitted evidence.'],
        'manual_verification_guidance': guidance,
    }

    db.add(AuditLog(
        action='EXPLANATION_GENERATED',
        entity_type='finding',
        entity_id=finding.finding_code,
        details_json={'rule_code': rule_code, 'assessment_period': assessment_period, 'cse_code': payload['cse']},
        created_at=_now(),
    ))
    db.commit()
    return payload


def get_finding_evidence(db: Session, finding_code: str) -> dict[str, Any]:
    finding = db.scalar(select(Finding).where(Finding.finding_code == finding_code.upper()))
    if finding is None:
        raise ValueError(f'Finding {finding_code.upper()} not found')
    period = _assessment_period_for_finding(db, finding)
    evidence = []
    for item in finding.evidence:
        evidence.append({
            'evidence_code': item.evidence_code,
            'record_type': item.record_type,
            'record_id': item.record_id,
            'summary': item.summary,
            'evidence_reference': item.evidence_reference,
            'relationship_to_finding': 'This record directly supports the finding.',
        })
    if not evidence:
        evidence.append({
            'evidence_code': 'NONE',
            'record_type': 'UNKNOWN',
            'record_id': 'NONE',
            'summary': 'No evidence records were linked to this finding.',
            'evidence_reference': None,
            'relationship_to_finding': 'This is a missing evidence condition, not a confirmed absence.',
        })
    return {
        'finding_code': finding.finding_code,
        'cse': finding.cse.cse_code if finding.cse else 'UNKNOWN',
        'assessment_period': period,
        'evidence': evidence,
    }


def build_attention_score_explanation(db: Session, cse_code: str) -> dict[str, Any]:
    cse = db.scalar(select(CSEEntity).where(CSEEntity.cse_code == cse_code.upper()))
    if cse is None:
        raise ValueError(f'CSE {cse_code.upper()} not found')
    score = db.scalar(select(AttentionScore).where(AttentionScore.cse_id == cse.id).order_by(AttentionScore.calculated_at.desc()))
    if score is None:
        raise ValueError(f'Attention score for {cse_code.upper()} not found')

    run = score.analytics_run
    period = run.ingestion_batch.assessment_period if run and run.ingestion_batch else 'Unavailable'
    findings = db.scalars(select(Finding).where(Finding.cse_id == cse.id, Finding.status != 'RESOLVED').order_by(Finding.score_contribution.desc().nullslast(), Finding.detected_at.desc())).all()
    top_findings = [finding.title for finding in findings[:3]]

    peer_metrics = db.scalars(select(PeerMetric).where(PeerMetric.cse_id == cse.id)).all()
    peer_available = bool(peer_metrics)
    peer_reason = 'Peer deviation was unavailable because comparable peer data was insufficient.' if not peer_available else 'Peer deviation was available from the peer benchmark comparison.'
    component_breakdown = {
        'execution_gap': {
            'value': score.execution_gap_score,
            'weight': 0.30,
            'contribution': round(score.execution_gap_score * 0.30, 2),
            'status': 'available',
            'reason': 'Execution-gap component was available for the assessment period.'
        },
        'negative_space': {
            'value': score.negative_space_score,
            'weight': 0.30,
            'contribution': round(score.negative_space_score * 0.30, 2),
            'status': 'available',
            'reason': 'Negative-space component was available for the assessment period.'
        },
        'anomaly': {
            'value': score.anomaly_score,
            'weight': 0.20,
            'contribution': round(score.anomaly_score * 0.20, 2),
            'status': 'available',
            'reason': 'Anomaly component was available for the assessment period.'
        },
        'peer_deviation': {
            'value': score.peer_deviation_score if peer_available else None,
            'weight': 0.20,
            'contribution': round(score.peer_deviation_score * 0.20, 2) if peer_available else None,
            'status': 'available' if peer_available else 'unavailable',
            'reason': peer_reason,
        },
    }

    summary = (
        f'Attention Score: {score.total_score}. '
        f'Level: {score.attention_level}. '
        f'High supervisory attention is primarily driven by execution-gap and negative-space findings during the assessment period.'
    )
    calculation_trace = [
        f'Execution Gap: {score.execution_gap_score} × 0.30 = {round(score.execution_gap_score * 0.30, 2)}',
        f'Negative Space: {score.negative_space_score} × 0.30 = {round(score.negative_space_score * 0.30, 2)}',
        f'Anomaly: {score.anomaly_score} × 0.20 = {round(score.anomaly_score * 0.20, 2)}',
        f'Peer Deviation: {peer_reason}',
    ]
    if not peer_available:
        calculation_trace[-1] = 'Peer Deviation: unavailable because comparable peer data was insufficient.'
    explanation = ' '.join([summary] + calculation_trace)

    payload = {
        'cse_code': cse.cse_code,
        'assessment_period': period,
        'attention_level': score.attention_level,
        'total_score': score.total_score,
        'component_breakdown': component_breakdown,
        'explanation': explanation,
        'top_contributing_findings': top_findings or ['No finding contributions were available for this period.'],
        'data_limitations': [
            'Insufficient data was available for this analytical dimension.' if not peer_available else 'No material data limitation identified.',
        ],
    }

    db.add(AuditLog(
        action='ATTENTION_EXPLANATION_GENERATED',
        entity_type='attention_score',
        entity_id=str(score.id),
        details_json={'cse_code': cse.cse_code, 'assessment_period': period, 'attention_level': score.attention_level},
        created_at=_now(),
    ))
    db.commit()
    return payload
