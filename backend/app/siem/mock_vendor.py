import logging
from datetime import datetime, timezone
from typing import Any

from app.siem.base import BaseSIEMConnector, SIEMConnectionError

logger = logging.getLogger("aegis.siem.vendors")


class SplunkConnector(BaseSIEMConnector):
    """
    Extensible connector for Splunk Enterprise / Splunk Cloud.
    Interfaces via Splunk REST API (/services/search/jobs/export).
    """

    def __init__(self, endpoint: str | None = None, auth_token: str | None = None):
        super().__init__(name="Splunk Enterprise Connector", vendor="Splunk")
        self.endpoint = (endpoint or "").rstrip("/")
        self.auth_token = auth_token

    def test_connection(self) -> dict[str, Any]:
        if not self.endpoint:
            return {
                "connected": False,
                "vendor": self.vendor,
                "status": "OFFLINE",
                "message": "Splunk endpoint URL not configured. Operating in Offline-First mode.",
                "details": {"endpoint": None},
            }
        return {
            "connected": False,
            "vendor": self.vendor,
            "status": "CONFIGURED",
            "message": f"Splunk connector configured for {self.endpoint}. Ready for deployment credentials.",
            "details": {"endpoint": self.endpoint},
        }

    def fetch_events(self, since: datetime | None = None, limit: int = 100) -> list[dict[str, Any]]:
        if not self.endpoint:
            return []
        return []

    def normalize_event(self, raw_event: dict[str, Any]) -> dict[str, Any]:
        result = raw_event.get("result", raw_event)
        return {
            "alert_code": f"SPLUNK-{result.get('sid', 'EVT')[:12]}",
            "severity": result.get("urgency", "MEDIUM").upper(),
            "category": result.get("app", "Security Posture"),
            "title": result.get("search_name", "Splunk Correlation Alert"),
            "description": result.get("_raw", "Splunk event"),
            "created_time": datetime.now(timezone.utc),
            "status": "NEW",
            "raw_reference": f"splunk://search/{result.get('sid')}",
            "indicators": [],
            "raw_data": raw_event,
        }


class MicrosoftSentinelConnector(BaseSIEMConnector):
    """
    Extensible connector for Microsoft Sentinel (Azure Log Analytics / SecurityAlert).
    """

    def __init__(self, workspace_id: str | None = None, tenant_id: str | None = None):
        super().__init__(name="Microsoft Sentinel Connector", vendor="Microsoft Sentinel")
        self.workspace_id = workspace_id
        self.tenant_id = tenant_id

    def test_connection(self) -> dict[str, Any]:
        if not self.workspace_id:
            return {
                "connected": False,
                "vendor": self.vendor,
                "status": "OFFLINE",
                "message": "Sentinel Workspace ID not configured. Operating in Offline-First mode.",
                "details": {"workspace_id": None},
            }
        return {
            "connected": False,
            "vendor": self.vendor,
            "status": "CONFIGURED",
            "message": f"Sentinel connector configured for workspace {self.workspace_id}.",
            "details": {"workspace_id": self.workspace_id},
        }

    def fetch_events(self, since: datetime | None = None, limit: int = 100) -> list[dict[str, Any]]:
        return []

    def normalize_event(self, raw_event: dict[str, Any]) -> dict[str, Any]:
        return {
            "alert_code": f"SENTINEL-{raw_event.get('SystemAlertId', 'EVT')[:12]}",
            "severity": raw_event.get("AlertSeverity", "MEDIUM").upper(),
            "category": raw_event.get("Tactics", "Security Incident"),
            "title": raw_event.get("AlertName", "Sentinel Security Alert"),
            "description": raw_event.get("Description", "Sentinel detection"),
            "created_time": datetime.now(timezone.utc),
            "status": "NEW",
            "raw_reference": f"azure://sentinel/{raw_event.get('SystemAlertId')}",
            "indicators": [],
            "raw_data": raw_event,
        }


class QRadarConnector(BaseSIEMConnector):
    """
    Extensible connector for IBM QRadar SIEM (Offenses API: /api/siem/offenses).
    """

    def __init__(self, console_ip: str | None = None, sec_token: str | None = None):
        super().__init__(name="IBM QRadar Connector", vendor="IBM QRadar")
        self.console_ip = console_ip
        self.sec_token = sec_token

    def test_connection(self) -> dict[str, Any]:
        if not self.console_ip:
            return {
                "connected": False,
                "vendor": self.vendor,
                "status": "OFFLINE",
                "message": "QRadar console not configured. Operating in Offline-First mode.",
                "details": {"console_ip": None},
            }
        return {
            "connected": False,
            "vendor": self.vendor,
            "status": "CONFIGURED",
            "message": f"QRadar connector configured for {self.console_ip}.",
            "details": {"console_ip": self.console_ip},
        }

    def fetch_events(self, since: datetime | None = None, limit: int = 100) -> list[dict[str, Any]]:
        return []

    def normalize_event(self, raw_event: dict[str, Any]) -> dict[str, Any]:
        return {
            "alert_code": f"QRADAR-{raw_event.get('id', 'EVT')}",
            "severity": "HIGH" if raw_event.get("magnitude", 5) >= 7 else "MEDIUM",
            "category": raw_event.get("categories", ["Threat"])[0] if isinstance(raw_event.get("categories"), list) else "Threat",
            "title": raw_event.get("description", "QRadar Offense"),
            "description": raw_event.get("description", "QRadar incident"),
            "created_time": datetime.now(timezone.utc),
            "status": "NEW",
            "raw_reference": f"qradar://offenses/{raw_event.get('id')}",
            "indicators": [],
            "raw_data": raw_event,
        }
