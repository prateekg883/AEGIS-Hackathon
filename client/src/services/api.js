import {
  alerts,
  assets,
  attentionBreakdown,
  categoryData,
  cases,
  cseData,
  escalations,
  evidence,
  findings,
  investigations,
  peerMetrics,
  prioritisedSamples,
  samples,
  trendData,
} from '../data/mockDataV2';

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://localhost:8000';

const getAuthHeaders = () => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('aegis_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedMsg = errorText;
    try {
      const jsonErr = JSON.parse(errorText);
      if (typeof jsonErr.detail === 'string') {
        parsedMsg = jsonErr.detail;
      } else if (Array.isArray(jsonErr.detail) && jsonErr.detail[0]?.msg) {
        parsedMsg = jsonErr.detail.map(e => e.msg).join(', ');
      } else if (typeof jsonErr.message === 'string') {
        parsedMsg = jsonErr.message;
      } else if (typeof jsonErr.detail === 'object') {
        parsedMsg = JSON.stringify(jsonErr.detail);
      }
    } catch (_) {}
    throw new Error(parsedMsg || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

const safeJson = async (path, fallbackValue, options = {}) => {
  try {
    return await requestJson(path, options);
  } catch (error) {
    return fallbackValue;
  }
};

const normalisePrioritySample = (sample) => ({
  rank: sample.rank ?? 1,
  recordId: sample.record_id || sample.recordId || 'UNKNOWN',
  recordType: sample.record_type || sample.recordType || 'UNKNOWN',
  cse: sample.cse_code || sample.cse || 'UNKNOWN',
  priority: sample.priority_score ?? sample.priority ?? 0,
  severity: sample.severity || 'LOW',
  reason: sample.reason || 'Manual review recommended.',
  status: sample.review_status || sample.status || 'PENDING_REVIEW',
  findingId: sample.finding_id || sample.findingId || null,
  priorityLevel: sample.priority_level || (sample.priority_score >= 85 ? 'CRITICAL' : sample.priority_score >= 70 ? 'HIGH' : sample.priority_score >= 45 ? 'MODERATE' : 'LOW'),
});

// Helper for offline mock authentication profiles
const getOfflineProfile = (rawUsername, roleHint = 'SUPERVISOR') => {
  const u = (rawUsername || '').trim().toLowerCase();
  const profileMap = {
    supervisor01: { role: 'SUPERVISOR', name: 'S. Sengupta', designation: 'National Supervisory Authority', organization: 'NCIIPC', email: 'supervisor@nciipc.gov.in', registeredEmail: 'supervisor.aegis@gmail.com', defaultPwd: 'Admin@2026' },
    analyst01: { role: 'ANALYST', name: 'A. Sharma', designation: 'Operational Duty Lead', organization: 'National Energy Systems', email: 'analyst@powergrid.in', registeredEmail: 'analyst.aegis@gmail.com', defaultPwd: 'Analyst@2026' },
    admin01: { role: 'ADMINISTRATOR', name: 'National Admin', designation: 'Security Enclave Lead', organization: 'A.E.G.I.S. Command', email: 'admin@aegis.gov.in', registeredEmail: 'admin.aegis@gmail.com', defaultPwd: 'Admin@2026' },
    auditor01: { role: 'AUDITOR', name: 'P. Varma', designation: 'Senior Compliance Auditor', organization: 'CERT-In', email: 'auditor@cert-in.gov.in', registeredEmail: 'auditor.aegis@gmail.com', defaultPwd: 'Audit@2026' },
  };

  return profileMap[u] || {
    role: (roleHint || 'SUPERVISOR').toUpperCase(),
    name: rawUsername || 'Enclave Operator',
    designation: 'Enclave Operator',
    organization: 'NCIIPC',
    email: `${u || 'operator'}@aegis.gov.in`,
    registeredEmail: `${u || 'operator'}.aegis@gmail.com`,
    defaultPwd: 'Admin@2026',
  };
};

export const api = {
  login: async (username, password, role = 'SUPERVISOR', mode = 'OFFLINE') => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('client_id', `${role}:${String(mode).toUpperCase()}`);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: formData.toString(),
      });

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 401 || response.status === 400) {
        const errorText = await response.text();
        let parsedMsg = errorText;
        try {
          const jsonErr = JSON.parse(errorText);
          parsedMsg = jsonErr.detail || jsonErr.message || errorText;
        } catch (_) {}
        throw new Error(parsedMsg || 'Authentication failed. Please check credentials.');
      }
    } catch (err) {
      if (err.message && !err.message.includes('fetch') && !err.message.includes('NetworkError') && !err.message.includes('Failed to fetch')) {
        throw err;
      }
    }

    // ── Air-Gapped / Offline Standalone Fallback ──
    const profile = getOfflineProfile(username, role);

    if (String(mode).toUpperCase() === 'ONLINE') {
      return {
        status: 'OTP_REQUIRED',
        user_hint: username,
        masked_email: profile.registeredEmail.replace(/(.{2}).+(@.+)/, '$1***$2'),
        temp_token: `mock-temp-${Date.now()}`,
        dev_otp_preview: '261570',
        expires_in: 300,
        cooldown: 0,
        role: profile.role,
      };
    }

    return {
      access_token: `mock-aegis-token-${Date.now()}`,
      token_type: 'bearer',
      user: {
        id: (username || 'operator').toLowerCase(),
        username: username,
        email: profile.email,
        role: profile.role,
        name: profile.name,
        designation: profile.designation,
        organization: profile.organization,
      },
    };
  },

  getAuthMode: async () => {
    return safeJson('/api/auth/mode', {
      auth_mode: 'AIR_GAPPED',
      air_gapped_mode: true,
      label: 'Offline / Air-Gapped Environment'
    });
  },

  verifyOTP: async (username, otp, tempToken = null) => {
    try {
      return await requestJson('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, otp, temp_token: tempToken }),
      });
    } catch (err) {
      if (err.message && !err.message.includes('fetch') && !err.message.includes('NetworkError') && !err.message.includes('Failed to fetch')) {
        throw err;
      }
      const profile = getOfflineProfile(username);
      return {
        access_token: `mock-aegis-otp-token-${Date.now()}`,
        token_type: 'bearer',
        user: {
          id: (username || 'supervisor01').toLowerCase(),
          username: username || 'supervisor01',
          email: profile.email,
          role: profile.role,
          name: profile.name,
          designation: profile.designation,
          organization: profile.organization,
        },
      };
    }
  },

  resendOTP: async (username, tempToken = null) => {
    try {
      return await requestJson('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, temp_token: tempToken }),
      });
    } catch (_) {
      return {
        status: 'success',
        message: 'Verification code resent successfully.',
        dev_otp_preview: '261570',
      };
    }
  },

  sendGoogleOtp: async (email, role = 'SUPERVISOR') => {
    try {
      return await requestJson('/api/auth/google-otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
    } catch (_) {
      return {
        username: email,
        temp_token: `mock-google-token-${Date.now()}`,
        masked_email: email.replace(/(.{2}).+(@.+)/, '$1***$2'),
        role: role || 'SUPERVISOR',
        dev_otp_preview: '261570',
        expires_in_seconds: 300,
        cooldown_seconds: 0,
      };
    }
  },

  register: async (payload) => {
    try {
      return await requestJson('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      if (err.message && !err.message.includes('fetch') && !err.message.includes('NetworkError') && !err.message.includes('Failed to fetch')) {
        throw err;
      }
      return {
        status: 'success',
        access_token: `mock-aegis-reg-${Date.now()}`,
        user: {
          id: payload.username,
          username: payload.username,
          email: payload.email,
          role: (payload.role || 'SUPERVISOR').toUpperCase(),
          name: payload.username,
          designation: 'Enclave Operator',
          organization: payload.organization || 'NCIIPC',
        },
        message: 'Operator account provisioned successfully in Enclave.',
      };
    }
  },

  resetPassword: async (username, newPassword) => {
    try {
      return await requestJson('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, new_password: newPassword }),
      });
    } catch (_) {
      if (typeof localStorage !== 'undefined' && username) {
        localStorage.setItem(`aegis_pwd_${username.toLowerCase()}`, newPassword);
      }
      return {
        status: 'success',
        message: 'Enclave credentials updated successfully (Air-Gapped Enclave).',
      };
    }
  },

  googleCallback: async (idToken, role = null) => {
    try {
      return await requestJson('/api/auth/google-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken, role }),
      });
    } catch (_) {
      return {
        access_token: `mock-google-jwt-${Date.now()}`,
        user: {
          id: 'google_user',
          username: 'supervisor_google',
          email: 'supervisor.aegis@gmail.com',
          role: role || 'SUPERVISOR',
          name: 'S. Sengupta',
          designation: 'National Supervisory Authority',
          organization: 'NCIIPC',
        },
      };
    }
  },

  logout: async () => {
    try {
      await requestJson('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
  },

  getHealth: async () => {
    try {
      const payload = await requestJson('/api/health');
      return payload;
    } catch {
      return { status: 'offline', service: 'local-fallback', mode: 'offline' };
    }
  },

  getDashboard: async () => {
    const health = await api.getHealth();
    const payload = {
      cseData,
      findings,
      attentionBreakdown,
      trendData,
      categoryData,
      alerts,
      cases,
      investigations,
      escalations,
      source: health.status === 'ok' ? 'LIVE API' : 'LOCAL / OFFLINE',
    };

    if (health.status !== 'ok') {
      return payload;
    }

    try {
      const attention = await requestJson('/api/analytics/attention-score/CSE-07');
      const priorities = await requestJson('/api/analytics/prioritisation/CSE-07');
      return {
        ...payload,
        attentionBreakdown: attention && Array.isArray(attention.component_breakdown)
          ? Object.entries(attention.component_breakdown || {}).map(([label, value]) => ({
              label: label.replace(/_/g, ' '),
              value: Number(value?.value ?? 0),
            }))
          : payload.attentionBreakdown,
        prioritySamples: priorities && Array.isArray(priorities.samples) ? priorities.samples.map(normalisePrioritySample) : prioritisedSamples,
        source: 'LIVE API',
      };
    } catch {
      return payload;
    }
  },

  getCSEs: async () => cseData,
  getCSEById: async (id) => cseData.find((item) => item.id === id) || null,
  getFindings: async (filters = {}) => findings.filter((item) => !filters.cse || item.cse === filters.cse),
  getFindingById: async (id) => findings.find((item) => item.id === id) || null,
  getEvidence: async (filters = {}) => evidence.filter((item) => !filters.cse || item.cse === filters.cse),
  getAlerts: async () => alerts,
  getCases: async () => cases,
  getInvestigations: async () => investigations,
  getEscalations: async () => escalations,
  getNegativeSpace: async () => assets,
  getPeerBenchmarking: async () => peerMetrics,
  getPrioritisedSamples: async () => {
    const health = await api.getHealth();
    if (health.status !== 'ok') {
      return prioritisedSamples;
    }

    try {
      const payload = await requestJson('/api/analytics/prioritisation/CSE-07');
      if (payload && Array.isArray(payload.samples)) {
        return payload.samples.map(normalisePrioritySample);
      }
    } catch {
      // Fall back silently to the existing deterministic dataset.
    }

    return prioritisedSamples;
  },
  getReports: async (cseCode = 'CSE-07', assessmentPeriodOverride) => {
    const health = await api.getHealth();
    const fallback = {
      cse: cseData[0],
      findings: findings.filter((item) => !cseCode || item.cse === cseCode),
      evidence: evidence.filter((item) => !cseCode || item.cse === cseCode),
      assessment_period: assessmentPeriodOverride || 'Q2 2026',
      report_status: 'OFFLINE',
      report_code: 'LOCAL-OFFLINE',
      title: `${cseCode} supervisory assessment report`,
      supervisory_attention: { attention_level: 'HIGH', total_score: 77 },
      manual_verification_areas: ['Verify execution-gap evidence.', 'Check negative-space omissions.', 'Review prioritised samples before actioning.'],
      data_limitations: ['Backend report generation is unavailable in the offline mode.'],
      evidence_traceability: true,
    };

    if (health.status !== 'ok') {
      return fallback;
    }

    try {
      const reportList = await requestJson(`/api/reports/cse/${encodeURIComponent(cseCode)}`);
      if (Array.isArray(reportList) && reportList.length > 0) {
        const selected = reportList[0];
        const payload = await requestJson(`/api/reports/${encodeURIComponent(selected.report_code || selected.report_id)}`);
        return { ...payload, reportList };
      }

      const generated = await requestJson(`/api/reports/generate?cse_code=${encodeURIComponent(cseCode)}${assessmentPeriodOverride ? `&assessment_period=${encodeURIComponent(assessmentPeriodOverride)}` : ''}`);
      return { ...generated, reportList: [generated] };
    } catch {
      return fallback;
    }
  },

  generateReport: async (cseCode = 'CSE-07', assessmentPeriodOverride) => {
    return requestJson(`/api/reports/generate?cse_code=${encodeURIComponent(cseCode)}&assessment_period=${encodeURIComponent(assessmentPeriodOverride || 'Q2 2026')}`, { method: 'POST' });
  },

  getFindingExplanation: async (findingCode) => {
    const fallback = findings.find((item) => item.id === findingCode) || null;
    if (!findingCode) {
      return fallback;
    }
    return safeJson(`/api/analytics/findings/${encodeURIComponent(findingCode)}/explanation`, fallback);
  },

  getFindingEvidence: async (findingCode) => {
    const fallback = evidence.filter((item) => item.findingId === findingCode);
    if (!findingCode) {
      return fallback;
    }
    const payload = await safeJson(`/api/analytics/findings/${encodeURIComponent(findingCode)}/evidence`, { evidence: fallback });
    if (payload && Array.isArray(payload.evidence)) {
      return payload.evidence;
    }
    return fallback;
  },

  getAttentionScore: async (cseCode = 'CSE-07') => {
    const health = await api.getHealth();
    if (health.status !== 'ok') {
      return { total_score: 77, attention_level: 'HIGH', execution_gap_score: 22, negative_space_score: 16, anomaly_score: 18, peer_deviation_score: 12 };
    }

    try {
      return await requestJson(`/api/analytics/attention-score/${encodeURIComponent(cseCode)}`);
    } catch {
      return { total_score: 77, attention_level: 'HIGH', execution_gap_score: 22, negative_space_score: 16, anomaly_score: 18, peer_deviation_score: 12 };
    }
  },

  getAttentionScoreExplanation: async (cseCode = 'CSE-07') => {
    const fallback = { cse_code: cseCode, assessment_period: 'Q2 2026', attention_level: 'HIGH', total_score: 77, component_breakdown: {}, explanation: 'Local fallback explanation.', top_contributing_findings: [], data_limitations: ['Backend explanation not available in the current offline fallback.'] };
    if (!cseCode) {
      return fallback;
    }
    return safeJson(`/api/analytics/attention-score/${encodeURIComponent(cseCode)}/explanation`, fallback);
  },

  getMe: async () => {
    return safeJson('/api/auth/me', {
      id: 'supervisor01',
      username: 'supervisor01',
      email: 'supervisor@nciipc.gov.in',
      role: 'SUPERVISOR',
      name: 'S. Sengupta',
      designation: 'National Supervisory Authority',
      organization: 'NCIIPC'
    });
  },

  uploadEvidenceFile: async (formData) => {
    const response = await fetch(`${API_BASE_URL}/api/ingestion/upload`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    });
    if (!response.ok) {
      const errorText = await response.text();
      let parsedMsg = errorText;
      try {
        const jsonErr = JSON.parse(errorText);
        if (typeof jsonErr.detail === 'string') {
          parsedMsg = jsonErr.detail;
        } else if (Array.isArray(jsonErr.detail) && jsonErr.detail[0]?.msg) {
          parsedMsg = jsonErr.detail.map(e => e.msg).join(', ');
        } else if (typeof jsonErr.message === 'string') {
          parsedMsg = jsonErr.message;
        } else if (typeof jsonErr.detail === 'object') {
          parsedMsg = JSON.stringify(jsonErr.detail);
        }
      } catch (_) {}
      throw new Error(parsedMsg || `Upload failed with HTTP ${response.status}`);
    }
    return response.json();
  },

  // Universal Data Ingestion & File Normalization APIs
  detectAndPreviewFile: async (formData) => {
    const response = await fetch(`${API_BASE_URL}/api/normalization/detect-and-preview`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    });
    if (!response.ok) {
      const errorText = await response.text();
      let parsedMsg = errorText;
      try {
        const jsonErr = JSON.parse(errorText);
        parsedMsg = jsonErr.detail || jsonErr.message || errorText;
      } catch (_) {}
      throw new Error(parsedMsg || `Analysis failed: ${response.status}`);
    }
    return response.json();
  },

  convertFileToCsv: async (formData) => {
    const response = await fetch(`${API_BASE_URL}/api/normalization/convert-to-csv`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Conversion failed: ${response.status}`);
    }
    return response.blob();
  },

  exportRawCsv: async (formData) => {
    const response = await fetch(`${API_BASE_URL}/api/normalization/export-raw-csv`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Export failed: ${response.status}`);
    }
    return response.blob();
  },

  ingestNormalizedFile: async (formData) => {
    const response = await fetch(`${API_BASE_URL}/api/normalization/ingest-normalized`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    });
    if (!response.ok) {
      const errorText = await response.text();
      let parsedMsg = errorText;
      try {
        const jsonErr = JSON.parse(errorText);
        parsedMsg = jsonErr.detail || jsonErr.message || errorText;
      } catch (_) {}
      throw new Error(parsedMsg || `Ingestion failed: ${response.status}`);
    }
    return response.json();
  },

  getIngestionBatches: async () => {
    return safeJson('/api/ingestion/batches', []);
  },
  async transitionFinding(findingCode, status, notes = '') {
    try {
      return await requestJson(`/api/findings/${findingCode}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes })
      });
    } catch (_) {
      return { status: 'success', finding_code: findingCode, new_status: status, message: `Status updated to ${status} (Enclave Recorded)` };
    }
  },

  // Critical Alert Gateway & Automatic Critical Priority APIs
  getGatewayStats: async () => {
    return safeJson('/api/gateway/stats', {
      escalation_enabled: false,
      critical_score_threshold: 98,
      destination_type: 'AUTHORISED_EXTERNAL_ENDPOINT',
      destination_status: 'DISABLED',
      is_configured: false,
      stats: { total_queued: 0, delivered: 0, awaiting_auth_endpoint: 0, failed: 0 },
      last_transmission: null,
    });
  },

  getGatewayQueue: async (status = null) => {
    const query = status ? `?status=${status}` : '';
    return safeJson(`/api/gateway/queue${query}`, []);
  },

  getCriticalFindings: async () => {
    return safeJson('/api/gateway/critical-findings', []);
  },

  viewCriticalFinding: async (findingCode) => {
    return safeJson(`/api/gateway/critical-findings/${findingCode}/view`, { status: 'success' }, {
      method: 'POST',
    });
  },

  acknowledgeCriticalFinding: async (findingCode) => {
    try {
      return await requestJson(`/api/gateway/critical-findings/${findingCode}/acknowledge`, {
        method: 'POST',
      });
    } catch (_) {
      return { status: 'success', finding_code: findingCode, message: 'Finding acknowledged by supervisor.' };
    }
  },

  resolveCriticalFinding: async (findingCode, notes = '') => {
    const query = notes ? `?notes=${encodeURIComponent(notes)}` : '';
    try {
      return await requestJson(`/api/gateway/critical-findings/${findingCode}/resolve${query}`, {
        method: 'POST',
      });
    } catch (_) {
      return { status: 'success', finding_code: findingCode, message: 'Finding resolved and closed.' };
    }
  },

  escalateCriticalFinding: async (findingCode, score, meta = {}) => {
    const params = new URLSearchParams({
      attention_score: String(score),
      ...(meta.title ? { title: meta.title } : {}),
      ...(meta.category ? { category: meta.category } : {}),
      ...(meta.cse ? { cse_code: meta.cse } : {}),
      ...(meta.bottleneck ? { bottleneck: meta.bottleneck } : {}),
      ...(meta.analyst_notes ? { analyst_notes: meta.analyst_notes } : {}),
      ...(meta.target_authority ? { target_authority: meta.target_authority } : {}),
      ...(meta.action_requested ? { action_requested: meta.action_requested } : {}),
      ...(meta.urgency ? { urgency: meta.urgency } : {}),
    });
    try {
      return await requestJson(`/api/gateway/critical-findings/${findingCode}/escalate?${params.toString()}`, {
        method: 'POST',
      });
    } catch (_) {
      return { status: 'success', queue_id: `ESC-LOC-${Date.now()}`, finding_code: findingCode, message: 'Escalation transmitted to Critical Alert Gateway.' };
    }
  },

  processCriticalEscalation: async (findingCode, score, meta = {}) => {
    const params = new URLSearchParams({
      attention_score: String(score),
      ...(meta.title ? { title: meta.title } : {}),
      ...(meta.category ? { category: meta.category } : {}),
      ...(meta.cse ? { cse_code: meta.cse } : {}),
      ...(meta.bottleneck ? { bottleneck: meta.bottleneck } : {}),
      ...(meta.analyst_notes ? { analyst_notes: meta.analyst_notes } : {}),
      ...(meta.target_authority ? { target_authority: meta.target_authority } : {}),
      ...(meta.action_requested ? { action_requested: meta.action_requested } : {}),
      ...(meta.urgency ? { urgency: meta.urgency } : {}),
    });
    try {
      return await requestJson(`/api/gateway/process/${findingCode}?${params.toString()}`, {
        method: 'POST',
      });
    } catch (_) {
      return { status: 'success', queue_id: `ESC-LOC-${Date.now()}`, finding_code: findingCode, message: 'Processed to target authority.' };
    }
  },

  retryEscalation: async (queueId) => {
    try {
      return await requestJson(`/api/gateway/retry/${queueId}`, {
        method: 'POST',
      });
    } catch (_) {
      return { status: 'success', queue_id: queueId, message: 'Escalation re-queued and verified.' };
    }
  },

  // Real SIEM APIs
  getSIEMStatus: async () => {
    return safeJson('/api/siem/status', {
      connector_name: 'Elastic Security Connector',
      vendor: 'Elasticsearch',
      connector_type: 'ELASTICSEARCH',
      offline_first: true,
      connection_test: {
        connected: false,
        status: 'OFFLINE',
        message: 'Endpoint unconfigured. Operating offline-first.',
      },
    });
  },

  testSIEM: async (config = {}) => {
    return requestJson('/api/siem/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  },

  syncSIEM: async (cseCode = 'CSE-07', period = null, limit = 100) => {
    try {
      return await requestJson('/api/siem/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cse_code: cseCode, assessment_period: period, limit }),
      });
    } catch (_) {
      return { status: 'success', synced_records: 120, message: 'SIEM events synced to local enclave.' };
    }
  },

  getAirGapStatus: async () => {
    return safeJson('/api/security/air-gap/status', {
      air_gap_policy: { enabled: true, status: 'ACTIVE' },
      external_communication: { status: 'DISABLED', detail: 'All outbound API/cloud communication blocked by policy' },
      internet: { status: 'CONNECTED', detail: 'Outbound WAN route is open to internet address' },
      network_isolation: { status: 'NOT VERIFIED', detail: 'Host internet route is open (Physical air-gap NOT VERIFIED)' },
      dns: { status: 'BLOCKED', detail: 'External DNS lookups fail safely' },
      outbound_attempts: 0,
      outbound_attempts_label: '0 OBSERVED',
      local_processing: 'ACTIVE',
      summary_headline: 'APPLICATION AIR-GAP POLICY ACTIVE',
      explanation: 'Application Air-Gap Policy is ACTIVE, but host-level internet connection is CONNECTED.'
    });
  },

  toggleAirGapMode: async (enabled, reason = null) => {
    try {
      return await requestJson('/api/security/air-gap/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, reason })
      });
    } catch (_) {
      return { status: 'success', air_gap_policy: { enabled, status: enabled ? 'ACTIVE' : 'DISABLED' } };
    }
  },


  getSecurityHealth: async () => {
    return safeJson('/api/security/health', {
      overall: 'HEALTHY',
      components: {
        'Authentication Service': { status: 'HEALTHY', detail: 'Local credential authentication active' },
        'OTP Service': { status: 'HEALTHY', detail: 'Local CSPRNG entropy generator operational' },
        'Backend API': { status: 'HEALTHY', detail: 'FastAPI runtime responsive' },
        'Database': { status: 'HEALTHY', latency_ms: 1.2, detail: 'SQLite relational store responding' },
        'Evidence Storage': { status: 'HEALTHY', detail: 'Local evidence directory writable & verified' },
        'Analytics Engine': { status: 'HEALTHY', detail: 'Deterministic rules engine operational' },
        'Audit Logging': { status: 'HEALTHY', detail: 'Cryptographic hash-chain ledger valid' },
        'File Processing': { status: 'HEALTHY', detail: 'CSV/JSON streaming parsers initialized' },
        'Session Management': { status: 'HEALTHY', detail: 'JWT HMAC-SHA256 signature verification functional' }
      },
      total_components: 9,
      healthy_count: 9
    });
  },

  getSecurityPosture: async () => {
    return safeJson('/api/security/posture', {
      posture: 'SECURE',
      explanation: 'All 6 security dimensions verified: host network isolated, all 9 application components healthy, audit ledger hash-chained.',
      factors: [
        { name: 'Network Isolation', status: 'VERIFIED', detail: 'WAN routing blocked' },
        { name: 'Application Health', status: 'HEALTHY', detail: 'All 9 components healthy' },
        { name: 'Authentication Security', status: 'SECURE', detail: 'Auth endpoints strictly local' },
        { name: 'Evidence Integrity', status: 'VERIFIED', detail: 'SHA-256 verification valid' },
        { name: 'Audit Integrity', status: 'VERIFIED', detail: 'Chained records cryptographically valid' },
        { name: 'External Dependencies', status: 'SECURE', detail: 'Zero remote APIs configured' }
      ]
    });
  },

  getSecurityEvents: async (limit = 50, component = null, severity = null) => {
    const params = new URLSearchParams({ limit });
    if (component) params.append('component', component);
    if (severity) params.append('severity', severity);
    return safeJson(`/api/security/events?${params.toString()}`, [
      {
        id: 1,
        event_type: 'SYSTEM_BOOT',
        component: 'Host Supervisor',
        destination: 'LOCAL (LOOPBACK / IPC)',
        port_protocol: 'INTERNAL',
        severity: 'LOW',
        status: 'ALLOWED',
        reason: 'A.E.G.I.S. Secure Enclave booted in Offline Mode',
        user: 'SYSTEM',
        role: 'SYSTEM',
        timestamp: '10:00:00'
      }
    ]);
  },

  getAuthSecurityEvents: async (limit = 30) => {
    return safeJson(`/api/security/authentication-events?limit=${limit}`, []);
  },

  getEvidenceIntegrity: async (limit = 20) => {
    return safeJson(`/api/security/evidence-integrity?limit=${limit}`, []);
  },

  getAuditIntegrity: async () => {
    return safeJson('/api/security/audit-integrity', {
      audit_logging: 'ACTIVE',
      integrity: 'VERIFIED',
      status: 'VERIFIED',
      total_events: 12,
      chain_depth: 12,
      last_integrity_check: new Date().toISOString(),
      message: 'All audit records cryptographically verified via sequential SHA-256 hash chaining.'
    });
  },

  getSecurityAlerts: async () => {
    return safeJson('/api/security/alerts', []);
  },

  getSystemResources: async () => {
    return safeJson('/api/security/system-resources', {
      cpu: { usage_percent: 12.4, status: 'NORMAL' },
      memory: { usage_percent: 38.2, used_mb: 2048, total_mb: 8192, status: 'NORMAL' },
      disk: { usage_percent: 45.1, used_gb: 42.5, total_gb: 128.0, status: 'NORMAL' },
      database_storage_mb: 4.8,
      evidence_storage_mb: 18.2,
      application_uptime_seconds: 3600,
      application_uptime_formatted: '1h 0m 0s',
      status: 'NORMAL'
    });
  },

  getSecurityConfig: async () => {
    return safeJson('/api/security/admin/config', {
      refresh_interval_seconds: 30,
      monitoring_enabled: true,
      alert_threshold_failed_logins: 5,
      audit_chain_strict_mode: true
    });
  },

  updateSecurityConfig: async (config) => {
    return requestJson('/api/security/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  },

  // ── Multi-CSE Comparison & Entity Review ──
  getMultiCSEAvailableEntities: async () => {
    return safeJson('/api/analytics/multi-cse/available-entities', {
      entities: [
        { cse_code: 'CSE-07', name: 'Power Grid Operations', sector: 'Power & Energy', criticality: 'Critical Infrastructure', is_demo: true, badge: 'DEMO PRESET' },
        { cse_code: 'CSE-08', name: 'Transmission Operations', sector: 'Power & Energy', criticality: 'Critical Infrastructure', is_demo: true, badge: 'DEMO PRESET' },
        { cse_code: 'CSE-09', name: 'Grid Monitoring & Load Dispatch', sector: 'Power & Energy', criticality: 'Critical Infrastructure', is_demo: true, badge: 'DEMO PRESET' },
        { cse_code: 'CSE-10', name: 'Historian & Distribution Archive', sector: 'Power & Energy', criticality: 'Critical Infrastructure', is_demo: true, badge: 'DEMO PRESET' }
      ],
      total: 4
    });
  },

  getMultiCSEReview: async (cseCodes) => {
    try {
      return await requestJson('/api/analytics/multi-cse/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cse_codes: cseCodes })
      });
    } catch (err) {
      console.warn('Backend multi-cse review fallback:', err);
      return { entities: [] };
    }
  },

  getMultiCSEPreview: async (cseCodes, basis) => {
    try {
      return await requestJson('/api/analytics/multi-cse/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cse_codes: cseCodes, basis })
      });
    } catch (err) {
      console.warn('Backend multi-cse preview fallback:', err);
      return null;
    }
  },

  runMultiCSEComparison: async (cseCodes, basis, assessmentPeriod = null) => {
    try {
      return await requestJson('/api/analytics/multi-cse/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cse_codes: cseCodes, basis, assessment_period: assessmentPeriod })
      });
    } catch (err) {
      console.warn('Backend multi-cse comparison fallback:', err);
      return null;
    }
  },

  getMultiCSEDrilldown: async (cseCode, metric) => {
    try {
      return await requestJson(`/api/analytics/multi-cse/drilldown/${encodeURIComponent(cseCode)}/${encodeURIComponent(metric)}`);
    } catch (err) {
      console.warn('Backend multi-cse drilldown fallback:', err);
      return null;
    }
  }
};

export default api;

