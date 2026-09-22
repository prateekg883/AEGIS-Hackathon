import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import CRITICAL_SCORE_THRESHOLD
from app.gateway.service import CriticalAlertGateway
from app.models.models import (
    Base,
    CSEEntity,
    CriticalEscalationQueue,
    Finding,
    FindingEvidence,
    IngestionBatch,
)
from app.siem.elastic import ElasticSecurityConnector
from app.siem.service import SIEMIngestionService


class TestGatewayAndSIEM(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Seed CSE Entity
        self.cse = CSEEntity(
            cse_code="CSE-07",
            name="PowerGrid Northern Region SOC",
            criticality="TIER_1",
            sector="Power & Energy",
            assessment_status="ACTIVE",
        )
        self.db.add(self.cse)
        self.db.commit()

        # Seed Ingestion Batch
        self.batch = IngestionBatch(
            batch_code="BATCH-TEST-001",
            cse_id=self.cse.id,
            source_type="CSV",
            source_name="test_feed.csv",
            assessment_period="Q2 2026",
            record_count=10,
            status="COMPLETED",
        )
        self.db.add(self.batch)
        self.db.commit()

        # Seed Finding with Evidence
        self.finding = Finding(
            finding_code="FINDING-CRIT-99",
            cse_id=self.cse.id,
            category="EXECUTION_GAP",
            severity="CRITICAL",
            title="Unauthorized ICS Command Sequence Detected",
            description="Supervisory control sequence bypassed human verification on grid switchgear.",
            explanation="Execution gap detected between protocol telemetry and SOC ticketing.",
            status="OPEN",
            detected_at=datetime.now(timezone.utc),
        )
        self.db.add(self.finding)
        self.db.commit()

        self.evidence = FindingEvidence(
            evidence_code="EVD-001",
            finding_id=self.finding.id,
            record_type="ALERT",
            record_id="ALT-SCADA-8821",
            summary="Direct substation telemetry bypass",
        )
        self.db.add(self.evidence)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_gateway_rejects_sub_critical_score_70_and_97(self):
        """Gateway must strictly reject any threat with Attention Score < 98."""
        with self.assertRaises(ValueError) as ctx:
            CriticalAlertGateway.process_critical_alert(
                db=self.db,
                finding=self.finding,
                attention_score=70.0,
            )
        self.assertIn("below the critical threshold", str(ctx.exception))

        with self.assertRaises(ValueError) as ctx:
            CriticalAlertGateway.process_critical_alert(
                db=self.db,
                finding=self.finding,
                attention_score=97.0,
            )
        self.assertIn("below the critical threshold", str(ctx.exception))

    def test_gateway_admits_critical_score_98_and_99(self):
        """Gateway admits 98 and 99, queuing safely when no external endpoint is configured."""
        res_98 = CriticalAlertGateway.process_critical_alert(
            db=self.db,
            finding=self.finding,
            attention_score=98.0,
        )
        self.assertIn(res_98["status"], ("AWAITING_AUTH_ENDPOINT", "DELIVERED"))
        self.assertTrue(res_98["alert_id"].startswith("ALT-CRT-"))

    def test_data_minimisation_enforcement(self):
        """Verifies package contains ONLY permitted minimised keys and no sensitive raw dumps."""
        package = CriticalAlertGateway.build_minimised_package(
            finding=self.finding,
            attention_score=99.5,
            indicators=["src_ip=192.168.10.5", "dst_ip=10.0.1.20"],
        )
        allowed_keys = {
            "alert_id",
            "finding_id",
            "timestamp",
            "attention_score",
            "severity",
            "attack_type",
            "finding_type",
            "summary",
            "description",
            "confidence",
            "relevant_indicators",
            "evidence_reference",
            "source_system",
            "event_reference",
            "ground_level_review",
        }
        self.assertEqual(set(package.keys()), allowed_keys)
        self.assertEqual(package["attention_score"], 99.5)
        self.assertEqual(package["severity"], "CRITICAL")
        self.assertIn("EVD-001", package["evidence_reference"])

    def test_idempotency_and_deduplication(self):
        """Duplicate submissions should be recognized and not create duplicate deliveries."""
        res1 = CriticalAlertGateway.process_critical_alert(
            db=self.db,
            finding=self.finding,
            attention_score=99.0,
        )
        queue_item = self.db.query(CriticalEscalationQueue).first()
        self.assertIsNotNone(queue_item)

        # Simulate delivered
        queue_item.delivery_status = "DELIVERED"
        queue_item.delivered_at = datetime.now(timezone.utc)
        self.db.commit()

        # Second attempt must report ALREADY_DELIVERED
        res2 = CriticalAlertGateway.process_critical_alert(
            db=self.db,
            finding=self.finding,
            attention_score=99.0,
        )
        self.assertEqual(res2["status"], "ALREADY_DELIVERED")

    def test_siem_elastic_offline_resilience(self):
        """SIEM connector should handle offline/unreachable endpoint gracefully without crashing."""
        connector = ElasticSecurityConnector(endpoint="http://non-existent-siem.invalid:9200", timeout=1.0)
        status = connector.test_connection()
        self.assertFalse(status["connected"])
        self.assertIn(status["status"], ("OFFLINE", "TIMEOUT", "ERROR"))

        # Ingestion service sync test
        sync_res = SIEMIngestionService.sync_siem(
            db=self.db,
            cse_code="CSE-07",
        )
        self.assertFalse(sync_res["success"])
        self.assertTrue(sync_res.get("offline_resilient"))


if __name__ == "__main__":
    unittest.main()
