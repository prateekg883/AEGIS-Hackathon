import hashlib
from datetime import timedelta, datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import Session

try:
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests
    GOOGLE_AUTH_AVAILABLE = True
except ImportError:
    GOOGLE_AUTH_AVAILABLE = False

from app.core.security import (
    create_access_token,
    decode_access_token,
    verify_password,
    get_password_hash,
    ACCESS_TOKEN_EXPIRE_SECONDS
)
from app.core import config
from app.core.audit import log_action
from app.core.security_monitor import record_security_event, create_security_alert
from app.core.otp_service import (
    create_or_refresh_otp,
    verify_user_otp,
    mask_email
)
from app.core.email_service import send_otp_email
from app.db.session import get_db
from app.models.models import User, SecurityConfig
from app.api.dependencies import get_current_user

router = APIRouter()

def get_effective_auth_mode(db: Session) -> tuple[str, bool]:
    """
    Checks if administrator has dynamically updated authentication mode in database,
    falling back to environment configuration.
    """
    cfg = db.scalar(select(SecurityConfig).where(SecurityConfig.key == "SYSTEM_SECURITY_CONFIG"))
    if cfg and cfg.value_json:
        dyn_mode = cfg.value_json.get("auth_mode")
        dyn_airgap = cfg.value_json.get("air_gapped_mode")
        if dyn_mode:
            return dyn_mode.upper(), dyn_airgap if dyn_airgap is not None else (dyn_mode == "AIR_GAPPED")
    return config.AUTH_MODE, config.AIR_GAPPED_MODE

def get_role_label(role: str) -> str:
    r = (role or "").upper()
    if "ADMIN" in r:
        return "National System Administrator"
    elif "SUPERVISOR" in r:
        return "NCIIPC Chief Supervisor"
    elif "AUDIT" in r:
        return "CERT-In Regulatory Auditor"
    elif "ANALYST" in r:
        return "PowerGrid SOC Lead (CSE-07)"
    return role

def format_user_response(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "username": user.username or user.email.split("@")[0],
        "email": user.email,
        "registered_email": user.registered_email or user.email,
        "role": user.role,
        "roleLabel": get_role_label(user.role),
        "organization": user.organization,
        "badgeColor": user.avatar_color
    }

class OTPVerifyPayload(BaseModel):
    username: str
    otp: str
    temp_token: str | None = None

class OTPResendPayload(BaseModel):
    username: str
    temp_token: str | None = None

class GoogleLoginPayload(BaseModel):
    id_token: str  # actually Google access_token from @react-oauth/google implicit flow
    role: str | None = None  # optional role hint from client (verified against DB)

class GoogleOTPSendPayload(BaseModel):
    email: str
    role: str | None = None

@router.post("/auth/google-otp/send")
@router.post("/auth/send-otp")
def send_google_email_otp(
    payload: GoogleOTPSendPayload,
    db: Session = Depends(get_db)
):
    """
    Sends a 6-digit OTP to the requested email address.
    If the user does not exist in the database, automatically provisions them
    with the requested role so that ANY email can log in smoothly.
    """
    email_clean = (payload.email or "").strip().lower()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid email address is required."
        )

    # Normalize role
    req_role = (payload.role or "").upper().strip()
    if "ADMIN" in req_role:
        assigned_role = "ADMINISTRATOR"
        org = "A.E.G.I.S. Command"
    elif "SUPERVISOR" in req_role:
        assigned_role = "SUPERVISOR"
        org = "NCIIPC Supervisory Authority"
    elif "AUDIT" in req_role:
        assigned_role = "AUDITOR"
        org = "CERT-In"
    else:
        assigned_role = "ANALYST"
        org = "PowerGrid SOC Command"

    # Find or provision user
    user = db.scalar(
        select(User).where(
            (func.lower(User.email) == email_clean) |
            (func.lower(User.registered_email) == email_clean) |
            (func.lower(User.google_linked_email) == email_clean)
        )
    )

    if not user:
        log_action(
            db=db,
            user_email=email_clean,
            action="UNAUTHORIZED_LOGIN_ATTEMPT",
            entity_type="AUTH",
            details={"email": email_clean, "role": assigned_role, "reason": "UNVERIFIED_EMAIL"}
        )
        record_security_event(
            db=db,
            event_type="UNAUTHORIZED_ACCESS",
            component="Authentication Service",
            severity="HIGH",
            status="BLOCKED",
            reason=f"Access denied: '{email_clean}' is not a verified registered user.",
            user_email=email_clean,
            requested_resource="/api/auth/google-otp/send",
            action="POST"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid email. Not a verified user."
        )
    else:
        if req_role and user.role != assigned_role:
            user.role = assigned_role
        db.commit()

    # Generate / refresh OTP
    user_otp, plaintext_otp, err = create_or_refresh_otp(db, user)
    if err:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=err)

    # Deliver via email service
    send_res = send_otp_email(
        db=db,
        to_email=email_clean,
        user_name=user.username or email_clean,
        otp=plaintext_otp,
        user_id=user.id
    )

    temp_token = create_access_token(
        data={"sub": user.email, "type": "pre_auth"},
        expires_delta=timedelta(minutes=10)
    )

    masked = mask_email(email_clean)
    print(f"\n=======================================================", flush=True)
    print(f"[*] [A.E.G.I.S. OTP CODE FOR {email_clean}]: {plaintext_otp}", flush=True)
    print(f"=======================================================\n", flush=True)

    smtp_ok = send_res.get("success", False)
    return {
        "status": "OTP_REQUIRED",
        "auth_mode": "EMAIL_OTP",
        "message": f"Verification code sent to {masked}" if smtp_ok else f"Verification code generated for {masked}. Check server logs.",
        "username": user.username or user.email,
        "masked_email": masked,
        "role": user.role,
        "temp_token": temp_token,
        "expires_in_seconds": config.OTP_EXPIRATION_SECONDS,
        "cooldown_seconds": config.OTP_RESEND_COOLDOWN_SECONDS,
        "smtp_delivered": smtp_ok,
    }

@router.post("/auth/google-callback")
def google_oauth_callback(
    payload: GoogleLoginPayload,
    db: Session = Depends(get_db)
):
    """
    Verifies a Google OAuth access_token and issues an AEGIS session JWT.

    Security model:
    - Blocked entirely when AIR_GAPPED_MODE=true (returns HTTP 503)
    - access_token is verified by calling Google's tokeninfo API (requires internet)
    - User MUST exist in AEGIS DB; role comes from DB, not from Google
    - Full audit trail is written on success and failure
    """
    import httpx as _httpx

    # ---------------------------------------------------------------
    # AIR-GAP ENFORCEMENT: Block all Google auth in offline mode
    # ---------------------------------------------------------------
    _, is_airgapped = get_effective_auth_mode(db)
    if is_airgapped or config.AIR_GAPPED_MODE:
        record_security_event(
            db=db,
            event_type="GOOGLE_AUTH_BLOCKED",
            component="Google OAuth Gateway",
            severity="MEDIUM",
            status="BLOCKED",
            reason="Google OAuth attempt rejected: system operating in air-gapped mode. WAN access is not permitted.",
            requested_resource="/api/auth/google-callback",
            action="POST"
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GOOGLE_AUTH_BLOCKED_AIRGAP: This system is operating in air-gapped mode. Google OAuth requires internet access and is not available."
        )

    # ---------------------------------------------------------------
    # VERIFY ACCESS TOKEN via Google's tokeninfo endpoint
    # ---------------------------------------------------------------
    try:
        resp = _httpx.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {payload.id_token}"},
            timeout=10.0
        )
        if resp.status_code != 200:
            raise ValueError(f"Google tokeninfo returned {resp.status_code}")
        google_payload_data = resp.json()
    except Exception as e:
        record_security_event(
            db=db,
            event_type="GOOGLE_LOGIN_FAILED",
            component="Google OAuth Gateway",
            severity="HIGH",
            status="BLOCKED",
            reason=f"Google access_token verification failed: {str(e)[:120]}",
            requested_resource="/api/auth/google-callback",
            action="POST"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google identity verification failed. Token may be invalid or expired."
        )

    google_email = (google_payload_data.get("email") or "").strip().lower()
    google_name = google_payload_data.get("name", "")
    google_verified = google_payload_data.get("email_verified", False)

    if not google_email or not google_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google account email is not verified or could not be retrieved."
        )

    # ---------------------------------------------------------------
    # LOOKUP USER IN AEGIS DATABASE
    # Match by: google_linked_email, registered_email, or primary email
    # ---------------------------------------------------------------
    user = db.scalar(
        select(User).where(
            (func.lower(User.google_linked_email) == google_email) |
            (func.lower(User.registered_email) == google_email) |
            (func.lower(User.email) == google_email)
        )
    )

    if not user:
        record_security_event(
            db=db,
            event_type="GOOGLE_LOGIN_FAILED",
            component="Google OAuth Gateway",
            severity="HIGH",
            status="BLOCKED",
            reason=f"Google account '{google_email}' is not registered in the AEGIS system.",
            requested_resource="/api/auth/google-callback",
            action="POST",
            details={"google_email": google_email}
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: The Google account '{google_email}' is not registered in A.E.G.I.S. Contact your Administrator to link your Gmail account."
        )

    # ---------------------------------------------------------------
    # ROLE ENFORCEMENT (role comes from DB, not from Google)
    # ---------------------------------------------------------------
    requested_role = (payload.role or "").upper().strip()
    actual_role = (user.role or "").upper()

    if requested_role and requested_role != actual_role:
        record_security_event(
            db=db,
            event_type="UNAUTHORIZED_ACCESS",
            component="Google OAuth Role Guard",
            severity="HIGH",
            status="BLOCKED",
            reason=f"Google login role mismatch for '{google_email}': requested '{requested_role}', actual '{actual_role}'",
            user_email=user.email,
            user_role=actual_role,
            requested_resource="/api/auth/google-callback",
            action="POST",
            details={"google_email": google_email, "requested_role": requested_role, "actual_role": actual_role}
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role mismatch: Your account is '{actual_role}', not '{requested_role}'."
        )

    # ---------------------------------------------------------------
    # SUCCESS: Issue AEGIS JWT session token
    # ---------------------------------------------------------------
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role, "org": user.organization},
        expires_delta=ACCESS_TOKEN_EXPIRE_SECONDS
    )

    log_action(
        db=db,
        action="GOOGLE_LOGIN_SUCCESS",
        user_email=user.email,
        entity_type="AUTH",
        entity_id=str(user.id),
        details={"role": user.role, "mode": "GOOGLE_OAUTH", "google_email": google_email, "google_name": google_name}
    )
    record_security_event(
        db=db,
        event_type="GOOGLE_LOGIN_SUCCESS",
        component="Google OAuth Gateway",
        severity="LOW",
        status="ALLOWED",
        reason=f"Google OAuth identity verified for '{google_email}' — AEGIS session issued",
        user_email=user.email,
        user_role=user.role,
        requested_resource="/api/auth/google-callback",
        action="LOGIN",
        details={"google_email": google_email, "google_name": google_name}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "auth_mode": "GOOGLE_OAUTH",
        "user": format_user_response(user)
    }

@router.get("/auth/mode")
def get_auth_mode_status(db: Session = Depends(get_db)):
    """
    Returns the currently active authentication mode:
    'AIR_GAPPED' (Offline Enclave) or 'EMAIL_OTP' (Connected Gmail OTP).
    """
    mode, air_gapped = get_effective_auth_mode(db)
    return {
        "auth_mode": mode,
        "air_gapped_mode": air_gapped,
        "mail_provider": config.MAIL_PROVIDER,
        "otp_expiration_seconds": config.OTP_EXPIRATION_SECONDS,
        "otp_resend_cooldown_seconds": config.OTP_RESEND_COOLDOWN_SECONDS,
        "label": "Offline / Air-Gapped Environment" if air_gapped else "Connected Secure Email OTP Mode"
    }

@router.post("/login")
def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db)
):
    raw_ident = form_data.username.strip()
    ident = raw_ident.lower()
    
    # Extract requested role if provided in client_id
    requested_role = (form_data.client_id or "").upper().strip()
    if "ANALYST" in requested_role:
        target_role = "ANALYST"
    elif "ADMIN" in requested_role:
        target_role = "ADMINISTRATOR"
    elif "AUDIT" in requested_role:
        target_role = "AUDITOR"
    elif "SUPERVISOR" in requested_role:
        target_role = "SUPERVISOR"
    else:
        target_role = None

    # Lookup user by username, email, registered_email, or known system aliases
    user = db.scalar(
        select(User).where(
            (func.lower(User.username) == ident) |
            (func.lower(User.email) == ident) |
            (func.lower(User.registered_email) == ident) |
            (func.lower(User.email).startswith(ident + "@")) |
            (func.lower(User.email) == f"{ident}@nciipc.gov.in") |
            (func.lower(User.email) == f"{ident}@aegis.gov.in") |
            (func.lower(User.email) == f"{ident}@powergrid.in") |
            (func.lower(User.email) == f"{ident}@cert-in.gov.in")
        )
    )

    if not user:
        # Record failed login
        log_action(
            db=db,
            user_email=raw_ident,
            action="LOGIN_FAILURE",
            entity_type="AUTH",
            details={"reason": "USER_NOT_FOUND", "attempted_identifier": raw_ident}
        )
        record_security_event(
            db=db,
            event_type="LOGIN_FAILED",
            component="Authentication Service",
            severity="MEDIUM",
            status="BLOCKED",
            reason=f"Authentication attempt failed for non-existent identifier '{raw_ident}'",
            requested_resource="/api/auth/login",
            action="POST"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify password (PBKDF2/SHA-256)
    if not verify_password(form_data.password, user.hashed_password):
        log_action(
            db=db,
            user_email=user.email,
            action="LOGIN_FAILURE",
            entity_type="AUTH",
            entity_id=str(user.id),
            details={"reason": "INVALID_PASSWORD"}
        )
        record_security_event(
            db=db,
            event_type="LOGIN_FAILED",
            component="Authentication Service",
            severity="MEDIUM",
            status="BLOCKED",
            reason=f"Invalid password attempt for account '{user.email}'",
            user_email=user.email,
            user_role=user.role,
            requested_resource="/api/auth/login",
            action="POST"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ---------------------------------------------------------
    # ROLE SECURITY: Selected UI role MUST match actual DB role
    # ---------------------------------------------------------
    actual_role = (user.role or "").upper()
    if target_role and target_role != actual_role:
        log_action(
            db=db,
            user_email=user.email,
            action="UNAUTHORIZED_ROLE_ATTEMPT",
            entity_type="AUTH_ROLE_SECURITY",
            entity_id=str(user.id),
            details={"account_role": actual_role, "attempted_role": target_role}
        )
        record_security_event(
            db=db,
            event_type="UNAUTHORIZED_ACCESS",
            component="Role Authorization Engine",
            severity="HIGH",
            status="BLOCKED",
            reason=f"Account '{user.email}' with actual role '{actual_role}' attempted unauthorized access as '{target_role}'",
            user_email=user.email,
            user_role=actual_role,
            requested_resource="/api/auth/login",
            action="POST",
            details={"attempted_role": target_role, "actual_role": actual_role}
        )
        create_security_alert(
            db=db,
            alert_code=f"ALERT-ROLE-SPOOF-{user.id}",
            title="Unauthorized Role Login Attempt",
            severity="HIGH",
            category="Authentication Security",
            source="Role Authorization Engine",
            description=f"User {user.email} attempted to authenticate with unauthorized role {target_role} (Actual role: {actual_role})"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role authorization mismatch: Your account is assigned as '{actual_role}', not '{target_role}'. Access denied."
        )

    # Determine Active Authentication Mode
    current_mode, is_airgapped = get_effective_auth_mode(db)
    is_explicit_online = "ONLINE" in (form_data.client_id or "").upper()

    # ---------------------------------------------------------
    # MODE 1: AIR-GAPPED / OFFLINE ENCLAVE MODE
    # (Password verified -> Direct login into enclave with NO OTP / NO email)
    # ---------------------------------------------------------
    if not is_explicit_online or is_airgapped or current_mode == "AIR_GAPPED":
        access_token = create_access_token(
            data={"sub": user.email, "role": user.role, "org": user.organization},
            expires_delta=ACCESS_TOKEN_EXPIRE_SECONDS
        )

        log_action(
            db=db,
            action="USER_LOGIN",
            user_email=user.email,
            entity_type="AUTH",
            entity_id=str(user.id),
            details={"role": user.role, "mode": "AIR_GAPPED"}
        )
        record_security_event(
            db=db,
            event_type="LOGIN_SUCCESS",
            component="Authentication Service",
            severity="LOW",
            status="ALLOWED",
            reason="Air-gapped local credentials authentication verified",
            user_email=user.email,
            user_role=user.role,
            requested_resource="/api/auth/login",
            action="POST"
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "auth_mode": "AIR_GAPPED",
            "user": format_user_response(user)
        }

    # ---------------------------------------------------------
    # MODE 2: CONNECTED REAL GMAIL EMAIL OTP MODE
    # ---------------------------------------------------------
    user_otp, plaintext_otp, err = create_or_refresh_otp(db, user)
    if err:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=err)

    # Destination is registered Gmail address
    destination_email = user.registered_email or user.email
    send_res = send_otp_email(
        db=db,
        to_email=destination_email,
        user_name=user.username or user.email,
        otp=plaintext_otp,
        user_id=user.id
    )

    masked = mask_email(destination_email)
    temp_token = create_access_token(
        data={"sub": user.email, "type": "pre_auth"},
        expires_delta=timedelta(minutes=10)
    )

    print(f"\n=======================================================", flush=True)
    print(f"[*] [A.E.G.I.S. OTP CODE FOR {destination_email}]: {plaintext_otp}", flush=True)
    print(f"=======================================================\n", flush=True)

    smtp_ok = send_res.get("success", False)
    return {
        "status": "OTP_REQUIRED",
        "auth_mode": "EMAIL_OTP",
        "message": f"Verification code sent to {masked}" if smtp_ok else f"Verification code generated for {masked}. Check server logs.",
        "masked_email": masked,
        "expires_in": config.OTP_EXPIRATION_SECONDS,
        "cooldown": config.OTP_RESEND_COOLDOWN_SECONDS,
        "temp_token": temp_token,
        "user_hint": user.username or user.email,
        "smtp_delivered": smtp_ok,
    }

@router.post("/auth/verify-otp")
def verify_otp_submission(
    payload: OTPVerifyPayload,
    db: Session = Depends(get_db)
):
    """
    Verifies the submitted 6-digit OTP code on the backend.
    Enforces expiration, attempt counters, one-time use, and issues session token.
    """
    ident = payload.username.strip().lower()
    user = db.scalar(
        select(User).where(
            (func.lower(User.username) == ident) |
            (func.lower(User.email) == ident) |
            (func.lower(User.registered_email) == ident)
        )
    )

    # Fallback to temp_token sub if username lookup needs resolution
    if not user and payload.temp_token:
        decoded = decode_access_token(payload.temp_token)
        if decoded and decoded.get("sub"):
            user = db.scalar(select(User).where(User.email == decoded["sub"]))

    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User session not found. Please log in again.")

    success, msg = verify_user_otp(db, user, payload.otp)

    if not success:
        if "locked" in msg.lower():
            log_action(
                db=db,
                user_email=user.email,
                action="ACCOUNT_LOCKOUT",
                entity_type="AUTH_OTP",
                entity_id=str(user.id),
                details={"reason": "EXCESSIVE_FAILED_OTP_ATTEMPTS"}
            )
            record_security_event(
                db=db,
                event_type="ACCOUNT_LOCKOUT",
                component="Authentication Service",
                severity="HIGH",
                status="BLOCKED",
                reason=f"OTP attempts exhausted for user '{user.email}'",
                user_email=user.email,
                user_role=user.role,
                action="LOCKOUT"
            )
            create_security_alert(
                db=db,
                alert_code=f"ALERT-LOCKOUT-{user.id}",
                title="Account Verification Temporarily Locked",
                severity="HIGH",
                category="Authentication Security",
                source="OTP Verification Engine",
                description=f"Multiple failed OTP attempts detected for {user.email}. Verification temporarily locked."
            )
            raise HTTPException(status_code=status.HTTP_423_LOCKED, detail=msg)
        elif "expired" in msg.lower():
            log_action(
                db=db,
                user_email=user.email,
                action="OTP_EXPIRED",
                entity_type="AUTH_OTP",
                entity_id=str(user.id)
            )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
        else:
            log_action(
                db=db,
                user_email=user.email,
                action="OTP_VERIFICATION_FAILURE",
                entity_type="AUTH_OTP",
                entity_id=str(user.id),
                details={"message": msg}
            )
            record_security_event(
                db=db,
                event_type="OTP_FAILED",
                component="Authentication Service",
                severity="MEDIUM",
                status="BLOCKED",
                reason=f"Failed OTP verification code submitted for '{user.email}'",
                user_email=user.email,
                user_role=user.role,
                action="VERIFY"
            )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    # Success: Issue full JWT session token
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role, "org": user.organization},
        expires_delta=ACCESS_TOKEN_EXPIRE_SECONDS
    )

    log_action(
        db=db,
        user_email=user.email,
        action="OTP_VERIFICATION_SUCCESS",
        entity_type="AUTH_OTP",
        entity_id=str(user.id),
        details={"mode": "EMAIL_OTP"}
    )
    log_action(
        db=db,
        action="USER_LOGIN",
        user_email=user.email,
        entity_type="AUTH",
        entity_id=str(user.id),
        details={"role": user.role, "mode": "EMAIL_OTP"}
    )
    record_security_event(
        db=db,
        event_type="LOGIN_SUCCESS",
        component="Authentication Service",
        severity="LOW",
        status="ALLOWED",
        reason="Two-factor Gmail OTP verification successfully authenticated",
        user_email=user.email,
        user_role=user.role,
        action="LOGIN"
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "auth_mode": "EMAIL_OTP",
        "user": format_user_response(user)
    }

@router.post("/auth/resend-otp")
def resend_otp(
    payload: OTPResendPayload,
    db: Session = Depends(get_db)
):
    """
    Resends a new 6-digit verification code to the registered email address.
    Guarded by cooldown rate limiting.
    """
    ident = payload.username.strip().lower()
    user = db.scalar(
        select(User).where(
            (func.lower(User.username) == ident) |
            (func.lower(User.email) == ident) |
            (func.lower(User.registered_email) == ident)
        )
    )

    if not user and payload.temp_token:
        decoded = decode_access_token(payload.temp_token)
        if decoded and decoded.get("sub"):
            user = db.scalar(select(User).where(User.email == decoded["sub"]))

    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found.")

    user_otp, plaintext_otp, err = create_or_refresh_otp(db, user)
    if err:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=err)

    destination_email = user.registered_email or user.email

    log_action(
        db=db,
        user_email=user.email,
        action="OTP_RESEND",
        entity_type="AUTH_OTP",
        entity_id=str(user.id),
        details={"destination": destination_email}
    )

    print(f"\n=======================================================", flush=True)
    print(f"[*] [A.E.G.I.S. RESENT OTP CODE FOR {destination_email}]: {plaintext_otp}", flush=True)
    print(f"=======================================================\n", flush=True)

    resend_res = send_otp_email(
        db=db,
        to_email=destination_email,
        user_name=user.username or user.email,
        otp=plaintext_otp,
        user_id=user.id
    )
    resend_smtp_ok = resend_res.get("success", False)
    return {
        "status": "OTP_SENT",
        "message": "A new verification code has been dispatched to your email.",
        "masked_email": mask_email(destination_email),
        "expires_in_seconds": config.OTP_EXPIRATION_SECONDS,
        "cooldown_seconds": config.OTP_RESEND_COOLDOWN_SECONDS,
        "smtp_delivered": resend_smtp_ok,
    }

@router.post("/auth/logout")
def logout_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    log_action(
        db=db,
        user_email=current_user.email,
        action="USER_LOGOUT",
        entity_type="AUTH",
        entity_id=str(current_user.id)
    )
    return {"status": "SUCCESS", "message": "Logged out successfully"}

@router.get("/me")
def read_users_me(current_user: Annotated[User, Depends(get_current_user)]):
    return format_user_response(current_user)

class PasswordResetPayload(BaseModel):
    username: str
    new_password: str

@router.post("/auth/reset-password")
def reset_password(payload: PasswordResetPayload, db: Session = Depends(get_db)):
    ident = payload.username.strip().lower()
    user = db.scalar(
        select(User).where(
            (func.lower(User.username) == ident) |
            (func.lower(User.email) == ident) |
            (func.lower(User.registered_email) == ident)
        )
    )
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{payload.username}' not found.")
    
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")
    
    user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    
    log_action(
        db=db,
        user_email=user.email,
        action="PASSWORD_RESET",
        entity_type="User",
        entity_id=str(user.id),
        details={"username": user.username, "method": "DIRECT_RESET"}
    )
    return {"status": "SUCCESS", "message": f"Password for '{user.username or user.email}' has been successfully reset."}

class RegisterPayload(BaseModel):
    username: str
    email: str
    password: str
    role: str = "SUPERVISOR"
    organization: str = "NCIIPC"
    registered_email: str | None = None

@router.post("/auth/register")
def register_enclave_operator(payload: RegisterPayload, db: Session = Depends(get_db)):
    uname = payload.username.strip()
    email_clean = payload.email.strip().lower()
    role_clean = payload.role.strip().upper()
    org_clean = payload.organization.strip() or "NCIIPC"

    if len(uname) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters long.")
    if "@" not in email_clean:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    
    valid_roles = ["SUPERVISOR", "ANALYST", "AUDITOR", "ADMINISTRATOR"]
    if role_clean not in valid_roles:
        role_clean = "SUPERVISOR"

    # Check for existing user
    existing_user = db.scalar(
        select(User).where(
            (func.lower(User.username) == uname.lower()) |
            (func.lower(User.email) == email_clean)
        )
    )
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail=f"An account with this username or email already exists in the enclave."
        )

    avatar_color_map = {
        "SUPERVISOR": "#16a34a",
        "AUDITOR": "#2563eb",
        "ANALYST": "#d97706",
        "ADMINISTRATOR": "#6366f1"
    }

    new_user = User(
        username=uname,
        email=email_clean,
        registered_email=payload.registered_email.strip() if payload.registered_email else email_clean,
        google_linked_email=email_clean,
        hashed_password=get_password_hash(payload.password),
        role=role_clean,
        organization=org_clean,
        avatar_color=avatar_color_map.get(role_clean, "#16a34a")
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_action(
        db=db,
        user_email=email_clean,
        action="OPERATOR_REGISTERED",
        entity_type="User",
        entity_id=str(new_user.id),
        details={"username": uname, "role": role_clean, "organization": org_clean}
    )
    record_security_event(
        db=db,
        event_type="USER_REGISTERED",
        component="Identity Provisioning Service",
        severity="LOW",
        status="ALLOWED",
        reason=f"New enclave operator account '{uname}' created with role '{role_clean}'",
        user_email=email_clean,
        user_role=role_clean,
        requested_resource="/api/auth/register",
        action="POST"
    )

    access_token = create_access_token(
        data={"sub": new_user.email, "role": new_user.role, "org": new_user.organization},
        expires_delta=ACCESS_TOKEN_EXPIRE_SECONDS
    )

    return {
        "status": "SUCCESS",
        "message": f"Operator '{uname}' registered successfully.",
        "access_token": access_token,
        "token_type": "bearer",
        "user": format_user_response(new_user)
    }

