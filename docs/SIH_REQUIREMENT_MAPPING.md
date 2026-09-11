# SIH Requirement Mapping: A.E.G.I.S

## Project Positioning

**A.E.G.I.S** (Analytics & Evidence-based Governance Intelligence System · Supervisory Analytics Tool for SOC Assessment · SAT-SA · SIH Problem Statement ID: SIH26157) is an evidence-driven supervisory analytics and evidence-intelligence platform that assists NCIIPC-style supervisory assessment by analysing periodic SOC operational evidence to identify execution gaps, negative-space indicators, anomalies, peer deviations, and entities requiring supervisory attention, while preserving evidence traceability and human expert judgment.

It is not a SIEM, SOC replacement, real-time monitoring system, national monitoring platform, cloud SaaS, or autonomous regulatory decision-maker.

## Requirement Status

| SIH-aligned capability | Status | Evidence in implementation |
|---|---|---|
| Problem understanding and supervisory assessment support | Implemented | CSE-scoped ingestion, analytics, attention scoring, prioritisation, and reporting modules |
| Execution-gap analysis | Implemented | `backend/app/analytics/execution_gaps/` with EG rules, detectors, persistence, and tests |
| Negative-space analysis | Implemented | `backend/app/analytics/negative_space/` with cautious observation language and tests |
| Anomaly and outlier detection | Implemented | `backend/app/analytics/anomalies/` with historical-baseline detectors and tests |
| Peer benchmarking | Implemented | `backend/app/analytics/peer_benchmark/` with peer metrics and deviation handling |
| Entity-level supervisory attention | Implemented | `backend/app/analytics/attention/` combines available analytical components with bounded scoring |
| Manual-review prioritisation | Implemented | `backend/app/analytics/prioritisation/` ranks samples and records convergence reasons |
| Evidence traceability | Implemented | Finding-to-rule, finding-to-record, and finding-to-evidence relationships plus evidence routes |
| Explainability | Implemented | `backend/app/analytics/explainability/` separates fact, interpretation, and manual verification guidance |
| Dashboards and reports | Implemented | React dashboard, drill-down views, evidence explorer, and assessment report routes |
| Multi-CSE data handling | Implemented | CSE identifiers and CSE-scoped services, rules, findings, reports, and test coverage |
| Offline / air-gapped deployment | Implemented | Localhost configuration, pinned dependencies, PowerShell deployment scripts, and offline guide |
| Human supervisor oversight | Implemented | UI and report language states that recommendations require human review and are not verdicts |
| Autonomous compliance certification | Not implemented | Reports explicitly state they are not compliance verdicts |
| Real-time telemetry or continuous monitoring | Not implemented | Input is periodic uploaded evidence; no telemetry collector or live feed exists |
| SIEM or SOC replacement | Not implemented | No SIEM collection, alert management, or SOC operations claim is made |
| Cloud SaaS or centralized national monitoring | Not implemented | Runtime is local-only and uses local PostgreSQL |
| External AI API dependency | Not implemented | No external AI client or runtime Internet dependency exists |

## Data Flow Verified

```text
Periodic CSE evidence
  -> CSV/JSON ingestion and validation
  -> PostgreSQL persistence and ingestion batch
  -> execution gaps
  -> negative-space observations
  -> anomalies and peer metrics
  -> entity attention score
  -> explainability and evidence links
  -> prioritised manual-review samples
  -> supervisory assessment report
  -> dashboard and drill-down views
```

## Boundaries and Limitations

- Findings are analytical signals, not confirmed incidents or regulatory conclusions.
- Negative-space results identify missing or unobserved evidence in the submitted sample; absence of evidence is not proof that an activity did not occur.
- Peer comparison and some score components remain unavailable when the submitted data lacks an adequate baseline; unavailable values are not converted to zero.
- PostgreSQL installation and migration execution were not physically validated on the validation machine because PostgreSQL is not installed there.
- Frontend browser journeys were validated through route/code inspection, build validation, and API contract checks; a full browser automation run was not available in this environment.
