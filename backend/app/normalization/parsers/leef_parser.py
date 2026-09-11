import re
from typing import Any
from app.normalization.parsers.base import BaseParser


class LEEFParser(BaseParser):
    format_name = "LEEF"

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
            leef_idx = line.find("LEEF:")
            if leef_idx == -1:
                continue
            leef_str = line[leef_idx:]

            parts = leef_str.split("|")
            if len(parts) < 5:
                continue

            version = parts[0].replace("LEEF:", "").strip()
            vendor = parts[1].strip()
            product = parts[2].strip()
            ver = parts[3].strip()
            event_part = parts[4]
            delimiter = "\t"
            ext_str = ""

            if len(parts) >= 7 and len(parts[5]) == 1 and not ("=" in parts[5]):
                event_id = event_part.strip()
                delimiter = parts[5]
                ext_str = "|".join(parts[6:])
            elif len(parts) >= 6:
                event_id = event_part.strip()
                ext_str = "|".join(parts[5:])
            else:
                if "\t" in event_part:
                    event_id, ext_str = event_part.split("\t", 1)
                elif " " in event_part:
                    event_id, ext_str = event_part.split(" ", 1)
                else:
                    event_id = event_part.strip()
                    ext_str = ""

            record: dict[str, Any] = {
                "record_id": f"LEEF-{idx:05d}",
                "leef_version": version,
                "vendor": vendor,
                "product": product,
                "product_version": ver,
                "event_id": event_id.strip(),
            }

            # Parse attributes by delimiter or regex
            if delimiter in ext_str:
                for pair in ext_str.split(delimiter):
                    if "=" in pair:
                        k, v = pair.split("=", 1)
                        record[k.strip()] = v.strip()
            else:
                kv_matches = re.findall(r'([a-zA-Z0-9_\-\.]+)=(.*?)(?=\s+[a-zA-Z0-9_\-\.]+=|$)', ext_str)
                for k, v in kv_matches:
                    record[k.strip()] = v.strip()

            records.append(record)

        if not records:
            raise ValueError("No valid LEEF (Log Event Extended Format) records found in file")

        return records
