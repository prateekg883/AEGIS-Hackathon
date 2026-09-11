import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Any
from sqlalchemy.orm import Session

from app.core import config
from app.core.audit import log_action
from app.core.security_monitor import record_security_event

def send_otp_email(
    db: Session,
    to_email: str,
    user_name: str,
    otp: str,
    user_id: int | None = None
) -> dict[str, Any]:
    """
    Delivers a secure 6-digit OTP to the user's registered Gmail/email address.
    Strictly adheres to Air-Gap safety boundary:
    If AIR_GAPPED_MODE is True, external email requests are blocked and audited.
    """
    # 1. AIR-GAP SAFETY CONTROL
    if config.AIR_GAPPED_MODE or config.AUTH_MODE == "AIR_GAPPED":
        reason = "External email delivery is disabled in Air-Gapped Mode."
        log_action(
            db=db,
            user_email=to_email,
            action="AIR_GAP_EMAIL_BLOCKED",
            entity_type="EMAIL_GATEWAY",
            entity_id=to_email,
            details={"reason": reason, "air_gapped_mode": True}
        )
        record_security_event(
            db=db,
            event_type="AIR_GAP_BOUNDARY_ENFORCED",
            component="Outbound Boundary Gateway",
            severity="LOW",
            status="BLOCKED",
            reason="Blocked outbound email transmission: Host operating in strict Air-Gapped Mode",
            user_email=to_email,
            requested_resource="SMTP_WAN_DISPATCH",
            action="BLOCKED"
        )
        return {
            "success": False,
            "air_gapped": True,
            "message": reason,
            "error": reason
        }

    # 2. CONNECTED EMAIL OTP MODE
    # Format professional plain-text and HTML email without credentials or system secrets
    subject = "A.E.G.I.S. Security Verification Code"
    plain_body = f"""A.E.G.I.S. Authentication

Hello {user_name},

A login verification code has been requested for your A.E.G.I.S. account.

Verification Code:
{otp}

This code will expire shortly.

If you did not initiate this login attempt, contact your authorized system administrator.

Do not share this code with anyone.

A.E.G.I.S.
Supervisory Analytics Tool for SOC Assessment
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = config.MAIL_FROM_ADDRESS
    msg["To"] = to_email
    msg.attach(MIMEText(plain_body, "plain", "utf-8"))

    # Log attempt (NEVER logging the OTP value itself)
    log_action(
        db=db,
        user_email=to_email,
        action="OTP_REQUESTED",
        entity_type="AUTH_OTP",
        entity_id=str(user_id or ""),
        details={"destination": to_email, "provider": "GMAIL_SMTP"}
    )

    # Check if SMTP credentials are configured
    if not config.SMTP_USERNAME or not config.SMTP_PASSWORD:
        err_msg = "Gmail SMTP credentials not configured in environment (SMTP_USERNAME/SMTP_PASSWORD missing)."
        log_action(
            db=db,
            user_email=to_email,
            action="OTP_DELIVERY_FAILURE",
            entity_type="EMAIL_GATEWAY",
            entity_id=to_email,
            details={"error": "MISSING_SMTP_CREDENTIALS"}
        )
        return {
            "success": False,
            "air_gapped": False,
            "message": err_msg
        }

    try:
        server = smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=10)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(config.SMTP_USERNAME, config.SMTP_PASSWORD)
        server.sendmail(config.MAIL_FROM_ADDRESS, [to_email], msg.as_string())
        server.quit()

        log_action(
            db=db,
            user_email=to_email,
            action="OTP_SENT_SUCCESS",
            entity_type="AUTH_OTP",
            entity_id=str(user_id or ""),
            details={"destination": to_email}
        )
        record_security_event(
            db=db,
            event_type="EMAIL_OTP_DISPATCHED",
            component="Gmail Delivery Service",
            severity="LOW",
            status="ALLOWED",
            destination=f"{config.SMTP_HOST}:{config.SMTP_PORT}",
            port_protocol="587/TLS",
            reason=f"Security verification code dispatched to registered email",
            user_email=to_email,
            action="SMTP_SEND"
        )
        return {
            "success": True,
            "air_gapped": False,
            "message": f"Verification code sent to {to_email}"
        }
    except Exception as e:
        err_detail = str(e)
        log_action(
            db=db,
            user_email=to_email,
            action="OTP_DELIVERY_FAILURE",
            entity_type="EMAIL_GATEWAY",
            entity_id=to_email,
            details={"error": err_detail}
        )
        record_security_event(
            db=db,
            event_type="EMAIL_OTP_FAILED",
            component="Gmail Delivery Service",
            severity="MEDIUM",
            status="WARNING",
            destination=f"{config.SMTP_HOST}:{config.SMTP_PORT}",
            reason=f"SMTP transmission error: {err_detail}",
            user_email=to_email,
            action="SMTP_SEND"
        )
        return {
            "success": False,
            "air_gapped": False,
            "message": f"Failed to deliver verification code: {err_detail}"
        }
