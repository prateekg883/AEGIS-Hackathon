import re
from typing import Any
from app.normalization.parsers.base import BaseParser


class SyslogParser(BaseParser):
    format_name = "SYSLOG"

    # RFC 5424: <PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID [STRUCTURED-DATA] MSG
    RFC5424_PATTERN = re.compile(
        r'^<(?P<pri>\d{1,3})>(?P<version>\d+)\s+(?P<timestamp>\S+)\s+(?P<hostname>\S+)\s+(?P<appname>\S+)\s+(?P<procid>\S+)\s+(?P<msgid>\S+)\s+(?P<msg>.*)$'
    )

    # RFC 3164: <PRI>TIMESTAMP HOSTNAME TAG: MSG or <PRI>TIMESTAMP HOSTNAME MSG
    RFC3164_PATTERN = re.compile(
        r'^<(?P<pri>\d{1,3})>(?P<timestamp>[A-Za-z]{3}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+(?P<hostname>\S+)\s+(?:(?P<appname>[^:\s]+):\s*)?(?P<msg>.*)$'
    )

    # Simple Syslog without PRI: TIMESTAMP HOSTNAME APP: MSG
    SIMPLE_PATTERN = re.compile(
        r'^(?P<timestamp>[A-Za-z]{3}\s+\d+\s+\d{2}:\d{2}:\d{2}|\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)\s+(?P<hostname>\S+)\s+(?:(?P<appname>[^:\s]+):\s*)?(?P<msg>.*)$'
    )

    KV_PATTERN = re.compile(r'([a-zA-Z0-9_\-\.]+)=(?:"([^"]*)"|\'([^\']*)\'|(\S+))')

    def parse(self, content: bytes, filename: str = "") -> list[dict[str, Any]]:
        text_content = None
        for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
            try:
                text_content = content.decode(enc)
                break
            except Exception:
                continue
        if text_content is None:
            text_content = content.decode("utf-8", errors="ignore")

        lines = [line.strip() for line in text_content.splitlines() if line.strip()]
        records = []

        for idx, line in enumerate(lines, 1):
            record: dict[str, Any] = {"record_id": f"SYS-{idx:05d}"}
            
            m = self.RFC5424_PATTERN.match(line)
            if m:
                d = m.groupdict()
                pri = int(d.get("pri") or 0)
                record["facility"] = pri >> 3
                record["severity_level"] = pri & 7
                record["timestamp"] = d.get("timestamp")
                record["hostname"] = d.get("hostname")
                record["app_name"] = d.get("appname")
                record["message"] = d.get("msg")
            else:
                m = self.RFC3164_PATTERN.match(line)
                if m:
                    d = m.groupdict()
                    pri = int(d.get("pri") or 0)
                    record["facility"] = pri >> 3
                    record["severity_level"] = pri & 7
                    record["timestamp"] = d.get("timestamp")
                    record["hostname"] = d.get("hostname")
                    record["app_name"] = d.get("appname") or ""
                    record["message"] = d.get("msg")
                else:
                    m = self.SIMPLE_PATTERN.match(line)
                    if m:
                        d = m.groupdict()
                        record["timestamp"] = d.get("timestamp")
                        record["hostname"] = d.get("hostname")
                        record["app_name"] = d.get("appname") or ""
                        record["message"] = d.get("msg")
                    else:
                        record["message"] = line

            # Extract any embedded key=value pairs from the syslog message body
            msg = record.get("message", "")
            if msg:
                kv_matches = self.KV_PATTERN.findall(msg)
                for key, val1, val2, val3 in kv_matches:
                    val = val1 or val2 or val3
                    if key not in record:
                        record[key] = val

            records.append(record)

        return records
