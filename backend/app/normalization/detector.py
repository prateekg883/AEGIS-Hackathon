import re
from typing import Tuple
from app.normalization.parsers.base import BaseParser
from app.normalization.parsers.cef_parser import CEFParser
from app.normalization.parsers.csv_parser import CSVParser
from app.normalization.parsers.excel_parser import ExcelParser
from app.normalization.parsers.json_parser import JSONParser
from app.normalization.parsers.leef_parser import LEEFParser
from app.normalization.parsers.parquet_parser import ParquetParser
from app.normalization.parsers.syslog_parser import SyslogParser
from app.normalization.parsers.text_parser import TextParser
from app.normalization.parsers.xml_parser import XMLParser

PARSER_REGISTRY: dict[str, type[BaseParser]] = {
    "CSV": CSVParser,
    "TSV": CSVParser,
    "JSON": JSONParser,
    "XML": XMLParser,
    "XLSX": ExcelParser,
    "TXT": TextParser,
    "LOG": TextParser,
    "SYSLOG": SyslogParser,
    "CEF": CEFParser,
    "LEEF": LEEFParser,
    "PARQUET": ParquetParser,
}


def detect_format(content: bytes, filename: str = "") -> Tuple[str, BaseParser]:
    """
    Detects the file format from filename extension and content inspection,
    and returns a tuple of (format_name, parser_instance).
    """
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    
    # Check Parquet magic bytes: 'PAR1' at start
    if content.startswith(b"PAR1") or ext == "parquet":
        return "PARQUET", ParquetParser()

    # Check Excel magic bytes: zip container 'PK\x03\x04' with xlsx extension
    if ext in ("xlsx", "xls", "xlsm") or (content.startswith(b"PK\x03\x04") and ext in ("xlsx", "xls", "")):
        # Check if actually an xlsx
        try:
            return "XLSX", ExcelParser()
        except Exception:
            pass

    # Decode prefix for text-based format detection
    sample_text = ""
    for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            sample_text = content[:4096].decode(enc)
            break
        except Exception:
            continue
    if not sample_text:
        sample_text = content[:4096].decode("utf-8", errors="ignore")

    stripped = sample_text.strip()

    # Check CEF
    if "CEF:" in sample_text or ext == "cef":
        return "CEF", CEFParser()

    # Check LEEF
    if "LEEF:" in sample_text or ext == "leef":
        return "LEEF", LEEFParser()

    # Check Syslog (RFC 3164 / RFC 5424 starts with <PRI> where PRI is 1-3 digits)
    if re.match(r'^<\d{1,3}>', stripped) or ext in ("syslog", "syslogng", "rfc5424", "rfc3164"):
        return "SYSLOG", SyslogParser()

    # Check XML (must start with <?xml or <tag> where tag begins with a letter/underscore)
    if stripped.startswith("<?xml") or (stripped.startswith("<") and re.match(r'^<[a-zA-Z_][a-zA-Z0-9_\-\:]*', stripped) and not stripped.startswith("<!DOCTYPE html")):
        return "XML", XMLParser()
    if ext in ("xml", "rss", "atom"):
        return "XML", XMLParser()

    # Check JSON / JSONL
    if stripped.startswith("{") or stripped.startswith("[") or ext in ("json", "jsonl", "ndjson"):
        return "JSON", JSONParser()

    # Check TSV
    if ext == "tsv":
        return "TSV", CSVParser()

    # Check CSV
    if ext == "csv":
        return "CSV", CSVParser()

    # Check Key-Value or Log text
    if ext in ("log", "txt", "out"):
        if "CEF:" in sample_text:
            return "CEF", CEFParser()
        if "LEEF:" in sample_text:
            return "LEEF", LEEFParser()
        return "LOG", TextParser()

    # Content heuristic: if comma or semicolon separated with multiple lines
    if "," in sample_text and "\n" in sample_text:
        return "CSV", CSVParser()
    if "\t" in sample_text and "\n" in sample_text:
        return "TSV", CSVParser()

    # Default fallback
    return "TXT", TextParser()
