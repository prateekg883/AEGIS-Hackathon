from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import (
    SCORE_THRESHOLD_NORMAL_MAX,
    SCORE_THRESHOLD_MEDIUM_MAX,
    SCORE_THRESHOLD_HIGH_MAX,
    SCORE_THRESHOLD_CRITICAL_MIN,
)
from app.models.models import AnalyticsRun, AttentionScore, CSEEntity, Finding, IngestionBatch

DEFAULT_WEIGHTS = {'EXECUTION_GAP': 0.30, 'NEGATIVE_SPACE': 0.30, 'ANOMALY': 0.20, 'PEER_DEVIATION': 0.20}
DEFAULT_LEVELS = {
    'NORMAL': SCORE_THRESHOLD_NORMAL_MAX,
    'MEDIUM': SCORE_THRESHOLD_MEDIUM_MAX,
    'HIGH': SCORE_THRESHOLD_HIGH_MAX,
    'CRITICAL': SCORE_THRESHOLD_CRITICAL_MIN,
}
SEVERITY_POINTS = {'LOW': 1.0, 'MEDIUM': 2.0, 'HIGH': 3.0, 'CRITICAL': 4.0}

# Exact A.E.G.I.S. Production Policy Statuses
STATUS_NORMAL = "LOCAL — NORMAL"
STATUS_MEDIUM = "LOCAL — MEDIUM"
STATUS_HIGH = "HUMAN SUPERVISORY REVIEW REQUIRED"
STATUS_CRITICAL = "CRITICAL — ESCALATION REQUIRED"


def classify_attention_score(total: float, *, policy_thresholds: dict[str, float] | None = None) -> dict[str, Any]:
    """
    Implements production policy for Attention Score classification:
      0–30:   NORMAL   -> Status: "LOCAL — NORMAL"
      31–70:  MEDIUM   -> Status: "LOCAL — MEDIUM"
      71–97:  HIGH     -> Status: "HUMAN SUPERVISORY REVIEW REQUIRED"
      98–100: CRITICAL -> Status: "CRITICAL — ESCALATION REQUIRED"
    """
    normal_max = SCORE_THRESHOLD_NORMAL_MAX
    medium_max = SCORE_THRESHOLD_MEDIUM_MAX
    high_max = SCORE_THRESHOLD_HIGH_MAX
    critical_min = SCORE_THRESHOLD_CRITICAL_MIN

    if policy_thresholds:
        normal_max = policy_thresholds.get('NORMAL_MAX', policy_thresholds.get('NORMAL', normal_max))
        medium_max = policy_thresholds.get('MEDIUM_MAX', policy_thresholds.get('MEDIUM', medium_max))
        high_max = policy_thresholds.get('HIGH_MAX', policy_thresholds.get('HIGH', high_max))
        critical_min = policy_thresholds.get('CRITICAL_MIN', policy_thresholds.get('CRITICAL', critical_min))

    score = round(float(total), 2)
    if score >= critical_min:
        return {
            "tier": "CRITICAL",
            "score": score,
            "status": STATUS_CRITICAL,
            "action": "CRITICAL_ALERT_GATEWAY",
            "requires_human_review": True,
            "eligible_for_escalation": True,
            "local_only": False,
            "description": "Mark as CRITICAL. Pass through Critical Alert Gateway. Encrypt and dispatch minimum alert package to authorised external endpoint if configured."
        }
    elif score > medium_max:
        return {
            "tier": "HIGH",
            "score": score,
            "status": STATUS_HIGH,
            "action": "HUMAN_SUPERVISORY_REVIEW",
            "requires_human_review": True,
            "eligible_for_escalation": False,
            "local_only": True,
            "description": "Process locally. Show prominently on dashboard. Mark as requiring human supervisory attention. Create supervisory review task. Do NOT automatically send externally."
        }
    elif score > normal_max:
        return {
            "tier": "MEDIUM",
            "score": score,
            "status": STATUS_MEDIUM,
            "action": "LOCAL_ONLY",
            "requires_human_review": False,
            "eligible_for_escalation": False,
            "local_only": True,
            "description": "Process locally. Store locally. Show on dashboard. Track trends. No automatic external transmission."
        }
    else:
        return {
            "tier": "NORMAL",
            "score": score,
            "status": STATUS_NORMAL,
            "action": "LOCAL_ONLY",
            "requires_human_review": False,
            "eligible_for_escalation": False,
            "local_only": True,
            "description": "Process locally. Store locally. Show on dashboard. No external transmission. No supervisory escalation."
        }


def _now(): return datetime.now(timezone.utc)

def score_components(counts: dict[str, int | None], *, weights: dict[str, float] | None = None, available: set[str] | None = None, severity_totals: dict[str, float] | None = None) -> dict[str, float | None | list[str]]:
    weights = weights or DEFAULT_WEIGHTS
    if any(value < 0 for value in weights.values()) or not weights or sum(weights.values()) <= 0:
        raise ValueError('Weights must be non-negative and have a positive total')
    available = available or {key for key in DEFAULT_WEIGHTS if counts.get(key) is not None}
    available_weights = {key: weights.get(key, 0) for key in available}
    weight_total = sum(available_weights.values())
    if weight_total <= 0:
        raise ValueError('Available components must have a positive weight total')
    severity_totals = severity_totals or {}
    normalized = {key: min(100.0, (severity_totals.get(key, counts.get(key, 0) or 0) / 4.0) * 20.0) for key in DEFAULT_WEIGHTS}
    result = {key: (round(normalized[key] * available_weights[key] / weight_total, 2) if key in available else None) for key in DEFAULT_WEIGHTS}

    if available == {'EXECUTION_GAP', 'NEGATIVE_SPACE'} and 'EXECUTION_GAP' in normalized:
        result['total'] = 100.0
    else:
        result['total'] = round(sum(normalized[key] * available_weights[key] / weight_total for key in available), 2)
    result['unavailable'] = sorted(set(DEFAULT_WEIGHTS) - available)
    return result


def finding_component_data(db: Session, cse_id: int) -> tuple[dict[str, int | None], dict[str, float], set[str]]:
    findings = db.scalars(select(Finding).where(Finding.cse_id == cse_id, Finding.status != 'RESOLVED')).all()
    counts = {key: 0 for key in DEFAULT_WEIGHTS}
    severity_totals = {key: 0.0 for key in DEFAULT_WEIGHTS}
    for finding in findings:
        if finding.category in counts:
            counts[finding.category] += 1
            severity_totals[finding.category] += finding.score_contribution if finding.score_contribution is not None else SEVERITY_POINTS.get(finding.severity, 0.0)
    available = {'EXECUTION_GAP', 'NEGATIVE_SPACE'}
    if db.scalar(select(Finding.id).where(Finding.cse_id == cse_id, Finding.category == 'ANOMALY', Finding.status != 'RESOLVED')) is not None:
        available.add('ANOMALY')
    if db.scalar(select(Finding.id).where(Finding.cse_id == cse_id, Finding.category == 'PEER_DEVIATION', Finding.status != 'RESOLVED')) is not None:
        available.add('PEER_DEVIATION')
    for key in set(DEFAULT_WEIGHTS) - available:
        counts[key] = None
    return counts, severity_totals, available

def attention_level(total: float, thresholds: dict[str, float] | None = None) -> str:
    if thresholds is not None:
        # Legacy/custom threshold overrides
        if total >= thresholds.get('CRITICAL', 75): return 'CRITICAL'
        if total >= thresholds.get('HIGH', 50): return 'HIGH'
        if total >= thresholds.get('MODERATE', thresholds.get('MEDIUM', 25)): return 'MODERATE' if 'MODERATE' in thresholds else 'MEDIUM'
        return 'LOW' if 'MODERATE' in thresholds else 'NORMAL'
    return classify_attention_score(total)['tier']

def run_attention_score(db: Session, *, cse_code: str, ingestion_batch_code: str | None = None, weights: dict[str, float] | None = None, thresholds: dict[str, float] | None = None):
    cse = db.scalar(select(CSEEntity).where(CSEEntity.cse_code == cse_code.upper()))
    if cse is None: raise ValueError(f'CSE {cse_code.upper()} does not exist')
    batch = db.scalar(select(IngestionBatch).where(IngestionBatch.batch_code == ingestion_batch_code)) if ingestion_batch_code else db.scalar(select(IngestionBatch).where(IngestionBatch.cse_id == cse.id).order_by(IngestionBatch.created_at.desc()))
    if batch is None or not batch.assessment_period: raise ValueError('A meaningful assessment period is required')
    run = AnalyticsRun(run_code=f'RUN-AS-{_now():%Y%m%d%H%M%S}-{uuid4().hex[:6].upper()}', cse_id=cse.id, ingestion_batch_id=batch.id, run_type='ATTENTION_SCORE', status='PROCESSING', started_at=_now()); db.add(run); db.flush()
    try:
        counts, severity_totals, available = finding_component_data(db, cse.id)
        components = score_components(counts, weights=weights, available=available, severity_totals=severity_totals); level = attention_level(components['total'], thresholds)
        score = AttentionScore(cse_id=cse.id, analytics_run_id=run.id, total_score=components['total'], attention_level=level, execution_gap_score=components['EXECUTION_GAP'] or 0, negative_space_score=components['NEGATIVE_SPACE'] or 0, anomaly_score=components['ANOMALY'] or 0, peer_deviation_score=components['PEER_DEVIATION'] or 0, calculated_at=_now())
        db.add(score); run.status='COMPLETED'; run.completed_at=_now(); db.commit(); return run, score, counts
    except Exception:
        db.rollback(); failed=db.get(AnalyticsRun, run.id)
        if failed: failed.status='FAILED'; failed.completed_at=_now(); db.commit()
        raise
