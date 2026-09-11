from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, RequireRole
from app.db.session import get_db
from app.models.models import AuditLog, User

router = APIRouter()

@router.get("/audit")
def get_audit_trail(
    current_user: Annotated[User, Depends(RequireRole(["SUPERVISOR", "AUDITOR"]))],
    db: Session = Depends(get_db)
):
    logs = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc())).all()
    return [
        {
            "id": log.id,
            "user_email": log.user_email,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "details": log.details_json,
            "timestamp": log.created_at.isoformat()
        }
        for log in logs
    ]
