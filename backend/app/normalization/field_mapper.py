import re
from typing import Any, Mapping

# Standard AEGIS fields expected by threat detection and risk scoring engines
STANDARD_AEGIS_FIELDS = [
    "record_id",
    "timestamp",
    "src_ip",
    "destination",
    "dst_port",
    "protocol",
    "bytes_transferred",
    "attack_type",
    "has_error",
    "error_type",
    "requires_attention",
    "triage_priority",
    "label",
]

# Comprehensive 200+ alias mapping dictionary
FIELD_ALIASES: dict[str, list[str]] = {
    "record_id": [
        "record_id", "recordid", "record_no", "rec_id", "id", "event_id", "eventid",
        "alert_id", "alertid", "log_id", "logid", "threat_id", "incident_id", "incident_no",
        "ticket_id", "ticket_no", "seq_no", "message_id", "_id", "uid", "guid", "alert_code"
    ],
    "timestamp": [
        "timestamp", "time", "eventtime", "event_time", "datetime", "date_time",
        "created_at", "created_time", "logged_at", "log_time", "start_time", "epoch",
        "@timestamp", "syslog_timestamp", "date", "time_generated", "occurred_at",
        "event_timestamp", "activity_time", "detection_time", "generated_at"
    ],
    "src_ip": [
        "src_ip", "source_ip", "sourceaddress", "source_address", "sourceip",
        "srcaddress", "src", "source", "client_ip", "clientip", "client_address",
        "attacker_ip", "origin_ip", "remote_ip", "src_host", "src_node",
        "c_ip", "sourceIPAddress", "source_ipv4", "src_ipv4", "s_ip", "source_host", "sourcehost"
    ],
    "destination": [
        "destination", "dst_ip", "destination_ip", "destinationaddress",
        "destination_address", "destinationip", "dest_ip", "destip",
        "dest_address", "dstaddress", "target_ip", "targetip", "target_host",
        "target_node", "server_ip", "serverip", "dst_host", "hostname", "host",
        "asset_code", "asset_id", "node", "target", "dest", "dst",
        "destinationIPAddress", "dest_ipv4", "dst_ipv4", "d_ip", "destination_host",
        "target_asset", "targetasset", "destinationHost", "destinationhost"
    ],
    "dst_port": [
        "dst_port", "destination_port", "destinationport", "destport", "dest_port",
        "dport", "dstport", "target_port", "server_port", "service_port",
        "destinationPort", "dst_p", "dest_p", "port", "rport", "remote_port",
        "dpt", "targetPort", "targetport"
    ],
    "protocol": [
        "protocol", "proto", "networkprotocol", "network_protocol", "proto_name",
        "transport", "ip_proto", "app_proto", "protocol_name", "net_proto",
        "l4_protocol", "l7_protocol", "service", "app", "application"
    ],
    "bytes_transferred": [
        "bytes_transferred", "bytes", "size", "length", "tot_bytes", "byte_count",
        "octets", "payload_size", "bytes_out", "bytes_in", "total_bytes",
        "traffic_size", "packet_size", "data_length", "flow_bytes"
    ],
    "attack_type": [
        "attack_type", "threat_name", "threat_type", "alertName", "alertname", "name", "msg", "threat_category",
        "threatcategory", "cat", "signature", "rule_name", "alert_name",
        "event_type", "event_name", "category", "attack_name", "classification",
        "threat_class", "malware_family", "exploit", "cve", "indicator", "vuln", "signature_id", "attack_cat", "attack", "threat"
    ],
    "has_error": [
        "has_error", "error", "is_error", "fault", "failure", "failed",
        "status_code_error", "error_flag", "has_failed", "is_faulty"
    ],
    "error_type": [
        "error_type", "error_name", "error_msg", "error_message", "fault_code",
        "exception", "reason", "failure_reason", "error_code", "status_msg"
    ],
    "requires_attention": [
        "requires_attention", "attention_required", "needs_review", "flagged",
        "is_escalated", "attention", "action_required", "review_needed", "escalated"
    ],
    "triage_priority": [
        "triage_priority", "priority", "severity", "threat_level", "level",
        "criticality", "impact", "urgency", "risk_level", "risk_score",
        "alert_severity", "event_severity", "severity_level",
        "priority_level", "prioritylevel", "triagePriority", "triagepriority", "sev"
    ],
    "label": [
        "label", "is_malicious", "attack_flag", "anomaly", "ground_truth",
        "class", "tag", "verdict", "disposition", "outcome", "is_threat"
    ],
}


def _clean_key(key: str) -> str:
    """Normalizes key for matching: lowercase, alphanumeric and underscores only."""
    return re.sub(r'[^a-z0-9_]', '', str(key).strip().lower())


class FieldMapper:
    """
    Intelligent field mapping engine capable of handling 200+ variations
    of cybersecurity and OT column headers.
    """

    def __init__(self, custom_aliases: dict[str, list[str]] | None = None):
        self.aliases = FIELD_ALIASES.copy()
        if custom_aliases:
            for k, v in custom_aliases.items():
                if k in self.aliases:
                    self.aliases[k].extend(v)
                else:
                    self.aliases[k] = v

    def map_record(self, raw_record: Mapping[str, Any], record_idx: int = 1) -> tuple[dict[str, Any], dict[str, str]]:
        """
        Maps a single raw record to the standard AEGIS schema.
        Returns (normalized_record, column_mapping_applied).
        """
        raw_keys_clean = {_clean_key(k): k for k in raw_record.keys()}
        mapped: dict[str, Any] = {}
        mapping_details: dict[str, str] = {}

        for std_field, alias_list in self.aliases.items():
            matched = False
            for alias in alias_list:
                cleaned_alias = _clean_key(alias)
                if cleaned_alias in raw_keys_clean:
                    orig_key = raw_keys_clean[cleaned_alias]
                    val = raw_record.get(orig_key)
                    if val is not None and str(val).strip() != "":
                        mapped[std_field] = val
                        mapping_details[std_field] = orig_key
                        matched = True
                        break
            if not matched:
                # Default fallbacks if standard field was not in raw row
                if std_field == "record_id":
                    import time
                    t_str = str(int(time.time() * 1000))[-6:]
                    mapped["record_id"] = f"REC-{t_str}-{record_idx:04d}"
                elif std_field == "requires_attention":
                    # Derive if triage priority is high/critical
                    prio = str(mapped.get("triage_priority", "")).upper()
                    mapped["requires_attention"] = 1 if prio in ("CRITICAL", "HIGH", "98", "99") else 0
                elif std_field == "has_error":
                    mapped["has_error"] = 0
                elif std_field == "triage_priority":
                    mapped["triage_priority"] = "LOW"

        # Preserve unmapped extra columns in the record under their original keys
        for orig_k, orig_v in raw_record.items():
            if orig_k not in mapping_details.values() and orig_k not in mapped:
                mapped[orig_k] = orig_v

        return mapped, mapping_details

    def analyze_dataset_columns(self, records: list[Mapping[str, Any]]) -> dict[str, Any]:
        """
        Analyzes column coverage across the entire dataset.
        Returns breakdown: detected_columns, mapped_fields, ignored_fields, missing_fields.
        """
        if not records:
            return {
                "detected_columns": [],
                "detected_columns_count": 0,
                "mapped_fields": {},
                "mapped_fields_count": 0,
                "ignored_fields": [],
                "ignored_fields_count": 0,
                "missing_fields": STANDARD_AEGIS_FIELDS,
                "missing_fields_count": len(STANDARD_AEGIS_FIELDS),
            }

        # Gather all unique original columns
        all_columns = set()
        for r in records:
            all_columns.update(r.keys())
        all_columns_list = sorted(list(all_columns))

        # Test mapping against unified column set
        sample_row = {c: "sample" for c in all_columns_list}
        _, mapping_details = self.map_record(sample_row, 1)

        mapped_source_cols = set(mapping_details.values())
        ignored_cols = [c for c in all_columns_list if c not in mapped_source_cols]
        missing_std_fields = [f for f in STANDARD_AEGIS_FIELDS if f not in mapping_details]

        return {
            "detected_columns": all_columns_list,
            "detected_columns_count": len(all_columns_list),
            "mapped_fields": mapping_details,
            "mapped_fields_count": len(mapping_details),
            "ignored_fields": ignored_cols,
            "ignored_fields_count": len(ignored_cols),
            "missing_fields": missing_std_fields,
            "missing_fields_count": len(missing_std_fields),
        }
