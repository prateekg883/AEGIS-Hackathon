from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.api.dependencies import RequireRole, get_current_user
from app.core.config import (
    CRITICAL_SCORE_THRESHOLD,
    DESTINATION_TYPE,
    DESTINATION_URL,
    ESCALATION_ENABLED,
)
from app.db.session import get_db
from app.gateway.service import CriticalAlertGateway
from app.models.models import CSEEntity, CriticalEscalationQueue, Finding, User

router = APIRouter(prefix="/gateway", tags=["Critical Alert Gateway"])


@router.get("/stats")
def get_gateway_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns aggregated status metrics for the Critical Alert Gateway and Supervisory Panel.
    """
    total = db.scalar(select(func.count(CriticalEscalationQueue.id))) or 0
    delivered = db.scalar(
        select(func.count(CriticalEscalationQueue.id)).where(
            CriticalEscalationQueue.delivery_status == "DELIVERED"
        )
    ) or 0
    awaiting = db.scalar(
        select(func.count(CriticalEscalationQueue.id)).where(
            CriticalEscalationQueue.delivery_status == "AWAITING_AUTH_ENDPOINT"
        )
    ) or 0
    failed = db.scalar(
        select(func.count(CriticalEscalationQueue.id)).where(
            CriticalEscalationQueue.delivery_status.in_(["FAILED", "RETRYING"])
        )
    ) or 0

    last_tx = db.scalar(
        select(CriticalEscalationQueue)
        .order_by(desc(CriticalEscalationQueue.last_attempt_at))
        .limit(1)
    )

    dest_configured = bool(ESCALATION_ENABLED and DESTINATION_URL)
    dest_status = "ENABLED_CONFIGURED" if dest_configured else ("DISABLED" if not ESCALATION_ENABLED else "AWAITING_ENDPOINT")

    return {
        "escalation_enabled": ESCALATION_ENABLED,
        "critical_score_threshold": CRITICAL_SCORE_THRESHOLD,
        "destination_type": DESTINATION_TYPE,
        "destination_status": dest_status,
        "is_configured": dest_configured,
        "stats": {
            "total_queued": total,
            "delivered": delivered,
            "awaiting_auth_endpoint": awaiting,
            "failed": failed,
        },
        "last_transmission": {
            "alert_id": last_tx.alert_id if last_tx else None,
            "status": last_tx.delivery_status if last_tx else None,
            "timestamp": last_tx.last_attempt_at.isoformat() if last_tx and last_tx.last_attempt_at else None,
        } if last_tx else None,
    }


@router.get("/queue")
def list_escalation_queue(
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List items in the protected Critical Escalation Queue.
    FEATURE 1: Sorted strictly by Attention Score descending, then newest timestamp first.
    (Score 100 appears above 99, Score 99 appears above 98)
    """
    stmt = (
        select(CriticalEscalationQueue)
        .order_by(desc(CriticalEscalationQueue.attention_score), desc(CriticalEscalationQueue.created_at))
        .limit(limit)
    )
    if status_filter:
        stmt = stmt.where(CriticalEscalationQueue.delivery_status == status_filter.upper())
    items = db.scalars(stmt).all()

    return [
        {
            "id": it.id,
            "alert_id": it.alert_id,
            "finding_id": it.finding.finding_code if it.finding else it.alert_id,
            "cse_code": it.cse_code,
            "attention_score": it.attention_score,
            "severity": it.severity,
            "destination_type": it.destination_type,
            "destination_url": it.destination_url,
            "delivery_status": it.delivery_status,
            "attempt_count": it.attempt_count,
            "max_attempts": it.max_attempts,
            "last_attempt_at": it.last_attempt_at.isoformat() if it.last_attempt_at else None,
            "failure_reason": it.failure_reason,
            "response_code": it.response_code,
            "payload_hash": it.payload_hash,
            "idempotency_key": it.idempotency_key,
            "created_at": it.created_at.isoformat() if it.created_at else None,
            "delivered_at": it.delivered_at.isoformat() if it.delivered_at else None,
            "minimised_package": it.minimised_payload_json,
        }
        for it in items
    ]


@router.get("/critical-findings")
def list_critical_findings(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    FEATURE 1, 2, 3: Returns all critical findings (Attention Score 98–100)
    for the Dashboard Critical Alert Panel and Senior Advisory Review.
    Ranked strictly by Attention Score descending (100 > 99 > 98) then newest timestamp first.
    """
    return CriticalAlertGateway.get_critical_findings(db=db, limit=limit)


@router.post("/critical-findings/{finding_code}/view")
def view_critical_finding(
    finding_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RequireRole(["ADMIN", "SUPERVISOR"])),
):
    """
    FEATURE 8: Records audit log when Senior Reviewer views a critical finding.
    """
    return CriticalAlertGateway.view_finding(db=db, finding_code=finding_code, user_email=current_user.email)


@router.post("/critical-findings/{finding_code}/acknowledge")
def acknowledge_critical_finding(
    finding_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RequireRole(["ADMIN", "SUPERVISOR"])),
):
    """
    FEATURE 3 & 8: Senior Reviewer acknowledges the critical finding.
    """
    return CriticalAlertGateway.acknowledge_finding(db=db, finding_code=finding_code, user_email=current_user.email)


@router.post("/critical-findings/{finding_code}/resolve")
def resolve_critical_finding(
    finding_code: str,
    notes: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(RequireRole(["ADMIN", "SUPERVISOR"])),
):
    """
    FEATURE 3 & 8: Senior Reviewer resolves the critical finding.
    """
    return CriticalAlertGateway.resolve_finding(db=db, finding_code=finding_code, user_email=current_user.email, notes=notes)


@router.post("/critical-findings/{finding_code}/escalate")
def escalate_critical_finding_route(
    finding_code: str,
    attention_score: float | None = Query(None),
    bottleneck: str | None = Query(None),
    analyst_notes: str | None = Query(None),
    target_authority: str | None = Query(None),
    action_requested: str | None = Query(None),
    urgency: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(RequireRole(["ADMIN", "SUPERVISOR"])),
):
    """
    FEATURE 4: Senior Reviewer triggers escalation through the existing Critical Alert Gateway.
    Includes ground-level operational review for higher authority.
    """
    finding = db.scalar(select(Finding).where(Finding.finding_code == finding_code))
    if not finding:
        # Check queue
        queue_item = db.scalar(select(CriticalEscalationQueue).where(CriticalEscalationQueue.alert_id == finding_code))
        if queue_item and queue_item.finding:
            finding = queue_item.finding

    score = attention_score or (finding.score_contribution if finding and finding.score_contribution else 99.0)
    return process_finding_for_escalation(
        finding_code=finding_code,
        attention_score=score,
        bottleneck=bottleneck,
        analyst_notes=analyst_notes,
        target_authority=target_authority,
        action_requested=action_requested,
        urgency=urgency,
        db=db,
        current_user=current_user,
    )


@router.post("/process/{finding_code}")
def process_finding_for_escalation(
    finding_code: str,
    attention_score: float = Query(..., description="Attention score of finding; must be >= 98"),
    title: str | None = Query(None),
    category: str | None = Query(None),
    cse_code: str | None = Query(None),
    bottleneck: str | None = Query(None),
    analyst_notes: str | None = Query(None),
    target_authority: str | None = Query(None),
    action_requested: str | None = Query(None),
    urgency: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(RequireRole(["ADMIN", "SUPERVISOR"])),
):
    """
    Submits a critical finding into the Critical Alert Gateway.
    Strictly restricted to SUPERVISOR or ADMIN.
    Rejects any score < 98.
    """
    from datetime import datetime, timezone
    finding = db.scalar(select(Finding).where(Finding.finding_code == finding_code))
    if not finding:
        target_cse = cse_code or "CSE-07"
        cse = db.scalar(select(CSEEntity).where(CSEEntity.cse_code == target_cse.upper())) or db.scalars(select(CSEEntity)).first()
        if not cse:
            cse = CSEEntity(
                cse_code=target_cse.upper(),
                name="PowerGrid Northern Region SOC",
                sector="Power & Energy",
                criticality="TIER_1",
                assessment_status="ACTIVE",
            )
            db.add(cse)
            db.flush()
        finding = Finding(
            finding_code=finding_code,
            cse_id=cse.id,
            category=category or "EXECUTION_GAP",
            severity="CRITICAL",
            title=title or f"Escalated Supervisory Threat {finding_code}",
            description="High-risk operational finding reviewed and authorized for escalation by human supervisor.",
            explanation="Admitted through A.E.G.I.S. Critical Alert Gateway with HMAC-SHA256 signature.",
            status="OPEN",
            score_contribution=attention_score,
            detected_at=datetime.now(timezone.utc),
        )
        db.add(finding)
        db.flush()

    try:
        res = CriticalAlertGateway.process_critical_alert(
            db=db,
            finding=finding,
            attention_score=attention_score,
            user_email=current_user.email,
            ground_bottleneck=bottleneck,
            analyst_notes=analyst_notes,
            target_authority=target_authority,
            action_requested=action_requested,
            urgency=urgency,
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Critical gateway error: {str(e)}",
        )


@router.post("/retry/{queue_id}")
def retry_escalation(
    queue_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RequireRole(["ADMIN", "SUPERVISOR"])),
):
    """
    Manually triggers retry for a queued critical alert.
    Restricted to SUPERVISOR or ADMIN.
    """
    try:
        return CriticalAlertGateway.retry_transmission(
            db=db,
            queue_id=queue_id,
            user_email=current_user.email,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Retry transmission failed: {str(e)}",
        )
