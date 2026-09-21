"""
A.E.G.I.S. Unstop Submission Packaging Script
Global Innovation Hackathon 2026 – Build for a Better Future (Bharat Academix)

This script packages the entire codebase into a clean, optimized .zip archive
ready for upload to Unstop, excluding node_modules, .git, .venv, and temporary cache files.
"""

import os
import zipfile
import sys
import shutil
from pathlib import Path

# Ensure UTF-8 output encoding for Windows terminal
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_ZIP_NAME = "AEGIS_Global_Innovation_Hackathon_2026_Submission.zip"
OUTPUT_ZIP_PATH = WORKSPACE_ROOT / OUTPUT_ZIP_NAME

EXCLUDE_DIRS = {
    "node_modules",
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".idea",
    ".vscode",
    ".parcel-cache",
    "dist",
}

EXCLUDE_EXTENSIONS = {
    ".pyc",
    ".pyo",
    ".pyd",
    ".pid",
    ".tmp",
    ".log",
}

EXCLUDE_FILES = {
    OUTPUT_ZIP_NAME,
    ".DS_Store",
    "Thumbs.db",
    ".aegis-backend.pid",
    ".aegis-frontend.pid",
}

def should_exclude(rel_path: Path) -> bool:
    for part in rel_path.parts:
        if part in EXCLUDE_DIRS:
            return True
        if part.startswith(".venv") or part.startswith("venv"):
            return True

    if rel_path.name in EXCLUDE_FILES:
        return True

    if rel_path.suffix.lower() in EXCLUDE_EXTENSIONS:
        return True

    return False

def package_submission():
    print("=" * 70)
    print("[AEGIS] Submission Packager for Unstop")
    print("[AEGIS] Global Innovation Hackathon 2026 - Build for a Better Future")
    print("=" * 70)
    print(f"[*] Workspace Root: {WORKSPACE_ROOT}")
    print(f"[*] Target ZIP:     {OUTPUT_ZIP_PATH}")
    print("-" * 70)

    # Clean existing zip if present
    if OUTPUT_ZIP_PATH.exists():
        try:
            OUTPUT_ZIP_PATH.unlink()
            print("[+] Removed existing submission ZIP.")
        except Exception as e:
            print(f"[!] Warning removing old zip: {e}")

    file_count = 0
    total_uncompressed_bytes = 0

    with zipfile.ZipFile(OUTPUT_ZIP_PATH, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
        for root, dirs, files in os.walk(WORKSPACE_ROOT):
            root_path = Path(root)
            rel_root = root_path.relative_to(WORKSPACE_ROOT)

            # Skip excluded directories in place
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".venv") and not d.startswith("venv")]

            for file in files:
                file_path = root_path / file
                rel_file = file_path.relative_to(WORKSPACE_ROOT)

                if should_exclude(rel_file):
                    continue

                try:
                    file_size = file_path.stat().st_size
                    # Put files in an enclosing folder for neat extraction
                    archive_name = f"AEGIS_Submission/{rel_file.as_posix()}"
                    zipf.write(file_path, arcname=archive_name)
                    file_count += 1
                    total_uncompressed_bytes += file_size
                except Exception as ex:
                    print(f"[!] Could not pack {rel_file}: {ex}")

    zip_size_mb = OUTPUT_ZIP_PATH.stat().st_size / (1024 * 1024)
    raw_size_mb = total_uncompressed_bytes / (1024 * 1024)

    print("-" * 70)
    print("[SUCCESS] Submission Package Created Successfully!")
    print(f"[*] Total Files Packaged: {file_count}")
    print(f"[*] Uncompressed Size:    {raw_size_mb:.2f} MB")
    print(f"[*] Compressed ZIP Size:   {zip_size_mb:.2f} MB")
    print(f"[*] Location:              {OUTPUT_ZIP_PATH}")
    print("=" * 70)
    print("[READY] Submission ZIP is ready to upload to Unstop!")
    print("=" * 70)

if __name__ == "__main__":
    package_submission()
