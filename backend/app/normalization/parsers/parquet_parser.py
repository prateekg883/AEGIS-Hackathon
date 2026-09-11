import io
from typing import Any
from app.normalization.parsers.base import BaseParser


class ParquetParser(BaseParser):
    format_name = "PARQUET"

    def parse(self, content: bytes, filename: str = "") -> list[dict[str, Any]]:
        try:
            import pyarrow.parquet as pq
        except ImportError:
            raise ValueError("pyarrow is required to read Apache Parquet files")

        try:
            table = pq.read_table(io.BytesIO(content))
            df_dict = table.to_pydict()
        except Exception as exc:
            raise ValueError(f"Failed to parse Parquet file: {str(exc)}")

        num_rows = table.num_rows
        records = []
        keys = list(df_dict.keys())

        for row_idx in range(num_rows):
            row = {}
            for k in keys:
                val = df_dict[k][row_idx]
                if val is not None:
                    if hasattr(val, "isoformat"):
                        val = val.isoformat()
                    row[k] = val
            if row:
                records.append(row)

        return records
