import io
from typing import Any
from app.normalization.parsers.base import BaseParser


class ExcelParser(BaseParser):
    format_name = "XLSX"

    def parse(self, content: bytes, filename: str = "") -> list[dict[str, Any]]:
        try:
            import openpyxl
        except ImportError:
            raise ValueError("openpyxl is required to parse Excel spreadsheets (.xlsx)")

        try:
            wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True, read_only=True)
        except Exception as exc:
            raise ValueError(f"Failed to open Excel workbook: {str(exc)}")

        sheet = wb.active
        if sheet is None:
            raise ValueError("Excel file contains no active sheets")

        rows_iter = sheet.iter_rows(values_only=True)
        try:
            headers = next(rows_iter)
        except StopIteration:
            return []

        if not headers:
            return []

        clean_headers = [str(h).strip() if h is not None else f"col_{idx}" for idx, h in enumerate(headers)]

        records = []
        for row in rows_iter:
            if not row or all(cell is None or str(cell).strip() == "" for cell in row):
                continue
            row_dict = {}
            for idx, cell in enumerate(row):
                if idx < len(clean_headers):
                    key = clean_headers[idx]
                    val = cell
                    if val is not None:
                        if hasattr(val, "isoformat"):
                            val = val.isoformat()
                        row_dict[key] = val
            if row_dict:
                records.append(row_dict)

        return records
