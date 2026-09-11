import csv
import io
from typing import Any
from app.normalization.parsers.base import BaseParser


class CSVParser(BaseParser):
    format_name = "CSV"

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

        # Determine delimiter: if .tsv or tabs present, use tab, else sniff or default to comma
        delimiter = ","
        if filename.lower().endswith(".tsv"):
            delimiter = "\t"
        else:
            sample = text_content[:4096]
            try:
                sniffer = csv.Sniffer()
                dialect = sniffer.sniff(sample, delimiters=",\t;|")
                delimiter = dialect.delimiter
            except Exception:
                if "\t" in sample and "," not in sample:
                    delimiter = "\t"
                elif ";" in sample and "," not in sample:
                    delimiter = ";"
                elif "|" in sample and "," not in sample:
                    delimiter = "|"

        reader = csv.DictReader(io.StringIO(text_content), delimiter=delimiter)
        records = []
        for row in reader:
            if any(v is not None and str(v).strip() != "" for v in row.values()):
                clean_row = {str(k).strip(): v.strip() if isinstance(v, str) else v for k, v in row.items() if k}
                records.append(clean_row)
        return records
