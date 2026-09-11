from collections import defaultdict
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.models import Alert, Asset, Case, CaseAlertLink, Escalation, Investigation


@dataclass
class EvidenceCandidate:
    record_type: str
    record_id: str
    summary: str


@dataclass
class FindingCandidate:
    rule_code: str
    cse_id: int
    severity: str
    title: str
    description: str
    explanation: str
    evidence: list[EvidenceCandidate]


def detect_ns001(assets: list[Asset], alerts: list[Alert], period: str, parameters: dict) -> list[FindingCandidate]:
    criticalities = set(parameters.get('criticalities', ['CRITICAL']))
    observed_assets = {alert.asset_id for alert in alerts if alert.asset_id is not None}
    findings = []
    for asset in assets:
        if asset.criticality not in criticalities or not asset.expected_monitoring or asset.id in observed_assets:
            continue
        findings.append(FindingCandidate(
            'NS-001', asset.cse_id, 'HIGH',
            'No submitted monitoring evidence observed for a critical asset where monitoring is expected',
            f'No relevant alert evidence was submitted for critical asset {asset.asset_code} during {period}.',
            f'Based on the submitted records for {period}, asset {asset.asset_code} is {asset.criticality} and has expected monitoring enabled, but the observed alert evidence count is 0. This does not prove the asset was not monitored; manual verification is recommended.',
            [EvidenceCandidate('ASSET', asset.asset_code, f'Expected monitoring: true; criticality: {asset.criticality}; assessment period: {period}; observed alert records: 0.')],
        ))
    return findings


def detect_ns002(alerts: list[Alert], cse_id: int, period: str, parameters: dict) -> list[FindingCandidate]:
    expected = [str(category).upper() for category in parameters.get('expected_categories', [])]
    observed = {alert.category.upper() for alert in alerts}
    findings = []
    for category in expected:
        if category in observed:
            continue
        findings.append(FindingCandidate(
            'NS-002', cse_id, 'MEDIUM',
            f'Expected alert category {category} has no submitted alert evidence for the assessment period',
            f'Expected category {category} has zero submitted alert records for {period}.',
            f'For the configured expected category {category}, the submitted alert count for {period} is 0. The absence of submitted evidence does not establish that the underlying activity did not occur.',
            [EvidenceCandidate('ALERT', 'NONE', f'Expected category: {category}; assessment period: {period}; observed alert count: 0.')],
        ))
    return findings


def detect_ns003(db: Session, alerts: list[Alert], period: str, parameters: dict) -> list[FindingCandidate]:
    applicable = set(parameters.get('applicable_severities', ['HIGH', 'CRITICAL']))
    findings = []
    for alert in alerts:
        if alert.severity not in applicable:
            continue
        case_ids = db.scalars(select(CaseAlertLink.case_id).where(CaseAlertLink.alert_id == alert.id)).all()
        investigation_count = db.scalar(select(Investigation.id).where(Investigation.case_id.in_(case_ids))) if case_ids else None
        if case_ids or investigation_count:
            continue
        findings.append(FindingCandidate(
            'NS-003', alert.cse_id, 'HIGH',
            'No submitted investigation evidence observed for an applicable high-severity alert',
            f'Alert {alert.alert_code} has no submitted case or investigation evidence.',
            f'Alert {alert.alert_code} is {alert.severity} and appears in the {period} submitted records, but no case or investigation relationship was found. This does not prove that investigation activity did not occur outside the submitted dataset; manual verification is recommended.',
            [EvidenceCandidate('ALERT', alert.alert_code, f'Severity: {alert.severity}; case presence: no; investigation presence: no; assessment period: {period}.')],
        ))
    return findings


def detect_ns004(db: Session, alerts: list[Alert], period: str, parameters: dict) -> list[FindingCandidate]:
    applicable = set(parameters.get('applicable_severities', ['CRITICAL']))
    findings = []
    for alert in alerts:
        if alert.severity not in applicable:
            continue
        count = db.scalar(select(Escalation.id).where(Escalation.alert_id == alert.id))
        if count is not None:
            continue
        findings.append(FindingCandidate(
            'NS-004', alert.cse_id, 'HIGH',
            'Expected escalation evidence was not observed in the submitted records',
            f'Applicable alert {alert.alert_code} has zero submitted escalation records.',
            f'Alert {alert.alert_code} is {alert.severity}; the escalation lookup for {period} returned a count of 0. This states only that corresponding evidence was absent from the submitted records, not that escalation was not performed.',
            [EvidenceCandidate('ALERT', alert.alert_code, f'Alert: {alert.alert_code}; severity: {alert.severity}; assessment period: {period}; escalation count: 0.')],
        ))
    return findings


def detect_ns005(cse_id: int, alerts: list[Alert], cases: list[Case], investigations: list[Investigation], escalations: list[Escalation], period: str, parameters: dict) -> list[FindingCandidate]:
    minimums = {
        'alerts': int(parameters.get('minimum_alerts_per_period', 1)),
        'cases': int(parameters.get('minimum_cases_per_period', 1)),
        'investigations': int(parameters.get('minimum_investigations_per_period', 1)),
    }
    counts = {'alerts': len(alerts), 'cases': len(cases), 'investigations': len(investigations), 'escalations': len(escalations)}
    missing = [name for name, minimum in minimums.items() if counts[name] < minimum]
    if not missing:
        return []
    detail = ', '.join(f'{name}={counts[name]} (minimum {minimums[name]})' for name in missing)
    return [FindingCandidate(
        'NS-005', cse_id, 'MEDIUM',
        'Unexpectedly low submitted operational activity; supervisory review recommended',
        f'The submitted operational activity for {period} is below configured minimums: {detail}.',
        f'For CSE {cse_id} in assessment period {period}, submitted activity is below configured minimums for {", ".join(missing)}. This is a cautious missing-activity signal, not an anomaly or peer comparison.',
        [EvidenceCandidate('CSE', str(cse_id), f'Assessment period: {period}; submitted counts: alerts={counts["alerts"]}, cases={counts["cases"]}, investigations={counts["investigations"]}, escalations={counts["escalations"]}.')],
    )]
