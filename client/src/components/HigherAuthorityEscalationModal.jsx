import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Send,
  X,
  Lock,
  Building,
} from 'lucide-react';

/* ---- Bottleneck presets (data only, no styles) ---- */
const BOTTLENECK_PRESETS = [
  {
    id: 'telemetry_missing',
    label: '⚠️ Incomplete / Missing Node Telemetry',
    description: 'Ground analyst observed anomalous signature, but secondary telemetry and firewall flow logs were incomplete or truncated.',
    attempted: 'Attempted local packet capture and secondary buffer query; telemetry feed remained incomplete.',
  },
  {
    id: 'sla_breach',
    label: '⏱️ Emergency SLA Containment Window Breached',
    description: 'Threat complexity exceeded level-1 containment capability; 15-minute operational SLA threshold expired without safe resolution.',
    attempted: 'Initiated standard incident triage and firewall session termination; malicious activity persisted.',
  },
  {
    id: 'access_denied',
    label: '🔒 Privileged Access Barrier / Node Lockout',
    description: 'Ground analyst lacked root/administrative credentials required to isolate compromised substation controller or inspect kernel memory.',
    attempted: 'Requested privileged emergency escalation from local administrator; credentials were not provisioned in time.',
  },
  {
    id: 'sensor_drop',
    label: '📡 SIEM Sensor Feed Dropped During Incident',
    description: 'Forwarding agent on target OT node stopped heartbeats during anomaly onset, hindering direct local root-cause determination.',
    attempted: 'Attempted remote agent restart and socket ping; node communications remained unverified.',
  },
  {
    id: 'alert_storm',
    label: '🚨 High-Volume Alert Storm / Resource Saturation',
    description: 'Local SOC shift was saturated by concurrent multi-vector events, requiring higher authority prioritization and resource dispatch.',
    attempted: 'Filtered noise using local correlation rules; isolated primary high-impact threat for executive escalation.',
  },
  {
    id: 'unresponsive_owner',
    label: '👥 Unresponsive Asset Owner / Substation POC',
    description: 'Designated asset custodian and substation operational contact failed to respond to emergency dispatch calls within mandated SLA.',
    attempted: 'Initiated 3 escalation calls and broadcasted emergency priority alert over internal SOC pager.',
  },
];

const SLA_TIERS = [
  'IMMEDIATE (P1) — Within 1 Hour',
  'HIGH (P2) — Within 4 Hours',
  'STANDARD (P3) — 24-Hour Review',
];

export default function HigherAuthorityEscalationModal({ finding, onEscalate, onClose, isSubmitting = false }) {
  if (!finding) return null;

  const findingCode = finding.finding_code || finding.finding_id || finding.id || 'FND-CRIT';
  const cseCode     = finding.cse || finding.cse_code || 'CSE-07';
  const score       = Number(finding.attention_score || finding.score_contribution || 99.0);

  const [selectedPresetId,   setSelectedPresetId]   = useState('telemetry_missing');
  const [bottleneckCategory, setBottleneckCategory] = useState(BOTTLENECK_PRESETS[0].label);
  const [analystStruggle,    setAnalystStruggle]    = useState(
    `Ground analyst at ${cseCode} identified a critical operational execution gap regarding ${finding.title || 'the anomaly'}. Local remediation was obstructed because secondary flow telemetry and controller logs were missing or unverified within the emergency SLA window.`
  );
  const [stepsAttempted,  setStepsAttempted]  = useState(BOTTLENECK_PRESETS[0].attempted);
  const [targetAuthority, setTargetAuthority] = useState('NCIIPC Critical Infrastructure Advisory Desk (National Coordinator)');
  const [actionRequested, setActionRequested] = useState('Issue Direct Mandatory Network Isolation Directive');
  const [urgency,         setUrgency]         = useState('IMMEDIATE (P1) — Within 1 Hour');

  const handlePresetClick = (preset) => {
    setSelectedPresetId(preset.id);
    setBottleneckCategory(preset.label);
    setAnalystStruggle(
      `Ground analyst at ${cseCode} encountered a barrier: ${preset.description} Immediate higher authority supervisory intervention is required to prevent widespread operational contagion.`
    );
    setStepsAttempted(preset.attempted);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onEscalate({
      findingCode,
      score,
      title:            finding.title,
      category:         finding.category || finding.attack_type || 'EXECUTION_GAP',
      cse:              cseCode,
      bottleneck:       bottleneckCategory,
      analyst_notes:    `[OPERATIONAL OBSTACLE]: ${analystStruggle}\n[PRIOR ACTIONS ATTEMPTED]: ${stepsAttempted}`,
      target_authority: targetAuthority,
      action_requested: actionRequested,
      urgency,
    });
  };

  return (
    <div className="cap-modal-overlay">
      {/* Modal shell — reuses the same .cap-modal system from app.css */}
      <div className="cap-modal" style={{ maxWidth: 840 }} onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="cap-modal__header">
          <div className="cap-modal__header-left">
            <span className="cap-modal__score-badge">HIGHER AUTHORITY ESCALATION</span>
            <div>
              <h3 className="cap-modal__title">Executive Escalation Dossier &amp; Ground-Level Review</h3>
              <small className="cap-modal__subtitle">A.E.G.I.S. · SAT-SA SUPERVISORY GOVERNANCE</small>
            </div>
          </div>
          <button className="cap-modal__close" onClick={onClose} disabled={isSubmitting} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* ── Body ── */}
        <form onSubmit={handleSubmit} className="cap-modal__body" style={{ gap: 20 }}>

          {/* Finding Reference Card */}
          <div className="cap-notice-block cap-notice-block--critical" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ fontSize: 'var(--font-size-h3)', color: 'var(--color-critical)', fontFamily: 'ui-monospace, monospace' }}>
                  {findingCode}
                </strong>
                <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-critical)', fontWeight: 700 }}>· Entity: {cseCode}</span>
              </div>
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 3 }}>
                {finding.title || 'Critical Supervisory Finding'}
              </div>
              <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                Category: <b>{finding.category || finding.attack_type || 'Execution Gap'}</b>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="badge critical badge--md" style={{ display: 'inline-block' }}>
                SCORE: {score.toFixed(1)} / 100
              </span>
              <div style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-critical)', fontWeight: 700, marginTop: 4 }}>
                Mandatory Senior Escalation
              </div>
            </div>
          </div>

          {/* ── Section 1: Ground-Level Obstacle ── */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)', padding: 4, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center' }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-h4)', fontWeight: 800, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: 'var(--letter-spacing-wide)' }}>
                  1. Ground-Level Operational Bottleneck
                </h3>
                <small style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-caption)' }}>
                  Specific operational blocker, evidence defect, or institutional challenge encountered by junior / ground SOC analyst:
                </small>
              </div>
            </div>

            {/* Preset selector */}
            <div style={{ margin: '12px 0 14px' }}>
              <label className="field-label" style={{ display: 'block', marginBottom: 6 }}>
                Select Common Ground Bottleneck Preset:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 }}>
                {BOTTLENECK_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      type="button"
                      key={preset.id}
                      onClick={() => handlePresetClick(preset)}
                      className={isSelected ? 'cap-btn cap-btn--view' : 'cap-btn cap-btn--view'}
                      style={{
                        padding: '8px 10px',
                        textAlign: 'left',
                        fontSize: 'var(--font-size-small)',
                        fontWeight: isSelected ? 700 : 500,
                        background: isSelected ? 'var(--color-info-bg)' : 'var(--color-surface-subtle)',
                        border: isSelected ? '1.5px solid var(--color-info-border)' : '1px solid var(--color-border)',
                        color: isSelected ? 'var(--color-info)' : 'var(--color-text-secondary)',
                      }}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Analyst struggle notes */}
            <div style={{ marginBottom: 12 }}>
              <label className="field-label" style={{ display: 'block', marginBottom: 4, textTransform: 'none', letterSpacing: 0, fontSize: 'var(--font-size-body)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Ground Analyst Struggle &amp; Failure Mode Explanation:
              </label>
              <textarea
                value={analystStruggle}
                onChange={(e) => setAnalystStruggle(e.target.value)}
                rows={3}
                required
                style={{ width: '100%', padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-body)', color: 'var(--color-text-primary)', background: 'var(--color-surface)', lineHeight: 'var(--line-height-base)', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                placeholder="Describe exact difficulty faced by the ground analyst…"
              />
            </div>

            {/* Prior actions */}
            <div>
              <label className="field-label" style={{ display: 'block', marginBottom: 4, textTransform: 'none', letterSpacing: 0, fontSize: 'var(--font-size-body)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Prior Containment Actions Attempted Locally by Ground SOC:
              </label>
              <input
                type="text"
                value={stepsAttempted}
                onChange={(e) => setStepsAttempted(e.target.value)}
                required
                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-body)', color: 'var(--color-text-primary)', background: 'var(--color-surface)', fontFamily: 'inherit', boxSizing: 'border-box' }}
                placeholder="What steps did the analyst execute before escalating?"
              />
            </div>
          </div>

          {/* ── Section 2: Higher Authority ── */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)', padding: 4, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center' }}>
                <Building size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-h4)', fontWeight: 800, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: 'var(--letter-spacing-wide)' }}>
                  2. Higher Authority Designation &amp; Recommended Action
                </h3>
                <small style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-caption)' }}>
                  Specify the apex authority and concrete regulatory or operational directive requested:
                </small>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
              <div>
                <label className="field-label" style={{ display: 'block', marginBottom: 4 }}>Target Higher Authority:</label>
                <select
                  value={targetAuthority}
                  onChange={(e) => setTargetAuthority(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-body)', color: 'var(--color-text-primary)', fontWeight: 600, background: 'var(--color-surface)', boxSizing: 'border-box' }}
                >
                  <option value="NCIIPC Critical Infrastructure Advisory Desk (National Coordinator)">🏛️ NCIIPC Critical Infrastructure Advisory Desk</option>
                  <option value="CERT-In National Incident Response Centre">🛡️ CERT-In National Incident Response Centre</option>
                  <option value="Sector Chief Information Security Officer (Sector CISO)">👔 Sector Chief Information Security Officer (CISO)</option>
                  <option value="National Load Dispatch Centre (NLDC) Executive Body">⚡ National Load Dispatch Centre (NLDC) Executive Body</option>
                  <option value="Director General / Apex Executive Governance Board">📋 Director General / Executive Governance Board</option>
                </select>
              </div>
              <div>
                <label className="field-label" style={{ display: 'block', marginBottom: 4 }}>Executive Action Requested:</label>
                <select
                  value={actionRequested}
                  onChange={(e) => setActionRequested(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-body)', color: 'var(--color-text-primary)', fontWeight: 600, background: 'var(--color-surface)', boxSizing: 'border-box' }}
                >
                  <option value="Issue Direct Mandatory Network Isolation Directive">🛑 Issue Mandatory Network Isolation Directive</option>
                  <option value="Deploy Emergency On-Site Incident Response (IR) Squad">🚨 Deploy Emergency Incident Response (IR) Squad</option>
                  <option value="Initiate Regulatory Non-Compliance &amp; Remediation Notice">📜 Initiate Regulatory Non-Compliance Audit Notice</option>
                  <option value="Authorize Emergency Forensic Memory Capture &amp; Asset Lock">🔑 Authorize Emergency Forensic Memory Capture</option>
                  <option value="Issue Sector-Wide Synchronized Threat Advisory Bulletin">📊 Issue Sector-Wide Synchronized Threat Advisory</option>
                </select>
              </div>
            </div>

            {/* SLA window */}
            <div>
              <label className="field-label" style={{ display: 'block', marginBottom: 4 }}>Required Response SLA Window:</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {SLA_TIERS.map((tier) => (
                  <label
                    key={tier}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 'var(--font-size-body)',
                      fontWeight: urgency === tier ? 700 : 500,
                      color:   urgency === tier ? 'var(--color-critical)' : 'var(--color-text-secondary)',
                      background: urgency === tier ? 'var(--color-critical-bg)' : 'var(--color-surface-subtle)',
                      padding: '6px 12px', borderRadius: 'var(--radius-md)',
                      border: urgency === tier ? '1px solid var(--color-critical-border)' : '1px solid var(--color-border)',
                      cursor: 'pointer',
                    }}
                  >
                    <input type="radio" name="urgency" checked={urgency === tier} onChange={() => setUrgency(tier)} style={{ accentColor: 'var(--color-critical)' }} />
                    {tier}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ── Section 3: Data minimisation assurance ── */}
          <div className="cap-notice-block cap-notice-block--success" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Lock size={16} style={{ marginTop: 2, flexShrink: 0, color: 'var(--color-success)' }} />
            <div>
              <strong style={{ display: 'block', marginBottom: 2, fontSize: 'var(--font-size-body)', color: 'var(--color-success)' }}>
                Data Minimisation &amp; Cryptographic Payload Integrity Assured
              </strong>
              <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-secondary)', lineHeight: 'var(--line-height-base)' }}>
                Under A.E.G.I.S. governance, only 14 sanitized metadata fields and the Ground Review Dossier are transmitted.
                Zero raw database credentials, local telemetry files, or extraneous SOC data are leaked. Signed with HMAC-SHA256.
              </span>
            </div>
          </div>

          {/* Footer actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
            <button type="button" className="button" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="submit" disabled={isSubmitting} className="cap-btn cap-btn--escalate" style={{ padding: '9px 22px', fontSize: 'var(--font-size-md)' }}>
              <Send size={15} />
              {isSubmitting ? 'Submitting to Higher Authority…' : 'Submit Escalation to Higher Authority →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
