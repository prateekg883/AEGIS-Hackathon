from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics.negative_space.schemas import NegativeSpaceRunRequest, NegativeSpaceRunResponse, NegativeSpaceRunStatus
from app.analytics.negative_space.service import run_negative_space
from app.db.session import get_db
from app.models.models import AnalyticsRun, CSEEntity, Finding

router = APIRouter(prefix='/analytics/negative-space', tags=['negative-space analytics'])


@router.post('/run', response_model=NegativeSpaceRunResponse)
def execute_run(request: NegativeSpaceRunRequest, db: Session = Depends(get_db)) -> NegativeSpaceRunResponse:
    try:
        run, period, rules_evaluated, findings_created = run_negative_space(db, cse_code=request.cse_code, ingestion_batch_code=request.ingestion_batch_code)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Negative Space analysis failed') from exc
    cse_code = db.scalar(select(CSEEntity.cse_code).where(CSEEntity.id == run.cse_id))
    return NegativeSpaceRunResponse(run_code=run.run_code, status=run.status, cse_code=cse_code, assessment_period=period, rules_evaluated=rules_evaluated, findings_created=findings_created)


@router.get('/runs/{run_code}', response_model=NegativeSpaceRunStatus)
def get_run(run_code: str, db: Session = Depends(get_db)) -> NegativeSpaceRunStatus:
    run = db.scalar(select(AnalyticsRun).where(AnalyticsRun.run_code == run_code))
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Analytics run not found')
    cse_code = db.scalar(select(CSEEntity.cse_code).where(CSEEntity.id == run.cse_id)) if run.cse_id else None
    batch_period = run.ingestion_batch.assessment_period if run.ingestion_batch else None
    if batch_period is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Assessment period unavailable')
    findings_created = db.scalar(select(func.count(Finding.id)).where(Finding.analytics_run_id == run.id)) or 0
    return NegativeSpaceRunStatus(run_code=run.run_code, status=run.status, run_type=run.run_type, cse_code=cse_code, assessment_period=batch_period, started_at=run.started_at.isoformat(), completed_at=run.completed_at.isoformat() if run.completed_at else None, findings_created=findings_created)
