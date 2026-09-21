# A.E.G.I.S — 4-Minute Video Demo Pitch Script
## Global Innovation Hackathon 2026 · Build for a Better Future (Bharat Academix) | Team Demo Guide

---

> **Total Duration**: 4 minutes (240 seconds)
> **Format**: Screen recording with voiceover
> **Browser**: Open `http://localhost:3000` (or whatever port) — **Dashboard** page visible

---

## 🎬 PRE-RECORDING CHECKLIST

Before hitting record:
1. Run `npm run dev` from `client/` folder
2. Open browser to `http://localhost:3000`
3. Click **"Reset Demo"** button (top-right red button) to ensure clean state
4. Make sure you're on the **Dashboard** page
5. Zoom browser to ~90% so everything fits
6. Close any other tabs/notifications

---

## SEGMENT 1 — INTRO & PROBLEM (0:00 – 0:40)

**🖥 Screen**: Dashboard is open and visible

**🗣 Script** (speak clearly, moderate pace):

> "Namaste. We are presenting **A.E.G.I.S** — Analytics and Evidence-based Governance Intelligence System.
>
> India's critical infrastructure — energy grids, financial systems, transport networks — is monitored by SOCs, Security Operations Centres. NCIIPC supervises these SOCs through periodic assessments.
>
> The problem? These assessments are **manual** — supervisors review thousands of operational records by hand. Execution gaps get missed. Evidence trails break. There is no structured, evidence-driven framework to identify **what the SOC missed** versus what it reported.
>
> A.E.G.I.S solves this. It is a **supervisory analytics platform** that analyses submitted SOC evidence to surface execution gaps, negative-space indicators, anomalies, and peer deviations — while preserving complete evidence traceability and **human expert judgment**."

**👆 Action**: Don't click anything yet. Let the dashboard be visible.

---

## SEGMENT 2 — DASHBOARD WALKTHROUGH (0:40 – 1:20)

**🖥 Screen**: Still on Dashboard

**🗣 Script**:

> "This is the **Supervisory Analytics Dashboard** for the Q2 2026 assessment period.
>
> Notice the top indicators — the **Cohort Attention Score** is dynamically calculated based on evidence analysis. It currently shows an elevated score, meaning this cohort requires deeper supervisory attention.
>
> **Execution Gaps shows 1** — the system has detected one operational gap requiring supervisory review."

**👆 Action**: Hover mouse over the "Execution Gaps: 1" stat card.

> "In the **Execution Gaps & Anomalies** section, the system has flagged a **Critical execution gap requiring supervisory review**. A critical alert was closed, but expected escalation records are missing from the submitted evidence."

**👆 Action**: Point mouse at the red EXECUTION GAP badge and the text below it.

> "Below that, we also see a **Negative Space** indicator — this means expected telemetry is absent. The system detects what **should** be there but **isn't**."

**👆 Action**: Point to the NEGATIVE SPACE badge.

> "On the right, the **CSE Attention Score ranking** shows CSE-07 at rank 1 with a score of 77 out of 100, flagged as HIGH attention. Let me drill into this entity."

**👆 Action**: **Click on CSE-07** in the ranking list.

---

## SEGMENT 3 — CSE-07 DEEP DIVE & FINDINGS (1:20 – 2:15)

**🖥 Screen**: CSE-07 detail page

**🗣 Script**:

> "This is the CSE-07 assessment view — a critical infrastructure entity in the energy sector.
>
> The **attention score breakdown** shows how each analytical dimension contributes to the overall score. Execution gaps, negative-space indicators, and peer deviations are all weighted and calculated transparently.
>
> Below, we see the **Potential Supervisory Findings**. The top finding — FND-042 — is a **Critical** execution gap: a critical alert was closed without escalation in just 8 minutes. The peer median for similar investigations is 42 minutes."

**👆 Action**: Point to finding FND-042 details.

> "Let me open the investigation for this finding."

**👆 Action**: **Click "View Investigation →"** on finding FND-042.

> "The **Evidence Investigation Drawer** opens. Here you can see the full evidence chain — the alert ID, the case ID, the timeline, what was expected versus what was observed, and the rule that detected this gap.
>
> This is **evidence traceability** — every finding links back to the original operational records. No black box. No AI hallucination. Just structured rule-based analysis that a supervisor can verify."

**👆 Action**: Scroll through the drawer content, then **close the drawer** (click X).

---

## SEGMENT 4 — EVIDENCE EXPLORER & NEGATIVE SPACE (2:15 – 2:55)

**👆 Action**: Click **"Findings"** in the left sidebar.

**🖥 Screen**: Findings page

**🗣 Script**:

> "The Findings page shows all detected supervisory findings across the entire cohort — filterable by severity and category.
>
> We can see Execution Gaps, Anomalies, Negative Space indicators, and Peer Deviations — each with confidence scores and evidence references."

**👆 Action**: Click **"Negative Space"** in the left sidebar.

**🖥 Screen**: Negative Space page

> "The **Negative Space** module is unique to A.E.G.I.S. It identifies what **should exist** in the evidence but **doesn't**. For example, a critical asset with no recent monitoring activity, or an expected alert category that is completely absent from the assessment records.
>
> These are the gaps that manual reviews miss — because you can't see what isn't there."

**👆 Action**: Point to the negative space observations.

---

## SEGMENT 5 — ANALYST WORKSPACE & TRACEABILITY (2:55 – 3:25)

**👆 Action**: Click **"Analyst Workspace"** in the left sidebar.

**🖥 Screen**: Evidence Traceability Workspace

**🗣 Script**:

> "The **Evidence Traceability Workspace** shows the three-stage supervisory flow:
>
> Stage 1 — **Analytical Signal**: The system identifies a potential execution gap.
> Stage 2 — **Supporting Evidence**: The original submitted SOC record.
> Stage 3 — **Human Review**: The supervisor verifies and makes the final decision.
>
> This is critical — A.E.G.I.S **never declares violations automatically**. It surfaces signals, links them to evidence, and presents them for human supervisory judgment."

**👆 Action**: Point to the 3-stage flow visualization at the top.

> "The submitted SOC record is shown below with full context — target asset, entity, and severity."

---

## SEGMENT 6 — PEER BENCHMARKING & REPORTS (3:25 – 3:50)

**👆 Action**: Click **"Peer Benchmarking"** in the left sidebar.

**🖥 Screen**: Peer Benchmarking page

**🗣 Script**:

> "**Peer Benchmarking** compares each entity's operational metrics against the cohort. This catches statistical outliers — for example, if one SOC's escalation rate is significantly below the peer median, it warrants review.
>
> The system provides context, not conclusions."

**👆 Action**: Click **"Assessment Reports"** in the left sidebar.

**🖥 Screen**: Assessment Reports page

> "Finally, the **Assessment Report** consolidates all findings, peer context, and limitations into a structured supervisory document — ready for human review and action."

**👆 Action**: Point to the report content briefly.

---

## SEGMENT 7 — CLOSING & KEY DIFFERENTIATORS (3:50 – 4:00)

**👆 Action**: Click **"Dashboard"** to return to the main page.

**🖥 Screen**: Dashboard

**🗣 Script**:

> "To summarize — A.E.G.I.S is **fully offline**, requires **no internet or AI APIs**, uses **deterministic rule-based analytics**, preserves **complete evidence traceability**, and keeps **human judgment at the centre** of every supervisory decision.
>
> Thank you."

---

## ⏱ TIMING SUMMARY

| Segment | Time | Duration | What's on Screen |
|---|---|---|---|
| 1. Intro & Problem | 0:00 – 0:40 | 40s | Dashboard (static) |
| 2. Dashboard Walkthrough | 0:40 – 1:20 | 40s | Dashboard (hover/point) |
| 3. CSE-07 & Findings | 1:20 – 2:15 | 55s | CSE-07 → Investigation Drawer |
| 4. Findings & Negative Space | 2:15 – 2:55 | 40s | Findings → Negative Space |
| 5. Analyst Workspace | 2:55 – 3:25 | 30s | Analyst Workspace |
| 6. Benchmarking & Reports | 3:25 – 3:50 | 25s | Peer Benchmarking → Reports |
| 7. Closing | 3:50 – 4:00 | 10s | Dashboard |

---

## 🚨 CRITICAL REMINDERS

- **DO NOT** click "Reset Demo" during recording
- **DO NOT** open browser dev tools
- **DO NOT** mention AI/ML/ChatGPT — the system is rule-based
- **DO** speak confidently about "evidence traceability" and "human judgment"
- **DO** emphasize the system is LOCAL / OFFLINE — no internet dependency
- The bottom-left shows **LOCAL DEMO DATA** and **Q2 2026** — these validate offline capability
- If something doesn't load, just move to the next section smoothly

---

## 📋 NAVIGATION CLICK ORDER

1. **Dashboard** (start here)
2. Click **CSE-07** in ranking → CSE detail page
3. Click **View Investigation** → Opens drawer → Close drawer
4. Sidebar: **Findings**
5. Sidebar: **Negative Space**
6. Sidebar: **Analyst Workspace**
7. Sidebar: **Peer Benchmarking**
8. Sidebar: **Assessment Reports**
9. Sidebar: **Dashboard** (end here)
