# A.E.G.I.S Offline Deployment Guide

**Purpose**: Deploy A.E.G.I.S (Analytics & Evidence-based Governance Intelligence System · Supervisory Analytics for SOC Assessment · SAT-SA) in air-gapped (no internet access at runtime) environments

**Status**: Complete for Phase 13 analytics (Phases 1-13 implemented)  
**Not Implemented**: Phase 15 (no new features added)

## Quick Start

### 1. On Internet-Connected Machine (Dependency Preparation)

```powershell
# Clone or copy project
cd A.E.G.I.S

# Prepare wheels for offline installation
.\scripts\prepare_offline_dependencies.ps1
```

This creates a `wheels/` directory with all Python packages.

### 2. Transfer to Air-Gapped Machine

- Copy entire `A.E.G.I.S/` directory
- Copy `wheels/` directory
- Ensure PostgreSQL is installed or will be installed

### 3. On Air-Gapped Machine (Deployment)

```powershell
# Install Python dependencies from wheels
.\scripts\install_offline_dependencies.ps1

# Set up PostgreSQL (if not already running)
.\scripts\setup_postgresql_offline.ps1

# Create environment configuration
Copy-Item .\backend\.env.offline .\backend\.env
```

### 4. Start Services

```powershell
# Terminal 1: Start backend
.\scripts\start_backend.ps1

# Terminal 2: Start frontend  
.\scripts\start_frontend.ps1

# Terminal 3: Check health
.\scripts\check_health.ps1
```

### 5. Access Application

- **Frontend**: http://127.0.0.1:3000
- **Backend API**: http://127.0.0.1:8000/api
- **API Docs**: http://127.0.0.1:8000/docs

---

## System Requirements

### Minimum Hardware
- **CPU**: 2 cores
- **RAM**: 4 GB minimum (8 GB recommended)
- **Disk**: 10 GB free (5 GB for installation, 5 GB for database/logs)
- **Network**: None required at runtime (fully offline operation)

### Required Software

#### 1. SQLite (default) or PostgreSQL 14+ (optional, Windows)
- **Download**: https://www.postgresql.org/download/windows/
- **During Installation**:
  - Choose default port 5432
  - Set password for `postgres` user
  - Enable as Windows service
- **Verification**:
  ```powershell
  psql --version
  psql -U postgres -h localhost -c "SELECT 1;"
  ```

#### 2. Python 3.12+ (Windows)
- **Download**: https://www.python.org/downloads/
- **During Installation**:
  - ✓ Check "Add Python to PATH"
  - ✓ Check "Install pip"
- **Verification**:
  ```powershell
  python --version
  pip --version
  ```

#### 3. Node.js 18+ (Windows)
- **Download**: https://nodejs.org/ (LTS version)
- **Package Manager**: npm (included) or pnpm (optional, faster)
- **Verification**:
  ```powershell
  node --version
  npm --version
  ```

### No Cloud Services Required
- ✓ No AWS, Azure, GCP, or other cloud accounts
- ✓ No API keys or external authentication
- ✓ No internet access required at runtime
- ✓ PostgreSQL must be local (running on same machine)

---

## Detailed Installation Steps

### Step 1: Prepare Offline Dependencies (Internet-Connected Machine)

This step downloads Python wheels for the air-gapped environment.

```powershell
# Navigate to project root
cd A.E.G.I.S

# Run preparation script (requires internet)
.\scripts\prepare_offline_dependencies.ps1

# Output:
# - wheels/                 (all .whl files)
# - wheels/XXX-1.0.0-py3-none-any.whl
# - etc.

# Verify wheels were created
Get-ChildItem .\wheels -Filter "*.whl" | Measure-Object
# Output: Count should be ~10-15 files
```

**Troubleshooting**:
- If `pip wheel` fails: ensure Python and pip are installed and on PATH
- If directory is empty: check pip error messages for network issues

### Step 2: Transfer Project to Air-Gapped Machine

Use removable media (USB drive, external SSD) to transfer:
- Entire `A.E.G.I.S/` directory (including `wheels/`)
- No network transfer needed

```powershell
# On air-gapped machine: verify transfer
Get-ChildItem C:\deployment\A.E.G.I.S\wheels -Filter "*.whl" | Measure-Object
# Output: Count should match internet-connected machine
```

### Step 3: Install PostgreSQL (Air-Gapped Machine)

PostgreSQL installer should be available on offline media, or use helper script.

**Option A: Manual Installation**
1. Run PostgreSQL Windows installer
2. Choose default settings
3. Note the postgres password
4. Verify: `psql -U postgres -h localhost -c "SELECT 1;"`

**Option B: Automated Setup**
```powershell
# Navigate to project root
cd A.E.G.I.S

# Run helper script
.\scripts\setup_postgresql_offline.ps1

# This will:
# - Verify PostgreSQL is installed
# - Create aegis_sat database
# - Create authentication credentials
# - Output connection string
```

**Verify PostgreSQL is Running**:
```powershell
# Check if PostgreSQL service is running
Get-Service -Name "postgresql*" | Select-Object -First 1

# Connect to test database
psql -U postgres -h localhost -c "SELECT 1;"

# Expected output: (1 row)
```

### Step 4: Install Python Dependencies

```powershell
cd A.E.G.I.S

# Install all dependencies from wheels (no internet needed)
.\scripts\install_offline_dependencies.ps1

# Verification
pip list | Select-Object -First 20

# Expected packages:
# fastapi            0.115.6
# uvicorn            0.34.0
# sqlalchemy         2.0.36
# pydantic           2.10.4
# psycopg            3.2.3
# alembic            1.14.0
```

### Step 5: Configure Environment

```powershell
# Copy offline template
Copy-Item .\backend\.env.offline .\backend\.env

# Review configuration
cat .\backend\.env

# Update if needed:
# - DATABASE_URL: Change password if PostgreSQL password is different
# - CORS_ORIGINS: Add additional localhost ports if needed
# - OFFLINE_MODE: Should be true
```

### Step 6: Install Node.js Dependencies

```powershell
# Navigate to project root
cd A.E.G.I.S

# Install with npm
npm install

# Or with pnpm (faster, if installed)
pnpm install

# Verification
npm list react
# Expected: react@19.2.1
```

---

## Running the Application

### Launch Backend Service

```powershell
# Terminal/PowerShell Window 1
cd A.E.G.I.S
.\scripts\start_backend.ps1

# Expected output:
# Uvicorn running on http://127.0.0.1:8000
# Press Ctrl+C to stop
```

**Health Check**:
```powershell
# In another terminal
Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/health" -UseBasicParsing

# Expected response:
# {"status": "ok", "service": "A.E.G.I.S", "mode": "offline"}
```

### Launch Frontend Service

```powershell
# Terminal/PowerShell Window 2
cd A.E.G.I.S
.\scripts\start_frontend.ps1

# Expected output:
# VITE v7.3.6 ready in XXX ms
# Local: http://127.0.0.1:3000/
```

### Access Application

- **Frontend**: Open browser to http://127.0.0.1:3000
- **Backend API**: http://127.0.0.1:8000/api
- **OpenAPI Docs**: http://127.0.0.1:8000/docs
- **ReDoc**: http://127.0.0.1:8000/redoc

### Verify System Health

```powershell
# Terminal/PowerShell Window 3
cd A.E.G.I.S
.\scripts\check_health.ps1

# Expected output:
# ✓ Backend is healthy
# ✓ Frontend is accessible
# ✓ API documentation is available
# ✓ All systems operational
```

---

## Operational Workflow

### Daily Startup (Offline Environment)

1. **Ensure PostgreSQL is running**:
   ```powershell
   Get-Service -Name "postgresql*" | Start-Service -ErrorAction SilentlyContinue
   Start-Sleep -Seconds 2
   ```

2. **Start backend** (Terminal 1):
   ```powershell
   cd C:\path\to\A.E.G.I.S
   .\scripts\start_backend.ps1
   ```

3. **Start frontend** (Terminal 2):
   ```powershell
   cd C:\path\to\A.E.G.I.S
   .\scripts\start_frontend.ps1
   ```

4. **Verify health** (Terminal 3):
   ```powershell
   .\scripts\check_health.ps1
   ```

### Daily Shutdown

1. Stop frontend: **Ctrl+C** in frontend terminal
2. Stop backend: **Ctrl+C** in backend terminal
3. PostgreSQL: Leave running (or use Windows Services to stop if needed)

### Data Management

#### Import Alert/Case/Investigation Data

```powershell
# From frontend at http://127.0.0.1:3000
# 1. Navigate to CSEs page
# 2. Click "New CSE" and create assessment entity
# 3. Click "Upload Data" and select CSV file
# 4. Choose record types (Alerts, Cases, Investigations, etc.)
# 5. System imports and processes deterministically
```

#### Generate Reports

```powershell
# From Reports page at http://127.0.0.1:3000/reports
# 1. Select CSE code
# 2. Click "Generate Report"
# 3. System analyzes all phases (Phases 1-13)
# 4. Report displays findings with evidence
```

#### Export Database Backup

```powershell
# Backup PostgreSQL database
pg_dump -U postgres -h localhost aegis_sat > "aegis_sat_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

# Store backup on external media for air-gapped environments
```

#### Restore from Backup

```powershell
# Restore PostgreSQL database from backup
psql -U postgres -h localhost aegis_sat < "aegis_sat_backup_20250101_120000.sql"
```

---

## Architecture Decisions for Offline Operation

### 1. **Local-Only Networking**
- All services bind to 127.0.0.1
- No public DNS resolution
- No external API calls
- CORS restricted to localhost only

### 2. **PostgreSQL Dependency**
- Replaced SQLite with PostgreSQL for production data
- SQLite in-memory used only for testing
- PostgreSQL must be running locally
- No cloud database (would require internet)

### 3. **No Cloud Services**
- ✗ No AWS, Azure, GCP
- ✗ No external authentication (no OAuth, SAML)
- ✗ No SaaS integrations
- ✓ All processing on local machine

### 4. **Deterministic Analytics Pipeline**
- All findings generated from imported data
- No real-time external data feeds
- Reproducible outputs (same input → same output)
- Historical analysis (not live monitoring)

### 5. **Offline Frontend Fallback**
- Frontend can operate with mock data if backend unavailable
- Graceful degradation in air-gapped environments
- User can assess system even without backend

---

## Troubleshooting

### PostgreSQL Connection Failed

**Symptom**: Backend starts but reports database connection error

**Solutions**:
```powershell
# 1. Verify PostgreSQL is running
Get-Service -Name "postgresql*"

# 2. Test connection directly
psql -U postgres -h localhost -c "SELECT 1;"

# 3. Check DATABASE_URL in .env
cat .\backend\.env | Select-String DATABASE_URL

# 4. If password is wrong, update:
# - .env file
# - PostgreSQL user password: ALTER USER postgres WITH PASSWORD 'newpassword';
```

### Backend Won't Start

**Symptom**: uvicorn crashes or throws errors

**Solutions**:
```powershell
# 1. Verify Python installation
python --version
pip list | Select-String fastapi

# 2. Reinstall dependencies
.\scripts\install_offline_dependencies.ps1

# 3. Check .env file syntax
cat .\backend\.env

# 4. Run backend with explicit error logging
cd .\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend Won't Load

**Symptom**: Browser shows blank page or error

**Solutions**:
```powershell
# 1. Verify Node.js is installed
node --version
npm --version

# 2. Check Node modules
npm list react

# 3. Clear build cache and rebuild
rm -r node_modules dist
npm install
npm run build

# 4. Start frontend with logging
npm run dev
```

### Health Check Fails

**Symptom**: check_health.ps1 shows red X marks

**Solutions**:
```powershell
# 1. Run individual checks
Invoke-WebRequest http://127.0.0.1:8000/api/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:3000 -UseBasicParsing

# 2. Check firewall allows localhost
netstat -ano | Select-String "127.0.0.1:8000"

# 3. Verify services are actually running
Get-Process python
Get-Process node
```

### Offline Dependency Installation Fails

**Symptom**: install_offline_dependencies.ps1 reports missing packages

**Solutions**:
```powershell
# 1. Verify wheels directory is not empty
Get-ChildItem .\wheels -Filter "*.whl"

# 2. Re-prepare dependencies on internet machine
# (Copy wheels/ again to air-gapped machine)

# 3. Check disk space
Get-Volume

# 4. Try manual installation with verbose output
pip install --no-index --find-links=.\wheels --verbose fastapi
```

---

## Validation Checklist

Before moving to production, verify:

- [ ] PostgreSQL is installed and running
- [ ] Python 3.12+ is installed with pip
- [ ] Node.js 18+ is installed with npm
- [ ] `wheels/` directory contains .whl files
- [ ] Dependencies installed: `pip list | grep fastapi`
- [ ] `.env` file created and configured
- [ ] Backend starts: `.\scripts\start_backend.ps1`
- [ ] Frontend starts: `.\scripts\start_frontend.ps1`
- [ ] Health check passes: `.\scripts\check_health.ps1`
- [ ] Backend responds: `curl http://127.0.0.1:8000/api/health`
- [ ] Frontend loads: Browser at http://127.0.0.1:3000
- [ ] Ingestion works: Upload test CSV via frontend
- [ ] Analytics runs: Generate report from frontend
- [ ] Database backup: `pg_dump` succeeds
- [ ] All tests pass: `python -m unittest discover -s backend/tests -v`

---

## Advanced Configuration

### Increasing File Upload Limit

```powershell
# In .env:
MAX_UPLOAD_BYTES=10485760  # 10 MB instead of 5 MB
```

### Binding to Specific Network Interface

```powershell
# In .env (not recommended for offline):
SERVER_HOST=192.168.1.100  # Expose to local network only
```

### Customizing Analytics Rules

Edit these files to modify analytics behavior:
- `backend/app/analytics/execution_gaps/rules.py` - Execution gap thresholds
- `backend/app/analytics/negative_space/rules.py` - Negative space detection
- `backend/app/analytics/anomalies/rules.py` - Anomaly detection thresholds
- `backend/app/analytics/peer_benchmark/rules.py` - Peer deviation metrics

After modification:
```powershell
.\scripts\start_backend.ps1  # Rules loaded on startup
```

### Database Optimization for Large Datasets

```sql
-- Create indices for faster queries
CREATE INDEX idx_alert_cse ON alert(cse_id);
CREATE INDEX idx_case_cse ON case(cse_id);
CREATE INDEX idx_investigation_case ON investigation(case_id);
```

---

## Air-Gapped Operations Guide

### Security Principles

1. **No Internet Access Required**
   - Application verifies offline mode at startup
   - All external service checks disabled
   - No automatic updates or telemetry

2. **Local Data Control**
   - All data stored in local PostgreSQL
   - No cloud sync or backup services
   - Manual backup via `pg_dump`

3. **Deterministic Processing**
   - Same input always produces same output
   - No randomization in analytics
   - Reproducible findings for audit trail

### Data Transfer (Offline Media)

**Importing New Data**:
1. Prepare CSV on connected machine
2. Transfer via USB/external drive
3. Upload through frontend
4. System processes deterministically

**Exporting Reports**:
1. Generate report in frontend
2. Export as PDF or JSON
3. Transfer via USB/external drive
4. Archive on external storage

**Database Backup & Recovery**:
```powershell
# On air-gapped machine:
# Backup every day
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
pg_dump -U postgres -h localhost aegis_sat > "backup_$timestamp.sql"

# Store on external media
Copy-Item "backup_$timestamp.sql" "E:\Backups\"
```

---

## Support & Documentation

### Files Included

- `docs/OFFLINE_DEPLOYMENT.md` - This file
- `scripts/README.md` - Quick script reference
- `backend/.env.example` - Full environment template
- `backend/.env.offline` - Offline-specific template
- `backend/.env.development` - Development template
- `backend/requirements.txt` - Python dependency list
- `package.json` - Frontend dependency list
- `README.md` - Project overview

### Internal Components

**Backend** (Phase 1-13 Analytics):
- Health monitoring
- Data ingestion (Phase 2)
- Execution gap detection (Phase 3)
- Negative space analysis (Phase 4)
- Anomaly detection (Phase 5)
- Peer benchmarking (Phase 6)
- Attention scoring (Phase 7)
- Explainability (Phase 10)
- Prioritization (Phase 11)
- Report generation (Phase 13)

**Frontend**:
- CSE Dashboard
- Findings Explorer
- Evidence Viewer
- Negative Space Analysis
- Peer Benchmarking
- Prioritised Samples
- Report Generation

### Test Suite

Verify installation:
```powershell
cd A.E.G.I.S
python -m unittest discover -s backend/tests -v

# Expected: 38 tests passing (all phases)
# OK (38 tests)
```

---

## Next Steps

1. **Prepare offline media** (internet machine):
   - Run `prepare_offline_dependencies.ps1`
   - Transfer to air-gapped machine via USB

2. **Deploy on air-gapped machine**:
   - Follow "Installation Steps" section above
   - Verify with health check
   - Confirm all tests pass

3. **Import production data**:
   - Prepare CSV on connected machine
   - Transfer via offline media
   - Use frontend to upload and process

4. **Establish operational procedures**:
   - Daily startup/shutdown
   - Regular database backups
   - Data export workflow
   - Incident response

5. **Monitor system health**:
   - Run `check_health.ps1` daily
   - Monitor PostgreSQL disk usage
   - Maintain backup archive

---

**Version**: 1.0.0  
**Last Updated**: Phase 14 Completion  
**Status**: Production Ready for Offline Deployment  
**Phase 15**: Not Implemented (as specified)
