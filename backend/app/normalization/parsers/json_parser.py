import json
from typing import Any
from app.normalization.parsers.base import BaseParser


class JSONParser(BaseParser):
    format_name = "JSON"

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

        text_content = text_content.strip()
        if not text_content:
            return []

        # Try standard JSON first
        try:
            payload = json.loads(text_content)
            if isinstance(payload, list):
                return [self._flatten_item(item) for item in payload if isinstance(item, dict)]
            if isinstance(payload, dict):
                for key in ("records", "data", "events", "logs", "items", "results", "alerts", "hits"):
                    if key in payload and isinstance(payload[key], list):
                        return [self._flatten_item(item) for item in payload[key] if isinstance(item, dict)]
                return [self._flatten_item(payload)]
        except Exception:
            pass

        # Try JSON Lines (.jsonl or newline-separated JSON)
        records = []
        for line in text_content.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                if isinstance(obj, dict):
                    records.append(self._flatten_item(obj))
            except Exception:
                continue

        if records:
            return records

        raise ValueError("Invalid JSON format: must be a JSON array, JSON Lines, or object containing a records array")

    def _flatten_item(self, d: dict, parent_key: str = "", sep: str = "_") -> dict[str, Any]:
        items: list[tuple[str, Any]] = []
        for k, v in d.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else str(k)
            if isinstance(v, dict):
                items.extend(self._flatten_item(v, new_key, sep=sep).items())
            elif isinstance(v, list):
                # If list of primitives, join as comma separated
                if all(isinstance(x, (str, int, float, bool)) for x in v):
                    items.append((new_key, ",".join(str(x) for x in v)))
                else:
                    items.append((new_key, json.dumps(v)))
            else:
                items.append((new_key, v))
        return dict(items)
