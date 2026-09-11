from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import CSEEntity
from app.analytics.multi_cse.schemas import (
    EntityReviewRequest, EntityReviewResponse,
    ComparisonPreviewRequest, ComparisonPreviewResponse,
    MultiCSECompareRequest, MultiCSECompareResponse,
    EntityDrillDownResponse
)
from app.analytics.multi_cse.service import (
    get_entity_review, get_comparison_preview,
    run_multi_cse_comparison, get_metric_drilldown,
    DEMO_ENTITIES_FALLBACK
)

router = APIRouter(prefix='/analytics/multi-cse', tags=['Multi-CSE Comparison'])


@router.get('/available-entities')
def list_available_entities(db: Session = Depends(get_db)):
    """List all CSEs eligible for Multi-CSE comparison, identifying live vs demo status."""
    db_cses = db.scalars(select(CSEEntity)).all()
    live_codes = {c.cse_code.upper() for c in db_cses}
    
    result = []
    # 1. Live database entities
    for c in db_cses:
        result.append({
            "cse_code": c.cse_code,
            "name": c.name,
            "sector": c.sector,
            "criticality": c.criticality,
            "is_demo": False,
            "badge": "LIVE PROCESSED DATA"
        })
        
    # 2. Demo entities fallback
    for code, demo in DEMO_ENTITIES_FALLBACK.items():
        if code not in live_codes:
            result.append({
                "cse_code": demo["cse_code"],
                "name": demo["cse_name"],
                "sector": demo["sector"],
                "criticality": demo["criticality"],
                "is_demo": True,
                "badge": "DEMO PRESET"
            })
            
    return {"entities": result, "total": len(result)}


@router.post('/review', response_model=EntityReviewResponse)
def review_entities(request: EntityReviewRequest, db: Session = Depends(get_db)):
    """Retrieve detailed entity metrics and availability for the mandatory Entity Review screen."""
    if not request.cse_codes or len(request.cse_codes) < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least 1 CSE must be requested for review.")
    entities = get_entity_review(db, request.cse_codes)
    return EntityReviewResponse(entities=entities)


@router.post('/preview', response_model=ComparisonPreviewResponse)
def preview_comparison(request: ComparisonPreviewRequest, db: Session = Depends(get_db)):
    """Pre-flight comparison summary and comparability check before executing."""
    if not request.cse_codes or len(request.cse_codes) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Comparison requires at least 2 selected CSEs.")
    if len(request.cse_codes) > 10:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum 10 CSEs can be compared concurrently.")
    return get_comparison_preview(db, request.cse_codes, request.basis)


@router.post('/compare', response_model=MultiCSECompareResponse)
def compare_multi_cses(request: MultiCSECompareRequest, db: Session = Depends(get_db)):
    """Execute dynamic multi-CSE comparison across 2 to 10 entities using real processed metrics."""
    if not request.cse_codes or len(request.cse_codes) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least 2 CSEs are required for multi-entity comparison.")
    if len(request.cse_codes) > 10:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum 10 CSEs can be compared concurrently.")
    return run_multi_cse_comparison(db, request.cse_codes, request.basis, request.assessment_period)


@router.get('/drilldown/{cse_code}/{metric}', response_model=EntityDrillDownResponse)
def inspect_metric_drilldown(cse_code: str, metric: str, db: Session = Depends(get_db)):
    """Drill into underlying CSE -> Dataset -> Asset -> Alert -> Finding -> Evidence provenance."""
    return get_metric_drilldown(db, cse_code, metric)
