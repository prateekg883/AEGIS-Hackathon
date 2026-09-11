import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import OTP_EXPIRATION_SECONDS, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_SECONDS
from app.models.models import User, UserOTP

def generate_secure_otp(length: int = 6) -> str:
    """
    Generates a cryptographically secure numeric OTP using Python's secrets module.
    Never uses pseudo-random or hardcoded values.
    """
    digits = "0123456789"
    return "".join(secrets.choice(digits) for _ in range(length))

def generate_salt(length: int = 16) -> str:
    return secrets.token_hex(length)

def hash_otp(otp: str, salt: str) -> str:
    """
    Salted SHA-256 hash. Plaintext OTP is NEVER stored in database.
    """
    raw = f"{salt}:{otp.strip()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def mask_email(email: str | None) -> str:
    """
    Masks an email for user-facing security verification UI:
    e.g. 'supervisor@gmail.com' -> 's*****@gmail.com'
    e.g. 'admin@aegis.gov.in' -> 'a*****@aegis.gov.in'
    """
    if not email or "@" not in email:
        return "u*****@domain.local"
    
    parts = email.split("@", 1)
    local, domain = parts[0], parts[1]
    if len(local) <= 1:
        masked_local = local + "*****"
    elif len(local) == 2:
        masked_local = local[0] + "*****"
    else:
        masked_local = local[0] + "*****" + local[-1]
    return f"{masked_local}@{domain}"

def create_or_refresh_otp(db: Session, user: User) -> tuple[UserOTP | None, str | None, str | None]:
    """
    Generates a new secure 6-digit OTP for the given user, enforcing rate-limit cooldown.
    Returns: (UserOTP instance, plaintext_otp_for_email_only, error_message_if_any)
    """
    now = datetime.now(timezone.utc)

    # Check for active existing OTP to enforce resend cooldown if configured
    if OTP_RESEND_COOLDOWN_SECONDS > 0:
        existing_otp = db.scalar(
            select(UserOTP)
            .where(UserOTP.user_id == user.id, UserOTP.is_used == False)
            .order_by(UserOTP.created_at.desc())
        )

        if existing_otp and existing_otp.last_sent_at:
            sent_time = existing_otp.last_sent_at
            if sent_time.tzinfo is None:
                sent_time = sent_time.replace(tzinfo=timezone.utc)
            elapsed = (now - sent_time).total_seconds()
            if elapsed < OTP_RESEND_COOLDOWN_SECONDS:
                remaining = int(OTP_RESEND_COOLDOWN_SECONDS - elapsed)
                return None, None, f"Please wait {remaining} seconds before requesting a new code."

    # Invalidate previous OTPs for this user
    prev_otps = db.scalars(
        select(UserOTP).where(UserOTP.user_id == user.id, UserOTP.is_used == False)
    ).all()
    for o in prev_otps:
        o.is_used = True

    plaintext_otp = generate_secure_otp(6)
    salt = generate_salt(16)
    hashed = hash_otp(plaintext_otp, salt)
    expires_at = now + timedelta(seconds=OTP_EXPIRATION_SECONDS)

    new_otp = UserOTP(
        user_id=user.id,
        otp_hash=hashed,
        salt=salt,
        attempts_left=OTP_MAX_ATTEMPTS,
        max_attempts=OTP_MAX_ATTEMPTS,
        expires_at=expires_at,
        last_sent_at=now,
        is_used=False
    )
    db.add(new_otp)
    db.commit()
    db.refresh(new_otp)

    return new_otp, plaintext_otp, None

def verify_user_otp(db: Session, user: User, candidate_otp: str) -> tuple[bool, str]:
    """
    Verifies the provided 6-digit OTP against the user's latest active OTP record.
    Returns (success: bool, message: str).
    """
    now = datetime.now(timezone.utc)

    active_otp = db.scalar(
        select(UserOTP)
        .where(UserOTP.user_id == user.id, UserOTP.is_used == False)
        .order_by(UserOTP.created_at.desc())
    )

    if not active_otp:
        return False, "No active verification code found. Please request a new code."

    # Check attempt exhaustion / lockout
    if active_otp.attempts_left <= 0:
        return False, "Verification temporarily locked. Please try again later or contact the system administrator."

    # Check expiration
    exp_time = active_otp.expires_at
    if exp_time.tzinfo is None:
        exp_time = exp_time.replace(tzinfo=timezone.utc)
    if now > exp_time:
        active_otp.is_used = True
        db.commit()
        return False, "This verification code has expired. Request a new code."

    # Check candidate hash
    candidate_hash = hash_otp(candidate_otp.strip(), active_otp.salt)
    if candidate_hash != active_otp.otp_hash:
        active_otp.attempts_left -= 1
        db.commit()
        if active_otp.attempts_left <= 0:
            return False, "Verification temporarily locked. Please try again later or contact the system administrator."
        return False, f"Invalid verification code. Please try again. ({active_otp.attempts_left} attempts left)"

    # Success: Invalidate immediately upon use (One-Time Use)
    active_otp.is_used = True
    db.commit()
    return True, "Verification successful."
