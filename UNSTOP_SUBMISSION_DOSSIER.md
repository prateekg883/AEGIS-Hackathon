# 🛡️ UNSTOP SUBMISSION DOSSIER
## Global Innovation Hackathon 2026 – Build for a Better Future
**Organized by:** Bharat Academix  
**Platform:** Unstop  
**Project Name:** A.E.G.I.S. (Analytics & Evidence-based Governance Intelligence System)  
**Team Name:** CODER RISE  
**Institution:** Galgotias University  
**Team Leader:** Prateek Gupta  

---

## 📌 1. Project Overview & Quick Reference

| Field | Submission Details |
|---|---|
| **Project Title** | **A.E.G.I.S.** (Analytics & Evidence-based Governance Intelligence System) |
| **Tagline / One-Liner** | Deterministic, evidence-grounded supervisory analytics & negative-space intelligence platform for critical infrastructure cybersecurity governance. |
| **Hackathon Theme** | **Cybersecurity, Digital Trust & AI Governance** (*"Build for a Better Future"*) |
| **Target Sector** | Critical National Infrastructure (Energy, Banking, Health, Defense, Telecom) & Enterprise SOCs |
| **Tech Stack** | Python 3.12+, FastAPI, React 19, Vite, Recharts, Three.js, SQLite/PostgreSQL, Docker |
| **Key Differentiator** | 100% Deterministic Evidence Traceability + Negative-Space Analysis + Zero Cloud Dependency |
| **Repository / Package** | `AEGIS_Global_Innovation_Hackathon_2026_Submission.zip` |

---

## 📝 2. Executive Summary (150–200 Words)

In an increasingly volatile cyber landscape, critical infrastructure entities (power grids, financial institutions, defense networks, and healthcare systems) depend on Security Operations Centers (SOCs) for defense. However, regulatory supervisors and CISOs face an asymmetric governance crisis: telemetry is trapped across siloed, heterogeneous SIEM platforms (ArcSight, QRadar, Splunk, Elastic), and supervisors have no mathematical way to detect **what the SOC missed or failed to log**.

**A.E.G.I.S.** (Analytics & Evidence-based Governance Intelligence System) solves this by providing a **deterministic, air-gapped supervisory intelligence engine**. Rather than acting as a redundant real-time SIEM, A.E.G.I.S. ingests periodic operational snapshots across 8+ formats (CEF, LEEF, Syslog, XML, Parquet, JSON, XLSX), executes **negative-space reasoning** (identifying absent sensors and skipped investigation steps), analyzes execution gaps against compliance playbooks, and computes bounded composite **Attention Scores (0–100)**. With zero synthetic LLM hallucinations, sequential SHA-256 cryptographic audit chaining, and normalized peer benchmarking radar, A.E.G.I.S. guarantees complete evidence accountability to safeguard our shared digital future.

---

## 🎯 3. Problem Statement & Global Significance

### The Real-World Challenge:
Modern societies cannot function without secure critical infrastructure. A breach in a national power grid or central banking network can destabilize millions of lives. While individual entities operate internal SOCs, high-level supervisory bodies (e.g., CERT-In, NCIIPC, RBI, NIST, ENISA) and enterprise leadership face four systemic bottlenecks:

1. **The Telemetry Tower of Babel**: Every entity uses different SIEM formats (ArcSight CEF, QRadar LEEF, Syslog, Windows XML, Parquet). Aggregating evidence across hundreds of entities is slow, error-prone, and manual.
2. **Supervisory Blindspots ("The Invisible Void")**: Traditional tools only analyze what is logged. They fail to reason about *negative space*—unmonitored network segments, missing DNS flow telemetry during malware alerts, or silence during peak operational hours.
3. **Execution Gaps & Triage Theatrics**: Critical alerts are frequently closed in under 5 minutes without mandatory escalation, forensic capture, or secondary analyst review. Supervisors cannot manually audit millions of closed tickets.
4. **AI Hallucination Risks in Forensics**: Standard GenAI tools introduce probabilistic hallucinations that are legally indefensible in regulatory audits and judicial investigations.

---

## 💡 4. The Proposed Solution: A.E.G.I.S. Architecture

A.E.G.I.S. is structured into five modular, evidence-traceable subsystems:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PERIODIC CSE EVIDENCE / SOC LOG INGESTION                       │
│  [CEF - ArcSight]  [LEEF - QRadar]  [Syslog RFC-5424]  [XML]  [Parquet]  [JSON]  [XLSX]│
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                         UNIVERSAL NORMALIZATION & ETL ENGINE                           │
│     • Schema Validation & Type Coercion   • Elastic Common Schema (ECS) Normalizer     │
│     • Batch Ingestion Ledger              • Missing Field & Null Imputation Handler    │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          SUPERVISORY ANALYTICAL CORE                                   │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌───────────────────────────┐ │
│  │  Execution Gap Engine  │  │ Negative-Space Engine  │  │ Anomaly & Outlier Engine  │ │
│  │ (Playbook Violations)  │  │ (Missing Logs/Signals) │  │ (Statistical Deviations)  │ │
│  └───────────┬────────────┘  └───────────┬────────────┘  └─────────────┬─────────────┘ │
│              └───────────────────────────┼─────────────────────────────┘               │
│                                          ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│  │         COMPOSITE ATTENTION SCORING & PRIORITIZATION ENGINE (0 - 100)             │ │
│  │  • [0 - 30]: NORMAL      • [31 - 70]: MEDIUM     • [71 - 97]: SUPERVISORY REVIEW  │ │
│  │  • [98 - 100]: CRITICAL ESCALATION REQUIRED                                      │ │
│  └───────────────────────────────────────┬───────────────────────────────────────────┘ │
└───────────────────────────────────────────┼────────────────────────────────────────────┘
                                            │
                        ┌───────────────────┴───────────────────┐
                        ▼                                       ▼
┌──────────────────────────────────────────────┐ ┌──────────────────────────────────────┐
│       EXECUTIVE SUPERVISORY FRONTEND         │ │     SECURE OUTBOUND GATEWAY          │
│  • Executive Decision Room & Drilldowns      │ │  • Gatekeeper (Score >= 98 Only)     │
│  • Multi-CSE Radar Comparator                │ │  • Data Minimisation (14 Fields Max) │
│  • Air-Gap Posture & Host Telemetry          │ │  • Cryptographic HMAC-SHA256 Sign    │
│  • Case Management & Audit Ledger            │ │  • Idempotency & Replay Shield       │
└──────────────────────────────────────────────┘ └──────────────────────────────────────┘
```

### Key Technical Capabilities:
1. **Universal SIEM Normalization**: Lossless parsing for 8 industry-standard log formats into a unified Elastic Common Schema (ECS) representation.
2. **Negative-Space Discovery Engine**: Statistical and rule-driven detection of missing log feeds, dropped telemetry, and unmonitored sensors.
3. **Execution Gap Engine**: Audits alert resolution lifecycles against standard incident response playbooks (NIST SP 800-61r2), flagging unverified closures and MTTR anomalies.
4. **Peer Benchmarking Radar**: Compares entity performance metrics against anonymized sectoral cohort medians (PowerGrid vs IOCL vs SBI vs Airtel).
5. **Deterministic Evidence Traceability**: Every single supervisory finding links directly to immutable raw event records with zero probabilistic hallucination.
6. **Air-Gapped Enclave Architecture**: Complete offline functionality with zero external telemetry, local SQLite/PostgreSQL storage, and sequential SHA-256 cryptographic audit chaining.
7. **Secure Outbound Gateway**: Enforces strict data minimization (14 essential metadata fields only) with HMAC-SHA256 digital signing for critical escalations (Score ≥ 98).

---

## 🚀 5. Innovation & Key Differentiators

| Traditional SOC / SIEM Tools | Generative AI Wrappers | A.E.G.I.S. (Our Innovation) |
|---|---|---|
| Ingests raw data only; cannot detect what is *missing*. | Hallucinates plausible-sounding explanations; unverified. | **Negative-Space Reasoning**: Quantifies missing signals mathematically. |
| Siloed per vendor (Splunk vs QRadar vs ArcSight). | Requires sending sensitive telemetry to public cloud APIs. | **Universal Normalizer**: Air-gapped lossless translation for 8+ formats. |
| Focuses on micro-alerts; floods analysts with noise. | Non-deterministic; non-reproducible for legal audits. | **Supervisory Composite Scoring (0–100)**: Evidence-grounded & deterministic. |
| No cross-entity cohort benchmarking due to privacy laws. | High API latency and prohibitive recurring token costs. | **Privacy-Preserving Radar**: Benchmarks entities without exposing raw data. |
| Vulnerable to audit log tampering and revisionism. | Subject to prompt injection and stochastic drift. | **Cryptographic Proofs**: Sequential SHA-256 chained audit ledger. |

---

## 🌍 6. Societal Impact: "Build for a Better Future"

1. **Shielding Critical National Infrastructure (CNI)**: Protects power generation, smart grids, water treatment, nuclear facilities, and financial transaction hubs from silent catastrophic cyber disruptions.
2. **Eliminating Operational Blindspots in Governance**: Provides national cybersecurity watchdogs and regulatory bodies with automated, objective, mathematically defensible audit reports.
3. **Democratizing Cyber Resilience**: Works seamlessly in air-gapped, resource-constrained, and offline enclaves without requiring multimillion-dollar cloud infrastructure.
4. **Data Sovereignty & Privacy**: Zero telemetry leaves the sovereign perimeter, adhering to global data protection laws (GDPR, DORA, DPDP Act 2023).

---

## 💻 7. Tech Stack & Architecture Details

- **Backend Framework**: Python 3.12+ / FastAPI (High-performance asynchronous REST API)
- **Data Modeling & Storage**: SQLAlchemy ORM, Alembic Migrations, SQLite (Air-gapped single-file) / PostgreSQL (Enterprise cluster)
- **Analytical & Mathematical Engine**: NumPy, SciPy (Statistical deviation, z-score anomaly scoring, cohort percentile distributions)
- **Frontend Architecture**: React 19, Vite, React Router 7, Framer Motion
- **Visualization Suite**: Recharts (Radar, Time-series, Cohort distributions), Three.js / React Three Fiber (Interactive 3D Enclave Globe)
- **Cryptographic Engine**: Python `hashlib` & `hmac` (SHA-256 sequential audit chaining, HMAC-SHA256 gateway signatures)
- **Authentication**: Dual-mode (Google OAuth 2.0 + Offline CSPRNG-based OTP generator)
- **Deployment**: Docker, Docker Compose, Windows Batch Scripts (`START_PROJECT.bat`)

---

## ⚡ 8. Step-by-Step Setup & Evaluation Guide (For Judges)

### Prerequisites:
- Python 3.12+ installed
- Node.js 18.0+ installed

### Option A: One-Click Instant Launch (Windows - Recommended)
1. Extract the submission ZIP file: `AEGIS_Global_Innovation_Hackathon_2026_Submission.zip`
2. Open the extracted folder.
3. Double-click **`START_PROJECT.bat`**.
4. The script will automatically:
   - Configure Python virtual environment & install requirements.
   - Run database migrations & seed comprehensive demonstration data.
   - Start the FastAPI backend on `http://127.0.0.1:8000`.
   - Start the React frontend on `http://localhost:3000`.
   - Launch your browser directly to the A.E.G.I.S. Executive Decision Room.

To gracefully stop all services: Double-click **`STOP_PROJECT.bat`**.

---

### Option B: Manual Terminal Launch

**Step 1: Start Backend**
```powershell
# Open Terminal 1
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # (On Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
alembic upgrade head
python -m app.db.seed_demo
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**Step 2: Start Frontend**
```powershell
# Open Terminal 2 (Workspace root)
npm install
npm run dev
```
Open your browser at `http://localhost:3000`.

---

### Option C: Docker Container Launch
```bash
docker-compose up --build
```
Access the application at `http://localhost:3000` (Backend API docs at `http://localhost:8000/docs`).

---

## 🎙️ 9. 4-Minute Jury Presentation Walkthrough (27 Sep Evaluation)

| Time | Screen / View | Narration & Key Demonstration Points |
|---|---|---|
| **0:00 – 0:45** | **Executive Decision Room** (`/`) | Introduce A.E.G.I.S. Explain how critical infrastructure SOCs face telemetry silos and supervisory blindspots. Highlight the composite Attention Score (0-100) and how CSE-07 (PowerGrid) is flagged at Score 77. |
| **0:45 – 1:30** | **Multi-CSE Radar Benchmarking** (`/benchmarking`) | Showcase comparative radar analytics. Point out how CSE-07 deviates from the cohort median in containment time and negative space indicators. |
| **1:30 – 2:15** | **Universal SIEM Ingestion** (`/evidence`) | Demonstrate ingestion of CEF, LEEF, Syslog, XML, and Parquet. Show lossless ECS normalization and instant schema validation. |
| **2:15 – 3:00** | **Negative Space & Execution Gaps** (`/negative-space` & `/findings`) | Drill down into Finding FND-042: a critical ransomware alert closed in 8 mins without escalation. Show negative-space telemetry showing missing DNS logs. |
| **3:00 – 3:40** | **Air-Gap Security & Cryptographic Ledger** (`/records`) | Display the host isolation telemetry, zero cloud calls, and the immutable SHA-256 chained audit trail for regulatory non-repudiation. |
| **3:40 – 4:00** | **Outbound Escalation & Conclusion** | Demonstrate the HMAC-SHA256 signed escalation gateway with strict 14-field data minimization. Conclude with how A.E.G.I.S. builds a secure digital future. |

---

## 👥 10. Team Information & Institutional Affiliation

- **Hackathon**: Global Innovation Hackathon 2026 – Build for a Better Future (Bharat Academix)
- **Team Name**: **CODER RISE**
- **Institution**: Galgotias University, Greater Noida, Uttar Pradesh, India
- **Team Leader**: Prateek Gupta ([LinkedIn Profile](https://www.linkedin.com/in/prateek-gupta-tech/))
- **Team Specializations**: Full-Stack Architecture, SIEM Engineering, Cryptographic Security, Threat Modeling, Predictive Analytics, and QA.

---
<div align="center">
  <b>A.E.G.I.S.</b> — <i>Engineering Deterministic Trust & Supervisory Intelligence for a Resilient Global Future</i>
</div>
