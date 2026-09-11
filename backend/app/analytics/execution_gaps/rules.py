RULE_DEFINITIONS = {
    'EG-001': {
        'name': 'High-severity alert closed too quickly',
        'description': 'Flags high or critical alerts closed below a configurable duration threshold.',
        'severity': 'HIGH',
        'weight': 1.0,
        'parameters': {'high_minutes': 10, 'critical_minutes': 15},
    },
    'EG-002': {
        'name': 'Acknowledged alert without meaningful investigation',
        'description': 'Flags applicable acknowledged alerts without a meaningful downstream case investigation.',
        'severity': 'HIGH',
        'weight': 1.0,
        'parameters': {'applicable_severities': ['HIGH', 'CRITICAL']},
    },
    'EG-003': {
        'name': 'Critical alert closed without escalation',
        'description': 'Flags closed critical alerts for which no escalation evidence is available.',
        'severity': 'CRITICAL',
        'weight': 1.0,
        'parameters': {},
    },
    'EG-004': {
        'name': 'Repeated alerts on same asset',
        'description': 'Flags repeated alert activity on one asset within a configurable window.',
        'severity': 'MEDIUM',
        'weight': 1.0,
        'parameters': {'minimum_alerts': 5, 'window_hours': 24},
    },
    'EG-005': {
        'name': 'Repetitive investigation pattern',
        'description': 'Flags identical normalized investigation narratives repeated across investigations.',
        'severity': 'MEDIUM',
        'weight': 1.0,
        'parameters': {'minimum_repetitions': 3},
    },
    'EG-006': {
        'name': 'Possible KPI / metric gaming signal',
        'description': 'Combines multiple simple operational indicators into a cautious manual-review signal.',
        'severity': 'HIGH',
        'weight': 1.0,
        'parameters': {'quick_closure_ratio': 0.5, 'acknowledgement_rate': 0.9, 'investigation_coverage': 0.5, 'minimum_alerts': 5},
    },
}
