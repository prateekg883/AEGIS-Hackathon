from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics.anomalies.schemas import AnomalyRunRequest, AnomalyRunResponse, AnomalyRunStatus
from app.analytics.anomalies.service import run_anomaly_analysis
from app.db.session import get_db
from app.models.models import AnalyticsRun, CSEEntity, Finding

router = APIRouter(prefix='/analytics/anomalies', tags=['anomaly analytics'])

@router.post('/run', response_model=AnomalyRunResponse)
def run_anomalies(request: AnomalyRunRequest, db: Session = Depends(get_db)):
    try: run, period, rules, created, note = run_anomaly_analysis(db, cse_code=request.cse_code, ingestion_batch_code=request.ingestion_batch_code)
    except ValueError as exc: raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc: raise HTTPException(status_code=500, detail='Anomaly analysis failed') from exc
    return AnomalyRunResponse(run_code=run.run_code, status=run.status, cse_code=request.cse_code.upper() if request.cse_code else None, assessment_period=period, rules_evaluated=rules, findings_created=created, note=note)

@router.get('/runs/{run_code}', response_model=AnomalyRunStatus)
def get_anomaly_run(run_code: str, db: Session = Depends(get_db)):
    run = db.scalar(select(AnalyticsRun).where(AnalyticsRun.run_code == run_code, AnalyticsRun.run_type == 'ANOMALY'))
    if run is None: raise HTTPException(status_code=404, detail='Anomaly run not found')
    cse_code = db.scalar(select(CSEEntity.cse_code).where(CSEEntity.id == run.cse_id)) if run.cse_id else None
    period = run.ingestion_batch.assessment_period if run.ingestion_batch else 'Unavailable'
    count = db.scalar(select(func.count(Finding.id)).where(Finding.analytics_run_id == run.id)) or 0
    return AnomalyRunStatus(run_code=run.run_code, status=run.status, run_type=run.run_type, cse_code=cse_code, assessment_period=period, started_at=run.started_at.isoformat(), completed_at=run.completed_at.isoformat() if run.completed_at else None, findings_created=count)
