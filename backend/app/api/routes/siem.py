from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import RequireRole, get_current_user
from app.db.session import get_db
from app.models.models import User
from app.siem.elastic import ElasticSecurityConnector
from app.siem.service import SIEMIngestionService

router = APIRouter(prefix="/siem", tags=["SIEM Integration"])


class SIEMSyncRequest(BaseModel):
    cse_code: str = Field(default="CSE-07", description="CSE entity code to ingest events for")
    assessment_period: str | None = Field(default=None, description="Optional custom period label")
    limit: int = Field(default=100, ge=1, le=1000)


class SIEMTestRequest(BaseModel):
    endpoint: str | None = None
    api_key: str | None = None
    username: str | None = None
    password: str | None = None
    index: str | None = None
    verify_ssl: bool = True


@router.get("/status")
def get_siem_status():
    """
    Returns current SIEM connector configuration, connectivity health, and offline-first state.
    Safe for all authenticated users to view.
    """
    return SIEMIngestionService.get_status()


@router.post("/test")
def test_siem_connection(
    request: SIEMTestRequest,
    current_user: User = Depends(RequireRole(["ADMIN", "SUPERVISOR"])),
):
    """
    Test connectivity and credentials against a real SIEM instance without ingesting data.
    Restricted to ADMIN or SUPERVISOR.
    """
    connector = ElasticSecurityConnector(
        endpoint=request.endpoint,
        api_key=request.api_key,
        username=request.username,
        password=request.password,
        index=request.index,
        verify_ssl=request.verify_ssl,
    )
    return connector.test_connection()


@router.post("/sync")
def sync_siem_events(
    request: SIEMSyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RequireRole(["ADMIN", "SUPERVISOR", "ANALYST"])),
):
    """
    Triggers local-first ingestion of real SIEM events into the local A.E.G.I.S. database.
    Does NOT transmit data externally.
    """
    try:
        result = SIEMIngestionService.sync_siem(
            db=db,
            cse_code=request.cse_code,
            assessment_period=request.assessment_period,
            user_email=current_user.email,
            limit=request.limit,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"SIEM ingestion encountered an error: {str(e)}",
        )
