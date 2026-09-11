import io
import os
from fastapi.testclient import TestClient

from app.main import app
from app.normalization.csv_exporter import CSVExporter
from app.normalization.data_cleaner import DataCleaner
from app.normalization.detector import detect_format
from app.normalization.field_mapper import FieldMapper, STANDARD_AEGIS_FIELDS
from app.normalization.parsers import (
    CEFParser,
    CSVParser,
    ExcelParser,
    JSONParser,
    LEEFParser,
    ParquetParser,
    SyslogParser,
    TextParser,
    XMLParser,
)

client = TestClient(app)
SAMPLE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../sample_data"))


def test_detector_and_csv_parser():
    filepath = os.path.join(SAMPLE_DIR, "sample_companies.csv")
    with open(filepath, "rb") as f:
        content = f.read()
    fmt_name, parser = detect_format(content, "sample_companies.csv")
    assert fmt_name == "CSV"
    records = parser.parse(content, "sample_companies.csv")
    assert len(records) == 6
    assert "sourceAddress" in records[0]


def test_json_parser():
    filepath = os.path.join(SAMPLE_DIR, "sample_firewall.json")
    with open(filepath, "rb") as f:
        content = f.read()
    fmt_name, parser = detect_format(content, "sample_firewall.json")
    assert fmt_name == "JSON"
    records = parser.parse(content, "sample_firewall.json")
    assert len(records) == 3
    assert records[0]["event_id"] == "EVT-9001"


def test_xml_parser():
    filepath = os.path.join(SAMPLE_DIR, "sample_soc_events.xml")
    with open(filepath, "rb") as f:
        content = f.read()
    fmt_name, parser = detect_format(content, "sample_soc_events.xml")
    assert fmt_name == "XML"
    records = parser.parse(content, "sample_soc_events.xml")
    assert len(records) == 2
    assert "sourceIPAddress" in records[0]


def test_tsv_parser():
    filepath = os.path.join(SAMPLE_DIR, "sample_flow.tsv")
    with open(filepath, "rb") as f:
        content = f.read()
    fmt_name, parser = detect_format(content, "sample_flow.tsv")
    assert fmt_name == "TSV"
    records = parser.parse(content, "sample_flow.tsv")
    assert len(records) == 3
    assert records[0]["srcAddress"] == "192.168.30.12"


def test_syslog_parser():
    filepath = os.path.join(SAMPLE_DIR, "sample_router.syslog")
    with open(filepath, "rb") as f:
        content = f.read()
    fmt_name, parser = detect_format(content, "sample_router.syslog")
    assert fmt_name == "SYSLOG"
    records = parser.parse(content, "sample_router.syslog")
    assert len(records) == 3
    assert records[0]["src_ip"] == "192.168.1.99"


def test_cef_parser():
    filepath = os.path.join(SAMPLE_DIR, "sample_arcsight.cef")
    with open(filepath, "rb") as f:
        content = f.read()
    fmt_name, parser = detect_format(content, "sample_arcsight.cef")
    assert fmt_name == "CEF"
    records = parser.parse(content, "sample_arcsight.cef")
    assert len(records) == 3
    assert records[0]["src"] == "192.168.10.88"


def test_leef_parser():
    filepath = os.path.join(SAMPLE_DIR, "sample_qradar.leef")
    with open(filepath, "rb") as f:
        content = f.read()
    fmt_name, parser = detect_format(content, "sample_qradar.leef")
    assert fmt_name == "LEEF"
    records = parser.parse(content, "sample_qradar.leef")
    assert len(records) == 2
    assert records[0]["src"] == "192.168.1.55"


def test_excel_parser():
    filepath = os.path.join(SAMPLE_DIR, "sample_telemetry.xlsx")
    with open(filepath, "rb") as f:
        content = f.read()
    fmt_name, parser = detect_format(content, "sample_telemetry.xlsx")
    assert fmt_name == "XLSX"
    records = parser.parse(content, "sample_telemetry.xlsx")
    assert len(records) == 3
    assert records[0]["record_no"] == "XLS-001"


def test_parquet_parser():
    filepath = os.path.join(SAMPLE_DIR, "sample_analytics.parquet")
    with open(filepath, "rb") as f:
        content = f.read()
    fmt_name, parser = detect_format(content, "sample_analytics.parquet")
    assert fmt_name == "PARQUET"
    records = parser.parse(content, "sample_analytics.parquet")
    assert len(records) == 3
    assert records[0]["record_id"] == "PARQ-001"


def test_field_mapper_and_column_analysis():
    mapper = FieldMapper()
    raw_record = {
        "sourceAddress": "192.168.1.50",
        "destinationIP": "EN-SCADA-01",
        "destPort": "502",
        "proto": "MODBUS",
        "threat_type": "Command Injection",
        "threat_level": "CRITICAL",
        "event_time": "2026-06-15 12:00:00",
        "custom_col_1": "alpha",
        "custom_col_2": "beta",
    }
    mapped, details = mapper.map_record(raw_record, 1)
    assert mapped["src_ip"] == "192.168.1.50"
    assert mapped["destination"] == "EN-SCADA-01"
    assert mapped["dst_port"] == "502"
    assert mapped["protocol"] == "MODBUS"
    assert mapped["attack_type"] == "Command Injection"
    assert mapped["triage_priority"] == "CRITICAL"
    assert mapped["custom_col_1"] == "alpha"  # Extra column preserved

    analysis = mapper.analyze_dataset_columns([raw_record])
    assert analysis["detected_columns_count"] == 9
    assert analysis["mapped_fields_count"] >= 6
    assert "custom_col_1" in analysis["ignored_fields"]


def test_data_cleaner_and_warnings():
    cleaner = DataCleaner()
    dirty_records = [
        {
            "record_id": "REC-01",
            "src_ip": "invalid-ip-format!@#",
            "destination": "EN-SCADA-01",
            "dst_port": "999999",  # Invalid port
            "timestamp": "invalid-date",
            "triage_priority": "CRITICAL",
        },
        {
            "record_id": "REC-01",  # Duplicate ID
            "src_ip": "10.0.0.1",
            "destination": "TR-OPS-04",
            "dst_port": 502,
            "timestamp": "2026-06-15 14:00:00",
            "triage_priority": "HIGH",
        },
    ]
    cleaned, warnings = cleaner.clean_and_validate(dirty_records)
    assert len(cleaned) == 2
    assert any("invalid or non-standard IP" in w for w in warnings)
    assert any("invalid port" in w for w in warnings)
    assert any("Duplicate" in w or "duplicate" in w for w in warnings)


def test_api_detect_and_preview():
    filepath = os.path.join(SAMPLE_DIR, "sample_arcsight.cef")
    with open(filepath, "rb") as f:
        content = f.read()
    response = client.post(
        "/api/normalization/detect-and-preview",
        files={"file": ("sample_arcsight.cef", content, "text/plain")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["detected_format"] == "CEF"
    assert data["total_records"] == 3
    assert len(data["preview_records"]) == 3
    assert data["preview_records"][0]["destination"] == "EN-SCADA-01"


def test_api_convert_to_csv():
    filepath = os.path.join(SAMPLE_DIR, "sample_firewall.json")
    with open(filepath, "rb") as f:
        content = f.read()
    response = client.post(
        "/api/normalization/convert-to-csv",
        files={"file": ("sample_firewall.json", content, "application/json")}
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    csv_text = response.text
    assert "record_id,timestamp,src_ip,destination" in csv_text
    assert "EN-SCADA-01" in csv_text


def test_api_ingest_normalized_into_threat_pipeline():
    filepath = os.path.join(SAMPLE_DIR, "sample_companies.csv")
    with open(filepath, "rb") as f:
        content = f.read()
    response = client.post(
        "/api/normalization/ingest-normalized",
        files={"file": ("sample_companies.csv", content, "text/csv")},
        data={"assessment_period": "Q2 2026", "cse_code": "CSE-07"}
    )
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["status"] in ("SUCCESS", "COMPLETED")
    assert res_data["accepted_records"] > 0
    assert res_data["analytics"]["attention_score"] > 0
    assert len(res_data["analytics"]["stages"]) >= 2
