from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any


class BaseSIEMConnector(ABC):
    """
    Abstract base class for all A.E.G.I.S. SIEM connectors.
    Ensures modularity and vendor-agnostic architecture for Elastic Security,
    Splunk, Microsoft Sentinel, IBM QRadar, etc.
    """

    def __init__(self, name: str, vendor: str):
        self.name = name
        self.vendor = vendor

    @abstractmethod
    def test_connection(self) -> dict[str, Any]:
        """
        Verify connectivity and authentication to the SIEM.
        Must return:
          {
            "connected": bool,
            "vendor": str,
            "status": "ONLINE" | "OFFLINE" | "ERROR",
            "message": str,
            "details": dict
          }
        Must not throw unhandled exceptions.
        """
        pass

    @abstractmethod
    def fetch_events(self, since: datetime | None = None, limit: int = 100) -> list[dict[str, Any]]:
        """
        Fetch raw events/alerts from the SIEM.
        Must catch networking/authentication failures and return an empty list or
        raise a controlled SIEMConnectionError.
        """
        pass

    @abstractmethod
    def normalize_event(self, raw_event: dict[str, Any]) -> dict[str, Any]:
        """
        Transform a vendor-specific raw event/alert into A.E.G.I.S. canonical alert format:
          {
            "alert_code": str,
            "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
            "category": str,
            "title": str,
            "description": str,
            "created_time": datetime,
            "status": str,
            "raw_reference": str,
            "indicators": list[str],
            "raw_data": dict
          }
        """
        pass

    def validate_event(self, normalized_event: dict[str, Any]) -> bool:
        """
        Validate that a normalized event contains all mandatory A.E.G.I.S. alert fields.
        """
        required_fields = ["alert_code", "severity", "category", "title", "created_time"]
        for field in required_fields:
            if not normalized_event.get(field):
                return False
        if normalized_event.get("severity") not in ("LOW", "MEDIUM", "HIGH", "CRITICAL"):
            normalized_event["severity"] = "MEDIUM"
        return True


class SIEMConnectionError(Exception):
    """Raised when communication with the SIEM endpoint fails."""
    pass
