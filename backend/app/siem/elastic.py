import logging
from datetime import datetime, timezone
from typing import Any
import httpx

from app.core.config import (
    SIEM_ENDPOINT,
    SIEM_API_KEY,
    SIEM_USERNAME,
    SIEM_PASSWORD,
    SIEM_INDEX,
    SIEM_VERIFY_SSL,
)
from app.siem.base import BaseSIEMConnector, SIEMConnectionError

logger = logging.getLogger("aegis.siem.elastic")


class ElasticSecurityConnector(BaseSIEMConnector):
    """
    Production connector for Elasticsearch and Elastic Security.
    Extracts alerts and security events conforming to the Elastic Common Schema (ECS).
    Fully offline-resilient: catches network/SSL/timeout errors gracefully.
    """

    def __init__(
        self,
        endpoint: str | None = None,
        api_key: str | None = None,
        username: str | None = None,
        password: str | None = None,
        index: str | None = None,
        verify_ssl: bool | None = None,
        timeout: float = 5.0,
    ):
        super().__init__(name="Elastic Security Connector", vendor="Elasticsearch")
        self.endpoint = (endpoint or SIEM_ENDPOINT or "").rstrip("/")
        self.api_key = api_key or SIEM_API_KEY
        self.username = username or SIEM_USERNAME
        self.password = password or SIEM_PASSWORD
        self.index = index or SIEM_INDEX or ".alerts-security.alerts-default,logs-*"
        self.verify_ssl = SIEM_VERIFY_SSL if verify_ssl is None else verify_ssl
        self.timeout = timeout

    def _get_headers(self) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "AEGIS-Supervisory-Tool/1.0",
        }
        if self.api_key:
            headers["Authorization"] = f"ApiKey {self.api_key}"
        return headers

    def _get_auth(self) -> tuple[str, str] | None:
        if not self.api_key and self.username and self.password:
            return (self.username, self.password)
        return None

    def is_configured(self) -> bool:
        return bool(self.endpoint and (self.api_key or (self.username and self.password)))

    def test_connection(self) -> dict[str, Any]:
        """
        Verify Elasticsearch cluster availability and authentication without modifying data.
        """
        if not self.endpoint:
            return {
                "connected": False,
                "vendor": self.vendor,
                "status": "OFFLINE",
                "message": "Elasticsearch endpoint URL not configured. Operating in Offline-First mode.",
                "details": {"endpoint": None, "index": self.index},
            }

        try:
            with httpx.Client(
                verify=self.verify_ssl,
                timeout=self.timeout,
                headers=self._get_headers(),
                auth=self._get_auth(),
            ) as client:
                res = client.get(f"{self.endpoint}/")
                if res.status_code == 200:
                    info = res.json()
                    cluster_name = info.get("cluster_name", "unknown")
                    version = info.get("version", {}).get("number", "unknown")
                    return {
                        "connected": True,
                        "vendor": self.vendor,
                        "status": "ONLINE",
                        "message": f"Connected to Elastic cluster '{cluster_name}' (v{version})",
                        "details": {
                            "cluster_name": cluster_name,
                            "version": version,
                            "endpoint": self.endpoint,
                            "index": self.index,
                        },
                    }
                elif res.status_code in (401, 403):
                    return {
                        "connected": False,
                        "vendor": self.vendor,
                        "status": "AUTH_FAILED",
                        "message": f"Authentication failed with HTTP {res.status_code}. Verify SIEM_API_KEY or credentials.",
                        "details": {"status_code": res.status_code},
                    }
                else:
                    return {
                        "connected": False,
                        "vendor": self.vendor,
                        "status": "ERROR",
                        "message": f"Elasticsearch responded with status code {res.status_code}",
                        "details": {"status_code": res.status_code, "body": res.text[:200]},
                    }
        except httpx.ConnectError:
            return {
                "connected": False,
                "vendor": self.vendor,
                "status": "OFFLINE",
                "message": f"Could not connect to {self.endpoint}. Host unreachable or offline.",
                "details": {"reason": "ConnectError"},
            }
        except httpx.TimeoutException:
            return {
                "connected": False,
                "vendor": self.vendor,
                "status": "TIMEOUT",
                "message": f"Connection timed out after {self.timeout}s.",
                "details": {"reason": "TimeoutException"},
            }
        except Exception as e:
            return {
                "connected": False,
                "vendor": self.vendor,
                "status": "ERROR",
                "message": f"Connection check failed: {str(e)}",
                "details": {"error": type(e).__name__},
            }

    def fetch_events(self, since: datetime | None = None, limit: int = 100) -> list[dict[str, Any]]:
        """
        Fetch alerts/events from Elastic Search API using ECS field conventions.
        """
        if not self.endpoint:
            logger.info("SIEM endpoint not configured. Skipping remote fetch.")
            return []

        search_query: dict[str, Any] = {
            "size": limit,
            "sort": [{"@timestamp": {"order": "desc"}}],
            "query": {"match_all": {}},
        }

        if since:
            search_query["query"] = {
                "range": {
                    "@timestamp": {
                        "gte": since.isoformat(),
                    }
                }
            }

        url = f"{self.endpoint}/{self.index}/_search"
        try:
            with httpx.Client(
                verify=self.verify_ssl,
                timeout=self.timeout * 2,
                headers=self._get_headers(),
                auth=self._get_auth(),
            ) as client:
                res = client.post(url, json=search_query)
                if res.status_code == 200:
                    data = res.json()
                    hits = data.get("hits", {}).get("hits", [])
                    return hits
                elif res.status_code in (401, 403):
                    raise SIEMConnectionError(f"SIEM Authentication failed ({res.status_code})")
                else:
                    raise SIEMConnectionError(f"Elasticsearch returned status {res.status_code}: {res.text[:200]}")
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            logger.warning(f"Elasticsearch unavailable during fetch: {e}")
            raise SIEMConnectionError(f"SIEM unavailable: {type(e).__name__}")

    def normalize_event(self, raw_event: dict[str, Any]) -> dict[str, Any]:
        """
        Map ECS raw document to A.E.G.I.S. canonical alert format.
        """
        source = raw_event.get("_source", raw_event)
        doc_id = str(raw_event.get("_id", ""))

        # Determine alert code
        alert_code = f"ES-{doc_id[:12]}" if doc_id else f"ES-EVT-{datetime.now(timezone.utc).strftime('%H%M%S%f')[:10]}"

        # Determine title
        rule_name = (
            source.get("kibana.alert.rule.name")
            or source.get("signal", {}).get("rule", {}).get("name")
            or source.get("rule", {}).get("name")
            or source.get("event", {}).get("action")
            or source.get("message", "Elastic Security Event")
        )
        if isinstance(rule_name, list) and rule_name:
            rule_name = str(rule_name[0])

        # Determine category
        category = (
            source.get("rule", {}).get("category")
            or source.get("event", {}).get("category")
            or source.get("event", {}).get("dataset")
            or "Security Detection"
        )
        if isinstance(category, list) and category:
            category = str(category[0])

        # Determine severity mapping
        raw_sev = (
            source.get("rule", {}).get("severity")
            or source.get("event", {}).get("severity")
            or source.get("signal", {}).get("rule", {}).get("severity")
            or "medium"
        )
        if isinstance(raw_sev, (int, float)):
            if raw_sev >= 4:
                severity = "CRITICAL"
            elif raw_sev == 3:
                severity = "HIGH"
            elif raw_sev == 2:
                severity = "MEDIUM"
            else:
                severity = "LOW"
        else:
            sev_str = str(raw_sev).strip().upper()
            if sev_str in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
                severity = sev_str
            else:
                severity = "MEDIUM"

        # Timestamp parsing
        raw_ts = source.get("@timestamp") or source.get("event", {}).get("created")
        if raw_ts:
            try:
                # Handle ISO8601 strings
                created_time = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
            except Exception:
                created_time = datetime.now(timezone.utc)
        else:
            created_time = datetime.now(timezone.utc)

        # Description & details
        desc = (
            source.get("rule", {}).get("description")
            or source.get("message")
            or f"Elastic Security detection: {rule_name}"
        )

        # Extract indicators
        indicators = []
        for key in ("source.ip", "destination.ip", "host.name", "user.name", "process.name"):
            val = source.get(key)
            if not val and "." in key:
                parts = key.split(".")
                sub = source.get(parts[0], {})
                if isinstance(sub, dict):
                    val = sub.get(parts[1])
            if val:
                indicators.append(f"{key}={val}")

        return {
            "alert_code": alert_code,
            "severity": severity,
            "category": str(category)[:100],
            "title": str(rule_name)[:250],
            "description": str(desc),
            "created_time": created_time,
            "status": "NEW",
            "raw_reference": f"elasticsearch://{self.index}/{doc_id}",
            "indicators": indicators,
            "raw_data": raw_event,
        }
