RULE_DEFINITIONS = {
    'AN-001': {
        'name': 'Operational volume deviates from entity baseline',
        'description': 'Flags alert or case volume that materially differs from the same CSE historical baseline.',
        'severity': 'MEDIUM',
        'parameters': {'z_score_threshold': 2.0, 'minimum_history_periods': 2},
    },
    'AN-002': {
        'name': 'Alert-to-case ratio deviates from entity baseline',
        'description': 'Flags an alert-to-case conversion ratio that materially differs from historical behavior.',
        'severity': 'MEDIUM',
        'parameters': {'z_score_threshold': 2.0, 'minimum_history_periods': 2},
    },
    'AN-003': {
        'name': 'Closure behavior deviates from entity baseline',
        'description': 'Flags median closed-alert duration that materially differs from historical behavior.',
        'severity': 'MEDIUM',
        'parameters': {'z_score_threshold': 2.0, 'minimum_history_periods': 2},
    },
}
