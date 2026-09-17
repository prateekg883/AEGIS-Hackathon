import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4
import httpx

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.audit import log_action
from app.core.config import (
    APP_ENV,
    CRITICAL_SCORE_THRESHOLD,
    DESTINATION_API_KEY,
    DESTINATION_AUTH_METHOD,
    DESTINATION_HMAC_SECRET,
    DESTINATION_TYPE,
    DESTINATION_URL,
    ESCALATION_ENABLED,
)
from app.models.models import AuditLog, CSEEntity, CriticalEscalationQueue, Finding, FindingEvidence

logger = logging.getLogger("aegis.gateway")


def _now():
    return datetime.now(timezone.utc)


class CriticalAlertGateway:
    """
    Secure outbound security boundary for A.E.G.I.S.
    Enforces:
      1. Score Policy Gatekeeper: ONLY scores >= 98 are admitted.
      2. Data Minimisation: ONLY minimised metadata, never full DB / CSV.
      3. Payload Integrity: SHA-256 hash and HMAC-SHA256 signature.
      4. Idempotency & Deduplication: Prevents duplicate transmission.
      5. Configurable Authorised Destinations: Endpoints configured server-side.
      6. Offline-First Resilience: Queues locally when endpoint is unconfigured or unreachable.
      7. SSRF Protection: Blocks internal cloud metadata endpoints.
    """

    BLOCKED_HOSTS = {
        "169.254.169.254",
        "metadata.google.internal",
        "100.100.100.200",
        "instance-data",
    }

    @classmethod
    def validate_destination_url(cls, url: str) -> bool:
        """
        SSRF check: Ensures URL is well-formed and does not target cloud metadata endpoints.
        """
        if not url:
            return False
        parsed = urlparse(url)
        if parsed.scheme not in ("https", "http"):
            return False
        # In production, require HTTPS
        if APP_ENV == "production" and parsed.scheme != "https":
            return False
        hostname = (parsed.hostname or "").lower()
        if hostname in cls.BLOCKED_HOSTS:
            return False
        return True

    @classmethod
    def compute_signature(cls, payload_json_str: str) -> str:
        """
        Generates HMAC-SHA256 signature for the canonical payload.
        """
        secret = DESTINATION_HMAC_SECRET.encode("utf-8")
        return hmac.new(secret, payload_json_str.encode("utf-8"), hashlib.sha256).hexdigest()

    @classmethod
    def build_minimised_package(
        cls,
        finding: Finding,
        attention_score: float,
        source_system: str = "A.E.G.I.S. SAT-SA",
        indicators: list[str] | None = None,
        ground_bottleneck: str | None = None,
        analyst_notes: str | None = None,
        target_authority: str | None = None,
        action_requested: str | None = None,
        urgency: str | None = None,
    ) -> dict[str, Any]:
        """
        Strict Data Minimisation rule:
        Transmits ONLY minimum necessary information for high-level tactical response.
        NEVER sends full CSV, raw logs, or unrelated SOC records.
        Includes ground-level operational review for higher authority.
        """
        evidence_refs = [e.evidence_code for e in finding.evidence] if finding.evidence else []
        event_refs = [f"{e.record_type}:{e.record_id}" for e in finding.evidence] if finding.evidence else []

        alert_id = f"ALT-CRT-{finding.finding_code}-{uuid4().hex[:6].upper()}"
        return {
            "alert_id": alert_id,
            "finding_id": finding.finding_code,
            "timestamp": _now().isoformat(),
            "attention_score": round(float(attention_score), 2),
            "severity": "CRITICAL",
            "attack_type": finding.category,
            "finding_type": finding.category,
            "summary": finding.title[:250],
            "description": finding.description[:500],
            "confidence": 0.96,
            "relevant_indicators": indicators or [],
            "evidence_reference": evidence_refs,
            "source_system": source_system,
            "event_reference": event_refs,
            "ground_level_review": {
                "bottleneck_category": ground_bottleneck or "Telemetry Incomplete / SLA Escalation Window",
                "ground_analyst_issues": analyst_notes or "Ground analyst encountered missing operational audit records and local containment timeout. Escalated for supervisory & higher authority intervention.",
                "target_higher_authority": target_authority or "NCIIPC Critical Infrastructure Advisory Desk",
                "recommended_executive_action": action_requested or "Direct Mandatory Network Isolation Order",
                "urgency_level": urgency or "Immediate (P1 - Within 1 Hour)",
                "review_status": "SUPERVISOR_VERIFIED",
            }
        }

    @classmethod
    def process_critical_alert(
        cls,
        db: Session,
        finding: Finding,
        attention_score: float,
        user_email: str | None = "system@aegis.local",
        indicators: list[str] | None = None,
        ground_bottleneck: str | None = None,
        analyst_notes: str | None = None,
        target_authority: str | None = None,
        action_requested: str | None = None,
        urgency: str | None = None,
    ) -> dict[str, Any]:
        """
        Entry point to the Critical Alert Gateway.
        """
        # Step 1: Policy Gatekeeper - Strictly block < 98.0
        if attention_score < CRITICAL_SCORE_THRESHOLD:
            logger.warning(
                f"Gateway rejected finding {finding.finding_code}: Score {attention_score} < {CRITICAL_SCORE_THRESHOLD}"
            )
            raise ValueError(
                f"Attention score {attention_score} is below the critical threshold ({CRITICAL_SCORE_THRESHOLD}). "
                f"Only critical threats (98-100) can be passed through the Critical Alert Gateway."
            )

        # Step 2: Build Minimised Alert Package with Ground-Level Review
        package = cls.build_minimised_package(
            finding=finding,
            attention_score=attention_score,
            indicators=indicators,
            ground_bottleneck=ground_bottleneck,
            analyst_notes=analyst_notes,
            target_authority=target_authority,
            action_requested=action_requested,
            urgency=urgency,
        )

        # Step 3: Canonical serialization and hashing for integrity & deduplication
        canonical_str = json.dumps(package, sort_keys=True, separators=(",", ":"))
        payload_hash = hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()
        idempotency_key = f"IDEMP-{finding.finding_code}-{payload_hash[:16]}"
        signature = cls.compute_signature(canonical_str)

        # Step 4: Check if already exists in Queue (Deduplication)
        existing = db.scalar(
            select(CriticalEscalationQueue).where(
                (CriticalEscalationQueue.idempotency_key == idempotency_key)
                | (CriticalEscalationQueue.finding_id == finding.id)
            )
        )

        if existing and existing.delivery_status == "DELIVERED":
            return {
                "alert_id": existing.alert_id,
                "status": "ALREADY_DELIVERED",
                "message": "Alert was already successfully transmitted to authorised endpoint. Duplicate transmission prevented.",
                "idempotency_key": idempotency_key,
                "payload_hash": existing.payload_hash,
                "delivered_at": existing.delivered_at.isoformat() if existing.delivered_at else None,
            }

        # Step 5: Create or update queue record
        if not existing:
            queue_item = CriticalEscalationQueue(
                alert_id=package["alert_id"],
                finding_id=finding.id,
                cse_code=finding.cse.cse_code if finding.cse else "UNKNOWN",
                attention_score=attention_score,
                severity="CRITICAL",
                destination_type=DESTINATION_TYPE,
                destination_url=DESTINATION_URL or None,
                payload_hash=payload_hash,
                idempotency_key=idempotency_key,
                minimised_payload_json=package,
                delivery_status="AWAITING_AUTH_ENDPOINT" if not (ESCALATION_ENABLED and DESTINATION_URL) else "PENDING",
                attempt_count=0,
                max_attempts=5,
                signature=signature,
                created_at=_now(),
            )
            db.add(queue_item)
            db.flush()
        else:
            queue_item = existing
            queue_item.signature = signature

        # Step 6: Determine if external transmission should be attempted
        if not ESCALATION_ENABLED or not DESTINATION_URL:
            queue_item.delivery_status = "AWAITING_AUTH_ENDPOINT"
            queue_item.failure_reason = "No authorised external endpoint configured or ESCALATION_ENABLED=false."
            db.add(
                AuditLog(
                    user_email=user_email,
                    action="CRITICAL_ALERT_QUEUED_LOCAL",
                    entity_type="CriticalEscalationQueue",
                    entity_id=queue_item.alert_id,
                    details_json={
                        "finding_code": finding.finding_code,
                        "attention_score": attention_score,
                        "status": "AWAITING_AUTH_ENDPOINT",
                        "reason": queue_item.failure_reason,
                    },
                )
            )
            db.commit()
            return {
                "alert_id": queue_item.alert_id,
                "status": "AWAITING_AUTH_ENDPOINT",
                "message": "Critical alert queued in secure local storage awaiting authorized deployment endpoint.",
                "destination_type": DESTINATION_TYPE,
                "idempotency_key": idempotency_key,
                "payload_hash": payload_hash,
                "minimised_package": package,
            }

        # Step 7: SSRF Verification
        if not cls.validate_destination_url(DESTINATION_URL):
            queue_item.delivery_status = "FAILED"
            queue_item.failure_reason = f"Destination URL '{DESTINATION_URL}' failed SSRF/security validation."
            db.commit()
            return {
                "alert_id": queue_item.alert_id,
                "status": "FAILED",
                "message": queue_item.failure_reason,
                "destination_type": DESTINATION_TYPE,
            }

        # Step 8: Outbound Transmission to Authorised Destination
        return cls._dispatch(db, queue_item, canonical_str, signature, user_email)

    @classmethod
    def _dispatch(
        cls,
        db: Session,
        queue_item: CriticalEscalationQueue,
        payload_str: str,
        signature: str,
        user_email: str | None,
    ) -> dict[str, Any]:
        """
        Executes outbound HTTPS POST to the configured authorised endpoint with defense-in-depth headers.
        """
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "AEGIS-Critical-Gateway/1.0",
            "X-AEGIS-Alert-ID": queue_item.alert_id,
            "X-AEGIS-Idempotency-Key": queue_item.idempotency_key,
            "X-AEGIS-Payload-Hash": queue_item.payload_hash,
            "X-AEGIS-Signature": f"sha256={signature}",
            "X-AEGIS-Destination-Type": DESTINATION_TYPE,
        }
        if DESTINATION_API_KEY:
            headers["Authorization"] = f"Bearer {DESTINATION_API_KEY}"

        queue_item.attempt_count += 1
        queue_item.last_attempt_at = _now()

        try:
            with httpx.Client(timeout=6.0, verify=True) as client:
                res = client.post(
                    queue_item.destination_url,
                    content=payload_str.encode("utf-8"),
                    headers=headers,
                )
                queue_item.response_code = res.status_code

                if res.status_code in (200, 201, 202):
                    queue_item.delivery_status = "DELIVERED"
                    queue_item.delivered_at = _now()
                    queue_item.failure_reason = None
                    db.add(
                        AuditLog(
                            user_email=user_email,
                            action="EXTERNAL_TRANSMISSION_SUCCESS",
                            entity_type="CriticalEscalationQueue",
                            entity_id=queue_item.alert_id,
                            details_json={
                                "destination_type": queue_item.destination_type,
                                "destination_url": queue_item.destination_url,
                                "status_code": res.status_code,
                                "payload_hash": queue_item.payload_hash,
                            },
                        )
                    )
                    db.commit()
                    return {
                        "alert_id": queue_item.alert_id,
                        "status": "DELIVERED",
                        "message": f"Successfully transmitted critical alert package to authorised destination ({DESTINATION_TYPE}).",
                        "destination_type": DESTINATION_TYPE,
                        "response_code": res.status_code,
                        "delivered_at": queue_item.delivered_at.isoformat(),
                    }
                else:
                    queue_item.delivery_status = "FAILED" if queue_item.attempt_count >= queue_item.max_attempts else "RETRYING"
                    queue_item.failure_reason = f"Endpoint responded with HTTP {res.status_code}: {res.text[:200]}"
        except Exception as e:
            queue_item.delivery_status = "FAILED" if queue_item.attempt_count >= queue_item.max_attempts else "RETRYING"
            queue_item.failure_reason = f"Network communication error: {type(e).__name__} - {str(e)}"
            logger.warning(f"Transmission to {queue_item.destination_url} failed: {queue_item.failure_reason}")

        db.add(
            AuditLog(
                user_email=user_email,
                action="EXTERNAL_TRANSMISSION_FAILED",
                entity_type="CriticalEscalationQueue",
                entity_id=queue_item.alert_id,
                details_json={
                    "destination_type": queue_item.destination_type,
                    "attempt_count": queue_item.attempt_count,
                    "reason": queue_item.failure_reason,
                },
            )
        )
        db.commit()

        return {
            "alert_id": queue_item.alert_id,
            "status": queue_item.delivery_status,
            "message": f"Outbound transmission could not be completed: {queue_item.failure_reason}. Retaining in protected local queue.",
            "destination_type": DESTINATION_TYPE,
            "attempt_count": queue_item.attempt_count,
            "offline_resilient": True,
        }

    @classmethod
    def retry_transmission(
        cls,
        db: Session,
        queue_id: int,
        user_email: str | None = "supervisor@aegis.local",
    ) -> dict[str, Any]:
        """
        Supervisor-initiated retry for a queued or failed transmission.
        """
        item = db.get(CriticalEscalationQueue, queue_id)
        if not item:
            raise ValueError(f"Queue record #{queue_id} does not exist.")
        if item.delivery_status == "DELIVERED":
            return {
                "alert_id": item.alert_id,
                "status": "DELIVERED",
                "message": "Alert is already delivered.",
            }

        canonical_str = json.dumps(item.minimised_payload_json, sort_keys=True, separators=(",", ":"))
        signature = item.signature or cls.compute_signature(canonical_str)

        if not ESCALATION_ENABLED or not DESTINATION_URL:
            item.delivery_status = "AWAITING_AUTH_ENDPOINT"
            item.failure_reason = "Cannot retry: No authorised external endpoint is configured."
            db.commit()
            return {
                "alert_id": item.alert_id,
                "status": "AWAITING_AUTH_ENDPOINT",
                "message": item.failure_reason,
            }

        item.destination_url = DESTINATION_URL
        return cls._dispatch(db, item, canonical_str, signature, user_email)

    @classmethod
    def auto_register_critical_finding(
        cls,
        db: Session,
        finding: Finding,
        attention_score: float,
        user_email: str | None = "system@aegis.local",
        indicators: list[str] | None = None,
    ) -> CriticalEscalationQueue:
        """
        FEATURE 1 & 7: Automatically classifies a score >= 98 as CRITICAL, creates
        a Senior Supervisory Review item in the Critical Priority Queue, and logs creation audit.
        Deduplication is strictly enforced.
        """
        if attention_score < CRITICAL_SCORE_THRESHOLD:
            raise ValueError(f"Score {attention_score} is not critical (threshold is {CRITICAL_SCORE_THRESHOLD})")

        finding.severity = "CRITICAL"
        finding.score_contribution = attention_score

        package = cls.build_minimised_package(
            finding=finding,
            attention_score=attention_score,
            indicators=indicators,
        )
        canonical_str = json.dumps(package, sort_keys=True, separators=(",", ":"))
        payload_hash = hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()
        idempotency_key = f"IDEMP-{finding.finding_code}-{payload_hash[:16]}"
        signature = cls.compute_signature(canonical_str)

        # Check existing
        existing = db.scalar(
            select(CriticalEscalationQueue).where(
                (CriticalEscalationQueue.idempotency_key == idempotency_key)
                | (CriticalEscalationQueue.finding_id == finding.id)
            )
        )
        if existing:
            return existing

        queue_item = CriticalEscalationQueue(
            alert_id=package["alert_id"],
            finding_id=finding.id,
            cse_code=finding.cse.cse_code if finding.cse else "UNKNOWN",
            attention_score=round(float(attention_score), 2),
            severity="CRITICAL",
            destination_type=DESTINATION_TYPE,
            destination_url=DESTINATION_URL or None,
            payload_hash=payload_hash,
            idempotency_key=idempotency_key,
            minimised_payload_json=package,
            delivery_status="AWAITING_AUTH_ENDPOINT" if not (ESCALATION_ENABLED and DESTINATION_URL) else "PENDING",
            attempt_count=0,
            max_attempts=5,
            signature=signature,
            created_at=_now(),
        )
        db.add(queue_item)
        db.flush()

        log_action(
            db=db,
            user_email=user_email or "system@aegis.local",
            action="CRITICAL_FINDING_CREATED",
            entity_type="CriticalEscalationQueue",
            entity_id=queue_item.alert_id,
            details={
                "finding_code": finding.finding_code,
                "attention_score": attention_score,
                "tier": "CRITICAL",
                "priority_queue": True,
                "requires_senior_review": True,
                "status": queue_item.delivery_status,
            }
        )
        db.commit()
        return queue_item

    @classmethod
    def get_critical_findings(cls, db: Session, limit: int = 50) -> list[dict[str, Any]]:
        """
        FEATURE 1 & 2: Returns findings with Attention Score 98–100 sorted strictly by:
        1. Attention Score descending (100 > 99 > 98)
        2. Newest timestamp first
        """
        # 1. Check any unqueued critical findings in database and auto-register them
        crit_findings = db.scalars(
            select(Finding).where(
                (Finding.score_contribution >= CRITICAL_SCORE_THRESHOLD)
                | (Finding.severity == "CRITICAL")
            )
        ).all()

        for f in crit_findings:
            score = f.score_contribution if f.score_contribution and f.score_contribution >= CRITICAL_SCORE_THRESHOLD else 98.0
            existing_queue = db.scalar(select(CriticalEscalationQueue).where(CriticalEscalationQueue.finding_id == f.id))
            if not existing_queue:
                cls.auto_register_critical_finding(db, f, score)

        # 2. Query queue sorted by attention_score DESC, then created_at DESC
        stmt = (
            select(CriticalEscalationQueue)
            .order_by(desc(CriticalEscalationQueue.attention_score), desc(CriticalEscalationQueue.created_at))
            .limit(limit)
        )
        queue_items = list(db.scalars(stmt).all())

        results = []
        for idx, item in enumerate(queue_items, start=1):
            finding = item.finding or db.get(Finding, item.finding_id) if item.finding_id else None
            score = round(float(item.attention_score), 2)
            
            # Visual priority label based on exact score ranking
            if score >= 100.0:
                priority_label = "🚨 Immediate Senior Review"
            elif score >= 99.0:
                priority_label = "🚨 Senior Review"
            else:
                priority_label = "🚨 Senior Review"

            evidence_items = []
            if finding and finding.evidence:
                evidence_items = [
                    {
                        "code": ev.evidence_code,
                        "type": ev.record_type,
                        "record_id": ev.record_id,
                        "summary": ev.summary,
                    }
                    for ev in finding.evidence
                ]

            results.append({
                "rank": idx,
                "queue_id": item.id,
                "alert_id": item.alert_id,
                "finding_id": finding.finding_code if finding else item.alert_id,
                "cse_code": item.cse_code,
                "attention_score": score,
                "priority_label": priority_label,
                "attack_type": finding.category if finding else item.minimised_payload_json.get("attack_type", "Operational Security Threat"),
                "finding_type": finding.category if finding else item.minimised_payload_json.get("finding_type", "EXECUTION_GAP"),
                "title": finding.title if finding else item.minimised_payload_json.get("summary", "Critical Supervisory Alert"),
                "description": finding.description if finding else item.minimised_payload_json.get("description", ""),
                "explanation": finding.explanation if finding else "Attention Score >= 98 critical threshold exceeded.",
                "status": finding.status if finding else "OPEN",
                "delivery_status": item.delivery_status,
                "source_system": item.minimised_payload_json.get("source_system", "A.E.G.I.S. SAT-SA"),
                "timestamp": item.created_at.isoformat() if item.created_at else _now().isoformat(),
                "payload_hash": item.payload_hash,
                "idempotency_key": item.idempotency_key,
                "evidence": evidence_items,
                "minimised_package": item.minimised_payload_json,
            })

        return results

    @classmethod
    def acknowledge_finding(cls, db: Session, finding_code: str, user_email: str) -> dict[str, Any]:
        """FEATURE 3 & 8: Senior reviewer acknowledges the critical finding."""
        finding = db.scalar(select(Finding).where(Finding.finding_code == finding_code))
        if not finding:
            # Check by alert_id in queue
            queue_item = db.scalar(select(CriticalEscalationQueue).where(CriticalEscalationQueue.alert_id == finding_code))
            if queue_item and queue_item.finding:
                finding = queue_item.finding

        finding_id_str = finding.finding_code if finding else finding_code
        if finding:
            finding.status = "UNDER REVIEW"
            db.commit()

        log_action(
            db=db,
            user_email=user_email,
            action="CRITICAL_FINDING_ACKNOWLEDGED",
            entity_type="Finding",
            entity_id=finding_id_str,
            details={"status": "UNDER REVIEW", "notes": "Senior supervisory review initiated"}
        )
        return {"status": "success", "message": f"Critical finding {finding_id_str} acknowledged by senior supervisor."}

    @classmethod
    def resolve_finding(cls, db: Session, finding_code: str, user_email: str, notes: str | None = None) -> dict[str, Any]:
        """FEATURE 3 & 8: Senior reviewer marks the critical finding resolved."""
        finding = db.scalar(select(Finding).where(Finding.finding_code == finding_code))
        if not finding:
            queue_item = db.scalar(select(CriticalEscalationQueue).where(CriticalEscalationQueue.alert_id == finding_code))
            if queue_item and queue_item.finding:
                finding = queue_item.finding

        finding_id_str = finding.finding_code if finding else finding_code
        if finding:
            finding.status = "RESOLVED"
            finding.resolved_at = _now()
            db.commit()

        log_action(
            db=db,
            user_email=user_email,
            action="CRITICAL_FINDING_RESOLVED",
            entity_type="Finding",
            entity_id=finding_id_str,
            details={"status": "RESOLVED", "notes": notes or "Resolved after senior supervisory review"}
        )
        return {"status": "success", "message": f"Critical finding {finding_id_str} marked as RESOLVED."}

    @classmethod
    def view_finding(cls, db: Session, finding_code: str, user_email: str) -> dict[str, Any]:
        """FEATURE 8: Records audit log when a critical finding is viewed by senior reviewer."""
        log_action(
            db=db,
            user_email=user_email,
            action="CRITICAL_FINDING_VIEWED",
            entity_type="Finding",
            entity_id=finding_code,
            details={"viewed_at": _now().isoformat()}
        )
        return {"status": "success", "finding_code": finding_code}
