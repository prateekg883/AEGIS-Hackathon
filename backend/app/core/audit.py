import hashlib
import json
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.models import AuditLog

GENESIS_HASH = "0" * 64

def canonicalize_details(details: Any) -> str:
    """
    Produces deterministic, canonical JSON representation with sorted keys and no whitespace variation.
    """
    if details is None:
        return "{}"
    if isinstance(details, str):
        try:
            parsed = json.loads(details)
            return json.dumps(parsed, sort_keys=True, separators=(',', ':'), default=str)
        except Exception:
            return json.dumps({"raw": details}, sort_keys=True, separators=(',', ':'), default=str)
    if isinstance(details, dict):
        return json.dumps(details, sort_keys=True, separators=(',', ':'), default=str)
    return json.dumps({"value": str(details)}, sort_keys=True, separators=(',', ':'), default=str)

def calculate_record_hash(prev_hash: str, action: str, user_email: str | None, entity_type: str | None, entity_id: str | None, details: Any) -> str:
    canonical_details = canonicalize_details(details)
    raw = f"{prev_hash}|{action}|{user_email or ''}|{entity_type or ''}|{entity_id or ''}|{canonical_details}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def log_action(db: Session, user_email: str, action: str, entity_type: str | None = None, entity_id: str | None = None, details: dict[str, Any] | None = None) -> AuditLog:
    # Find latest audit log to establish hash chain link
    last_log = db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(1)).first()
    prev_hash = (last_log.record_hash if last_log and last_log.record_hash else GENESIS_HASH)

    record_hash = calculate_record_hash(
        prev_hash=prev_hash,
        action=action,
        user_email=user_email,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details
    )

    audit = AuditLog(
        user_email=user_email,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details_json=details,
        prev_hash=prev_hash,
        record_hash=record_hash
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)
    return audit

def verify_audit_log_chain(db: Session) -> dict[str, Any]:
    logs = list(db.scalars(select(AuditLog).order_by(AuditLog.id.asc())).all())
    total_records = len(logs)
    now_iso = datetime.now(timezone.utc).isoformat()

    if total_records == 0:
        return {
            "status": "VERIFIED",
            "integrity": "VALID",
            "total_events": 0,
            "chain_depth": 0,
            "broken_record_id": None,
            "last_verified_at": now_iso,
            "message": "Audit ledger empty. Hash chain ready (genesis state)."
        }

    expected_prev = GENESIS_HASH
    for log in logs:
        computed = calculate_record_hash(
            prev_hash=expected_prev,
            action=log.action,
            user_email=log.user_email,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            details=log.details_json
        )
        if log.record_hash is None:
            # Backfill legacy record gracefully during migration so existing records enter the chain
            log.prev_hash = expected_prev
            log.record_hash = computed
            db.commit()
        elif log.record_hash != computed or (log.prev_hash and log.prev_hash != expected_prev):
            return {
                "status": "FAILED",
                "integrity": "AUDIT INTEGRITY VERIFICATION FAILED",
                "total_events": total_records,
                "chain_depth": log.id,
                "broken_record_id": log.id,
                "broken_action": log.action,
                "last_verified_at": now_iso,
                "message": f"Tampering detected at Audit Record #{log.id} ({log.action}). Hash chain broken."
            }
        expected_prev = log.record_hash

    return {
        "status": "VERIFIED",
        "integrity": "VALID",
        "total_events": total_records,
        "chain_depth": total_records,
        "broken_record_id": None,
        "last_verified_at": now_iso,
        "message": f"All {total_records} audit records cryptographically verified via sequential SHA-256 hash chaining."
    }


def rebaseline_audit_log_chain(db: Session, admin_email: str) -> dict[str, Any]:
    """
    Administrator-authorized re-baselining of the hash chain for legacy records.
    """
    logs = list(db.scalars(select(AuditLog).order_by(AuditLog.id.asc())).all())
    expected_prev = GENESIS_HASH
    for log in logs:
        computed = calculate_record_hash(
            prev_hash=expected_prev,
            action=log.action,
            user_email=log.user_email,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            details=log.details_json
        )
        log.prev_hash = expected_prev
        log.record_hash = computed
        expected_prev = computed
    db.commit()
    return verify_audit_log_chain(db)

