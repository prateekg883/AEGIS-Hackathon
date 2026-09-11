import pandas as pd
import json
import xml.etree.ElementTree as ET

INPUT_FILE = "AEGIS_Synthetic_SOC_5000.csv"

df = pd.read_csv(INPUT_FILE)

print(f"Loaded {len(df)} records")


# 1. JSON
df.to_json(
    "AEGIS_Synthetic_SOC_5000.json",
    orient="records",
    indent=2
)


# 2. XML
root = ET.Element("CybersecurityEvents")

for _, row in df.iterrows():
    event = ET.SubElement(root, "Event")

    for column in df.columns:
        field = ET.SubElement(event, str(column))
        value = row[column]

        if pd.isna(value):
            value = ""

        field.text = str(value)

ET.ElementTree(root).write(
    "AEGIS_Synthetic_SOC_5000.xml",
    encoding="utf-8",
    xml_declaration=True
)


# 3. XLSX
df.to_excel(
    "AEGIS_Synthetic_SOC_5000.xlsx",
    index=False
)


# 4. LOG
with open(
    "AEGIS_Synthetic_SOC_5000.log",
    "w",
    encoding="utf-8"
) as f:

    for _, row in df.iterrows():

        line = " | ".join(
            f"{column}={row[column]}"
            for column in df.columns
        )

        f.write(line + "\n")


# 5. SYSLOG
with open(
    "AEGIS_Synthetic_SOC_5000.syslog",
    "w",
    encoding="utf-8"
) as f:

    for i, (_, row) in enumerate(
        df.iterrows(),
        start=1
    ):

        message = " ".join(
            f"{column}={row[column]}"
            for column in df.columns
        )

        f.write(
            f"<134>1 2026-09-09T12:00:00Z "
            f"AEGIS-SOC AEGIS-{i} - - "
            f"{message}\n"
        )


# 6. CEF
with open(
    "AEGIS_Synthetic_SOC_5000.cef",
    "w",
    encoding="utf-8"
) as f:

    for _, row in df.iterrows():

        src = row["src_ip"] if "src_ip" in df.columns else ""
        dst = row["destination"] if "destination" in df.columns else ""

        attack = (
            row["attack_type"]
            if "attack_type" in df.columns
            else "Security Event"
        )

        f.write(
            f"CEF:0|AEGIS|SOC|1.0|100|"
            f"{attack}|5|"
            f"src={src} dst={dst}\n"
        )


# 7. LEEF
with open(
    "AEGIS_Synthetic_SOC_5000.leef",
    "w",
    encoding="utf-8"
) as f:

    for _, row in df.iterrows():

        data = "\t".join(
            f"{column}={row[column]}"
            for column in df.columns
        )

        f.write(
            f"LEEF:2.0|AEGIS|SOC|1.0|100\t"
            f"{data}\n"
        )


# 8. PARQUET
df.to_parquet(
    "AEGIS_Synthetic_SOC_5000.parquet",
    index=False
)


print("\nSUCCESS!")
print("Created:")
print("1. JSON")
print("2. XML")
print("3. XLSX")
print("4. LOG")
print("5. SYSLOG")
print("6. CEF")
print("7. LEEF")
print("8. PARQUET")