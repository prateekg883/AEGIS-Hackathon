RULE_DEFINITIONS = {
    'PB-001': {'name': 'Material peer deviation', 'description': 'Flags a metric materially different from comparable CSEs in the same assessment period.', 'severity': 'MEDIUM', 'parameters': {'deviation_ratio': 0.5, 'minimum_peers': 2}},
}
