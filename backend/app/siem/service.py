import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import SIEM_CONNECTOR_TYPE
from app.models.models import Alert, AuditLog, CSEEntity, IngestionBatch
from app.siem.base import BaseSIEMConnector, SIEMConnectionError
from app.siem.elastic import ElasticSecurityConnector
from app.siem.mock_vendor import MicrosoftSentinelConnector, QRadarConnector, SplunkConnector

logger = logging.getLogger("aegis.siem.service")


def _now():
    return datetime.now(timezone.utc)


def get_connector(connector_type: str | None = None) -> BaseSIEMConnector:
    c_type = (connector_type or SIEM_CONNECTOR_TYPE or "ELASTICSEARCH").strip().upper()
    if c_type in ("ELASTIC", "ELASTICSEARCH", "ELASTIC_SECURITY"):
        return ElasticSecurityConnector()
    elif c_type == "SPLUNK":
        return SplunkConnector()
    elif c_type in ("SENTINEL", "AZURE_SENTINEL", "MICROSOFT_SENTINEL"):
        return MicrosoftSentinelConnector()
    elif c_type == "QRADAR":
        return QRadarConnector()
    else:
        return ElasticSecurityConnector()


class SIEMIngestionService:
    """
    Manages SIEM ingestion workflow into A.E.G.I.S. local database.
    Adheres strictly to LOCAL-FIRST processing:
      REAL SIEM -> SIEM CONNECTOR -> LOCAL INGESTION -> LOCAL DATABASE -> LOCAL ANALYTICS.
    No SIEM events are forwarded to external cloud services.
    """

    @staticmethod
    def get_status() -> dict[str, Any]:
        connector = get_connector()
        conn_test = connector.test_connection()
        return {
            "connector_name": connector.name,
            "vendor": connector.vendor,
            "connector_type": SIEM_CONNECTOR_TYPE,
            "connection_test": conn_test,
            "offline_first": True,
            "timestamp": _now().isoformat(),
        }

    @staticmethod
    def sync_siem(
        db: Session,
        cse_code: str,
        assessment_period: str | None = None,
        user_email: str | None = "system@aegis.local",
        limit: int = 100,
    ) -> dict[str, Any]:
        """
        Polls configured SIEM connector, normalizes events, validates them,
        and saves them into the local database as an IngestionBatch and Alert records.
        Offline-resilient: returns graceful response if SIEM is unreachable.
        """
        cse = db.scalar(select(CSEEntity).where(CSEEntity.cse_code == cse_code.upper()))
        if not cse:
            raise ValueError(f"CSE Entity '{cse_code.upper()}' does not exist.")

        period = assessment_period or f"SIEM-SYNC-{_now().strftime('%Y-Q%q' if hasattr(_now(), 'q') else '%Y-%m')}"
        connector = get_connector()

        # Step 1: Connectivity pre-check
        test_res = connector.test_connection()
        if not test_res.get("connected"):
            # Record audit log of offline sync attempt
            db.add(
                AuditLog(
                    user_email=user_email,
                    action="SIEM_SYNC_OFFLINE",
                    entity_type="SIEM",
                    entity_id=connector.vendor,
                    details_json={
                        "cse_code": cse.cse_code,
                        "status": test_res.get("status"),
                        "message": test_res.get("message"),
                    },
                )
            )
            db.commit()
            return {
                "success": False,
                "status": test_res.get("status", "OFFLINE"),
                "message": f"SIEM endpoint is currently offline or unconfigured: {test_res.get('message')}. Local operations unaffected.",
                "synced_count": 0,
                "batch_code": None,
                "offline_resilient": True,
            }

        # Step 2: Fetch and validate
        try:
            raw_events = connector.fetch_events(limit=limit)
        except SIEMConnectionError as e:
            return {
                "success": False,
                "status": "CONNECTION_ERROR",
                "message": f"Failed to retrieve events from {connector.vendor}: {str(e)}",
                "synced_count": 0,
                "batch_code": None,
            }

        if not raw_events:
            return {
                "success": True,
                "status": "EMPTY",
                "message": f"Connected to {connector.vendor}. No new events matching index query.",
                "synced_count": 0,
                "batch_code": None,
            }

        # Step 3: Create Ingestion Batch in Local DB
        batch_code = f"BATCH-SIEM-{_now().strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:6].upper()}"
        batch = IngestionBatch(
            batch_code=batch_code,
            cse_id=cse.id,
            source_type=f"SIEM_{connector.vendor.upper().replace(' ', '_')}",
            source_name=f"{connector.vendor} Security Feed",
            assessment_period=period,
            record_count=0,
            status="PROCESSING",
            ingested_at=_now(),
        )
        db.add(batch)
        db.flush()

        # Step 4: Normalize, deduplicate & insert Alerts
        synced_count = 0
        existing_alert_codes = set(
            db.scalars(select(Alert.alert_code).where(Alert.cse_id == cse.id)).all()
        )

        for raw_event in raw_events:
            try:
                norm = connector.normalize_event(raw_event)
                if not connector.validate_event(norm):
                    continue

                if norm["alert_code"] in existing_alert_codes:
                    continue  # Deduplicate: do not re-ingest existing alert

                alert = Alert(
                    alert_code=norm["alert_code"],
                    cse_id=cse.id,
                    ingestion_batch_id=batch.id,
                    severity=norm["severity"],
                    category=norm["category"],
                    title=norm["title"],
                    description=norm["description"],
                    created_time=norm["created_time"],
                    status=norm.get("status", "NEW"),
                    disposition="INGESTED_VIA_SIEM",
                    analyst="AEGIS_AUTOMATED_INGESTION",
                )
                db.add(alert)
                existing_alert_codes.add(norm["alert_code"])
                synced_count += 1
            except Exception as ex:
                logger.warning(f"Error normalizing SIEM event: {ex}")

        batch.record_count = synced_count
        batch.status = "COMPLETED"

        # Step 5: Audit record
        db.add(
            AuditLog(
                user_email=user_email,
                action="SIEM_SYNC_COMPLETED",
                entity_type="IngestionBatch",
                entity_id=batch_code,
                details_json={
                    "cse_code": cse.cse_code,
                    "vendor": connector.vendor,
                    "records_ingested": synced_count,
                    "assessment_period": period,
                },
            )
        )
        db.commit()

        return {
            "success": True,
            "status": "COMPLETED",
            "message": f"Successfully ingested {synced_count} alerts from {connector.vendor} into local database.",
            "synced_count": synced_count,
            "batch_code": batch_code,
            "assessment_period": period,
        }
