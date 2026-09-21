# A.E.G.I.S. (SAT-SA) — Demonstration & Presentation Script
**Hackathon:** Global Innovation Hackathon 2026 – Build for a Better Future (Bharat Academix)  
**Track:** Cybersecurity, AI Governance & Digital Trust  
**Target Domain:** Critical National & Global Infrastructure Defense (Energy, Banking, Telecom, Health, Defense)  

---

## 1. 30-Second Elevator Pitch (Start with this)

> "Respected Evaluators, **A.E.G.I.S.** is an **offline-first supervisory analytics and decision-support platform** designed for national critical infrastructure oversight.
> 
> Unlike a generic SIEM, A.E.G.I.S. does not replace existing SOC tools. It sits *above* them to assess **Execution Gaps, Negative Space, and Operational Anomalies**.
> 
> Today, we have integrated **Real SIEM connectivity** (Elasticsearch/Splunk/Sentinel) with strict **Zero Cloud Leakage**. 
> All operational data remains 100% on-premises. Only critical threats with an **Attention Score of 98 to 100** pass through our **Critical Alert Gateway**, which encrypts a minimised payload for authorised external endpoints (or holds securely in a protected local queue)."

---

## 2. Attention Score Policy (The Core Policy Formula)

| Score Range | Tier | Status Label | System Action | Outbound Rule |
| :--- | :--- | :--- | :--- | :--- |
| **0 – 30** | **NORMAL** | `LOCAL — NORMAL` | Processed locally, stored locally, displayed on dashboard. | **No transmission** |
| **31 – 70** | **MEDIUM** | `LOCAL — MEDIUM` | Processed locally, trends tracked over assessment periods. | **No transmission** |
| **71 – 97** | **HIGH** | `HUMAN SUPERVISORY REVIEW REQUIRED` | Creates human review task. Displayed prominently for supervisor audit. | **No auto transmission** (Manual action only) |
| **98 – 100** | **CRITICAL** | `CRITICAL — ESCALATION REQUIRED` | Enters Critical Alert Gateway. Signed with HMAC-SHA256 & SHA-256 hash. | **Transmitted ONLY to authorised endpoint** (or encrypted local queue) |

---

## 3. Role-Based Access Control (RBAC) — "Kiska Kya Kaam Hai?"

### 1. Supervisor (`supervisor` / `Admin@2026`) — *NCIIPC Chief Supervisor*
- **Role:** High-level supervisory governance and escalation authority.
- **Actions:**
  - Reviews high-risk findings (**Score 71–97**).
  - Verifies evidence and mathematical score explanations.
  - Manually escalates findings through the **Critical Alert Gateway**.
  - Approves assessment reports and signs off in the Decision Room.

### 2. Analyst (`analyst` / `Analyst@2026`) — *PowerGrid SOC Lead (CSE-07)*
- **Role:** Operational day-to-day triage and investigation.
- **Actions:**
  - Ingests operational telemetry via CSV or Real SIEM.
  - Investigates alerts, links cases, and documents investigation notes.
  - Explores raw telemetry and negative-space monitoring gaps.
  - **Constraint:** Cannot bypass supervisory sign-off or reconfigure gateway keys.

### 3. Administrator (`admin` / `Admin@2026`) — *National System Administrator*
- **Role:** Enclave infrastructure and security boundary configuration.
- **Actions:**
  - Configures and tests Real SIEM connection parameters (Elasticsearch, Splunk, Sentinel).
  - Manages authorised external endpoint destinations and HMAC secret keys.
  - Handles air-gapped user provisioning and system health monitoring.

### 4. Auditor (`auditor` / `Audit@2026`) — *CERT-In Regulatory Auditor*
- **Role:** Independent compliance and provenance verification.
- **Actions:**
  - **Strictly Read-Only.** Inspects immutable audit logs (`/audit`).
  - Verifies data minimisation packages to ensure zero raw database leakage.
  - Checks rule traceability: *Finding ➔ Evidence ➔ Score ➔ Decision ➔ Escalation*.

---

## 4. Live 3-Minute Demo Walkthrough (Step-by-Step)

### Step 1: Secure Login & Role Identity (Show Screen)
1. Select **Role: Supervisor** from the dropdown.
2. Log in with `supervisor` / `Admin@2026`.
3. Point out:
   - **Offline / Air-Gapped Environment** indicator.
   - Header badge displaying: **S. Sengupta | NCIIPC CHIEF SUPERVISOR** in green.

### Step 2: Ingestion & Real SIEM Connectivity
1. Navigate to **Data Ingestion** (`/ingestion`).
2. Show the two tabs:
   - **Local CSV Ingestion:** Drag-and-drop operational CSV evidence.
   - **Real SIEM Ingestion:** Show modular support for **Elasticsearch**, **Splunk**, and **Microsoft Sentinel**.
3. Point out:
   - "Test Connection" button proves non-blocking offline resilience.
   - "Zero Cloud Leakage Guarantee": All ingested alerts are stored in the local relational database (`Alert` & `IngestionBatch`).

### Step 3: Attention Score & Supervisory Review
1. Navigate to **Supervisory Escalation** (`/escalation`).
2. Point out the 4 policy cards:
   - `0-30 NORMAL` (Local)
   - `31-70 MEDIUM` (Local)
   - `71-97 HIGH` (Human Review Required)
   - `98-100 CRITICAL` (Gateway Eligible)
3. Show **Pending Human Supervisory Reviews (Scores 71–97)**:
   - Show finding `FND-042` with status `HUMAN SUPERVISORY REVIEW REQUIRED`.
   - Click **"Escalate Manually"**.
   - The alert is admitted through the **Critical Alert Gateway**.

### Step 4: Critical Alert Gateway & Data Minimisation
1. Look at the top table: **Protected Critical Escalation Queue**.
2. Point out:
   - **Alert ID:** `ALT-CRT-FND-042-...`
   - **Attention Score:** `99 CRITICAL`
   - **Delivery Status:** `AWAITING_AUTH_ENDPOINT` (Protects data locally when no external endpoint is configured).
   - **Payload Hash:** SHA-256 hash preventing tampering.
3. Click **"Inspect"** button:
   - Show the minimised JSON payload.
   - Point out: Only 14 necessary metadata fields are present. **Zero raw CSV or database rows are leaked!**

---

## 5. Potential Evaluator Questions & Winning Answers

**Q1: Does this system claim direct access to real IB / R&AW systems?**  
*Answer:*  
"No, sir. We follow strict defense-in-depth and compliance rules. We do NOT claim direct access to real IB/R&AW systems, nor do we invent mock government endpoints. External transmission happens ONLY when an authorized endpoint is explicitly configured by the administrator. Otherwise, all critical alerts remain safely held in our protected local queue (`AWAITING_AUTH_ENDPOINT`)."

**Q2: What happens if the internet goes down or the SIEM fails?**  
*Answer:*  
"A.E.G.I.S. is primarily **offline-first**. All CSV and local database analytics run independently on-premises. If the SIEM or external endpoint is unreachable, network timeouts return a graceful offline status without crashing the system. Critical alerts stay safely queued until connectivity is restored."

**Q3: How do you prevent data leaks during escalation?**  
*Answer:*  
"We strictly implement **Data Minimisation**. We never transmit full CSVs or database tables. We only send a 14-field canonical metadata package protected with a SHA-256 payload hash and an HMAC-SHA256 signature to guarantee authenticity and prevent replay attacks."
