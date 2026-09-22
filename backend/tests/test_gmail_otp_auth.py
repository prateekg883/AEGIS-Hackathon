import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.models.models import User, UserOTP, AuditLog, SecurityEvent, SecurityConfig
from app.core.security import get_password_hash, create_access_token
from app.core.otp_service import generate_secure_otp, hash_otp, mask_email, create_or_refresh_otp, verify_user_otp
from app.core.email_service import send_otp_email

TEST_DB_URL = "sqlite:///:memory:"

class GmailOTPAuthTests(unittest.TestCase):
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

        # Seed test users with distinct roles and registered Gmail addresses
        with self.TestingSessionLocal() as db:
            self.supervisor = User(
                username="supervisor01",
                email="supervisor@nciipc.gov.in",
                registered_email="supervisor.aegis@gmail.com",
                hashed_password=get_password_hash("Admin@2026"),
                role="SUPERVISOR",
                organization="NCIIPC"
            )
            self.analyst = User(
                username="analyst01",
                email="analyst@powergrid.in",
                registered_email="analyst.aegis@gmail.com",
                hashed_password=get_password_hash("Analyst@2026"),
                role="ANALYST",
                organization="National Energy Systems"
            )
            self.admin = User(
                username="admin01",
                email="admin@aegis.gov.in",
                registered_email="admin.aegis@gmail.com",
                hashed_password=get_password_hash("Admin@2026"),
                role="ADMINISTRATOR",
                organization="A.E.G.I.S. Command"
            )
            db.add_all([self.supervisor, self.analyst, self.admin])
            db.commit()

    def tearDown(self):
        app.dependency_overrides.clear()
        Base.metadata.drop_all(self.engine)

    def test_secure_otp_generator(self):
        otp1 = generate_secure_otp(6)
        otp2 = generate_secure_otp(6)
        self.assertEqual(len(otp1), 6)
        self.assertEqual(len(otp2), 6)
        self.assertTrue(otp1.isdigit())
        self.assertTrue(otp2.isdigit())
        self.assertNotEqual(otp1, otp2)

    def test_mask_email(self):
        self.assertEqual(mask_email("supervisor.aegis@gmail.com"), "s*****s@gmail.com")
        self.assertEqual(mask_email("admin@aegis.gov.in"), "a*****n@aegis.gov.in")
        self.assertEqual(mask_email("ab@gmail.com"), "a*****@gmail.com")

    def test_airgap_safety_control_blocks_email_delivery(self):
        # In Air-Gapped Mode, outbound email transmission must be rejected at boundary
        with self.TestingSessionLocal() as db:
            with patch("app.core.config.AIR_GAPPED_MODE", True):
                res = send_otp_email(db, "target@gmail.com", "Target User", "123456")
                self.assertFalse(res["success"])
                self.assertTrue(res["air_gapped"])
                self.assertIn("disabled in Air-Gapped Mode", res["message"])

                # Check audit and security events recorded
                audit_entries = db.scalars(select(AuditLog).where(AuditLog.action == "AIR_GAP_EMAIL_BLOCKED")).all()
                self.assertTrue(len(audit_entries) > 0)
                sec_events = db.scalars(select(SecurityEvent).where(SecurityEvent.event_type == "AIR_GAP_BOUNDARY_ENFORCED")).all()
                self.assertTrue(len(sec_events) > 0)
                self.assertEqual(sec_events[-1].status, "BLOCKED")

    def test_role_security_rejection_on_mismatch(self):
        # Analyst account attempts login as 'SUPERVISOR'
        login_data = {
            "username": "analyst01",
            "password": "Analyst@2026",
            "client_id": "SUPERVISOR"
        }
        res = self.client.post("/api/auth/login", data=login_data)
        self.assertEqual(res.status_code, 403)
        data = res.json()
        self.assertIn("Role authorization mismatch", data["detail"])

        # Verify audit log recorded UNAUTHORIZED_ROLE_ATTEMPT
        with self.TestingSessionLocal() as db:
            attempts = db.scalars(select(AuditLog).where(AuditLog.action == "UNAUTHORIZED_ROLE_ATTEMPT")).all()
            self.assertTrue(len(attempts) > 0)

    def test_air_gapped_mode_login_succeeds_directly(self):
        # With default AIR_GAPPED mode, login creates session directly without external email
        with self.TestingSessionLocal() as db:
            cfg = SecurityConfig(
                key="SYSTEM_SECURITY_CONFIG",
                value_json={"auth_mode": "AIR_GAPPED", "air_gapped_mode": True}
            )
            db.add(cfg)
            db.commit()

        login_data = {
            "username": "supervisor01",
            "password": "Admin@2026",
            "client_id": "SUPERVISOR"
        }
        res = self.client.post("/api/auth/login", data=login_data)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["auth_mode"], "AIR_GAPPED")
        self.assertEqual(data["user"]["role"], "SUPERVISOR")

    def test_connected_email_otp_mode_flow(self):
        # Configure EMAIL_OTP mode in SecurityConfig table
        with self.TestingSessionLocal() as db:
            cfg = SecurityConfig(
                key="SYSTEM_SECURITY_CONFIG",
                value_json={"auth_mode": "EMAIL_OTP", "air_gapped_mode": False}
            )
            db.add(cfg)
            db.commit()

        # Step 1: Request Login with credentials
        login_data = {
            "username": "supervisor01",
            "password": "Admin@2026",
            "client_id": "SUPERVISOR"
        }

        with patch("app.core.email_service.send_otp_email") as mock_send:
            mock_send.return_value = {"success": True, "air_gapped": False, "message": "Sent"}
            res = self.client.post("/api/auth/login", data=login_data)
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["status"], "OTP_REQUIRED")
            self.assertEqual(data["auth_mode"], "EMAIL_OTP")
            self.assertIn("masked_email", data)
            self.assertIn("temp_token", data)
            # CRITICAL: Plaintext OTP must NEVER be exposed in response
            self.assertNotIn("otp", data)

        # Retrieve the generated OTP hash and salt from database to compute valid OTP for test
        with self.TestingSessionLocal() as db:
            user = db.scalar(select(User).where(User.username == "supervisor01"))
            otp_record = db.scalar(select(UserOTP).where(UserOTP.user_id == user.id, UserOTP.is_used == False))
            self.assertIsNotNone(otp_record)
            self.assertEqual(otp_record.attempts_left, 3)

            # Test invalid OTP submission
            verify_payload = {
                "username": "supervisor01",
                "otp": "000000",
                "temp_token": data["temp_token"]
            }
            bad_res = self.client.post("/api/auth/verify-otp", json=verify_payload)
            self.assertEqual(bad_res.status_code, 400)
            self.assertIn("Invalid verification code", bad_res.json()["detail"])

            # Verify attempts decremented
            db.refresh(otp_record)
            self.assertEqual(otp_record.attempts_left, 2)

            # Test valid OTP by mocking or matching hash
            # Create a known candidate OTP
            known_otp = "849201"
            otp_record.otp_hash = hash_otp(known_otp, otp_record.salt)
            db.commit()

            good_payload = {
                "username": "supervisor01",
                "otp": known_otp,
                "temp_token": data["temp_token"]
            }
            good_res = self.client.post("/api/auth/verify-otp", json=good_payload)
            self.assertEqual(good_res.status_code, 200)
            token_data = good_res.json()
            self.assertIn("access_token", token_data)
            self.assertEqual(token_data["user"]["role"], "SUPERVISOR")

            # Check one-time use: replaying same OTP MUST fail
            replay_res = self.client.post("/api/auth/verify-otp", json=good_payload)
            self.assertEqual(replay_res.status_code, 400)

    def test_otp_attempt_lockout(self):
        with self.TestingSessionLocal() as db:
            user = db.scalar(select(User).where(User.username == "analyst01"))
            otp_obj, plaintext, _ = create_or_refresh_otp(db, user)

            # Attempt 1: wrong
            ok, _ = verify_user_otp(db, user, "111111")
            self.assertFalse(ok)
            # Attempt 2: wrong
            ok, _ = verify_user_otp(db, user, "222222")
            self.assertFalse(ok)
            # Attempt 3: wrong
            ok, msg = verify_user_otp(db, user, "333333")
            self.assertFalse(ok)
            self.assertIn("temporarily locked", msg.lower())

            # Attempt 4: locked
            ok, msg = verify_user_otp(db, user, plaintext)
            self.assertFalse(ok)
            self.assertIn("temporarily locked", msg.lower())

    def test_google_otp_send_any_email(self):
        # Testing with registered supervisor email address
        new_email = "supervisor.aegis@gmail.com"
        res = self.client.post("/api/auth/google-otp/send", json={"email": new_email, "role": "Supervisor"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "OTP_REQUIRED")
        self.assertIn("temp_token", data)
        self.assertEqual(data["role"], "SUPERVISOR")

        with self.TestingSessionLocal() as db:
            user = db.scalar(select(User).where(User.registered_email == new_email))
            otp_record = db.scalar(select(UserOTP).where(UserOTP.user_id == user.id, UserOTP.is_used == False))
            known_otp = "771122"
            otp_record.otp_hash = hash_otp(known_otp, otp_record.salt)
            db.commit()

        # Verify using the generated OTP
        verify_payload = {
            "username": data["username"],
            "otp": known_otp,
            "temp_token": data["temp_token"]
        }
        v_res = self.client.post("/api/auth/verify-otp", json=verify_payload)
        self.assertEqual(v_res.status_code, 200)
        user_info = v_res.json()["user"]
        self.assertEqual(user_info["role"], "SUPERVISOR")

if __name__ == "__main__":
    unittest.main()
