import unittest
from app.analytics.attention.service import (
    classify_attention_score,
    STATUS_NORMAL,
    STATUS_MEDIUM,
    STATUS_HIGH,
    STATUS_CRITICAL,
)


class TestAttentionPolicy(unittest.TestCase):
    """
    Validates exact prompt specification:
    0–30: NORMAL -> Local Only
    31–70: MEDIUM -> Local Only
    71–97: HIGH -> Human Supervisory Review Required
    98–100: CRITICAL -> Secure Escalation Gateway
    """

    def test_score_0_normal_local(self):
        res = classify_attention_score(0)
        self.assertEqual(res["tier"], "NORMAL")
        self.assertEqual(res["status"], STATUS_NORMAL)
        self.assertEqual(res["action"], "LOCAL_ONLY")
        self.assertFalse(res["requires_human_review"])
        self.assertFalse(res["eligible_for_escalation"])
        self.assertTrue(res["local_only"])

    def test_score_30_normal_local(self):
        res = classify_attention_score(30)
        self.assertEqual(res["tier"], "NORMAL")
        self.assertEqual(res["status"], STATUS_NORMAL)
        self.assertEqual(res["action"], "LOCAL_ONLY")
        self.assertFalse(res["requires_human_review"])
        self.assertFalse(res["eligible_for_escalation"])
        self.assertTrue(res["local_only"])

    def test_score_31_medium_local(self):
        res = classify_attention_score(31)
        self.assertEqual(res["tier"], "MEDIUM")
        self.assertEqual(res["status"], STATUS_MEDIUM)
        self.assertEqual(res["action"], "LOCAL_ONLY")
        self.assertFalse(res["requires_human_review"])
        self.assertFalse(res["eligible_for_escalation"])
        self.assertTrue(res["local_only"])

    def test_score_70_medium_local(self):
        res = classify_attention_score(70)
        self.assertEqual(res["tier"], "MEDIUM")
        self.assertEqual(res["status"], STATUS_MEDIUM)
        self.assertEqual(res["action"], "LOCAL_ONLY")
        self.assertFalse(res["requires_human_review"])
        self.assertFalse(res["eligible_for_escalation"])
        self.assertTrue(res["local_only"])

    def test_score_71_high_human_supervisory_review(self):
        res = classify_attention_score(71)
        self.assertEqual(res["tier"], "HIGH")
        self.assertEqual(res["status"], STATUS_HIGH)
        self.assertEqual(res["action"], "HUMAN_SUPERVISORY_REVIEW")
        self.assertTrue(res["requires_human_review"])
        self.assertFalse(res["eligible_for_escalation"])
        self.assertTrue(res["local_only"])

    def test_score_97_high_human_supervisory_review(self):
        res = classify_attention_score(97)
        self.assertEqual(res["tier"], "HIGH")
        self.assertEqual(res["status"], STATUS_HIGH)
        self.assertEqual(res["action"], "HUMAN_SUPERVISORY_REVIEW")
        self.assertTrue(res["requires_human_review"])
        self.assertFalse(res["eligible_for_escalation"])
        self.assertTrue(res["local_only"])

    def test_score_98_critical_escalation_gateway(self):
        res = classify_attention_score(98)
        self.assertEqual(res["tier"], "CRITICAL")
        self.assertEqual(res["status"], STATUS_CRITICAL)
        self.assertEqual(res["action"], "CRITICAL_ALERT_GATEWAY")
        self.assertTrue(res["requires_human_review"])
        self.assertTrue(res["eligible_for_escalation"])
        self.assertFalse(res["local_only"])

    def test_score_99_critical_escalation_gateway(self):
        res = classify_attention_score(99)
        self.assertEqual(res["tier"], "CRITICAL")
        self.assertEqual(res["status"], STATUS_CRITICAL)
        self.assertEqual(res["action"], "CRITICAL_ALERT_GATEWAY")
        self.assertTrue(res["requires_human_review"])
        self.assertTrue(res["eligible_for_escalation"])
        self.assertFalse(res["local_only"])

    def test_score_100_critical_escalation_gateway(self):
        res = classify_attention_score(100)
        self.assertEqual(res["tier"], "CRITICAL")
        self.assertEqual(res["status"], STATUS_CRITICAL)
        self.assertEqual(res["action"], "CRITICAL_ALERT_GATEWAY")
        self.assertTrue(res["requires_human_review"])
        self.assertTrue(res["eligible_for_escalation"])
        self.assertFalse(res["local_only"])


if __name__ == "__main__":
    unittest.main()
