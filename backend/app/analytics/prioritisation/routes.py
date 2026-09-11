from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.prioritisation.schemas import PrioritisationRequest, PrioritisationResponse, PrioritisedSampleView
from app.analytics.prioritisation.service import run_prioritisation
from app.db.session import get_db
from app.models.models import AnalyticsRun, CSEEntity, PrioritisedSample

router = APIRouter(prefix='/analytics/prioritisation', tags=['prioritisation'])


@router.post('/run', response_model=PrioritisationResponse)
def run_prioritisation_route(request: PrioritisationRequest, db: Session = Depends(get_db)) -> PrioritisationResponse:
    try:
        run, samples = run_prioritisation(db, cse_code=request.cse_code, ingestion_batch_code=request.ingestion_batch_code)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Prioritisation failed') from exc

    cse_code = db.scalar(select(CSEEntity.cse_code).where(CSEEntity.id == run.cse_id)) if run.cse_id else None
    payload = [
        PrioritisedSampleView(
            rank=sample.rank,
            record_type=sample.record_type,
            record_id=sample.record_id,
            priority_score=sample.priority_score,
            severity=sample.severity,
            reason=sample.reason,
            review_status=sample.review_status,
        )
        for sample in samples
    ]
    return PrioritisationResponse(run_code=run.run_code, cse_code=cse_code or request.cse_code, status=run.status, total_samples=len(payload), samples=payload)


@router.get('/{cse_code}', response_model=PrioritisationResponse)
def get_prioritised_samples(cse_code: str, db: Session = Depends(get_db)) -> PrioritisationResponse:
    cse = db.scalar(select(CSEEntity).where(CSEEntity.cse_code == cse_code.upper()))
    if cse is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='CSE not found')
    items = db.scalars(
        select(PrioritisedSample)
        .where(PrioritisedSample.cse_id == cse.id)
        .order_by(PrioritisedSample.rank.asc())
    ).all()
    payload = [
        PrioritisedSampleView(
            rank=item.rank,
            record_type=item.record_type,
            record_id=item.record_id,
            priority_score=item.priority_score,
            severity=item.severity,
            reason=item.reason,
            review_status=item.review_status,
        )
        for item in items
    ]
    return PrioritisationResponse(run_code='N/A', cse_code=cse.cse_code, status='READY', total_samples=len(payload), samples=payload)
