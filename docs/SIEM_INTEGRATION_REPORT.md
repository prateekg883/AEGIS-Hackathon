# A.E.G.I.S. (SAT-SA) — Real SIEM Integration & Critical Alert Gateway Report

**Project:** A.E.G.I.S. — Analytics & Evidence-based Governance Intelligence System  
**SIH Problem Statement:** SIH26157  
**Target Organisation:** NTRO / NCIIPC / CERT-In  
**System Classification:** Offline-First Supervisory Analytics Tool for SOC Assessment  

---

## Executive Summary

A.E.G.I.S. has been enhanced with **Real SIEM connectivity** while preserving its core **Offline-First architecture**.
- **Normal (0–30)** and **Medium (31–70)** threats remain 100% on-premises.
- **High (71–97)** threats require mandatory **Human Supervisory Review**.
- Only **Critical (98–100)** threats are admitted into the **Critical Alert Gateway** for outbound transmission to authorised external endpoints (or held in protected local queue).
- **Data Minimisation:** No full CSV, database dump, or unrelated SOC logs are ever transmitted. Only minimum necessary alert metadata signed with HMAC-SHA256 is queued/transmitted.

---

## 1. System Architecture

```
                  REAL SIEM (Elasticsearch / Splunk / Sentinel)
                                      │
                                      ▼ (REST Ingestion with Non-blocking Timeout)
                      ┌───────────────────────────────┐
                      │   A.E.G.I.S. LOCAL INGESTION  │
                      │   (Validation & Normalisation)│
                      └───────────────┬───────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │   LOCAL DATABASE (SQLite/PG)  │
                      │   (IngestionBatch & Alerts)   │
                      └───────────────┬───────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │   EXISTING ANALYTICS ENGINE   │
                      │  (Gap, NegSpace, Peer, Anom)  │
                      └───────────────┬───────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │    ATTENTION SCORE ENGINE     │
                      └───────────────┬───────────────┘
                                      │
           ┌──────────────────────────┼──────────────────────────┐
           ▼                          ▼                          ▼
         0–30                       31–70                      71–97
        NORMAL                     MEDIUM                       HIGH
   "LOCAL — NORMAL"           "LOCAL — MEDIUM"         "HUMAN SUPERVISORY
           │                          │                  REVIEW REQUIRED"
           ▼                          ▼                          │
      [Local Only]               [Local Only]                    ▼
                                                           [Supervisor Review /
                                                            Manual Action Only]
                                                                 
                                                                 98–100
                                                                    │
                                                                    ▼
                                                         CRITICAL ALERT GATEWAY
                                                         (Data Minimisation & HMAC)
                                                                    │
                                                       ┌────────────┴────────────┐
                                                       ▼                         ▼
                                                Authorised External       Authorised Local
                                                    Endpoint                   Enclave
                                                        │                         │
                                                        └────────────┬────────────┘
                                                                     ▼
                                                            [Secure Delivery or
                                                            Protected Local Queue]
```

---

## 2. Attention Score Policy Classification

Implemented exact thresholds (configurable server-side in `app/core/config.py`):

| Score Range | Tier | Status String | Action | External Transmission |
| :--- | :--- | :--- | :--- | :--- |
| **0 – 30** | `NORMAL` | `"LOCAL — NORMAL"` | Process locally, store locally, show on dashboard | **Prohibited** |
| **31 – 70** | `MEDIUM` | `"LOCAL — MEDIUM"` | Process locally, store locally, track trends | **Prohibited** |
| **71 – 97** | `HIGH` | `"HUMAN SUPERVISORY REVIEW REQUIRED"` | Show prominently on dashboard, create supervisory review task | **Prohibited** (Manual human action only) |
| **98 – 100** | `CRITICAL` | `"CRITICAL — ESCALATION REQUIRED"` | Pass to Critical Alert Gateway, prepare minimised HMAC package | **Permitted** (Authorised destinations only) |

---

## 3. Real SIEM Connectors (Elasticsearch / Extensible)

### A. Modular Connector Framework (`app/siem/`)
1. **`app/siem/base.py`**: Abstract `BaseSIEMConnector` interface enforcing:
   - `test_connection()`: Probes SIEM health with timeout. Never crashes A.E.G.I.S.
   - `fetch_events()`: Pulls security events/alerts via REST.
   - `normalize_event()`: Maps vendor raw documents into A.E.G.I.S. standard alert schema.
   - `validate_event()`: Validates required security attributes.
2. **`app/siem/elastic.py`**: Production **Elastic Security / Elasticsearch** connector.
   - Queries `POST /{index}/_search` matching Elastic Common Schema (ECS).
   - Maps `@timestamp`, `rule.name`, `rule.category`, `event.severity`, `source.ip`, `destination.ip`, `host.name`, `process.name`.
   - Supports API Key (`Authorization: ApiKey ...`) and Basic Auth.
   - 5.0s connection timeout ensures network unavailability returns graceful `OFFLINE` status.
3. **`app/siem/mock_vendor.py`**: Extensible connector modules for:
   - **Splunk Enterprise / Cloud**
   - **Microsoft Sentinel** (Azure Log Analytics)
   - **IBM QRadar** (Offenses API)
4. **`app/siem/service.py`**: `SIEMIngestionService` orchestrates:
   - Automated ECS parsing and validation.
   - Deduplication (skips already-ingested alerts).
   - Ingestion into local relational tables (`IngestionBatch` and `Alert`).
   - Audit trail logging (`SIEM_SYNC_COMPLETED`, `SIEM_SYNC_OFFLINE`).

---

## 4. Critical Alert Gateway

Located at `app/gateway/service.py`:
- **Gatekeeper:** Strictly rejects any finding with `attention_score < 98.0`.
- **Data Minimisation:** Transmits ONLY:
  `alert_id`, `finding_id`, `timestamp`, `attention_score`, `severity`, `attack_type`, `finding_type`, `summary`, `description`, `confidence`, `relevant_indicators`, `evidence_reference`, `source_system`, `event_reference`.
  Raw CSV rows and full database dumps are **NEVER** transmitted.
- **Cryptographic Integrity & Authentication:**
  - SHA-256 payload hash (`X-AEGIS-Payload-Hash`).
  - HMAC-SHA256 signature (`X-AEGIS-Signature: sha256=...`).
  - Idempotency key (`IDEMP-{finding_code}-{payload_hash[:16]}`) prevents duplicate or replayed transmissions.
- **Protected Local Queue:** When `ESCALATION_ENABLED=false` (default) or `DESTINATION_URL` is unconfigured, alerts are queued with status `AWAITING_AUTH_ENDPOINT` in table `critical_escalation_queue`.
- **SSRF Defense:** Validates destination URL and blocks private cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`).

---

## 5. Files Created & Modified

### Backend:
- `backend/app/core/config.py` — Config thresholds (`SCORE_THRESHOLD_*`), Gateway configs (`ESCALATION_ENABLED`, `DESTINATION_*`), SIEM configs (`SIEM_*`).
- `backend/app/models/models.py` — Added `CriticalEscalationQueue` table, expanded `attention_scores.attention_level` column.
- `backend/app/analytics/attention/service.py` — Added `classify_attention_score()`, policy constants, updated `attention_level()`.
- `backend/app/analytics/attention/schemas.py` — Added policy status fields to `AttentionScoreResponse`.
- `backend/app/analytics/attention/routes.py` — Populated policy fields in score responses.
- `backend/app/siem/base.py` — Abstract `BaseSIEMConnector`.
- `backend/app/siem/elastic.py` — `ElasticSecurityConnector`.
- `backend/app/siem/mock_vendor.py` — Extensible Splunk, Sentinel, QRadar connectors.
- `backend/app/siem/service.py` — `SIEMIngestionService`.
- `backend/app/api/routes/siem.py` — SIEM REST routes (`/api/siem/status`, `/api/siem/test`, `/api/siem/sync`).
- `backend/app/gateway/service.py` — `CriticalAlertGateway`.
- `backend/app/api/routes/gateway.py` — Gateway routes (`/api/gateway/stats`, `/api/gateway/queue`, `/api/gateway/process/{finding_code}`, `/api/gateway/retry/{queue_id}`).
- `backend/app/main.py` — Registered `/api/siem` and `/api/gateway`.

### Frontend:
- `client/src/services/api.js` — Added Gateway and SIEM API helper methods.
- `client/src/components/SIEMConnectorView.jsx` — Dedicated UI for real SIEM connector configuration, testing, and ingestion.
- `client/src/components/EscalationPanel.jsx` — Supervisory Escalation Panel with metrics, queue table, human review items, and data minimisation inspector.
- `client/src/components/DataIngestion.jsx` — Added mode selector tab between CSV Upload and Real SIEM Ingestion.
- `client/src/components/layout/Sidebar.jsx` — Added **Supervisory Escalation** link.
- `client/src/components/layout/Header.jsx` — Added `/escalation` header label.
- `client/src/App.jsx` — Integrated `AttentionStatusBadge` with exact status labels, mounted `/escalation` route.

---

## 6. Verification & Test Commands

### 1. Run Complete Automated Test Suite (62 tests):
```powershell
cd c:\Users\prate\OneDrive\Desktop\AEGIS\backend
python -m unittest discover tests
```
*Result: 62 passed in ~4.5s (100% pass rate).*

### 2. Verify Attention Score Policy Thresholds:
```powershell
python -m unittest tests/test_attention_policy.py
```
*Validates scores: 0, 30, 31, 70, 71, 97, 98, 99, 100.*

### 3. Verify SIEM & Gateway Functionality:
```powershell
python -m unittest tests/test_gateway_and_siem.py
python -m unittest tests/test_aegis_e2e_integration.py
```
*Validates Gatekeeper rejection, Data Minimisation, Idempotency, and SIEM Offline Resilience.*

### 4. Verify Frontend Production Build:
```powershell
cd c:\Users\prate\OneDrive\Desktop\AEGIS\client
npm run build
```
*Result: Built in 10s with 0 errors.*

---

## 7. How to Test in the Browser

1. Start backend: `python -m uvicorn app.main:app --port 8000`
2. Start frontend: `npm run dev`
3. Go to **Data Ingestion** (`/ingestion`):
   - Switch to **Real SIEM Ingestion** tab.
   - Test connection with any Elastic/Splunk/Sentinel endpoint.
   - Run local ingestion to pull alerts directly into local database.
4. Go to **Supervisory Escalation** (`/escalation`):
   - View Gateway status, queue metrics, and pending human reviews.
   - Inspect minimised JSON payload proving zero CSV/database leakage.
