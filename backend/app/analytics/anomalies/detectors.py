from dataclasses import dataclass
from statistics import mean, stdev
from typing import Any


@dataclass
class MetricSnapshot:
    name: str
    value: float
    unit: str
    description: str


@dataclass
class AnomalyCandidate:
    rule_code: str
    severity: str
    title: str
    description: str
    explanation: str
    evidence_summary: str


def z_score(value: float, baseline: list[float]) -> float | None:
    if len(baseline) < 2:
        return None
    deviation = stdev(baseline)
    return (value - mean(baseline)) / deviation if deviation else None


def detect_volume_anomalies(current: dict[str, float], history: list[dict[str, float]], threshold: float, minimum_history: int) -> list[AnomalyCandidate]:
    if len(history) < minimum_history:
        return []
    findings = []
    for metric_name, label in (('alerts', 'alert'), ('cases', 'case')):
        baseline = [period[metric_name] for period in history]
        score = z_score(current[metric_name], baseline)
        if score is None or abs(score) < threshold:
            continue
        direction = 'high' if score > 0 else 'low'
        findings.append(AnomalyCandidate('AN-001', 'MEDIUM', f'Unusually {direction} {label} volume submitted', f'{label.title()} volume differs materially from the CSE historical baseline.', f'Submitted {label} volume for the selected period is {current[metric_name]:g}; historical periods contain {baseline}. The calculated z-score is {score:.2f}, exceeding the configured threshold of {threshold:g}. This is an unusual-activity signal, not a conclusion about cause.', f'Metric={metric_name}; entity value={current[metric_name]:g}; historical baseline={baseline}; z-score={score:.2f}; threshold={threshold:g}.'))
    return findings


def detect_ratio_anomaly(current_ratio: float, history_ratios: list[float], threshold: float, minimum_history: int) -> AnomalyCandidate | None:
    if len(history_ratios) < minimum_history:
        return None
    score = z_score(current_ratio, history_ratios)
    if score is None or abs(score) < threshold:
        return None
    return AnomalyCandidate('AN-002', 'MEDIUM', 'Alert-to-case ratio differs from historical baseline', f'The selected alert-to-case ratio of {current_ratio:.2f} differs materially from the CSE historical baseline.', f'The selected period has an alert-to-case ratio of {current_ratio:.2f}; historical ratios are {[round(item, 2) for item in history_ratios]}. The z-score is {score:.2f}, exceeding {threshold:g}. This indicates unusual conversion behavior and does not establish a control failure.', f'Metric=alert_to_case_ratio; entity value={current_ratio:.2f}; historical baseline={history_ratios}; z-score={score:.2f}; threshold={threshold:g}.')


def detect_closure_anomaly(current_median: float | None, history_medians: list[float], threshold: float, minimum_history: int) -> AnomalyCandidate | None:
    if current_median is None or len(history_medians) < minimum_history:
        return None
    score = z_score(current_median, history_medians)
    if score is None or abs(score) < threshold:
        return None
    return AnomalyCandidate('AN-003', 'MEDIUM', 'Alert closure behavior differs from historical baseline', f'Median closed-alert duration of {current_median:.1f} minutes differs materially from the CSE historical baseline.', f'The selected period median closure duration is {current_median:.1f} minutes; historical medians are {[round(item, 1) for item in history_medians]}. The z-score is {score:.2f}, exceeding {threshold:g}. This is an unusual closure-behavior signal and requires context.', f'Metric=median_closure_minutes; entity value={current_median:.1f}; historical baseline={history_medians}; z-score={score:.2f}; threshold={threshold:g}.')
