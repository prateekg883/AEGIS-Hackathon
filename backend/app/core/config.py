import os
from pathlib import Path
from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[2]
# Load .env file from backend root or workspace root
load_dotenv(BACKEND_ROOT / '.env')
load_dotenv(BACKEND_ROOT.parent / '.env')

APP_NAME = os.getenv('APP_NAME', 'A.E.G.I.S API')
APP_VERSION = os.getenv('APP_VERSION', '0.1.0')
APP_ENV = os.getenv('APP_ENV', 'development')
MAX_UPLOAD_BYTES = int(os.getenv('MAX_UPLOAD_BYTES', '5242880'))
DEFAULT_SQLITE_PATH = BACKEND_ROOT / 'data' / 'aegis_sat.db'
if not DEFAULT_SQLITE_PATH.exists():
    legacy_path = BACKEND_ROOT / 'data' / 'nirikshak_sat.db'
    if legacy_path.exists():
        DEFAULT_SQLITE_PATH = legacy_path
DATABASE_URL = os.getenv('DATABASE_URL') or f'sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}'
if DATABASE_URL == f'sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}':
    DEFAULT_SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        'CORS_ORIGINS',
        'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174',
    ).split(',')
    if origin.strip()
]

# Attention Score Policy Thresholds (Configurable with Production Defaults)
SCORE_THRESHOLD_NORMAL_MAX = float(os.getenv('SCORE_THRESHOLD_NORMAL_MAX', '30.0'))
SCORE_THRESHOLD_MEDIUM_MAX = float(os.getenv('SCORE_THRESHOLD_MEDIUM_MAX', '70.0'))
SCORE_THRESHOLD_HIGH_MAX = float(os.getenv('SCORE_THRESHOLD_HIGH_MAX', '97.0'))
SCORE_THRESHOLD_CRITICAL_MIN = float(os.getenv('SCORE_THRESHOLD_CRITICAL_MIN', '98.0'))

# Critical Alert Gateway Configuration
ESCALATION_ENABLED = os.getenv('ESCALATION_ENABLED', 'false').lower() in ('true', '1', 'yes')
CRITICAL_SCORE_THRESHOLD = float(os.getenv('CRITICAL_SCORE_THRESHOLD', '98.0'))
DESTINATION_TYPE = os.getenv('DESTINATION_TYPE', 'AUTHORISED_EXTERNAL_ENDPOINT')
DESTINATION_URL = os.getenv('DESTINATION_URL', '')
DESTINATION_AUTH_METHOD = os.getenv('DESTINATION_AUTH_METHOD', 'HMAC_BEARER')
DESTINATION_API_KEY = os.getenv('DESTINATION_API_KEY', '')
DESTINATION_HMAC_SECRET = os.getenv('DESTINATION_HMAC_SECRET', 'AEGIS_SECURE_GATEWAY_DEFAULT_SECRET_2026')

# Real SIEM Integration Settings
SIEM_CONNECTOR_TYPE = os.getenv('SIEM_CONNECTOR_TYPE', 'ELASTICSEARCH')
SIEM_ENDPOINT = os.getenv('SIEM_ENDPOINT', '')
SIEM_API_KEY = os.getenv('SIEM_API_KEY', '')
SIEM_USERNAME = os.getenv('SIEM_USERNAME', '')
SIEM_PASSWORD = os.getenv('SIEM_PASSWORD', '')
SIEM_INDEX = os.getenv('SIEM_INDEX', '.alerts-security.alerts-default,logs-*')
SIEM_VERIFY_SSL = os.getenv('SIEM_VERIFY_SSL', 'true').lower() in ('true', '1', 'yes')
SIEM_POLL_INTERVAL_SECONDS = int(os.getenv('SIEM_POLL_INTERVAL_SECONDS', '300'))

# Authentication & Email OTP Configuration
AUTH_MODE = os.getenv('AUTH_MODE', 'AIR_GAPPED').upper() # 'AIR_GAPPED' or 'EMAIL_OTP'
AIR_GAPPED_MODE = os.getenv('AIR_GAPPED_MODE', 'true').lower() in ('true', '1', 'yes')
MAIL_PROVIDER = os.getenv('MAIL_PROVIDER', 'gmail').lower()
SMTP_HOST = os.getenv('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_USERNAME = os.getenv('SMTP_USERNAME', '')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
MAIL_FROM_ADDRESS = os.getenv('MAIL_FROM_ADDRESS', 'aegis-security@aegis.gov.in')
OTP_EXPIRATION_SECONDS = int(os.getenv('OTP_EXPIRATION_SECONDS', '300'))
OTP_MAX_ATTEMPTS = int(os.getenv('OTP_MAX_ATTEMPTS', '3'))
OTP_RESEND_COOLDOWN_SECONDS = int(os.getenv('OTP_RESEND_COOLDOWN_SECONDS', '0'))

# Google OAuth Configuration (Connected Mode only — disabled in air-gapped mode)
# Obtain from: https://console.cloud.google.com → APIs & Services → Credentials → OAuth 2.0 Client ID
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
GOOGLE_AUTH_ENABLED = bool(GOOGLE_CLIENT_ID) and not AIR_GAPPED_MODE
