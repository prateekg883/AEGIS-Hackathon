import hashlib
import json
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.analytics.attention.service import (
    classify_attention_score,
    STATUS_NORMAL,
    STATUS_MEDIUM,
    STATUS_HIGH,
    STATUS_CRITICAL,
)
from app.gateway.service import CriticalAlertGateway
from app.models.models import (
    Base,
    CSEEntity,
    CriticalEscalationQueue,
    Finding,
    FindingEvidence,
    IngestionBatch,
    User,
)
from app.siem.elastic import ElasticSecurityConnector
from app.siem.service import SIEMIngestionService


class TestAEGISE2EIntegration(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        self.cse = CSEEntity(
            cse_code="CSE-07",
            name="PowerGrid Northern Region SOC",
            criticality="TIER_1",
            sector="Power & Energy",
            assessment_status="ACTIVE",
        )
        self.db.add(self.cse)
        self.db.commit()

        self.finding = Finding(
            finding_code="FINDING-CRIT-001",
            cse_id=self.cse.id,
            category="EXECUTION_GAP",
            severity="CRITICAL",
            title="SCADA Telemetry Disconnect & Bypassed Escalation",
            description="High-voltage circuit breaker command transmitted without supervisory sign-off.",
            explanation="Execution gap detected between protocol telemetry and SOC ticketing.",
            status="OPEN",
            detected_at=datetime.now(timezone.utc),
        )
        self.db.add(self.finding)
        self.db.commit()

        self.evidence = FindingEvidence(
            evidence_code="EVD-TEL-001",
            finding_id=self.finding.id,
            record_type="ALERT",
            record_id="ALT-IED-9910",
            summary="Unauthenticated Modbus/TCP command sequence",
        )
        self.db.add(self.evidence)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    # 1. Exact Threshold Test Suite (0, 30, 31, 70, 71, 97, 98, 99, 100)
    def test_01_score_threshold_cases(self):
        cases = [
            (0, "NORMAL", STATUS_NORMAL, "LOCAL_ONLY", False, False),
            (30, "NORMAL", STATUS_NORMAL, "LOCAL_ONLY", False, False),
            (31, "MEDIUM", STATUS_MEDIUM, "LOCAL_ONLY", False, False),
            (70, "MEDIUM", STATUS_MEDIUM, "LOCAL_ONLY", False, False),
            (71, "HIGH", STATUS_HIGH, "HUMAN_SUPERVISORY_REVIEW", True, False),
            (97, "HIGH", STATUS_HIGH, "HUMAN_SUPERVISORY_REVIEW", True, False),
            (98, "CRITICAL", STATUS_CRITICAL, "CRITICAL_ALERT_GATEWAY", True, True),
            (99, "CRITICAL", STATUS_CRITICAL, "CRITICAL_ALERT_GATEWAY", True, True),
            (100, "CRITICAL", STATUS_CRITICAL, "CRITICAL_ALERT_GATEWAY", True, True),
        ]
        for score, exp_tier, exp_status, exp_act, exp_rev, exp_esc in cases:
            with self.subTest(score=score):
                res = classify_attention_score(score)
                self.assertEqual(res["tier"], exp_tier)
                self.assertEqual(res["status"], exp_status)
                self.assertEqual(res["action"], exp_act)
                self.assertEqual(res["requires_human_review"], exp_rev)
                self.assertEqual(res["eligible_for_escalation"], exp_esc)

    # 2. Gatekeeper Strictly Blocks < 98
    def test_02_gatekeeper_blocks_sub_critical_scores(self):
        for sub_crit in [0, 30, 50, 70, 71, 95, 97, 97.9]:
            with self.assertRaises(ValueError):
                CriticalAlertGateway.process_critical_alert(
                    db=self.db,
                    finding=self.finding,
                    attention_score=sub_crit,
                )

    # 3. Data Minimisation: No CSV or Database Dumps
    def test_03_data_minimisation(self):
        pkg = CriticalAlertGateway.build_minimised_package(
            finding=self.finding,
            attention_score=99.0,
            indicators=["src=10.0.1.5", "dst=192.168.1.100"],
        )
        self.assertEqual(pkg["finding_id"], "FINDING-CRIT-001")
        self.assertEqual(pkg["attention_score"], 99.0)
        self.assertEqual(pkg["severity"], "CRITICAL")
        self.assertIn("src=10.0.1.5", pkg["relevant_indicators"])
        self.assertIn("EVD-TEL-001", pkg["evidence_reference"])
        self.assertNotIn("password", pkg)
        self.assertNotIn("raw_csv", pkg)

    # 4. No Internet / External Endpoint Unconfigured: Local Queueing
    def test_04_no_external_endpoint_queues_locally(self):
        res = CriticalAlertGateway.process_critical_alert(
            db=self.db,
            finding=self.finding,
            attention_score=98.5,
        )
        self.assertEqual(res["status"], "AWAITING_AUTH_ENDPOINT")
        self.assertIn("queued in secure local storage", res["message"])

        queue_item = self.db.query(CriticalEscalationQueue).filter_by(finding_id=self.finding.id).first()
        self.assertIsNotNone(queue_item)
        self.assertEqual(queue_item.delivery_status, "AWAITING_AUTH_ENDPOINT")
        self.assertIsNotNone(queue_item.signature)

    # 5. Duplicate and Replay Prevention
    def test_05_duplicate_and_replay_prevention(self):
        res1 = CriticalAlertGateway.process_critical_alert(
            db=self.db,
            finding=self.finding,
            attention_score=99.0,
        )
        queue_item = self.db.query(CriticalEscalationQueue).filter_by(finding_id=self.finding.id).first()
        queue_item.delivery_status = "DELIVERED"
        queue_item.delivered_at = datetime.now(timezone.utc)
        self.db.commit()

        # Replay attempt
        res2 = CriticalAlertGateway.process_critical_alert(
            db=self.db,
            finding=self.finding,
            attention_score=99.0,
        )
        self.assertEqual(res2["status"], "ALREADY_DELIVERED")

    # 6. SIEM Offline Resilience
    def test_06_siem_offline_resilience(self):
        connector = ElasticSecurityConnector(endpoint="http://127.0.0.1:59999", timeout=0.5)
        test_res = connector.test_connection()
        self.assertFalse(test_res["connected"])
        self.assertIn(test_res["status"], ("OFFLINE", "TIMEOUT"))

    # 7. SIEM Normalisation of Malformed vs Well-formed ECS
    def test_07_siem_event_normalisation_and_validation(self):
        connector = ElasticSecurityConnector()
        ecs_event = {
            "_id": "sec-alert-7788",
            "_source": {
                "@timestamp": "2026-06-15T10:30:00Z",
                "rule": {
                    "name": "Persistence: Scheduled Task Creation",
                    "category": "Persistence",
                    "severity": "high",
                    "description": "A scheduled task was created via schtasks.exe",
                },
                "host": {"name": "SUBSTATION-SRV-01"},
                "source": {"ip": "10.10.4.12"},
            },
        }
        norm = connector.normalize_event(ecs_event)
        self.assertTrue(connector.validate_event(norm))
        self.assertEqual(norm["alert_code"], "ES-sec-alert-77")
        self.assertEqual(norm["severity"], "HIGH")
        self.assertEqual(norm["title"], "Persistence: Scheduled Task Creation")
        self.assertIn("source.ip=10.10.4.12", norm["indicators"])

        # Malformed event with missing mandatory fields
        malformed = {"_id": "malformed", "_source": {}}
        norm_malformed = connector.normalize_event(malformed)
        # Missing created_time or severe title
        norm_malformed["title"] = ""
        self.assertFalse(connector.validate_event(norm_malformed))

    # 8. Outbound Transmission Success & Failure Simulation
    @patch("httpx.Client.post")
    def test_08_outbound_transmission_success(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        with patch("app.gateway.service.ESCALATION_ENABLED", True), \
             patch("app.gateway.service.DESTINATION_URL", "https://authorised-gateway.internal/api/v1/alerts"):
            queue_item = CriticalEscalationQueue(
                alert_id="ALT-TEST-SUCCESS",
                finding_id=self.finding.id,
                cse_code="CSE-07",
                attention_score=99.5,
                severity="CRITICAL",
                destination_type="IB_SECURE_GATEWAY",
                destination_url="https://authorised-gateway.internal/api/v1/alerts",
                payload_hash="testhash123",
                idempotency_key="IDEMP-TEST-SUCCESS",
                minimised_payload_json={"alert_id": "ALT-TEST-SUCCESS"},
                delivery_status="PENDING",
            )
            self.db.add(queue_item)
            self.db.commit()

            res = CriticalAlertGateway.retry_transmission(self.db, queue_item.id)
            self.assertEqual(res["status"], "DELIVERED")
            self.assertEqual(queue_item.delivery_status, "DELIVERED")
            self.assertEqual(queue_item.response_code, 200)


if __name__ == "__main__":
    unittest.main()
