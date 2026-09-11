export const assessmentPeriod = 'Q2 2026';

export const cseEntities = [
  { id: 'CSE-01', name: 'Strategic Telecom Services', sector: 'Telecommunications', score: 43, level: 'MEDIUM', findings: 2, samples: 2, status: 'Assessed', lastAssessment: '15 Jun 2026', execution_gap_score: 17, negative_space_score: 12, peer_deviation_score: 8, anomaly_score: 6 },
  { id: 'CSE-02', name: 'Critical Finance Services', sector: 'Finance', score: 46, level: 'MEDIUM', findings: 2, samples: 3, status: 'Assessed', lastAssessment: '17 Jun 2026', execution_gap_score: 18, negative_space_score: 13, peer_deviation_score: 8, anomaly_score: 7 },
  { id: 'CSE-03', name: 'National Transport Grid', sector: 'Transport', score: 71, level: 'HIGH', findings: 3, samples: 4, status: 'Assessed', lastAssessment: '16 Jun 2026', execution_gap_score: 28, negative_space_score: 20, peer_deviation_score: 13, anomaly_score: 10 },
  { id: 'CSE-04', name: 'Public Health Exchange', sector: 'Healthcare', score: 34, level: 'LOW', findings: 1, samples: 2, status: 'Assessed', lastAssessment: '14 Jun 2026', execution_gap_score: 13, negative_space_score: 10, peer_deviation_score: 6, anomaly_score: 5 },
  { id: 'CSE-05', name: 'Industrial Control Services', sector: 'Manufacturing', score: 58, level: 'MEDIUM', findings: 2, samples: 3, status: 'Assessed', lastAssessment: '13 Jun 2026', execution_gap_score: 23, negative_space_score: 17, peer_deviation_score: 10, anomaly_score: 8 },
  { id: 'CSE-06', name: 'National Water Utilities', sector: 'Water', score: 29, level: 'LOW', findings: 1, samples: 1, status: 'Assessed', lastAssessment: '12 Jun 2026', execution_gap_score: 11, negative_space_score: 8, peer_deviation_score: 6, anomaly_score: 4 },
  { id: 'CSE-07', name: 'National Energy Systems', sector: 'Energy', score: 77, level: 'HIGH', findings: 4, samples: 6, status: 'Assessed', lastAssessment: '18 Jun 2026', execution_gap_score: 30, negative_space_score: 22, peer_deviation_score: 14, anomaly_score: 11 },
  { id: 'CSE-08', name: 'Strategic Defence Network', sector: 'Defence', score: 22, level: 'LOW', findings: 1, samples: 1, status: 'Assessed', lastAssessment: '11 Jun 2026', execution_gap_score: 9, negative_space_score: 6, peer_deviation_score: 4, anomaly_score: 3 },
];

export const alerts = [
  { id: 'ALT-1092', cse: 'CSE-07', severity: 'Critical', type: 'Suspicious privileged access', asset: 'EN-SCADA-01', created: '18 Jun 2026 08:42', acknowledged: '18 Jun 2026 08:45', closed: '18 Jun 2026 08:53', status: 'Closed', caseId: 'CASE-284', escalationId: null, analyst: 'A. Sharma' },
  { id: 'ALT-1093', cse: 'CSE-07', severity: 'High', type: 'Unusual outbound transfer', asset: 'EN-GRID-02', created: '18 Jun 2026 09:12', acknowledged: '18 Jun 2026 09:20', closed: null, status: 'Open', caseId: 'CASE-285', escalationId: 'ESC-193', analyst: 'R. Iyer' },
  { id: 'ALT-1076', cse: 'CSE-03', severity: 'High', type: 'Endpoint policy deviation', asset: 'TR-OPS-14', created: '16 Jun 2026 13:06', acknowledged: '16 Jun 2026 13:20', closed: '16 Jun 2026 16:42', status: 'Closed', caseId: 'CASE-276', escalationId: 'ESC-188', analyst: 'M. Das' },
  { id: 'ALT-1081', cse: 'CSE-05', severity: 'Medium', type: 'Admin account anomaly', asset: 'IC-CONTROL-04', created: '15 Jun 2026 10:18', acknowledged: '15 Jun 2026 10:31', closed: '15 Jun 2026 15:12', status: 'Closed', caseId: 'CASE-279', escalationId: null, analyst: 'K. Menon' },
  { id: 'ALT-1065', cse: 'CSE-02', severity: 'High', type: 'Authentication threshold', asset: 'FIN-CORE-08', created: '14 Jun 2026 17:04', acknowledged: '14 Jun 2026 17:11', closed: '15 Jun 2026 09:22', status: 'Closed', caseId: 'CASE-271', escalationId: 'ESC-181', analyst: 'P. Rao' },
];

export const cases = [
  { id: 'CASE-284', cse: 'CSE-07', alertIds: ['ALT-1092'], severity: 'Critical', opened: '18 Jun 2026 08:45', closed: '18 Jun 2026 08:53', status: 'Closed', closureMinutes: 8, investigationId: 'INV-771', escalationId: null, analyst: 'A. Sharma', closureReason: 'Closed after validation' },
  { id: 'CASE-285', cse: 'CSE-07', alertIds: ['ALT-1093'], severity: 'High', opened: '18 Jun 2026 09:20', closed: null, status: 'Open', closureMinutes: null, investigationId: 'INV-772', escalationId: 'ESC-193', analyst: 'R. Iyer', closureReason: null },
  { id: 'CASE-276', cse: 'CSE-03', alertIds: ['ALT-1076'], severity: 'High', opened: '16 Jun 2026 13:20', closed: '16 Jun 2026 16:42', status: 'Closed', closureMinutes: 202, investigationId: 'INV-768', escalationId: 'ESC-188', analyst: 'M. Das', closureReason: 'Policy exception documented' },
  { id: 'CASE-271', cse: 'CSE-02', alertIds: ['ALT-1065'], severity: 'High', opened: '14 Jun 2026 17:11', closed: '15 Jun 2026 09:22', status: 'Closed', closureMinutes: 977, investigationId: 'INV-764', escalationId: 'ESC-181', analyst: 'P. Rao', closureReason: 'Credential reset completed' },
];

export const investigations = [
  { id: 'INV-771', caseId: 'CASE-284', cse: 'CSE-07', started: '18 Jun 2026 08:46', completed: '18 Jun 2026 08:52', status: 'Partial', evidenceCount: 1, outcome: 'Access verified; closure evidence incomplete', analyst: 'A. Sharma' },
  { id: 'INV-772', caseId: 'CASE-285', cse: 'CSE-07', started: '18 Jun 2026 09:22', completed: null, status: 'In progress', evidenceCount: 2, outcome: 'Pending review', analyst: 'R. Iyer' },
  { id: 'INV-768', caseId: 'CASE-276', cse: 'CSE-03', started: '16 Jun 2026 13:30', completed: '16 Jun 2026 16:35', status: 'Complete', evidenceCount: 4, outcome: 'Policy exception confirmed', analyst: 'M. Das' },
  { id: 'INV-764', caseId: 'CASE-271', cse: 'CSE-02', started: '14 Jun 2026 17:15', completed: '15 Jun 2026 09:15', status: 'Complete', evidenceCount: 5, outcome: 'Credential misuse not confirmed', analyst: 'P. Rao' },
];

export const escalations = [
  { id: 'ESC-193', caseId: 'CASE-285', alertId: 'ALT-1093', cse: 'CSE-07', level: 'L2', status: 'Open', reason: 'High severity transfer requires supervisory review', created: '18 Jun 2026 09:24', owner: 'Duty supervisor' },
  { id: 'ESC-188', caseId: 'CASE-276', alertId: 'ALT-1076', cse: 'CSE-03', level: 'L2', status: 'Resolved', reason: 'Policy exception required approval', created: '16 Jun 2026 13:41', owner: 'Transport supervisor' },
  { id: 'ESC-181', caseId: 'CASE-271', alertId: 'ALT-1065', cse: 'CSE-02', level: 'L1', status: 'Resolved', reason: 'Authentication threshold exceeded', created: '14 Jun 2026 17:18', owner: 'Finance supervisor' },
];

export const findings = [
  { id: 'FND-042', cse: 'CSE-07', category: 'Execution Gap', title: 'Critical alert closed without escalation', severity: 'Critical', status: 'Open', detectedDate: '18 Jun 2026', contribution: 22, confidence: 96, evidenceCount: 2, explanation: 'The alert was classified as Critical but the associated case was closed without a corresponding escalation record. Closure occurred 8 minutes after acknowledgement.', expected: 'Critical alerts should have a documented escalation or supervisory disposition before closure.', observed: 'ALT-1092 was acknowledged at 08:45 and closed at 08:53 with no escalation linked to CASE-284.', impact: 'Supervisors may be unable to verify whether a material event received the required review.', rule: 'Critical closure escalation check', alertIds: ['ALT-1092'], caseIds: ['CASE-284'], investigationIds: ['INV-771'], escalationIds: [] },
  { id: 'FND-043', cse: 'CSE-07', category: 'Anomaly', title: 'Case closure velocity is below expected complexity baseline', severity: 'High', status: 'Under Review', detectedDate: '18 Jun 2026', contribution: 18, confidence: 89, evidenceCount: 2, explanation: 'The selected critical case closed materially faster than the matched peer context for comparable investigations.', expected: 'Closure time should be consistent with investigation complexity and documented operating context.', observed: 'CASE-284 closed in 8 minutes after acknowledgement while the peer median is 42 minutes.', impact: 'Rapid closure warrants manual review of investigative completeness.', rule: 'Closure velocity deviation', alertIds: ['ALT-1092'], caseIds: ['CASE-284'], investigationIds: ['INV-771'], escalationIds: [] },
  { id: 'FND-044', cse: 'CSE-07', category: 'Execution Gap', title: 'Investigation evidence is incomplete for a closed case', severity: 'High', status: 'Open', detectedDate: '18 Jun 2026', contribution: 16, confidence: 91, evidenceCount: 1, explanation: 'The closed investigation contains an outcome but does not retain the expected supporting evidence set.', expected: 'Closed investigations should retain evidence for analysis, decision, and outcome.', observed: 'INV-771 has one linked evidence item and is marked Partial.', impact: 'The supervisory record may not support reconstruction of the investigative decision.', rule: 'Investigation evidence completeness', alertIds: ['ALT-1092'], caseIds: ['CASE-284'], investigationIds: ['INV-771'], escalationIds: [] },
  { id: 'FND-045', cse: 'CSE-03', category: 'Negative Space', title: 'Expected escalation record absent for a high severity alert', severity: 'High', status: 'Open', detectedDate: '16 Jun 2026', contribution: 15, confidence: 87, evidenceCount: 1, explanation: 'A high severity alert was closed without an escalation record in the available assessment records.', expected: 'High severity alerts should have a linked escalation or documented supervisory exception.', observed: 'ALT-1076 has a linked escalation, but one related record in the cohort has no escalation reference.', impact: 'Missing workflow records reduce confidence in the completeness of supervisory evidence.', rule: 'Escalation record coverage', alertIds: ['ALT-1076'], caseIds: ['CASE-276'], investigationIds: ['INV-768'], escalationIds: ['ESC-188'] },
  { id: 'FND-046', cse: 'CSE-05', category: 'Peer Deviation', title: 'Critical escalation rate is below peer baseline', severity: 'Medium', status: 'Under Review', detectedDate: '13 Jun 2026', contribution: 9, confidence: 82, evidenceCount: 1, explanation: 'Escalation activity is lower than the matched peer context and requires operating-model review.', expected: 'Escalation patterns should be explainable in the context of severity and operating model.', observed: 'CSE-05 critical escalation rate is 11% against a peer median of 23%.', impact: 'The deviation warrants review of criteria and record completeness.', rule: 'Peer escalation deviation', alertIds: ['ALT-1081'], caseIds: ['CASE-279'], investigationIds: [], escalationIds: [] },
];

export const evidence = [
  { id: 'EVD-551', findingId: 'FND-042', recordType: 'Alert', recordId: 'ALT-1092', cse: 'CSE-07', timestamp: '18 Jun 2026 08:53', summary: 'Critical privileged-access alert closed eight minutes after acknowledgement without escalation.' },
  { id: 'EVD-552', findingId: 'FND-042', recordType: 'Case', recordId: 'CASE-284', cse: 'CSE-07', timestamp: '18 Jun 2026 08:53', summary: 'Case closure record contains no escalation reference.' },
  { id: 'EVD-553', findingId: 'FND-043', recordType: 'Investigation', recordId: 'INV-771', cse: 'CSE-07', timestamp: '18 Jun 2026 08:52', summary: 'Investigation outcome is present, but supporting evidence set is marked partial.' },
  { id: 'EVD-554', findingId: 'FND-044', recordType: 'Investigation', recordId: 'INV-771', cse: 'CSE-07', timestamp: '18 Jun 2026 08:52', summary: 'One evidence item attached to a closed investigation expected to contain three.' },
  { id: 'EVD-555', findingId: 'FND-045', recordType: 'Escalation', recordId: 'ESC-188', cse: 'CSE-03', timestamp: '16 Jun 2026 13:41', summary: 'Escalation exists for the sample record; cohort review identified a coverage exception.' },
  { id: 'EVD-556', findingId: 'FND-046', recordType: 'Alert', recordId: 'ALT-1081', cse: 'CSE-05', timestamp: '15 Jun 2026 15:12', summary: 'Closed medium-severity alert contributes to a lower-than-peer escalation pattern.' },
];

export const assets = [
  { id: 'EN-SCADA-04', cse: 'CSE-07', criticality: 'Critical', observation: 'Critical asset has no observed monitoring activity.', expected: 'Recent monitoring evidence for every critical asset.', observed: 'No activity recorded since 19 May 2026.', severity: 'High', evidenceId: 'EVD-557' },
  { id: 'TR-OPS-21', cse: 'CSE-03', criticality: 'High', observation: 'Expected authentication alert category is absent.', expected: 'Authentication anomalies should appear in the assessment records.', observed: 'No matching alert category observed in Q2 sample.', severity: 'Medium', evidenceId: 'EVD-558' },
  { id: 'IC-CONTROL-09', cse: 'CSE-05', criticality: 'High', observation: 'Investigation record is missing for one closed case.', expected: 'Every closed case should link to an investigation record.', observed: 'CASE-279 has no complete investigation reference.', severity: 'High', evidenceId: 'EVD-559' },
];

export const peerMetrics = [
  { label: 'Critical escalation rate', value: '11%', average: '26%', median: '23%', percentile: '18th', deviation: '-12 pp', cseValue: 11, peerValue: 23 },
  { label: 'Median case closure time', value: '8 min', average: '46 min', median: '42 min', percentile: '12th', deviation: '-34 min', cseValue: 8, peerValue: 42 },
  { label: 'Investigation completeness', value: '61%', average: '85%', median: '88%', percentile: '19th', deviation: '-27 pp', cseValue: 61, peerValue: 88 },
  { label: 'Alert acknowledgement rate', value: '94%', average: '91%', median: '92%', percentile: '64th', deviation: '+2 pp', cseValue: 94, peerValue: 92 },
  { label: 'Unresolved case percentage', value: '14%', average: '8%', median: '6%', percentile: '81st', deviation: '+8 pp', cseValue: 14, peerValue: 6 },
];

export const prioritisedSamples = [
  { rank: 1, recordId: 'ALT-1092', recordType: 'Alert', cse: 'CSE-07', priority: 94, severity: 'Critical', status: 'Pending review', reason: 'Critical alert closed in 8 minutes without escalation.', findingId: 'FND-042' },
  { rank: 2, recordId: 'INV-771', recordType: 'Investigation', cse: 'CSE-07', priority: 88, severity: 'High', status: 'Pending review', reason: 'Closed investigation contains partial evidence.', findingId: 'FND-044' },
  { rank: 3, recordId: 'CASE-284', recordType: 'Case', cse: 'CSE-07', priority: 84, severity: 'Critical', status: 'Pending review', reason: 'Case closure context does not contain an escalation reference.', findingId: 'FND-043' },
  { rank: 4, recordId: 'IC-CONTROL-09', recordType: 'Asset', cse: 'CSE-05', priority: 76, severity: 'High', status: 'Pending review', reason: 'Closed case has no complete investigation record.', findingId: 'FND-046' },
];

export const trendData = [
  { period: 'Jan', score: 49 }, { period: 'Feb', score: 53 }, { period: 'Mar', score: 57 }, { period: 'Apr', score: 63 }, { period: 'May', score: 70 }, { period: 'Jun', score: 77 },
];

export const attentionBreakdown = [
  { label: 'Execution Gap', value: 22 }, { label: 'Negative Space', value: 16 }, { label: 'Anomaly', value: 18 }, { label: 'Peer Deviation', value: 12 }, { label: 'Other', value: 9 },
];

cseEntities.forEach((cse) => { cse.criticality = 'Critical Infrastructure'; });
findings.forEach((finding) => { finding.occurrences = finding.evidenceCount; finding.ruleId = finding.id; finding.version = '1.0'; });
evidence.forEach((item) => { item.type = item.recordType; item.finding = item.findingId; item.asset = item.recordId; item.alertType = item.summary; item.created = item.timestamp; item.closed = 'See source record'; item.disposition = item.summary; item.analyst = 'Supervisory record'; item.escalated = 'See linked escalation'; });
assets.forEach((asset) => { asset.last = asset.observed; asset.gap = 'Review'; asset.status = 'REVIEW'; });
prioritisedSamples.forEach((sample) => { sample.record = sample.recordId; sample.score = sample.priority; sample.finding = sample.findingId; });
peerMetrics.forEach((metric) => { metric.cse = metric.value; metric.peer = metric.median; });

export const cseData = cseEntities;
export const samples = prioritisedSamples;
export const categoryData = attentionBreakdown.map(({ label: name, value }) => ({ name, value }));
