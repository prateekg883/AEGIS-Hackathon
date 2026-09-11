import os
import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.models.models import User, AuditLog, SecurityEvent, SecurityAlert
from app.core.security import get_password_hash, create_access_token
from app.core.audit import log_action, verify_audit_log_chain, GENESIS_HASH

TEST_DB_URL = "sqlite:///:memory:"

class AirGapSecurityMonitoringTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            TEST_DB_URL,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool
        )
        self.TestingSessionLocal = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        Base.metadata.create_all(self.engine)


        def override_get_db():
            db = self.TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

        # Seed test users
        with self.TestingSessionLocal() as db:
            self.admin = User(
                email="admin.sec@aegis.gov.in",
                hashed_password=get_password_hash("AdminPass123!"),
                role="ADMINISTRATOR",
                organization="National Supervisory Enclave"
            )
            self.supervisor = User(
                email="supervisor.sec@nciipc.gov.in",
                hashed_password=get_password_hash("SuperPass123!"),
                role="SUPERVISOR",
                organization="NCIIPC Monitoring Enclave"
            )
            self.analyst = User(
                email="analyst.sec@powergrid.in",
                hashed_password=get_password_hash("AnalystPass123!"),
                role="ANALYST",
                organization="PowerGrid SOC"
            )
            db.add_all([self.admin, self.supervisor, self.analyst])
            db.commit()

        self.admin_token = create_access_token({"sub": "admin.sec@aegis.gov.in", "role": "ADMINISTRATOR"})
        self.supervisor_token = create_access_token({"sub": "supervisor.sec@nciipc.gov.in", "role": "SUPERVISOR"})
        self.analyst_token = create_access_token({"sub": "analyst.sec@powergrid.in", "role": "ANALYST"})

    def tearDown(self):
        app.dependency_overrides.clear()
        Base.metadata.drop_all(self.engine)

    def test_airgap_status_endpoint(self):
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        res = self.client.get("/api/security/air-gap/status", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("air_gapped_mode", data)
        self.assertIn("status", data)
        self.assertIn("internet_access", data)
        self.assertEqual(data["external_api_dependency"], "NONE")
        self.assertEqual(data["cloud_dependency"], "NONE")
        self.assertEqual(data["local_processing"], "ACTIVE")

    def test_security_health_all_nine_components(self):
        headers = {"Authorization": f"Bearer {self.supervisor_token}"}
        res = self.client.get("/api/security/health", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("components", data)
        comps = data["components"]
        expected = [
            "Database", "Authentication Service", "OTP Service",
            "Backend API", "Evidence Storage", "Analytics Engine",
            "Audit Logging", "File Processing", "Session Management"
        ]
        for name in expected:
            self.assertIn(name, comps, f"Missing component health check for {name}")
            self.assertIn(comps[name]["status"], ["HEALTHY", "WARNING", "ERROR", "NOT AVAILABLE"])

    def test_security_posture_calculation(self):
        headers = {"Authorization": f"Bearer {self.analyst_token}"}
        res = self.client.get("/api/security/posture", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn(data["posture"], ["SECURE", "CAUTION", "ATTENTION REQUIRED", "CRITICAL"])
        self.assertTrue(len(data["explanation"]) > 0)
        self.assertTrue(len(data["factors"]) >= 5)

    def test_audit_log_hash_chaining_and_tamper_detection(self):
        with self.TestingSessionLocal() as db:
            log1 = log_action(db, "test1@aegis.gov.in", "ACTION_ONE", details={"k": 1})
            log2 = log_action(db, "test2@aegis.gov.in", "ACTION_TWO", details={"k": 2})
            log3 = log_action(db, "test3@aegis.gov.in", "ACTION_THREE", details={"k": 3})

            # Check sequential chaining
            self.assertEqual(log1.prev_hash, GENESIS_HASH)
            self.assertEqual(log2.prev_hash, log1.record_hash)
            self.assertEqual(log3.prev_hash, log2.record_hash)

            # Verification should be clean
            check = verify_audit_log_chain(db)
            self.assertEqual(check["status"], "VERIFIED")
            self.assertEqual(check["integrity"], "VALID")
            self.assertEqual(check["total_events"], 3)

            # Deliberately tamper with log2 content
            db.execute(text(f"UPDATE audit_logs SET action = 'TAMPERED_ACTION' WHERE id = {log2.id}"))
            db.commit()

            # Verification MUST catch the break
            tamper_check = verify_audit_log_chain(db)
            self.assertEqual(tamper_check["status"], "FAILED")
            self.assertEqual(tamper_check["integrity"], "AUDIT INTEGRITY VERIFICATION FAILED")
            self.assertEqual(tamper_check["broken_record_id"], log2.id)

    def test_unauthorized_access_triggers_security_event_and_audit(self):
        # Analyst attempts admin-only config update
        headers = {"Authorization": f"Bearer {self.analyst_token}"}
        res = self.client.post("/api/security/admin/config", json={"refresh_interval_seconds": 15}, headers=headers)
        self.assertEqual(res.status_code, 403)

        # Verify unauthorized event was recorded
        with self.TestingSessionLocal() as db:
            events = db.scalars(select(SecurityEvent).where(SecurityEvent.event_type == "UNAUTHORIZED_ACCESS")).all()
            self.assertTrue(len(events) > 0)
            self.assertEqual(events[-1].severity, "HIGH")
            self.assertEqual(events[-1].status, "BLOCKED")
            self.assertEqual(events[-1].user_role, "ANALYST")

    def test_admin_config_controls_allowed_for_administrator(self):
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        res = self.client.post("/api/security/admin/config", json={"refresh_interval_seconds": 20, "monitoring_enabled": True}, headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "SUCCESS")
        self.assertEqual(data["config"]["refresh_interval_seconds"], 20)

    def test_authentication_events_never_expose_secrets(self):
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        res = self.client.get("/api/security/authentication-events", headers=headers)
        self.assertEqual(res.status_code, 200)
        events = res.json()
        for ev in events:
            for key in ["password", "otp", "secret", "token", "hash"]:
                self.assertNotIn(key, ev)

    def test_system_resources_telemetry(self):
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        res = self.client.get("/api/security/system-resources", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("cpu", data)
        self.assertIn("memory", data)
        self.assertIn("disk", data)
        self.assertIn("application_uptime_seconds", data)
        self.assertIn(data["status"], ["NORMAL", "WARNING", "CRITICAL"])

    def test_airgap_toggle_and_audit_logging(self):
        # Admin toggles Air-Gap OFF
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        res = self.client.post("/api/security/air-gap/toggle", json={"enabled": False, "reason": "Authorized maintenance"}, headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["air_gapped_mode"], "OFF")
        self.assertFalse(data["enabled"])

        # Check AuditLog for AIR_GAP_MODE_CHANGED
        with self.TestingSessionLocal() as db:
            logs = db.scalars(select(AuditLog).where(AuditLog.action == "AIR_GAP_MODE_CHANGED")).all()
            self.assertTrue(len(logs) > 0)
            self.assertEqual(logs[-1].user_email, "admin.sec@aegis.gov.in")
            self.assertEqual(logs[-1].details_json["new_state"], "OFF")

            # Toggle back ON
            res2 = self.client.post("/api/security/air-gap/toggle", json={"enabled": True, "reason": "Re-enable isolation"}, headers=headers)
            self.assertEqual(res2.status_code, 200)
            self.assertTrue(res2.json()["enabled"])

    def test_requirement_24_test_cases(self):
        from unittest.mock import patch

        # TEST 1: Air-Gap ON + Internet Connected
        with self.TestingSessionLocal() as db:
            from app.core.security_monitor import set_airgap_mode, get_airgap_status, get_security_health, get_security_posture
            set_airgap_mode(db, enabled=True, admin_email="admin.sec@aegis.gov.in")
            with patch("app.core.security_monitor.probe_internet_connectivity", return_value={"status": "WARNING", "state": "CONNECTED", "detail": "WAN open"}):
                st = get_airgap_status(db)
                self.assertEqual(st["air_gap_policy"]["status"], "ACTIVE")
                self.assertEqual(st["external_communication"]["status"], "DISABLED")
                self.assertEqual(st["internet"]["status"], "CONNECTED")
                self.assertEqual(st["network_isolation"]["status"], "NOT VERIFIED")
                self.assertNotIn("OFFLINE ENCLAVE VERIFIED", st["summary_headline"])

                posture = get_security_posture(db)
                self.assertEqual(posture["level"], "CAUTION")

        # TEST 2: Air-Gap ON + No Internet (Blocked)
        with self.TestingSessionLocal() as db:
            set_airgap_mode(db, enabled=True, admin_email="admin.sec@aegis.gov.in")
            with patch("app.core.security_monitor.probe_internet_connectivity", return_value={"status": "ACTIVE", "state": "BLOCKED", "detail": "Blocked"}):
                st = get_airgap_status(db)
                self.assertEqual(st["air_gap_policy"]["status"], "ACTIVE")
                self.assertEqual(st["external_communication"]["status"], "DISABLED")
                self.assertEqual(st["internet"]["status"], "BLOCKED")
                self.assertEqual(st["network_isolation"]["status"], "VERIFIED")

        # TEST 3: Air-Gap OFF
        with self.TestingSessionLocal() as db:
            set_airgap_mode(db, enabled=False, admin_email="admin.sec@aegis.gov.in")
            st = get_airgap_status(db)
            self.assertEqual(st["air_gap_policy"]["status"], "INACTIVE")
            self.assertEqual(st["external_communication"]["status"], "PERMITTED")

        # TEST 4: Valid audit chain
        with self.TestingSessionLocal() as db:
            chain = verify_audit_log_chain(db)
            self.assertEqual(chain["status"], "VERIFIED")

        # TEST 6: Air-Gap ON -> OTP Service = DISABLED — AIR-GAPPED MODE, NOT causing ERROR
        with self.TestingSessionLocal() as db:
            set_airgap_mode(db, enabled=True, admin_email="admin.sec@aegis.gov.in")
            health = get_security_health(db)
            self.assertEqual(health["components"]["OTP Service"]["display_status"], "DISABLED — AIR-GAPPED MODE")
            self.assertTrue(health["components"]["OTP Service"]["is_operational"])
            self.assertEqual(health["components"]["OTP Service"]["status"], "HEALTHY")
            self.assertEqual(health["overall"], "HEALTHY")

        # TEST 7: All components healthy -> 9/9 Operational
        with self.TestingSessionLocal() as db:
            health = get_security_health(db)
            self.assertEqual(health["healthy_count"], 9)
            self.assertEqual(health["total_components"], 9)
            self.assertEqual(health["operational_summary"], "9/9 Operational")
            self.assertEqual(health["overall"], "HEALTHY")

        # TEST 5: Tampered audit record creates alert & fails integrity
        with self.TestingSessionLocal() as db:
            # Add records then tamper
            log_action(db, "user@aegis.local", "CRITICAL_ACTION", details={"data": 123})
            last_log = db.scalars(select(AuditLog).order_by(AuditLog.id.desc())).first()
            db.execute(text(f"UPDATE audit_logs SET action = 'HACKED_ACTION' WHERE id = {last_log.id}"))
            db.commit()

            headers = {"Authorization": f"Bearer {self.admin_token}"}
            audit_res = self.client.get("/api/security/audit-integrity", headers=headers)
            self.assertEqual(audit_res.status_code, 200)
            self.assertEqual(audit_res.json()["status"], "FAILED")

            # Check critical alert generated
            alerts = db.scalars(select(SecurityAlert).where(SecurityAlert.severity == "CRITICAL")).all()
            self.assertTrue(len(alerts) > 0)


if __name__ == "__main__":
    unittest.main()

