import re
from typing import Any
from app.normalization.parsers.base import BaseParser


class TextParser(BaseParser):
    format_name = "TXT"

    KV_REGEX = re.compile(r'(?:^|\s+)([a-zA-Z0-9_\-\.]+)=(?:"([^"]*)"|\'([^\']*)\'|(\S+))')

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
        if not lines:
            return []

        records = []

        # 1. Try Key-Value pair extraction (e.g. src=192.168.1.1 dst=10.0.0.1 proto=TCP action=blocked)
        kv_success_count = 0
        for line in lines:
            matches = self.KV_REGEX.findall(line)
            if matches and len(matches) >= 2:
                row = {}
                for key, val1, val2, val3 in matches:
                    val = val1 or val2 or val3
                    row[key] = val
                records.append(row)
                kv_success_count += 1

        if kv_success_count > len(lines) * 0.4:
            return records

        # 2. Try Delimited text (pipe, tab, semicolon)
        sample_line = lines[0]
        if "|" in sample_line and not sample_line.startswith("CEF:") and not sample_line.startswith("LEEF:"):
            delimiter = "|"
        elif "\t" in sample_line:
            delimiter = "\t"
        elif ";" in sample_line:
            delimiter = ";"
        else:
            delimiter = None

        if delimiter:
            headers = [h.strip() for h in lines[0].split(delimiter)]
            if len(headers) > 1 and len(lines) > 1:
                del_records = []
                for line in lines[1:]:
                    parts = [p.strip() for p in line.split(delimiter)]
                    del_records.append({headers[i]: parts[i] if i < len(parts) else "" for i in range(len(headers))})
                if del_records:
                    return del_records

        # 3. Fallback: Parse line as single log message
        records = []
        for idx, line in enumerate(lines, 1):
            records.append({
                "record_id": f"LOG-{idx:05d}",
                "message": line,
                "raw_log": line
            })
        return records
