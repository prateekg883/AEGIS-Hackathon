export const cseData = [
  { id: 'CSE-07', sector: 'Energy', criticality: 'Critical Infrastructure', score: 77, color: '#c14b48', level: 'HIGH', findings: 8, samples: 7, lastAssessment: '18 Jun 2026' },
  { id: 'CSE-02', sector: 'Finance', criticality: 'Critical Infrastructure', score: 68, color: '#c88a35', level: 'HIGH', findings: 6, samples: 5, lastAssessment: '17 Jun 2026' },
  { id: 'CSE-04', sector: 'Transport', criticality: 'High', score: 54, color: '#c88a35', level: 'MEDIUM', findings: 5, samples: 4, lastAssessment: '16 Jun 2026' },
  { id: 'CSE-01', sector: 'Telecommunications', criticality: 'Critical Infrastructure', score: 43, color: '#4f8c82', level: 'MEDIUM', findings: 4, samples: 3, lastAssessment: '15 Jun 2026' },
  { id: 'CSE-06', sector: 'Defence', criticality: 'Critical Infrastructure', score: 31, color: '#4f8c82', level: 'LOW', findings: 3, samples: 2, lastAssessment: '14 Jun 2026' },
  { id: 'CSE-03', sector: 'Healthcare', criticality: 'High', score: 26, color: '#4f8c82', level: 'LOW', findings: 4, samples: 2, lastAssessment: '13 Jun 2026' },
  { id: 'CSE-05', sector: 'Water', criticality: 'High', score: 19, color: '#4f8c82', level: 'LOW', findings: 4, samples: 1, lastAssessment: '12 Jun 2026' },
  { id: 'CSE-08', sector: 'Government', criticality: 'High', score: 15, color: '#4f8c82', level: 'LOW', findings: 3, samples: 0, lastAssessment: '11 Jun 2026' },
];

export const attentionBreakdown = [
  { label: 'Critical alerts without escalation', value: 22 },
  { label: 'Unusually fast case closures', value: 18 },
  { label: 'Missing investigation evidence', value: 16 },
  { label: 'Peer deviation', value: 12 },
  { label: 'Unresolved workload', value: 9 },
];

export const trendData = [
  { period: 'Jan', score: 43 }, { period: 'Feb', score: 48 }, { period: 'Mar', score: 52 },
  { period: 'Apr', score: 61 }, { period: 'May', score: 70 }, { period: 'Jun', score: 77 },
];

export const categoryData = [
  { name: 'Execution Gap', value: 14 },
  { name: 'Negative Space', value: 8 },
  { name: 'Operational Anomaly', value: 7 },
  { name: 'Peer Deviation', value: 8 },
];

export const findings = [
  { id: 'FND-001', cse: 'CSE-07', category: 'Execution Gap', title: 'Critical alerts closed without documented escalation', severity: 'Critical', confidence: 96, occurrences: 27, contribution: 22, status: 'Open', explanation: 'Critical alerts were closed without a corresponding escalation record in the assessment period.', expected: 'Critical alerts should have a documented escalation or supervisory disposition before closure.', observed: '27 critical alerts were closed while no escalation record could be linked to the alert.', impact: 'Supervisors may be unable to verify whether material events received the required level of review.', rule: 'Critical closure escalation check', ruleId: 'EXE-ESC-001', version: '1.2' },
  { id: 'FND-002', cse: 'CSE-07', category: 'Operational Anomaly', title: 'Case closure velocity is significantly above peer baseline', severity: 'High', confidence: 89, occurrences: 41, contribution: 18, status: 'Open', explanation: 'The median time to close selected cases is materially lower than the comparable peer group.', expected: 'Case closure times should be consistent with investigation complexity and peer operating context.', observed: 'The median closure time was 11 minutes compared with a peer median of 47 minutes.', impact: 'Rapid closure may indicate incomplete investigation or insufficient documentation.', rule: 'Closure velocity deviation', ruleId: 'ANO-CLS-002', version: '1.0' },
  { id: 'FND-003', cse: 'CSE-07', category: 'Execution Gap', title: 'Investigation evidence is incomplete for closed cases', severity: 'High', confidence: 91, occurrences: 38, contribution: 16, status: 'Open', explanation: 'A material share of closed investigations does not include the expected supporting evidence.', expected: 'Closed investigations should retain evidence supporting analysis, decision, and outcome.', observed: 'Evidence completion was 61%, below the peer median of 88%.', impact: 'The supervisory record may not support reconstruction of investigative decisions.', rule: 'Investigation evidence completeness', ruleId: 'EXE-EVD-003', version: '1.1' },
  { id: 'FND-004', cse: 'CSE-07', category: 'Negative Space', title: 'Three critical assets lack recent telemetry evidence', severity: 'High', confidence: 87, occurrences: 3, contribution: 12, status: 'Open', explanation: 'Expected monitoring evidence is absent for three critical assets during the assessment period.', expected: 'All critical assets should produce or have documented monitoring evidence.', observed: '45 of 48 critical assets had recent telemetry activity.', impact: 'Unobserved assets create a monitoring blind spot requiring manual validation.', rule: 'Critical asset coverage gap', ruleId: 'NEG-AST-004', version: '1.0' },
  { id: 'FND-005', cse: 'CSE-02', category: 'Peer Deviation', title: 'Critical escalation rate is below peer baseline', severity: 'Medium', confidence: 82, occurrences: 1, contribution: 12, status: 'Open', explanation: 'The critical escalation rate is significantly below the matched peer baseline.', expected: 'Escalation patterns should be explainable in the context of alert severity and operating model.', observed: 'The critical escalation rate was 19% against a peer median of 44%.', impact: 'The deviation warrants review of escalation criteria and record completeness.', rule: 'Peer escalation deviation', ruleId: 'PEER-ESC-005', version: '1.0' },
];

export const evidence = [
  { id: 'ALT-88421', type: 'Alert', finding: 'FND-001', cse: 'CSE-07', severity: 'Critical', alertType: 'Suspicious privileged access', asset: 'EN-SCADA-01', created: '18 Jun 2026 08:42', closed: '18 Jun 2026 08:53', disposition: 'Closed - no escalation', analyst: 'A. Sharma', escalated: 'No' },
  { id: 'ALT-88419', type: 'Alert', finding: 'FND-001', cse: 'CSE-07', severity: 'Critical', alertType: 'Unusual outbound transfer', asset: 'EN-GRID-02', created: '18 Jun 2026 08:19', closed: '18 Jun 2026 08:27', disposition: 'Closed - no escalation', analyst: 'R. Iyer', escalated: 'No' },
  { id: 'CAS-33108', type: 'Case', finding: 'FND-002', cse: 'CSE-07', severity: 'High', alertType: 'Multi-alert investigation', asset: 'EN-SCADA-03', created: '17 Jun 2026 11:05', closed: '17 Jun 2026 11:16', disposition: 'Closed - monitored', analyst: 'A. Sharma', escalated: 'No' },
  { id: 'INV-7712', type: 'Investigation', finding: 'FND-003', cse: 'CSE-07', severity: 'High', alertType: 'Evidence review', asset: 'EN-GRID-02', created: '17 Jun 2026 10:14', closed: '17 Jun 2026 10:35', disposition: 'Partial evidence', analyst: 'R. Iyer', escalated: 'No' },
  { id: 'AST-EN04', type: 'Asset', finding: 'FND-004', cse: 'CSE-07', severity: 'High', alertType: 'Monitoring coverage', asset: 'EN-SCADA-04', created: '18 Jun 2026', closed: 'Not observed', disposition: 'Review required', analyst: 'Unassigned', escalated: 'No' },
];

export const assets = [
  { id: 'EN-SCADA-04', criticality: 'Critical', expected: 'Continuous monitoring', last: '19 May 2026', gap: '30 days', status: 'REVIEW' },
  { id: 'EN-GRID-07', criticality: 'Critical', expected: 'Continuous monitoring', last: '02 Jun 2026', gap: '16 days', status: 'REVIEW' },
  { id: 'EN-OT-12', criticality: 'High', expected: 'Daily monitoring', last: '12 Jun 2026', gap: '6 days', status: 'REVIEW' },
];

export const samples = [
  { rank: 1, record: 'ALT-88421', cse: 'CSE-07', type: 'Alert', score: 96, severity: 'Critical', reason: 'Critical alert closed without escalation record', finding: 'FND-001' },
  { rank: 2, record: 'CAS-33108', cse: 'CSE-07', type: 'Case', score: 88, severity: 'High', reason: 'Case closure time is materially below peer baseline', finding: 'FND-002' },
  { rank: 3, record: 'INV-7712', cse: 'CSE-07', type: 'Investigation', score: 83, severity: 'High', reason: 'Closed investigation has partial evidence', finding: 'FND-003' },
  { rank: 4, record: 'AST-EN04', cse: 'CSE-07', type: 'Asset', score: 78, severity: 'High', reason: 'Critical asset has no recent monitoring evidence', finding: 'FND-004' },
];

export const peerMetrics = [
  { label: 'Critical escalation rate', cse: '11%', peer: '48%', cseValue: 11, peerValue: 48 },
  { label: 'Evidence completion', cse: '61%', peer: '88%', cseValue: 61, peerValue: 88 },
  { label: 'Unresolved case ratio', cse: '14%', peer: '6%', cseValue: 14, peerValue: 6 },
  { label: 'Median closure time', cse: '11 min', peer: '47 min', cseValue: 11, peerValue: 47 },
];
