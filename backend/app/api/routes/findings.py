from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from pydantic import BaseModel

from app.api.dependencies import get_current_user, RequireRole
from app.db.session import get_db
from app.models.models import Finding, User
from app.core.audit import log_action

router = APIRouter()

class FindingTransitionRequest(BaseModel):
    status: str
    notes: str | None = None

@router.get("/findings")
def get_findings(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
    cse_id: str | None = None
):
    query = select(Finding)
    if cse_id:
        query = query.where(Finding.cse.has(cse_code=cse_id))
    findings = db.scalars(query).all()
    
    return [
        {
            "id": f.finding_code,
            "cse": f.cse.cse_code,
            "category": f.category,
            "title": f.title,
            "severity": f.severity,
            "status": f.status,
            "detectedDate": f.detected_at.isoformat(),
            "evidenceCount": len(f.evidence)
        }
        for f in findings
    ]

@router.put("/findings/{finding_code}/status")
def transition_finding_status(
    finding_code: str,
    request: FindingTransitionRequest,
    current_user: Annotated[User, Depends(RequireRole(["SUPERVISOR"]))],
    db: Session = Depends(get_db)
):
    finding = db.scalar(select(Finding).where(Finding.finding_code == finding_code))
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    
    valid_statuses = ["OPEN", "UNDER REVIEW", "VALIDATED", "ACTION ASSIGNED", "RESOLVED"]
    if request.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")
    
    old_status = finding.status
    finding.status = request.status
    if request.status == "RESOLVED":
        finding.resolved_at = datetime.now(timezone.utc)
    
    db.commit()
    
    log_action(
        db=db,
        user_email=current_user.email,
        action="TRANSITION_FINDING",
        entity_type="FINDING",
        entity_id=finding_code,
        details={"old_status": old_status, "new_status": request.status, "notes": request.notes}
    )
    
    return {"status": "success", "new_status": finding.status}
