from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.analytics.explainability.schemas import (
    AttentionScoreExplanationResponse,
    EvidenceResponse,
    FindingExplanationResponse,
)
from app.analytics.explainability.service import build_attention_score_explanation, build_finding_explanation, get_finding_evidence
from app.db.session import get_db

router = APIRouter(prefix='/analytics', tags=['explainability'])


@router.get('/findings/{finding_code}/explanation', response_model=FindingExplanationResponse)
def get_finding_explanation_route(finding_code: str, db: Session = Depends(get_db)):
    try:
        payload = build_finding_explanation(db, finding_code)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return FindingExplanationResponse(**payload)


@router.get('/findings/{finding_code}/evidence', response_model=EvidenceResponse)
def get_finding_evidence_route(finding_code: str, db: Session = Depends(get_db)):
    try:
        payload = get_finding_evidence(db, finding_code)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return EvidenceResponse(**payload)


@router.get('/attention-score/{cse_code}/explanation', response_model=AttentionScoreExplanationResponse)
def get_attention_score_explanation_route(cse_code: str, db: Session = Depends(get_db)):
    try:
        payload = build_attention_score_explanation(db, cse_code)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return AttentionScoreExplanationResponse(**payload)
