import base64
import hashlib
import hmac
import json
import time
from datetime import timedelta
from typing import Any

# Supervisory secret key for HMAC-SHA256 token signing
SECRET_KEY = "AEGIS_NCIIPC_NATIONAL_SUPERVISORY_SECRET_2026"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_SECONDS = 60 * 60 * 24  # 24 hours


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')


def _base64url_decode(data: str) -> bytes:
    padding = 4 - (len(data) % 4)
    if padding and padding != 4:
        data += '=' * padding
    return base64.urlsafe_b64decode(data.encode('utf-8'))


def get_password_hash(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return get_password_hash(plain_password) == hashed_password


def create_access_token(data: dict[str, Any], expires_delta: int | timedelta | None = None) -> str:
    payload = data.copy()
    now = int(time.time())
    if isinstance(expires_delta, timedelta):
        delta_sec = int(expires_delta.total_seconds())
    elif expires_delta is not None:
        delta_sec = int(expires_delta)
    else:
        delta_sec = ACCESS_TOKEN_EXPIRE_SECONDS
    expire = now + delta_sec
    payload.update({'exp': expire, 'iat': now})

    header = {'alg': ALGORITHM, 'typ': 'JWT'}
    header_json = json.dumps(header, separators=(',', ':')).encode('utf-8')
    payload_json = json.dumps(payload, separators=(',', ':')).encode('utf-8')

    encoded_header = _base64url_encode(header_json)
    encoded_payload = _base64url_encode(payload_json)

    signing_input = f'{encoded_header}.{encoded_payload}'.encode('utf-8')
    signature = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    encoded_signature = _base64url_encode(signature)

    return f'{encoded_header}.{encoded_payload}.{encoded_signature}'


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None

        encoded_header, encoded_payload, encoded_signature = parts
        signing_input = f'{encoded_header}.{encoded_payload}'.encode('utf-8')
        expected_sig = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()

        if not hmac.compare_digest(_base64url_encode(expected_sig), encoded_signature):
            return None

        payload_bytes = _base64url_decode(encoded_payload)
        payload = json.loads(payload_bytes.decode('utf-8'))

        # Expiry check
        if payload.get('exp') and payload['exp'] < int(time.time()):
            return None

        return payload
    except Exception:
        return None
