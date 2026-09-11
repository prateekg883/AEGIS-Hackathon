from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal, engine
from app.db.base import Base

client = TestClient(app)


def setup_module():
    Base.metadata.create_all(engine)


def test_available_entities():
    response = client.get("/api/analytics/multi-cse/available-entities")
    assert response.status_code == 200
    data = response.json()
    assert "entities" in data
    assert len(data["entities"]) >= 4
    codes = [e["cse_code"] for e in data["entities"]]
    assert "CSE-07" in codes
    assert "CSE-08" in codes
    assert "CSE-09" in codes


def test_entity_review_multiple_cses():
    payload = {"cse_codes": ["CSE-07", "CSE-08", "CSE-09", "CSE-10"]}
    response = client.post("/api/analytics/multi-cse/review", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "entities" in data
    assert len(data["entities"]) == 4
    
    cse07 = next(e for e in data["entities"] if e["cse_code"] == "CSE-07")
    assert cse07["record_count"] > 0
    assert cse07["asset_count"] > 0
    assert cse07["alert_count"] > 0
    assert len(cse07["available_supervisory_metrics"]) >= 4

    cse08 = next(e for e in data["entities"] if e["cse_code"] == "CSE-08")
    assert cse08["company"] == "National Energy Systems"
    assert cse08["dataset_name"] == "transmission.json"
    assert cse08["file_type"] == "JSON"
    assert cse08["record_count"] == 31200
    assert cse08["asset_count"] == 24
    assert cse08["alert_count"] == 890
    assert cse08["threat_count"] == 2850
    assert cse08["critical_event_count"] == 82
    assert "IEC-60870-5-104" in cse08["protocols"]
    assert cse08["findings_count"] == 14
    assert cse08["evidence_count"] == 128


def test_comparison_preview():
    payload = {
        "cse_codes": ["CSE-07", "CSE-08", "CSE-09"],
        "basis": {
            "structure": ["CSE", "Assets", "Datasets"],
            "security": ["Threat Types", "Severity", "Critical Events"],
            "soc_supervisory": ["Attention Score", "Execution Gaps", "Response Time", "Escalation Rate"]
        }
    }
    response = client.post("/api/analytics/multi-cse/preview", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["selected_cses"] == ["CSE-07", "CSE-08", "CSE-09"]
    assert data["datasets_count"] == 3
    assert data["assets_count"] > 0
    assert data["events_count"] > 0
    assert "comparability" in data
    assert data["comparability"]["level"] in ("HIGH", "MEDIUM", "LOW")


def test_multi_cse_compare_2_cses():
    payload = {
        "cse_codes": ["CSE-07", "CSE-08"],
        "basis": {
            "structure": ["CSE", "Assets", "Protocols"],
            "security": ["Threat Volume", "Critical Events", "Severity"],
            "soc_supervisory": ["Attention Score", "Execution Gaps", "Response Time", "Escalation Rate", "Evidence Verification"]
        }
    }
    response = client.post("/api/analytics/multi-cse/compare", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["scope"] == "CSE-level"
    assert data["entities"] == ["CSE-07", "CSE-08"]
    
    # Check metrics table
    metrics = data["metrics_table"]
    att_row = next((m for m in metrics if m["metric_key"] == "attention_score"), None)
    assert att_row is not None
    assert "CSE-07" in att_row["values"]
    assert "CSE-08" in att_row["values"]
    assert int(att_row["values"]["CSE-07"]) > 0
    assert att_row["values"]["CSE-08"] == "61"
    
    # Check threat comparison table
    threats = data["threat_comparison"]
    assert len(threats) > 0
    assert "CSE-07" in threats[0]["counts"]
    assert "CSE-08" in threats[0]["counts"]


def test_multi_cse_compare_3_cses():
    payload = {
        "cse_codes": ["CSE-07", "CSE-08", "CSE-09"],
        "basis": {
            "structure": ["CSE", "Assets", "Datasets", "Protocols"],
            "security": ["Threat Volume", "Critical Events", "Severity"],
            "soc_supervisory": ["Attention Score", "Execution Gaps", "Response Time", "Escalation Rate", "Evidence Verification", "Asset Telemetry"]
        }
    }
    response = client.post("/api/analytics/multi-cse/compare", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["entities"]) == 3
    
    # Verify execution gaps for CSE-07, CSE-08, CSE-09
    gaps_row = next((m for m in data["metrics_table"] if m["metric_key"] == "execution_gaps"), None)
    assert gaps_row is not None
    assert int(gaps_row["values"]["CSE-07"]) >= 0
    assert gaps_row["values"]["CSE-08"] == "2"
    assert gaps_row["values"]["CSE-09"] == "7"

    # Verify response times
    rt_row = next((m for m in data["metrics_table"] if m["metric_key"] == "response_time"), None)
    assert rt_row is not None
    assert "m" in rt_row["values"]["CSE-07"]
    assert rt_row["values"]["CSE-08"] == "19m"
    assert rt_row["values"]["CSE-09"] == "41m"

    # Verify charts data structure
    charts = data["charts_data"]
    assert "multi_bar" in charts
    assert "radar" in charts
    assert len(charts["radar"]) == 5


def test_multi_cse_compare_4_cses():
    payload = {
        "cse_codes": ["CSE-07", "CSE-08", "CSE-09", "CSE-10"],
        "basis": {
            "structure": ["CSE", "Assets"],
            "security": ["Threat Volume", "Critical Events"],
            "soc_supervisory": ["Attention Score", "Execution Gaps", "Response Time"]
        }
    }
    response = client.post("/api/analytics/multi-cse/compare", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["entities"]) == 4
    for row in data["metrics_table"]:
        for code in ["CSE-07", "CSE-08", "CSE-09", "CSE-10"]:
            assert code in row["values"]


def test_cross_company_comparability():
    payload = {
        "cse_codes": ["CSE-07", "CSE-05"],  # CSE-07 is Q2 2026, CSE-05 is Q1 2026
        "basis": {
            "structure": ["CSE"],
            "security": ["Threat Volume"],
            "soc_supervisory": ["Attention Score"]
        }
    }
    response = client.post("/api/analytics/multi-cse/compare", json=payload)
    assert response.status_code == 200
    data = response.json()
    comp = data["comparability"]
    # Should detect cross-enterprise or different assessment period
    assert comp["level"] in ("MEDIUM", "LOW")
    assert comp["warning"] is not None


def test_insufficient_data_handling():
    # Unknown entity
    payload = {
        "cse_codes": ["CSE-07", "CSE-UNKNOWN-99"],
        "basis": {
            "structure": ["CSE", "Assets"],
            "security": ["Threat Volume"],
            "soc_supervisory": ["Attention Score", "Response Time", "Escalation Rate"]
        }
    }
    response = client.post("/api/analytics/multi-cse/compare", json=payload)
    assert response.status_code == 200
    data = response.json()
    metrics = data["metrics_table"]
    
    # Check that unknown CSE has N/A - Insufficient Data, not a fake number
    for row in metrics:
        if row["metric_key"] in ("response_time", "escalation_rate", "attention_score"):
            val = row["values"]["CSE-UNKNOWN-99"]
            assert "N/A" in val or "Insufficient" in val
            assert row["raw_values"]["CSE-UNKNOWN-99"] is None
            assert row["status"]["CSE-UNKNOWN-99"] == "INSUFFICIENT_DATA"


def test_metric_drilldown():
    response = client.get("/api/analytics/multi-cse/drilldown/CSE-07/execution_gaps")
    assert response.status_code == 200
    data = response.json()
    assert data["cse_code"] == "CSE-07"
    assert data["metric"] == "execution_gaps"
    assert len(data["provenance_chain"]) == 11
    
    # Hierarchy check
    levels = [node["level"] for node in data["provenance_chain"]]
    expected = [
        "CSE", "Datasets", "Assets", "Events", "Alerts",
        "Threats", "Cases", "Investigations", "Escalations", "Findings", "Evidence"
    ]
    assert levels == expected
    assert len(data["sample_records"]) >= 2


if __name__ == "__main__":
    test_available_entities()
    test_entity_review_multiple_cses()
    test_comparison_preview()
    test_multi_cse_compare_2_cses()
    test_multi_cse_compare_3_cses()
    test_multi_cse_compare_4_cses()
    test_cross_company_comparability()
    test_insufficient_data_handling()
    test_metric_drilldown()
    print("ALL MULTI-CSE COMPARISON BACKEND TESTS PASSED!")
