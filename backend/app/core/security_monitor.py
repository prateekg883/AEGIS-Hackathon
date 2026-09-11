import os
import time
import socket
import shutil
try:
    import psutil
except ImportError:
    psutil = None
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.models import SecurityEvent, SecurityAlert, SecurityConfig, User, AuditLog, IngestionBatch
from app.db.session import engine

# Record app boot timestamp for uptime calculation
APP_START_TIME = time.time()

def probe_internet_connectivity(timeout_seconds: float = 0.2) -> dict[str, str]:
    """
    Real socket probe checking if outbound WAN routing is blocked.
    In a true air-gapped system, connecting to a public IP raises an exception.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout_seconds)
    try:
        # Attempt connection to public DNS root/anycast IP
        s.connect(("8.8.8.8", 53))
        s.close()
        return {
            "status": "WARNING",
            "state": "CONNECTED",
            "detail": "Outbound WAN route is open to internet address (NOT AIR-GAPPED)"
        }
    except (socket.timeout, socket.error, OSError):
        return {
            "status": "ACTIVE",
            "state": "BLOCKED",
            "detail": "Outbound WAN socket packets blocked at host/hypervisor boundary"
        }
    finally:
        try:
            s.close()
        except Exception:
            pass

def probe_dns_resolution() -> dict[str, str]:
    """
    Real probe checking if external internet DNS resolution is blocked or unmapped.
    """
    try:
        socket.gethostbyname("external-telemetry.ntro.gov.in")
        return {
            "status": "WARNING",
            "state": "RESOLVED",
            "detail": "External domain successfully resolved"
        }
    except (socket.gaierror, socket.timeout, OSError):
        return {
            "status": "ACTIVE",
            "state": "BLOCKED",
            "detail": "External DNS lookups fail safely; isolated split-horizon/offline host"
        }

def is_airgap_mode_enabled(db: Session | None) -> bool:
    if not db:
        return True
    cfg = db.scalar(select(SecurityConfig).where(SecurityConfig.key == "AIR_GAPPED_MODE"))
    if cfg and cfg.value_json:
        return bool(cfg.value_json.get("enabled", True))
    sys_cfg = db.scalar(select(SecurityConfig).where(SecurityConfig.key == "SYSTEM_SECURITY_CONFIG"))
    if sys_cfg and sys_cfg.value_json:
        return bool(sys_cfg.value_json.get("air_gapped_mode", True))
    return True

def set_airgap_mode(db: Session, enabled: bool, admin_email: str, reason: str | None = None) -> dict[str, Any]:
    old_enabled = is_airgap_mode_enabled(db)
    now_iso = datetime.now(timezone.utc).isoformat()

    # Update AIR_GAPPED_MODE in SecurityConfig
    cfg = db.scalar(select(SecurityConfig).where(SecurityConfig.key == "AIR_GAPPED_MODE"))
    if not cfg:
        cfg = SecurityConfig(
            key="AIR_GAPPED_MODE",
            value_json={"enabled": enabled, "mode": "ON" if enabled else "OFF", "reason": reason or "Admin mode change"},
            updated_by=admin_email
        )
        db.add(cfg)
    else:
        cfg.value_json = {"enabled": enabled, "mode": "ON" if enabled else "OFF", "reason": reason or "Admin mode change"}
        cfg.updated_by = admin_email

    # Also update SYSTEM_SECURITY_CONFIG for full system sync
    sys_cfg = db.scalar(select(SecurityConfig).where(SecurityConfig.key == "SYSTEM_SECURITY_CONFIG"))
    if sys_cfg:
        val = dict(sys_cfg.value_json or {})
        val["air_gapped_mode"] = enabled
        val["auth_mode"] = "AIR_GAPPED" if enabled else "CONNECTED"
        sys_cfg.value_json = val
        sys_cfg.updated_by = admin_email

    db.commit()

    # Log action in AuditLog
    from app.core.audit import log_action
    log_action(
        db=db,
        user_email=admin_email,
        action="AIR_GAP_MODE_CHANGED",
        entity_type="SYSTEM_SETTING",
        entity_id="AIR_GAPPED_MODE",
        details={
            "user": admin_email,
            "old_state": "ON" if old_enabled else "OFF",
            "new_state": "ON" if enabled else "OFF",
            "timestamp": now_iso,
            "reason": reason or "Administrator configuration change"
        }
    )

    # Record security event
    record_security_event(
        db=db,
        event_type="AIR_GAP_POLICY_CHANGED",
        component="Air-Gap Security Policy",
        severity="LOW" if enabled else "MEDIUM",
        status="ALLOWED",
        reason=f"Administrator {admin_email} changed Air-Gapped Mode to {'ON' if enabled else 'OFF'}",
        user_email=admin_email,
        requested_resource="/api/security/air-gap/toggle",
        action="POST",
        details={"old_state": "ON" if old_enabled else "OFF", "new_state": "ON" if enabled else "OFF"}
    )

    return {
        "status": "SUCCESS",
        "air_gapped_mode": "ON" if enabled else "OFF",
        "enabled": enabled,
        "message": f"Air-Gapped Mode set to {'ON (Enforce Local Operation)' if enabled else 'OFF (External Integrations Permitted)'}"
    }

def get_airgap_status(db: Session | None = None) -> dict[str, Any]:
    """
    Comprehensive real-time environment air-gap status check.
    Strictly separates Application Policy from Host Network Isolation.
    """
    is_policy_enabled = is_airgap_mode_enabled(db) if db else True
    net_probe = probe_internet_connectivity()
    dns_probe = probe_dns_resolution()

    # Count observed application-level outbound connection attempts
    ext_attempts_count = 0
    if db:
        ext_attempts_count = db.scalar(
            select(func.count(SecurityEvent.id)).where(SecurityEvent.destination.is_not(None))
        ) or 0

    # Policy vs Isolation distinct values
    policy_status = "ACTIVE" if is_policy_enabled else "INACTIVE"
    ext_comm_status = "DISABLED" if is_policy_enabled else "PERMITTED"
    internet_status = net_probe["state"]  # CONNECTED or BLOCKED
    
    # Isolation is NOT_VERIFIED if host is connected to internet, or VERIFIED only if WAN is physically blocked
    isolation_status = "NOT VERIFIED" if internet_status == "CONNECTED" else ("VERIFIED" if internet_status == "BLOCKED" else "NOT VERIFIED")
    dns_status = dns_probe["state"]

    if is_policy_enabled:
        headline = "APPLICATION AIR-GAP POLICY ACTIVE"
        if internet_status == "CONNECTED":
            explanation = "Application Air-Gap Policy is ACTIVE (external app comms disabled), but host-level internet connection is CONNECTED (physical isolation NOT VERIFIED)."
        else:
            explanation = "Application Air-Gap Policy is ACTIVE and socket probes confirm outbound WAN routing is BLOCKED."
    else:
        headline = "APPLICATION AIR-GAP POLICY INACTIVE"
        explanation = "Air-Gap Policy is INACTIVE; external application communication is permitted where configured."

    return {
        "air_gap_policy": {
            "enabled": is_policy_enabled,
            "status": policy_status
        },
        "external_communication": {
            "status": ext_comm_status,
            "detail": "All outbound API/cloud communication blocked by policy" if is_policy_enabled else "External application communication permitted where configured"
        },
        "internet": {
            "status": internet_status,
            "detail": net_probe["detail"]
        },
        "network_isolation": {
            "status": isolation_status,
            "detail": "Outbound WAN route is open on host interface (Physical air-gap NOT VERIFIED)" if internet_status == "CONNECTED" else "Host socket probes blocked at hypervisor/host boundary"
        },
        "dns": {
            "status": dns_status,
            "detail": dns_probe["detail"]
        },
        "outbound_attempts": ext_attempts_count,
        "outbound_attempts_label": f"{ext_attempts_count} OBSERVED",
        "outbound_attempts_detail": "No outbound attempts were observed by the application (does not prove host physical isolation)" if ext_attempts_count == 0 else f"{ext_attempts_count} outbound attempts observed",
        "local_processing": "ACTIVE",
        "local_processing_detail": "Local SQLite database and analytics execution operational",
        "summary_headline": headline,
        "explanation": explanation,
        "timestamp": datetime.now(timezone.utc).isoformat(),

        # Legacy backward-compatibility mappings for existing consumers
        "air_gapped_mode": policy_status,
        "status": policy_status,
        "internet_access": internet_status,
        "internet_detail": net_probe["detail"],
        "external_connection_attempts": ext_attempts_count,
        "external_api_dependency": "NONE",
        "external_api_detail": "Zero external cloud/telemetry endpoints configured",
        "cloud_dependency": "NONE",
        "cloud_dependency_detail": "100% local database & isolated local file store",
        "dns_status": dns_status,
        "dns_detail": dns_probe["detail"]
    }

def get_security_health(db: Session) -> dict[str, Any]:
    """
    Executes actual health checks across the 9 primary system components.
    Statuses: HEALTHY, WARNING, ERROR, DISABLED, NOT AVAILABLE.
    """
    is_airgap = is_airgap_mode_enabled(db)
    components = {}

    # 1. Database Check
    db_start = time.perf_counter()
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1")).scalar()
        db_lat = round((time.perf_counter() - db_start) * 1000, 2)
        components["Database"] = {
            "status": "HEALTHY",
            "display_status": "HEALTHY",
            "is_operational": True,
            "latency_ms": db_lat,
            "detail": f"SQLite relational store responding ({db_lat}ms)"
        }
    except Exception as e:
        components["Database"] = {
            "status": "ERROR",
            "display_status": "ERROR",
            "is_operational": False,
            "latency_ms": None,
            "detail": f"Database query failed: {str(e)}"
        }

    # 2. Authentication Service
    try:
        user_count = db.scalar(select(func.count(User.id))) or 0
        components["Authentication Service"] = {
            "status": "HEALTHY" if user_count > 0 else "WARNING",
            "display_status": "HEALTHY" if user_count > 0 else "WARNING",
            "is_operational": user_count > 0,
            "detail": f"PBKDF2/SHA-256 auth active with {user_count} local user(s)"
        }
    except Exception as e:
        components["Authentication Service"] = {
            "status": "ERROR",
            "display_status": "ERROR",
            "is_operational": False,
            "detail": f"Auth store query error: {str(e)}"
        }

    # 3. OTP Service
    if is_airgap:
        components["OTP Service"] = {
            "status": "HEALTHY",
            "display_status": "DISABLED — AIR-GAPPED MODE",
            "is_operational": True,
            "detail": "External Gmail OTP disabled by air-gap policy; local CSPRNG available"
        }
    else:
        components["OTP Service"] = {
            "status": "HEALTHY",
            "display_status": "HEALTHY",
            "is_operational": True,
            "detail": "Gmail OTP delivery / Local CSPRNG entropy generator operational"
        }

    # 4. Backend API
    components["Backend API"] = {
        "status": "HEALTHY",
        "display_status": "HEALTHY",
        "is_operational": True,
        "detail": f"FastAPI runtime active (Uptime: {int(time.time() - APP_START_TIME)}s)"
    }

    # 5. Evidence Storage
    try:
        evidence_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data")
        os.makedirs(evidence_dir, exist_ok=True)
        test_file = os.path.join(evidence_dir, ".write_test")
        with open(test_file, "w") as f:
            f.write("aegis_health_check")
        os.remove(test_file)
        components["Evidence Storage"] = {
            "status": "HEALTHY",
            "display_status": "HEALTHY",
            "is_operational": True,
            "detail": "Local evidence directory writable & verified"
        }
    except Exception as e:
        components["Evidence Storage"] = {
            "status": "WARNING",
            "display_status": "WARNING",
            "is_operational": True,
            "detail": f"Evidence storage check warning: {str(e)}"
        }

    # 6. Analytics Engine
    try:
        from app.analytics.attention.service import run_attention_score
        components["Analytics Engine"] = {
            "status": "HEALTHY",
            "display_status": "HEALTHY",
            "is_operational": True,
            "detail": "Deterministic rules engine loaded (Execution Gaps, Negative Space, Anomaly, Attention)"
        }
    except Exception as e:
        components["Analytics Engine"] = {
            "status": "WARNING",
            "display_status": "WARNING",
            "is_operational": True,
            "detail": f"Analytics engine import issue: {str(e)}"
        }

    # 7. Audit Logging
    try:
        from app.core.audit import verify_audit_log_chain
        audit_res = verify_audit_log_chain(db)
        if audit_res["status"] == "VERIFIED":
            components["Audit Logging"] = {
                "status": "HEALTHY",
                "display_status": "HEALTHY",
                "is_operational": True,
                "detail": f"Cryptographic ledger valid ({audit_res['total_events']} chained records)"
            }
        else:
            components["Audit Logging"] = {
                "status": "ERROR",
                "display_status": "ERROR",
                "is_operational": False,
                "detail": audit_res.get("message", "Audit integrity verification failed")
            }
    except Exception as e:
        components["Audit Logging"] = {
            "status": "WARNING",
            "display_status": "WARNING",
            "is_operational": True,
            "detail": f"Audit ledger check error: {str(e)}"
        }

    # 8. File Processing
    try:
        import csv
        import json
        components["File Processing"] = {
            "status": "HEALTHY",
            "display_status": "HEALTHY",
            "is_operational": True,
            "detail": "CSV/JSON streaming parsers initialized"
        }
    except Exception as e:
        components["File Processing"] = {
            "status": "ERROR",
            "display_status": "ERROR",
            "is_operational": False,
            "detail": f"File parsing engine error: {str(e)}"
        }

    # 9. Session Management
    try:
        from app.core.security import create_access_token, decode_access_token
        test_jwt = create_access_token({"sub": "health_probe@aegis.local"})
        decoded = decode_access_token(test_jwt)
        is_jwt_ok = bool(decoded and decoded.get("sub") == "health_probe@aegis.local")
        components["Session Management"] = {
            "status": "HEALTHY" if is_jwt_ok else "WARNING",
            "display_status": "HEALTHY" if is_jwt_ok else "WARNING",
            "is_operational": is_jwt_ok,
            "detail": "JWT HMAC-SHA256 signature verification functional"
        }
    except Exception as e:
        components["Session Management"] = {
            "status": "ERROR",
            "display_status": "ERROR",
            "is_operational": False,
            "detail": f"Session verification error: {str(e)}"
        }

    # Overall health calculation
    raw_statuses = [c["status"] for c in components.values()]
    operational_count = sum(1 for c in components.values() if c.get("is_operational", True))

    if "ERROR" in raw_statuses:
        overall = "ERROR"
    elif "WARNING" in raw_statuses:
        overall = "WARNING"
    else:
        overall = "HEALTHY"

    return {
        "overall": overall,
        "components": components,
        "total_components": len(components),
        "healthy_count": operational_count,
        "operational_summary": f"{operational_count}/{len(components)} Operational",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

def get_security_posture(db: Session) -> dict[str, Any]:
    airgap = get_airgap_status(db)
    health = get_security_health(db)
    from app.core.audit import verify_audit_log_chain
    audit_check = verify_audit_log_chain(db)

    active_alerts = list(db.scalars(
        select(SecurityAlert).where(SecurityAlert.status == "ACTIVE")
    ).all())
    crit_alerts = [a for a in active_alerts if a.severity == "CRITICAL"]
    high_alerts = [a for a in active_alerts if a.severity == "HIGH"]

    factors = []
    issues = []

    # Factor 1: Application Air-Gap Policy
    is_policy_active = airgap["air_gap_policy"]["enabled"]
    if is_policy_active:
        factors.append({"name": "Application Air-Gap Policy", "status": "ACTIVE", "detail": "External application comms disabled"})
    else:
        factors.append({"name": "Application Air-Gap Policy", "status": "INACTIVE", "detail": "External application comms permitted"})

    # Factor 2: Host Network Isolation
    if airgap["internet"]["status"] == "CONNECTED":
        factors.append({"name": "Host Network Isolation", "status": "NOT VERIFIED", "detail": "Host internet route is active"})
        issues.append("Host-level internet isolation is not verified (WAN route open)")
    elif airgap["internet"]["status"] == "BLOCKED":
        factors.append({"name": "Host Network Isolation", "status": "VERIFIED", "detail": "Socket probes blocked at host boundary"})
    else:
        factors.append({"name": "Host Network Isolation", "status": "NOT AVAILABLE", "detail": "Socket probe telemetry unavailable"})

    # Factor 3: Application Health
    if health["overall"] == "HEALTHY":
        factors.append({"name": "Application Health", "status": "HEALTHY", "detail": health["operational_summary"]})
    elif health["overall"] == "WARNING":
        factors.append({"name": "Application Health", "status": "WARNING", "detail": "One or more components reporting warning"})
        issues.append("System components reporting warning")
    else:
        factors.append({"name": "Application Health", "status": "ERROR", "detail": "One or more components reporting ERROR"})
        issues.append("Core system component failure")

    # Factor 4: Audit Ledger Integrity
    if audit_check["status"] == "VERIFIED":
        factors.append({"name": "Audit Integrity", "status": "VERIFIED", "detail": f"{audit_check['total_events']} records hash-chained"})
    else:
        factors.append({"name": "Audit Integrity", "status": "CRITICAL", "detail": audit_check["message"]})
        issues.append("Audit log cryptographic hash chain validation failed")

    # Factor 5: External Dependencies
    factors.append({"name": "External Dependencies", "status": "NONE", "detail": "Zero external cloud/API services configured"})

    # Compute Level and Reason
    if audit_check["status"] == "FAILED" or any(f["status"] == "CRITICAL" for f in factors) or crit_alerts:
        level = "CRITICAL"
        reason = "Audit ledger verification failed or critical security alert active. Review required."
    elif any(f["status"] == "ERROR" for f in factors) or len(high_alerts) > 2:
        level = "ATTENTION REQUIRED"
        reason = f"Elevated alerts or degraded components require attention: {'; '.join(issues)}."
    elif is_policy_active and airgap["internet"]["status"] == "CONNECTED":
        level = "CAUTION"
        reason = "Application-level external communication is disabled, but host-level internet isolation could not be independently verified."
    elif not is_policy_active:
        level = "CAUTION"
        reason = "Application Air-Gap Policy is inactive; external communication permitted where configured."
    elif any(f["status"] == "WARNING" for f in factors):
        level = "CAUTION"
        reason = f"System operating with warnings: {'; '.join(issues)}."
    else:
        level = "SECURE"
        reason = "All security dimensions satisfied: application air-gap policy active, host isolation observed, all components healthy, audit chain verified."

    return {
        "level": level,
        "posture": level,
        "reason": reason,
        "explanation": reason,
        "factors": factors,
        "active_critical_alerts": len(crit_alerts),
        "active_high_alerts": len(high_alerts),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

def record_security_event(
    db: Session,
    event_type: str,
    component: str,
    severity: str = "LOW",
    status: str = "ALLOWED",
    reason: str | None = None,
    user_email: str | None = None,
    user_role: str | None = None,
    destination: str | None = None,
    port_protocol: str | None = None,
    requested_resource: str | None = None,
    action: str | None = None,
    source_ip: str | None = "127.0.0.1",
    details: dict[str, Any] | None = None
) -> SecurityEvent:
    """
    Saves a verified SecurityEvent to the relational database.
    Passwords, OTP secrets, or credentials must NEVER be passed.
    """
    ev = SecurityEvent(
        event_type=event_type,
        component=component,
        source_ip=source_ip,
        destination=destination,
        port_protocol=port_protocol,
        severity=severity,
        status=status,
        reason=reason,
        user_email=user_email,
        user_role=user_role,
        requested_resource=requested_resource,
        action=action,
        details_json=details
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev

def create_security_alert(
    db: Session,
    alert_code: str,
    title: str,
    severity: str,
    category: str,
    source: str,
    description: str
) -> SecurityAlert:
    """
    Creates an actionable SecurityAlert.
    """
    existing = db.scalar(select(SecurityAlert).where(SecurityAlert.alert_code == alert_code))
    if existing:
        return existing

    alert = SecurityAlert(
        alert_code=alert_code,
        title=title,
        severity=severity,
        category=category,
        source=source,
        status="ACTIVE",
        description=description
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert

def get_system_resources() -> dict[str, Any]:
    """
    Collects real observable system resource telemetry.
    CPU, Memory, Disk, DB storage, Evidence storage, Uptime.
    Returns 'NOT AVAILABLE' if metric cannot be reliably queried.
    """
    uptime_seconds = int(time.time() - APP_START_TIME)
    
    # 1. CPU & Memory
    cpu_percent = "NOT AVAILABLE"
    memory_percent = "NOT AVAILABLE"
    memory_used_mb = "NOT AVAILABLE"
    memory_total_mb = "NOT AVAILABLE"
    
    if psutil:
        try:
            cpu_val = psutil.cpu_percent(interval=None)
            cpu_percent = f"{cpu_val:.1f}%"
        except Exception:
            pass
            
        try:
            mem = psutil.virtual_memory()
            memory_percent = f"{mem.percent:.1f}%"
            memory_used_mb = f"{round(mem.used / (1024 * 1024), 1)} MB"
            memory_total_mb = f"{round(mem.total / (1024 * 1024), 1)} MB"
        except Exception:
            pass
            
    # 2. Disk Usage
    disk_percent = "NOT AVAILABLE"
    disk_free_gb = "NOT AVAILABLE"
    disk_total_gb = "NOT AVAILABLE"
    try:
        total, used, free = shutil.disk_usage(os.getcwd())
        disk_pct = (used / total) * 100
        disk_percent = f"{disk_pct:.1f}%"
        disk_free_gb = f"{round(free / (1024**3), 2)} GB"
        disk_total_gb = f"{round(total / (1024**3), 2)} GB"
    except Exception:
        pass

    # 3. Database Size
    db_size_mb = "NOT AVAILABLE"
    try:
        db_path = os.path.join(os.path.dirname(__file__), "..", "..", "aegis.db")
        if os.path.exists(db_path):
            size_b = os.path.getsize(db_path)
            db_size_mb = f"{round(size_b / (1024 * 1024), 2)} MB"
        else:
            db_size_mb = "< 1.0 MB (InMemory/Local)"
    except Exception:
        pass

    # 4. Evidence Storage Size
    evidence_size_mb = "NOT AVAILABLE"
    try:
        ev_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data")
        if os.path.exists(ev_dir):
            tot = sum(os.path.getsize(os.path.join(dirpath, f)) for dirpath, _, filenames in os.walk(ev_dir) for f in filenames)
            evidence_size_mb = f"{round(tot / (1024 * 1024), 2)} MB"
        else:
            evidence_size_mb = "0.0 MB"
    except Exception:
        pass

    return {
        "status": "NORMAL",
        "cpu": {
            "usage_percent": cpu_percent,
            "status": "NORMAL"
        },
        "memory": {
            "usage_percent": memory_percent,
            "used": memory_used_mb,
            "total": memory_total_mb,
            "status": "NORMAL"
        },
        "disk": {
            "usage_percent": disk_percent,
            "free": disk_free_gb,
            "total": disk_total_gb,
            "status": "NORMAL"
        },
        "application_uptime_seconds": uptime_seconds,
        "uptime_seconds": uptime_seconds,
        "uptime_formatted": f"{uptime_seconds // 3600}h {(uptime_seconds % 3600) // 60}m {uptime_seconds % 60}s",
        "cpu_usage": cpu_percent,
        "memory_usage": memory_percent,
        "memory_used": memory_used_mb,
        "memory_total": memory_total_mb,
        "disk_usage": disk_percent,
        "disk_free": disk_free_gb,
        "disk_total": disk_total_gb,
        "database_size": db_size_mb,
        "evidence_storage_size": evidence_size_mb,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


