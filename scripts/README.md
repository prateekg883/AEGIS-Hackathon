# Offline Deployment Infrastructure

This directory contains scripts and configuration for deploying A.E.G.I.S (Analytics & Evidence-based Governance Intelligence System · Supervisory Analytics for SOC Assessment) in a fully offline / air-gapped environment.

## Contents

- `prepare_offline_dependencies.ps1` - Prepares Python wheel files on an internet-connected machine
- `install_offline_dependencies.ps1` - Installs Python dependencies from local wheels on the air-gapped machine
- `start_backend.ps1` - Starts the FastAPI backend service
- `start_frontend.ps1` - Builds and starts the frontend development server
- `check_health.ps1` - Verifies the system is running correctly
- `setup_demo.ps1` - Applies SQLite migrations and loads deterministic demo data
- `setup_postgresql_offline.ps1` - PostgreSQL installation helper for offline environments

## Quick Start (Offline Environment)

1. **Prepare dependencies** (on internet-connected machine):
   ```powershell
   .\prepare_offline_dependencies.ps1
   ```
   This creates a `wheels/` directory with all Python dependencies.

2. **Transfer to air-gapped machine**:
   - Copy the entire `AEGIS/` directory
   - Copy `wheels/` directory

3. **On the air-gapped machine**, install dependencies:
   ```powershell
   .\scripts\install_offline_dependencies.ps1
   ```

4. **Initialize the portable SQLite MVP**:
   ```powershell
   .\scripts\setup_demo.ps1
   ```
   This creates `backend/data/aegis_sat.db`, applies Alembic migrations, and loads CSE-07 demo data. It is safe to run again.

5. **Start services**:
   ```powershell
   .\scripts\start_backend.ps1
   .\scripts\start_frontend.ps1
   ```

6. **Verify health**:
   ```powershell
   .\scripts\check_health.ps1
   ```

## Documentation

See `../docs/OFFLINE_DEPLOYMENT.md` for comprehensive deployment instructions.
