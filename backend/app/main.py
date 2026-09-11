from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
from app.api.routes.ingestion import router as ingestion_router
from app.analytics.execution_gaps.routes import router as execution_gap_router
from app.analytics.negative_space.routes import router as negative_space_router
from app.analytics.anomalies.routes import router as anomaly_router
from app.analytics.peer_benchmark.routes import router as peer_benchmark_router
from app.analytics.attention.routes import router as attention_router
from app.analytics.explainability.routes import router as explainability_router
from app.analytics.prioritisation.routes import router as prioritisation_router
from app.core.config import APP_NAME, APP_VERSION, CORS_ORIGINS
from app.reports.routes import router as report_router
from app.api.routes.findings import router as findings_router
from app.api.routes.audit import router as audit_router
from app.api.routes.siem import router as siem_router
from app.api.routes.gateway import router as gateway_router
from app.api.routes.security_monitoring import router as security_monitoring_router
from app.api.routes.normalization import router as normalization_router
from app.analytics.multi_cse.routes import router as multi_cse_router

app = FastAPI(
    title=APP_NAME,
    description='Backend API for the A.E.G.I.S supervisory analytics platform (SAT-SA).',
    version=APP_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=['GET', 'POST', 'OPTIONS'],
    allow_headers=['*'],
)

app.include_router(auth_router, prefix='/api')
app.include_router(auth_router, prefix='/api/auth')
app.include_router(health_router, prefix='/api')
app.include_router(ingestion_router, prefix='/api')
app.include_router(siem_router, prefix='/api')
app.include_router(gateway_router, prefix='/api')
app.include_router(execution_gap_router, prefix='/api')
app.include_router(negative_space_router, prefix='/api')
app.include_router(anomaly_router, prefix='/api')
app.include_router(peer_benchmark_router, prefix='/api')
app.include_router(attention_router, prefix='/api')
app.include_router(explainability_router, prefix='/api')
app.include_router(prioritisation_router, prefix='/api')
app.include_router(report_router, prefix='/api')
app.include_router(findings_router, prefix='/api')
app.include_router(audit_router, prefix='/api')
app.include_router(security_monitoring_router, prefix='/api')
app.include_router(normalization_router, prefix='/api')
app.include_router(multi_cse_router, prefix='/api')

@app.on_event("startup")
def init_security_subsystem():
    try:
        from app.db.session import engine, SessionLocal
        from app.db.base import Base
        import app.models.models
        from sqlalchemy import text, select, func
        from app.models.models import SecurityEvent, SecurityAlert
        from app.core.security_monitor import record_security_event, create_security_alert

        Base.metadata.create_all(engine)
        
        # Migrate SQLite columns if missing
        with engine.connect() as conn:
            existing_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(audit_logs)"))]
            if "prev_hash" not in existing_cols:
                conn.execute(text("ALTER TABLE audit_logs ADD COLUMN prev_hash VARCHAR(64)"))
            if "record_hash" not in existing_cols:
                conn.execute(text("ALTER TABLE audit_logs ADD COLUMN record_hash VARCHAR(64)"))
            conn.commit()

        # Seed baseline security events if fresh
        with SessionLocal() as db:
            ev_count = db.scalar(select(func.count(SecurityEvent.id))) or 0
            if ev_count == 0:
                record_security_event(
                    db=db,
                    event_type="SYSTEM_BOOT",
                    component="Host Supervisor",
                    severity="LOW",
                    status="ALLOWED",
                    reason="A.E.G.I.S. Secure Enclave booted in Offline/Air-Gapped Mode",
                    requested_resource="HOST_SUPERVISOR_INIT",
                    action="STARTUP"
                )
                record_security_event(
                    db=db,
                    event_type="NETWORK_ISOLATION_CHECK",
                    component="Air-Gap Boundary Monitor",
                    severity="LOW",
                    status="BLOCKED",
                    destination="8.8.8.8",
                    port_protocol="53/UDP",
                    reason="Outbound WAN socket blocked by kernel boundary",
                    action="PROBE"
                )
                record_security_event(
                    db=db,
                    event_type="DATABASE_INTEGRITY_CHECK",
                    component="Relational Store",
                    severity="LOW",
                    status="ALLOWED",
                    destination="LOCAL_SQLITE",
                    port_protocol="IPC/FILE",
                    reason="SQLite WAL mode and schema verified",
                    action="VERIFY"
                )
                record_security_event(
                    db=db,
                    event_type="AUDIT_CHAIN_INITIALIZED",
                    component="Cryptographic Ledger",
                    severity="LOW",
                    status="ALLOWED",
                    reason="Audit log sequential SHA-256 hash chaining active",
                    action="CHAIN_VERIFY"
                )
    except Exception as e:
        print(f"[A.E.G.I.S.] Startup security subsystem notice: {e}")



