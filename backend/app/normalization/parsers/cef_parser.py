import re
from typing import Any
from app.normalization.parsers.base import BaseParser


class CEFParser(BaseParser):
    format_name = "CEF"

    # Match key=value where value can be string up to next key= or end of line
    EXT_PATTERN = re.compile(r'([a-zA-Z0-9_\-\.]+)=(.*?)(?=\s+[a-zA-Z0-9_\-\.]+=|$)')

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
            cef_idx = line.find("CEF:")
            if cef_idx == -1:
                continue
            cef_str = line[cef_idx:]

            # Unescape pipe if preceded by backslash
            # Split into max 8 parts: CEF:0 | Vendor | Product | Version | SignatureID | Name | Severity | Extension
            parts = []
            current = []
            escaped = False
            for char in cef_str:
                if char == "\\" and not escaped:
                    escaped = True
                    current.append(char)
                elif char == "|" and not escaped:
                    parts.append("".join(current))
                    current = []
                    if len(parts) == 7:
                        # Reached extension part
                        break
                else:
                    escaped = False
                    current.append(char)

            # Get remaining extension string
            ext_str = cef_str[sum(len(p) + 1 for p in parts):] if len(parts) >= 7 else ""

            if len(parts) < 7:
                continue

            record: dict[str, Any] = {
                "record_id": f"CEF-{idx:05d}",
                "cef_version": parts[0].replace("CEF:", "").strip(),
                "device_vendor": parts[1].strip(),
                "device_product": parts[2].strip(),
                "device_version": parts[3].strip(),
                "signature_id": parts[4].strip(),
                "name": parts[5].strip(),
                "severity": parts[6].strip(),
            }

            # Parse extension key-values
            if ext_str:
                matches = self.EXT_PATTERN.findall(ext_str)
                for k, v in matches:
                    record[k.strip()] = v.strip().replace(r"\|", "|").replace(r"\=", "=").replace(r"\\", "\\")

            records.append(record)

        if not records:
            raise ValueError("No valid CEF (Common Event Format) records found in file")

        return records
