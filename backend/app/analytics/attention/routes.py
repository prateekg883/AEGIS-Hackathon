from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.attention.schemas import AttentionScoreRequest, AttentionScoreResponse
from app.analytics.attention.service import classify_attention_score, finding_component_data, run_attention_score
from app.db.session import get_db
from app.models.models import AttentionScore, CSEEntity

router = APIRouter(prefix='/analytics/attention-score', tags=['attention scoring'])


def _response(run, score, cse_code, period, counts):
    active = [key.replace('_', ' ') for key, value in counts.items() if value is not None and value]
    unavailable = [key.replace('_', ' ') for key, value in counts.items() if value is None]
    suffix = f' Unavailable components: {", ".join(unavailable)}.' if unavailable else ''
    explanation = f'{score.attention_level.title()} supervisory attention based on severity-weighted submitted {", ".join(active) or "available"} signals during {period}.{suffix} Available component weights were renormalized; this is a prioritisation signal for human review, not a final supervisory judgment.'
    classification = classify_attention_score(score.total_score)
    return AttentionScoreResponse(
        run_code=run.run_code,
        cse_code=cse_code,
        assessment_period=period,
        status=run.status,
        execution_gap_score=score.execution_gap_score,
        negative_space_score=score.negative_space_score,
        anomaly_score=score.anomaly_score,
        peer_deviation_score=score.peer_deviation_score,
        total_score=score.total_score,
        attention_level=score.attention_level,
        explanation=explanation,
        policy_tier=classification['tier'],
        policy_status=classification['status'],
        action_required=classification['action'],
        requires_human_review=classification['requires_human_review'],
        eligible_for_escalation=classification['eligible_for_escalation'],
    )

@router.post('/run', response_model=AttentionScoreResponse)
def run_score(request: AttentionScoreRequest, db: Session = Depends(get_db)):
    try:
        run, score, counts = run_attention_score(db, cse_code=request.cse_code, ingestion_batch_code=request.ingestion_batch_code, weights=request.weights, thresholds=request.thresholds)
    except ValueError as exc: raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc: raise HTTPException(status_code=500, detail='Attention scoring failed') from exc
    return _response(run, score, request.cse_code.upper(), run.ingestion_batch.assessment_period, counts)

@router.get('/{cse_code}', response_model=AttentionScoreResponse)
def get_score(cse_code: str, db: Session = Depends(get_db)):
    score = db.scalar(select(AttentionScore).join(CSEEntity).where(CSEEntity.cse_code == cse_code.upper()).order_by(AttentionScore.calculated_at.desc()))
    if score is None: raise HTTPException(status_code=404, detail='Attention score not found')
    run = score.analytics_run
    period = run.ingestion_batch.assessment_period if run and run.ingestion_batch else 'Unavailable'
    counts, _, _ = finding_component_data(db, score.cse_id)
    return _response(run, score, cse_code.upper(), period, counts)
