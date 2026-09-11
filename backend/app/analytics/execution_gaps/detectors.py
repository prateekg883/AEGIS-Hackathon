import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.models import Alert, Asset, CaseAlertLink, Escalation, Investigation


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


def _minutes(start: datetime, end: datetime) -> float:
    return (end - start).total_seconds() / 60


def _alert_evidence(alert: Alert, summary: str) -> EvidenceCandidate:
    return EvidenceCandidate('ALERT', alert.alert_code, summary)


def detect_eg001(alerts: list[Alert], parameters: dict) -> list[FindingCandidate]:
    findings = []
    for alert in alerts:
        if alert.severity not in {'HIGH', 'CRITICAL'} or not alert.closed_time:
            continue
        duration = _minutes(alert.created_time, alert.closed_time)
        threshold = parameters.get('critical_minutes' if alert.severity == 'CRITICAL' else 'high_minutes', 15 if alert.severity == 'CRITICAL' else 10)
        if duration < threshold:
            findings.append(FindingCandidate(
                'EG-001', alert.cse_id, 'HIGH',
                'Potentially insufficient investigation due to unusually short closure time',
                f'Alert {alert.alert_code} was closed unusually quickly for its severity.',
                f'Alert {alert.alert_code} is {alert.severity}, was created at {alert.created_time.isoformat()}, and closed at {alert.closed_time.isoformat()} after {duration:.1f} minutes. The configured threshold is {threshold} minutes. This is a supervisory signal, not proof of inadequate handling.',
                [_alert_evidence(alert, f'{alert.alert_code}: {alert.severity}; created {alert.created_time.isoformat()}; closed {alert.closed_time.isoformat()}; calculated duration {duration:.1f} minutes; threshold {threshold} minutes.')],
            ))
    return findings


def detect_eg002(db: Session, alerts: list[Alert], parameters: dict) -> list[FindingCandidate]:
    applicable = set(parameters.get('applicable_severities', ['HIGH', 'CRITICAL']))
    findings = []
    for alert in alerts:
        if alert.severity not in applicable or not alert.acknowledged_time:
            continue
        links = db.scalars(select(CaseAlertLink).where(CaseAlertLink.alert_id == alert.id)).all()
        case_ids = {link.case_id for link in links}
        investigations = db.scalars(select(Investigation).where(Investigation.case_id.in_(case_ids))).all() if case_ids else []
        meaningful = [item for item in investigations if item.status in {'IN_PROGRESS', 'PARTIAL', 'COMPLETE', 'CLOSED'}]
        if meaningful:
            continue
        evidence = [_alert_evidence(alert, f'{alert.alert_code}: acknowledged at {alert.acknowledged_time.isoformat()}; no meaningful investigation evidence found.')]
        if case_ids:
            evidence.append(EvidenceCandidate('CASE', ', '.join(str(item) for item in sorted(case_ids)), 'A case link exists, but no meaningful investigation is linked.'))
        else:
            evidence.append(EvidenceCandidate('CASE', 'NONE', 'No case is linked to the acknowledged alert.'))
        findings.append(FindingCandidate(
            'EG-002', alert.cse_id, 'HIGH',
            'Acknowledged alert without meaningful investigation evidence',
            f'Alert {alert.alert_code} was acknowledged but no meaningful downstream investigation evidence was found.',
            f'Alert {alert.alert_code} was acknowledged at {alert.acknowledged_time.isoformat()}. The available case and investigation relationships do not show a meaningful investigation. Not every alert requires a case; this rule is limited to {sorted(applicable)} severity records.',
            evidence,
        ))
    return findings


def detect_eg003(db: Session, alerts: list[Alert]) -> list[FindingCandidate]:
    findings = []
    for alert in alerts:
        if alert.severity != 'CRITICAL' or not alert.closed_time:
            continue
        escalation = db.scalar(select(Escalation.id).where(Escalation.alert_id == alert.id))
        if escalation is not None:
            continue
        findings.append(FindingCandidate(
            'EG-003', alert.cse_id, 'CRITICAL',
            'Critical alert closed without corresponding escalation evidence',
            f'Critical alert {alert.alert_code} has a closed timestamp but no escalation record was found.',
            f'Alert {alert.alert_code} is CRITICAL and closed at {alert.closed_time.isoformat()}. The escalation lookup returned no matching record. This indicates missing escalation evidence and requires human review; it does not establish that the alert was mishandled.',
            [_alert_evidence(alert, f'{alert.alert_code}: severity CRITICAL; closed {alert.closed_time.isoformat()}; escalation lookup: none.')],
        ))
    return findings


def detect_eg004(db: Session, alerts: list[Alert], parameters: dict) -> list[FindingCandidate]:
    minimum = int(parameters.get('minimum_alerts', 5))
    window = timedelta(hours=float(parameters.get('window_hours', 24)))
    grouped: dict[tuple[int, int], list[Alert]] = defaultdict(list)
    for alert in alerts:
        if alert.asset_id is not None:
            grouped[(alert.cse_id, alert.asset_id)].append(alert)
    findings = []
    for (cse_id, asset_id), group in grouped.items():
        ordered = sorted(group, key=lambda item: item.created_time)
        for start_index, start in enumerate(ordered):
            matching = [item for item in ordered[start_index:] if item.created_time - start.created_time <= window]
            if len(matching) < minimum:
                continue
            asset = db.get(Asset, asset_id)
            asset_code = asset.asset_code if asset else str(asset_id)
            codes = ', '.join(item.alert_code for item in matching)
            findings.append(FindingCandidate(
                'EG-004', cse_id, 'MEDIUM',
                'Repeated alert activity on the same asset may indicate unresolved underlying activity',
                f'{len(matching)} alerts were recorded on {asset_code} within {window.total_seconds() / 3600:g} hours.',
                f'Alert activity for asset {asset_code} reached {len(matching)} records between {start.created_time.isoformat()} and {matching[-1].created_time.isoformat()}, meeting the configured minimum of {minimum} alerts in a {window.total_seconds() / 3600:g}-hour window. Repetition may indicate unresolved underlying activity and is not a root-cause conclusion.',
                [EvidenceCandidate('ASSET', asset_code, f'Asset involved in repeated alert activity: {asset_code}.')] + [_alert_evidence(item, f'Related alert in the window: {item.alert_code}.') for item in matching],
            ))
            break
    return findings


def _fingerprint(notes: str | None) -> str:
    return re.sub(r'[^a-z0-9 ]', '', re.sub(r'\s+', ' ', (notes or '').lower())).strip()


def detect_eg005(investigations: list[Investigation], parameters: dict) -> list[FindingCandidate]:
    minimum = int(parameters.get('minimum_repetitions', 3))
    groups: dict[tuple[int, str], list[Investigation]] = defaultdict(list)
    for investigation in investigations:
        fingerprint = _fingerprint(investigation.notes)
        if fingerprint:
            groups[(investigation.cse_id, fingerprint)].append(investigation)
    findings = []
    for (cse_id, fingerprint), group in groups.items():
        if len(group) < minimum:
            continue
        ids = ', '.join(item.investigation_code for item in group)
        findings.append(FindingCandidate(
            'EG-005', cse_id, 'MEDIUM',
            'Repeated investigation narrative pattern detected; manual review recommended',
            f'The same normalized investigation narrative appears in {len(group)} investigations.',
            f'After lowercasing, whitespace normalization, and removal of trivial punctuation, the same investigation note fingerprint appears in {len(group)} investigations: {ids}. This deterministic repetition signal recommends manual review and does not establish template misuse.',
            [EvidenceCandidate('INVESTIGATION', item.investigation_code, 'Investigation shares a repeated normalized narrative pattern.') for item in group],
        ))
    return findings


def detect_eg006(db: Session, alerts: list[Alert], investigations: list[Investigation], parameters: dict) -> list[FindingCandidate]:
    minimum_alerts = int(parameters.get('minimum_alerts', 5))
    quick_thresholds = {'HIGH': parameters.get('high_minutes', 10), 'CRITICAL': parameters.get('critical_minutes', 15)}
    by_cse: dict[int, list[Alert]] = defaultdict(list)
    for alert in alerts:
        if alert.severity in quick_thresholds:
            by_cse[alert.cse_id].append(alert)
    findings = []
    for cse_id, items in by_cse.items():
        if len(items) < minimum_alerts:
            continue
        quick = [item for item in items if item.closed_time and _minutes(item.created_time, item.closed_time) < quick_thresholds[item.severity]]
        acknowledged = [item for item in items if item.acknowledged_time]
        covered = 0
        for alert in items:
            case_ids = db.scalars(select(CaseAlertLink.case_id).where(CaseAlertLink.alert_id == alert.id)).all()
            if case_ids and db.scalar(select(Investigation.id).where(Investigation.case_id.in_(case_ids))) is not None:
                covered += 1
        quick_ratio = len(quick) / len(items)
        ack_ratio = len(acknowledged) / len(items)
        coverage_ratio = covered / len(items)
        indicators = [quick_ratio >= parameters.get('quick_closure_ratio', 0.5), ack_ratio >= parameters.get('acknowledgement_rate', 0.9), coverage_ratio < parameters.get('investigation_coverage', 0.5)]
        if sum(indicators) < 2:
            continue
        examples = items[:10]
        findings.append(FindingCandidate(
            'EG-006', cse_id, 'HIGH',
            'POSSIBLE KPI / METRIC GAMING SIGNAL',
            'Multiple operational indicators combine into a possible KPI or metric gaming signal.',
            f'For this CSE, {quick_ratio:.0%} of applicable alerts were closed below the configured quick-closure thresholds, {ack_ratio:.0%} were acknowledged, and investigation coverage was {coverage_ratio:.0%}. At least two configured indicators were present. This is a possible KPI / metric gaming signal requiring manual review, not confirmed KPI gaming.',
            [_alert_evidence(item, f'Operational sample for composite signal: {item.alert_code}.') for item in examples],
        ))
    return findings
