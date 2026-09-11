from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics.execution_gaps.schemas import ExecutionGapRunRequest, ExecutionGapRunResponse, ExecutionGapRunStatus
from app.analytics.execution_gaps.service import run_execution_gaps
from app.db.session import get_db
from app.models.models import AnalyticsRun, CSEEntity, Finding

router = APIRouter(prefix='/analytics/execution-gaps', tags=['execution-gap analytics'])


@router.post('/run', response_model=ExecutionGapRunResponse)
def execute_run(request: ExecutionGapRunRequest, db: Session = Depends(get_db)) -> ExecutionGapRunResponse:
    try:
        run, rules_evaluated, findings_created = run_execution_gaps(db, cse_code=request.cse_code, ingestion_batch_code=request.ingestion_batch_code)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Execution-gap analysis failed') from exc
    cse_code = db.scalar(select(CSEEntity.cse_code).where(CSEEntity.id == run.cse_id)) if run.cse_id else None
    return ExecutionGapRunResponse(run_code=run.run_code, status=run.status, cse_code=cse_code, rules_evaluated=rules_evaluated, findings_created=findings_created)


@router.get('/runs/{run_code}', response_model=ExecutionGapRunStatus)
def get_run(run_code: str, db: Session = Depends(get_db)) -> ExecutionGapRunStatus:
    run = db.scalar(select(AnalyticsRun).where(AnalyticsRun.run_code == run_code))
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Analytics run not found')
    cse_code = db.scalar(select(CSEEntity.cse_code).where(CSEEntity.id == run.cse_id)) if run.cse_id else None
    findings_created = db.scalar(select(func.count(Finding.id)).where(Finding.analytics_run_id == run.id)) or 0
    return ExecutionGapRunStatus(run_code=run.run_code, status=run.status, run_type=run.run_type, cse_code=cse_code, started_at=run.started_at.isoformat(), completed_at=run.completed_at.isoformat() if run.completed_at else None, findings_created=findings_created)
