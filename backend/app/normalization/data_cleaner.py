import ipaddress
import re
from datetime import datetime, timezone
from typing import Any


class DataCleaner:
    """
    Validates, cleans, and standardizes records for the AEGIS Threat Detection Engine.
    Generates actionable validation warnings without silently deleting rows.
    """

    IP_PATTERN = re.compile(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$')
    TIMESTAMP_FORMATS = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y/%m/%d %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%b %d %H:%M:%S",
        "%Y-%m-%d",
    ]

    def clean_and_validate(self, records: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
        """
        Cleans and validates records.
        Returns (cleaned_records, validation_warnings).
        """
        cleaned_records: list[dict[str, Any]] = []
        warnings: list[str] = []

        invalid_ip_count = 0
        invalid_port_count = 0
        missing_timestamp_count = 0
        duplicate_id_count = 0
        missing_src_count = 0
        missing_dest_count = 0

        seen_ids = set()

        for idx, rec in enumerate(records, 1):
            row = rec.copy()

            # 1. Record ID check
            rec_id = str(row.get("record_id", "")).strip()
            if not rec_id:
                import time
                t_str = str(int(time.time() * 1000))[-6:]
                rec_id = f"REC-{t_str}-{idx:04d}"
                row["record_id"] = rec_id
            if rec_id in seen_ids:
                duplicate_id_count += 1
            else:
                seen_ids.add(rec_id)

            # 2. Source IP validation & normalization
            src = row.get("src_ip")
            if src is not None and str(src).strip():
                src_str = str(src).strip()
                if not self._is_valid_ip_or_host(src_str):
                    invalid_ip_count += 1
                row["src_ip"] = src_str
            else:
                missing_src_count += 1
                row["src_ip"] = "0.0.0.0"

            # 3. Destination validation & normalization
            dst = row.get("destination")
            if dst is not None and str(dst).strip():
                dst_str = str(dst).strip()
                row["destination"] = dst_str
            else:
                missing_dest_count += 1
                row["destination"] = "EN-SCADA-01"

            # 4. Port validation
            port = row.get("dst_port")
            if port is not None and str(port).strip():
                try:
                    port_num = int(float(str(port).strip()))
                    if 1 <= port_num <= 65535:
                        row["dst_port"] = port_num
                    else:
                        invalid_port_count += 1
                        row["dst_port"] = 80
                except (ValueError, TypeError):
                    invalid_port_count += 1
                    row["dst_port"] = 80
            else:
                row["dst_port"] = 0

            # 5. Timestamp validation & ISO normalization
            ts = row.get("timestamp")
            if ts is not None and str(ts).strip():
                row["timestamp"] = self._normalize_timestamp(str(ts).strip())
            else:
                missing_timestamp_count += 1
                row["timestamp"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

            # 6. Protocol normalization
            proto = str(row.get("protocol", "TCP")).strip().upper()
            if proto in ("6", "TCP", "TRANSMISSION CONTROL PROTOCOL"):
                proto = "TCP"
            elif proto in ("17", "UDP", "USER DATAGRAM PROTOCOL"):
                proto = "UDP"
            elif proto in ("1", "ICMP"):
                proto = "ICMP"
            elif "MODBUS" in proto:
                proto = "MODBUS"
            elif "DNP3" in proto:
                proto = "DNP3"
            elif "OPC" in proto:
                proto = "OPC-UA"
            row["protocol"] = proto

            # 7. Triage Priority & Severity normalization
            prio = str(row.get("triage_priority", "LOW")).strip().upper()
            try:
                numeric_prio = float(prio)
                if numeric_prio >= 8:
                    row["triage_priority"] = "CRITICAL"
                elif numeric_prio >= 6:
                    row["triage_priority"] = "HIGH"
                elif numeric_prio >= 4:
                    row["triage_priority"] = "MEDIUM"
                else:
                    row["triage_priority"] = "LOW"
            except (ValueError, TypeError):
                if any(k in prio for k in ("CRIT", "98", "99", "URGENT", "FATAL")):
                    row["triage_priority"] = "CRITICAL"
                elif any(k in prio for k in ("HIGH", "MAJOR", "ALERT")):
                    row["triage_priority"] = "HIGH"
                elif any(k in prio for k in ("MED", "WARN")):
                    row["triage_priority"] = "MEDIUM"
                else:
                    row["triage_priority"] = "LOW"

            # 8. Numeric fields
            for num_field in ("bytes_transferred", "has_error", "requires_attention"):
                if num_field in row:
                    try:
                        row[num_field] = int(float(str(row[num_field]).strip()))
                    except (ValueError, TypeError):
                        row[num_field] = 0

            cleaned_records.append(row)

        # Assemble summary warnings
        if invalid_ip_count > 0:
            warnings.append(f"{invalid_ip_count} record(s) contain invalid or non-standard IP address format.")
        if invalid_port_count > 0:
            warnings.append(f"{invalid_port_count} record(s) have invalid port numbers (outside 1-65535 range).")
        if missing_timestamp_count > 0:
            warnings.append(f"{missing_timestamp_count} record(s) had missing timestamps; current UTC timestamp was assigned.")
        if duplicate_id_count > 0:
            warnings.append(f"{duplicate_id_count} duplicate record ID(s) detected in source dataset.")
        if missing_src_count > 0:
            warnings.append(f"{missing_src_count} record(s) were missing source IP/address.")
        if missing_dest_count > 0:
            warnings.append(f"{missing_dest_count} record(s) were missing destination asset; defaulted to primary SCADA node.")

        return cleaned_records, warnings

    def _is_valid_ip_or_host(self, val: str) -> bool:
        if not val or val in ("-", "None", "null", "unknown"):
            return False
        try:
            ipaddress.ip_address(val)
            return True
        except ValueError:
            # Allow hostname / SCADA node syntax (e.g. EN-SCADA-01, plc-node-9)
            if re.match(r'^[a-zA-Z0-9\.\-\_]+$', val) and len(val) >= 3:
                return True
            return False

    def _normalize_timestamp(self, ts_str: str) -> str:
        # Check if epoch timestamp (milliseconds or seconds)
        if ts_str.isdigit():
            try:
                epoch = int(ts_str)
                if epoch > 100000000000:  # milliseconds
                    epoch = epoch / 1000
                dt = datetime.fromtimestamp(epoch, tz=timezone.utc)
                return dt.strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                pass

        # Try predefined datetime formats
        for fmt in self.TIMESTAMP_FORMATS:
            try:
                dt = datetime.strptime(ts_str, fmt)
                return dt.strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                continue

        # If already formatted or string
        return ts_str
