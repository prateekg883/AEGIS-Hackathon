import csv
import io
from typing import Any
from app.normalization.field_mapper import STANDARD_AEGIS_FIELDS


class CSVExporter:
    """
    Exports normalized dataset into standard AEGIS CSV format.
    Ensures core threat detection headers appear first, while preserving
    any additional enterprise telemetry columns.
    """

    def export_csv_string(self, records: list[dict[str, Any]], preserve_extra_columns: bool = True) -> str:
        if not records:
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(STANDARD_AEGIS_FIELDS)
            return output.getvalue()

        # Gather all columns, placing standard AEGIS fields first
        extra_cols = set()
        if preserve_extra_columns:
            for r in records:
                for k in r.keys():
                    if k not in STANDARD_AEGIS_FIELDS:
                        extra_cols.add(k)

        all_headers = STANDARD_AEGIS_FIELDS + sorted(list(extra_cols))

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=all_headers, extrasaction="ignore")
        writer.writeheader()

        for r in records:
            writer.writerow(r)

        return output.getvalue()

    def export_csv_bytes(self, records: list[dict[str, Any]], preserve_extra_columns: bool = True) -> bytes:
        return self.export_csv_string(records, preserve_extra_columns).encode("utf-8")
