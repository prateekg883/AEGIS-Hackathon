RULE_DEFINITIONS = {
    'NS-001': {
        'name': 'Missing monitoring / telemetry evidence for critical assets',
        'description': 'Flags critical monitored assets with no submitted alert evidence in the assessment period.',
        'severity': 'HIGH',
        'parameters': {'criticalities': ['CRITICAL']},
    },
    'NS-002': {
        'name': 'Expected alert category absence',
        'description': 'Flags configured expected alert categories with zero submitted alerts in the assessment period.',
        'severity': 'MEDIUM',
        'parameters': {'expected_categories': ['MALWARE', 'AUTHENTICATION', 'NETWORK', 'PRIVILEGED_ACCESS']},
    },
    'NS-003': {
        'name': 'Missing investigation evidence',
        'description': 'Flags applicable high-severity alerts with no submitted case or investigation evidence.',
        'severity': 'HIGH',
        'parameters': {'applicable_severities': ['HIGH', 'CRITICAL']},
    },
    'NS-004': {
        'name': 'Missing escalation evidence',
        'description': 'Flags applicable alerts where expected escalation evidence is absent from submitted records.',
        'severity': 'HIGH',
        'parameters': {'applicable_severities': ['CRITICAL']},
    },
    'NS-005': {
        'name': 'Unexpectedly low operational activity',
        'description': 'Flags a CSE with less than the configured minimum submitted activity for the assessment period.',
        'severity': 'MEDIUM',
        'parameters': {'minimum_alerts_per_period': 1, 'minimum_cases_per_period': 1, 'minimum_investigations_per_period': 1},
    },
}
