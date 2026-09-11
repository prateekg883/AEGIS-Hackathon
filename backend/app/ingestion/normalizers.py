from datetime import datetime, timezone
from typing import Any


def text(value: Any, *, null: bool = False) -> str | None:
    if value is None:
        return None if null else ''
    result = str(value).strip()
    if not result and null:
        return None
    return result


def code(value: Any) -> str:
    return text(value).upper()


def enum(value: Any) -> str:
    return text(value).upper().replace('-', '_').replace(' ', '_')


def timestamp(value: Any) -> datetime | None:
    value = text(value, null=True)
    if value is None:
        return None
    value = value.strip('"\'')
    if not value:
        return None
    normalized = value[:-1] + '+00:00' if value.endswith(('Z', 'z')) else value
    try:
        parsed = datetime.fromisoformat(normalized)
    except Exception:
        for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M:%S.%f', '%Y/%m/%d %H:%M:%S', '%d-%m-%Y %H:%M:%S', '%m/%d/%Y %H:%M:%S', '%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y'):
            try:
                parsed = datetime.strptime(value, fmt)
                break
            except Exception:
                continue
        else:
            raise ValueError(f'Invalid timestamp: {value}')
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def boolean(value: Any) -> bool:
    normalized = text(value).lower()
    if normalized in {'true', '1', 'yes', 'y', 'on'}:
        return True
    if normalized in {'false', '0', 'no', 'n', 'off'}:
        return False
    raise ValueError('Expected a boolean value')


def number(value: Any) -> int:
    return int(text(value))
