from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.reports.service import generate_assessment_report, get_assessment_report, list_assessment_reports

router = APIRouter(prefix='/reports', tags=['assessment reports'])


@router.post('/generate')
def generate_report_route(cse_code: str = Query(...), assessment_period: str | None = Query(default=None), db: Session = Depends(get_db)):
    try:
        return generate_assessment_report(db, cse_code=cse_code, assessment_period=assessment_period)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail='Report generation is unavailable because the database could not complete the request') from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Report generation failed') from exc


@router.get('/cse/{cse_code}')
def get_reports_for_cse(cse_code: str, db: Session = Depends(get_db)):
    return list_assessment_reports(db, cse_code=cse_code)


@router.get('/{report_id}')
def get_report_by_id(report_id: str, db: Session = Depends(get_db)):
    try:
        return get_assessment_report(db, report_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
