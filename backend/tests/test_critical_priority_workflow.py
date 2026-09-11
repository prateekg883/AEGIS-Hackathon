import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from sqlalchemy import create_engine, select
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
    AuditLog,
    Base,
    CSEEntity,
    CriticalEscalationQueue,
    Finding,
    FindingEvidence,
    IngestionBatch,
    User,
)


class TestCriticalPriorityWorkflow(unittest.TestCase):
    """
    FEATURE 13: Exhaustive tests for Automatic Critical Priority + Senior Advisory Workflow
    Validates exact score tiers: 0, 30, 31, 70, 71, 97, 98, 99, 100.
    """

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

        # Seed Supervisor User
        self.supervisor = User(
            username="supervisor01",
            email="aegis.supervisor01@gmail.com",
            hashed_password="fakehashpassword123",
            role="SUPERVISOR",
            organization="NCIIPC / NTRO",
        )
        self.db.add(self.supervisor)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    # -------------------------------------------------------------
    # Policy Classification Tests: 0, 30, 31, 70, 71, 97, 98, 99, 100
    # -------------------------------------------------------------
    def test_score_policy_thresholds(self):
        # 0: Normal -> Local Only
        res_0 = classify_attention_score(0)
        self.assertEqual(res_0["tier"], "NORMAL")
        self.assertEqual(res_0["status"], STATUS_NORMAL)
        self.assertFalse(res_0["requires_human_review"])
        self.assertFalse(res_0["eligible_for_escalation"])

        # 30: Normal -> Local Only
        res_30 = classify_attention_score(30)
        self.assertEqual(res_30["tier"], "NORMAL")
        self.assertEqual(res_30["status"], STATUS_NORMAL)
        self.assertFalse(res_30["requires_human_review"])
        self.assertFalse(res_30["eligible_for_escalation"])

        # 31: Medium -> Local Only
        res_31 = classify_attention_score(31)
        self.assertEqual(res_31["tier"], "MEDIUM")
        self.assertEqual(res_31["status"], STATUS_MEDIUM)
        self.assertFalse(res_31["requires_human_review"])
        self.assertFalse(res_31["eligible_for_escalation"])

        # 70: Medium -> Local Only
        res_70 = classify_attention_score(70)
        self.assertEqual(res_70["tier"], "MEDIUM")
        self.assertEqual(res_70["status"], STATUS_MEDIUM)
        self.assertFalse(res_70["requires_human_review"])
        self.assertFalse(res_70["eligible_for_escalation"])

        # 71: High -> Human Supervisory Review Required (Local Only)
        res_71 = classify_attention_score(71)
        self.assertEqual(res_71["tier"], "HIGH")
        self.assertEqual(res_71["status"], STATUS_HIGH)
        self.assertTrue(res_71["requires_human_review"])
        self.assertFalse(res_71["eligible_for_escalation"])
        self.assertTrue(res_71["local_only"])

        # 97: High -> Human Supervisory Review Required (Local Only)
        res_97 = classify_attention_score(97)
        self.assertEqual(res_97["tier"], "HIGH")
        self.assertEqual(res_97["status"], STATUS_HIGH)
        self.assertTrue(res_97["requires_human_review"])
        self.assertFalse(res_97["eligible_for_escalation"])
        self.assertTrue(res_97["local_only"])

        # 98: Critical -> Critical Alert Gateway / Senior Advisory Review
        res_98 = classify_attention_score(98)
        self.assertEqual(res_98["tier"], "CRITICAL")
        self.assertEqual(res_98["status"], STATUS_CRITICAL)
        self.assertTrue(res_98["requires_human_review"])
        self.assertTrue(res_98["eligible_for_escalation"])

        # 99: Critical -> Critical Alert Gateway / Senior Advisory Review
        res_99 = classify_attention_score(99)
        self.assertEqual(res_99["tier"], "CRITICAL")
        self.assertEqual(res_99["status"], STATUS_CRITICAL)
        self.assertTrue(res_99["requires_human_review"])
        self.assertTrue(res_99["eligible_for_escalation"])

        # 100: Critical -> Critical Alert Gateway / Highest Priority Senior Advisory Review
        res_100 = classify_attention_score(100)
        self.assertEqual(res_100["tier"], "CRITICAL")
        self.assertEqual(res_100["status"], STATUS_CRITICAL)
        self.assertTrue(res_100["requires_human_review"])
        self.assertTrue(res_100["eligible_for_escalation"])

    # -------------------------------------------------------------
    # Gatekeeper Enforcement Tests
    # -------------------------------------------------------------
    def test_scores_0_to_97_never_enter_gateway(self):
        """Scores 0, 30, 31, 70, 71, 97 must be rejected by CriticalAlertGateway."""
        finding = Finding(
            finding_code="FND-NON-CRIT",
            cse_id=self.cse.id,
            category="EXECUTION_GAP",
            severity="HIGH",
            title="Non-critical finding",
            description="Testing gatekeeper rejection",
            explanation="Test explanation",
            status="OPEN",
            detected_at=datetime.now(timezone.utc),
        )
        self.db.add(finding)
        self.db.commit()

        for non_crit_score in [0.0, 30.0, 31.0, 70.0, 71.0, 97.0]:
            with self.assertRaises(ValueError) as ctx:
                CriticalAlertGateway.process_critical_alert(
                    db=self.db,
                    finding=finding,
                    attention_score=non_crit_score,
                )
            self.assertIn("below the critical threshold", str(ctx.exception))

    # -------------------------------------------------------------
    # Automatic Critical Priority Queue & Sorting (100 > 99 > 98)
    # -------------------------------------------------------------
    def test_automatic_critical_priority_ranking(self):
        """
        FEATURE 1: When score is 98-100, automatically place in critical queue.
        Score 100 must appear above 99, and 99 must appear above 98.
        """
        f_98 = Finding(
            finding_code="FND-CRT-98",
            cse_id=self.cse.id,
            category="EXECUTION_GAP",
            severity="CRITICAL",
            title="Unescalated Port Sweep Threat",
            description="Port sweep on SCADA subnet",
            explanation="Execution gap detected",
            status="OPEN",
            score_contribution=98.0,
            detected_at=datetime.now(timezone.utc),
        )
        f_99 = Finding(
            finding_code="FND-CRT-99",
            cse_id=self.cse.id,
            category="NEGATIVE_SPACE",
            severity="CRITICAL",
            title="Missing Firewall Telemetry",
            description="Complete dropout of firewall logs",
            explanation="Negative space detected",
            status="OPEN",
            score_contribution=99.0,
            detected_at=datetime.now(timezone.utc),
        )
        f_100 = Finding(
            finding_code="FND-CRT-100",
            cse_id=self.cse.id,
            category="ANOMALY",
            severity="CRITICAL",
            title="Zero-Day ICS Protocol Tampering",
            description="Unauthorized switchgear trip sequence",
            explanation="Operational anomaly detected",
            status="OPEN",
            score_contribution=100.0,
            detected_at=datetime.now(timezone.utc),
        )
        self.db.add_all([f_98, f_99, f_100])
        self.db.commit()

        # Retrieve critical findings via gateway service
        critical_list = CriticalAlertGateway.get_critical_findings(self.db)
        self.assertEqual(len(critical_list), 3)

        # Verify strict ordering: 100 > 99 > 98
        self.assertEqual(critical_list[0]["finding_id"], "FND-CRT-100")
        self.assertEqual(critical_list[0]["attention_score"], 100.0)
        self.assertEqual(critical_list[0]["priority_label"], "🚨 Immediate Senior Review")

        self.assertEqual(critical_list[1]["finding_id"], "FND-CRT-99")
        self.assertEqual(critical_list[1]["attention_score"], 99.0)
        self.assertEqual(critical_list[1]["priority_label"], "🚨 Senior Review")

        self.assertEqual(critical_list[2]["finding_id"], "FND-CRT-98")
        self.assertEqual(critical_list[2]["attention_score"], 98.0)
        self.assertEqual(critical_list[2]["priority_label"], "🚨 Senior Review")

    # -------------------------------------------------------------
    # Senior Advisory Review Actions: View, Acknowledge, Resolve, Escalate
    # -------------------------------------------------------------
    def test_senior_advisory_review_workflow(self):
        """
        FEATURE 3, 4, 8: Senior reviewer can View, Acknowledge, Resolve, and Escalate.
        """
        finding = Finding(
            finding_code="FND-SENIOR-01",
            cse_id=self.cse.id,
            category="EXECUTION_GAP",
            severity="CRITICAL",
            title="ICS Command Verification Bypass",
            description="Supervisory sign-off bypassed",
            explanation="Critical execution gap",
            status="OPEN",
            score_contribution=99.0,
            detected_at=datetime.now(timezone.utc),
        )
        self.db.add(finding)
        self.db.commit()

        # 1. View finding -> logs audit
        view_res = CriticalAlertGateway.view_finding(self.db, "FND-SENIOR-01", self.supervisor.email)
        self.assertEqual(view_res["status"], "success")

        # 2. Acknowledge finding -> updates status to UNDER REVIEW and logs audit
        ack_res = CriticalAlertGateway.acknowledge_finding(self.db, "FND-SENIOR-01", self.supervisor.email)
        self.assertEqual(ack_res["status"], "success")
        self.db.refresh(finding)
        self.assertEqual(finding.status, "UNDER REVIEW")

        # 3. Resolve finding -> updates status to RESOLVED and logs audit
        res_res = CriticalAlertGateway.resolve_finding(self.db, "FND-SENIOR-01", self.supervisor.email, notes="Verified false trigger")
        self.assertEqual(res_res["status"], "success")
        self.db.refresh(finding)
        self.assertEqual(finding.status, "RESOLVED")
        self.assertIsNotNone(finding.resolved_at)

        # 4. Escalate finding -> enters existing Critical Alert Gateway
        esc_res = CriticalAlertGateway.process_critical_alert(
            db=self.db,
            finding=finding,
            attention_score=99.0,
            user_email=self.supervisor.email,
        )
        self.assertIn(esc_res["status"], ("AWAITING_AUTH_ENDPOINT", "DELIVERED"))
        self.assertTrue(esc_res["alert_id"].startswith("ALT-CRT-"))

        # Verify audit logs generated
        audit_actions = [a.action for a in self.db.scalars(select(AuditLog)).all()]
        self.assertIn("CRITICAL_FINDING_VIEWED", audit_actions)
        self.assertIn("CRITICAL_FINDING_ACKNOWLEDGED", audit_actions)
        self.assertIn("CRITICAL_FINDING_RESOLVED", audit_actions)
        self.assertIn("CRITICAL_ALERT_QUEUED_LOCAL", audit_actions)

    # -------------------------------------------------------------
    # Data Minimisation & Duplicate Prevention Tests
    # -------------------------------------------------------------
    def test_data_minimisation_and_deduplication(self):
        """
        FEATURE 5, 9: Never transmits full DB/CSV; prevents duplicate transmissions.
        """
        finding = Finding(
            finding_code="FND-MINIMISE-01",
            cse_id=self.cse.id,
            category="EXECUTION_GAP",
            severity="CRITICAL",
            title="Minimisation Test Finding",
            description="Ensuring zero CSV / full database dump leakage",
            explanation="Testing data minimisation schema",
            status="OPEN",
            score_contribution=100.0,
            detected_at=datetime.now(timezone.utc),
        )
        self.db.add(finding)
        self.db.commit()

        # Build minimised package
        pkg = CriticalAlertGateway.build_minimised_package(
            finding=finding,
            attention_score=100.0,
            indicators=["ip=10.0.0.1", "port=502"],
        )

        # Ensure no raw dumps exist in package
        self.assertNotIn("raw_csv", pkg)
        self.assertNotIn("database_dump", pkg)
        self.assertNotIn("password", pkg)
        self.assertEqual(pkg["attention_score"], 100.0)
        self.assertEqual(pkg["severity"], "CRITICAL")

        # Process twice to verify deduplication
        res1 = CriticalAlertGateway.process_critical_alert(self.db, finding, 100.0, self.supervisor.email)
        queue_item = self.db.scalar(select(CriticalEscalationQueue).where(CriticalEscalationQueue.finding_id == finding.id))
        self.assertIsNotNone(queue_item)

        # Mark as delivered
        queue_item.delivery_status = "DELIVERED"
        queue_item.delivered_at = datetime.now(timezone.utc)
        self.db.commit()

        # Second attempt must return ALREADY_DELIVERED
        res2 = CriticalAlertGateway.process_critical_alert(self.db, finding, 100.0, self.supervisor.email)
        self.assertEqual(res2["status"], "ALREADY_DELIVERED")


if __name__ == "__main__":
    unittest.main()
