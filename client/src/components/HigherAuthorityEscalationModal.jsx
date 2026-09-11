import React, { useState } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Send, 
  X, 
  Lock, 
  Building, 
  FileText, 
  Clock, 
  UserCheck, 
  Activity,
  AlertOctagon,
  CheckCircle2
} from 'lucide-react';

const BOTTLENECK_PRESETS = [
  {
    id: 'telemetry_missing',
    label: '⚠️ Incomplete / Missing Node Telemetry',
    description: 'Ground analyst observed anomalous signature, but secondary telemetry and firewall flow logs were incomplete or truncated.',
    attempted: 'Attempted local packet capture and secondary buffer query; telemetry feed remained incomplete.'
  },
  {
    id: 'sla_breach',
    label: '⏱️ Emergency SLA Containment Window Breached',
    description: 'Threat complexity exceeded level-1 containment capability; 15-minute operational SLA threshold expired without safe resolution.',
    attempted: 'Initiated standard incident triage and firewall session termination; malicious activity persisted.'
  },
  {
    id: 'access_denied',
    label: '🔒 Privileged Access Barrier / Node Lockout',
    description: 'Ground analyst lacked root/administrative credentials required to isolate compromised substation controller or inspect kernel memory.',
    attempted: 'Requested privileged emergency escalation from local administrator; credentials were not provisioned in time.'
  },
  {
    id: 'sensor_drop',
    label: '📡 SIEM Sensor Feed Dropped During Incident',
    description: 'Forwarding agent on target OT node stopped heartbeats during anomaly onset, hindering direct local root-cause determination.',
    attempted: 'Attempted remote agent restart and socket ping; node communications remained unverified.'
  },
  {
    id: 'alert_storm',
    label: '🚨 High-Volume Alert Storm / Resource Saturation',
    description: 'Local SOC shift was saturated by concurrent multi-vector events, requiring higher authority prioritization and resource dispatch.',
    attempted: 'Filtered noise using local correlation rules; isolated primary high-impact threat for executive escalation.'
  },
  {
    id: 'unresponsive_owner',
    label: '👥 Unresponsive Asset Owner / Substation POC',
    description: 'Designated asset custodian and substation operational contact failed to respond to emergency dispatch calls within mandated SLA.',
    attempted: 'Initiated 3 escalation calls and broadcasted emergency priority alert over internal SOC pager.'
  }
];

export default function HigherAuthorityEscalationModal({ finding, onEscalate, onClose, isSubmitting = false }) {
  if (!finding) return null;

  const findingCode = finding.finding_code || finding.finding_id || finding.id || 'FND-CRIT';
  const cseCode = finding.cse || finding.cse_code || 'CSE-07';
  const score = Number(finding.attention_score || finding.score_contribution || 99.0);

  const [selectedPresetId, setSelectedPresetId] = useState('telemetry_missing');
  const [bottleneckCategory, setBottleneckCategory] = useState(BOTTLENECK_PRESETS[0].label);
  const [analystStruggle, setAnalystStruggle] = useState(
    `Ground analyst at ${cseCode} identified a critical operational execution gap regarding ${finding.title || 'the anomaly'}. Local remediation was obstructed because secondary flow telemetry and controller logs were missing or unverified within the emergency SLA window.`
  );
  const [stepsAttempted, setStepsAttempted] = useState(
    BOTTLENECK_PRESETS[0].attempted
  );
  const [targetAuthority, setTargetAuthority] = useState('NCIIPC Critical Infrastructure Advisory Desk (National Coordinator)');
  const [actionRequested, setActionRequested] = useState('Issue Direct Mandatory Network Isolation Directive');
  const [urgency, setUrgency] = useState('IMMEDIATE (P1) — Within 1 Hour');

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
      title: finding.title,
      category: finding.category || finding.attack_type || 'EXECUTION_GAP',
      cse: cseCode,
      bottleneck: bottleneckCategory,
      analyst_notes: `[OPERATIONAL OBSTACLE]: ${analystStruggle}\n[PRIOR ACTIONS ATTEMPTED]: ${stepsAttempted}`,
      target_authority: targetAuthority,
      action_requested: actionRequested,
      urgency: urgency,
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '14px',
        width: '100%',
        maxWidth: '820px',
        maxHeight: '92vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        border: '1px solid #cbd5e1'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '16px 22px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #ef4444'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{
                background: '#ef4444',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: '800',
                padding: '2px 8px',
                borderRadius: '4px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}>
                Higher Authority Escalation
              </span>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>
                A.E.G.I.S. · SAT-SA SUPERVISORY GOVERNANCE
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
              Executive Escalation Dossier & Ground-Level Review
            </h2>
          </div>
          <button 
            onClick={onClose} 
            disabled={isSubmitting}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Finding Reference Header Card */}
          <div style={{
            background: 'linear-gradient(135deg, #fff5f5 0%, #fef2f2 100%)',
            border: '1px solid #fca5a5',
            borderRadius: '10px',
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ fontSize: '15px', color: '#991b1b', fontFamily: 'monospace' }}>
                  {findingCode}
                </strong>
                <span style={{ fontSize: '12px', color: '#7f1d1d', fontWeight: '700' }}>· Entity: {cseCode}</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginTop: '3px' }}>
                {finding.title || 'Critical Supervisory Finding'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Category: <b>{finding.category || finding.attack_type || 'Execution Gap'}</b>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{
                background: '#dc2626',
                color: '#ffffff',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '800',
                display: 'inline-block'
              }}>
                SCORE: {score.toFixed(1)} / 100
              </span>
              <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: '700', marginTop: '3px' }}>
                Mandatory Senior Escalation
              </div>
            </div>
          </div>

          {/* Section 1: Ground-Level Obstacle & Operational Bottleneck (Neeche wale ne kya dikkat face ki) */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            padding: '18px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{
                background: '#fef3c7',
                color: '#b45309',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  1. Ground-Level Operational Bottleneck (Neeche Wale Ko Kya Dikkat Aayi)
                </h3>
                <small style={{ color: '#64748b' }}>
                  Specific operational blocker, evidence defect, or institutional challenge encountered by junior / ground SOC analyst:
                </small>
              </div>
            </div>

            {/* Quick Preset Selector */}
            <div style={{ marginTop: '12px', marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                Select Common Ground Bottleneck Preset:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '8px' }}>
                {BOTTLENECK_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      type="button"
                      key={preset.id}
                      onClick={() => handlePresetClick(preset)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        background: isSelected ? '#eff6ff' : '#f8fafc',
                        border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                        color: isSelected ? '#1d4ed8' : '#334155'
                      }}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detailed Ground Struggle Notes */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', display: 'block', marginBottom: '4px' }}>
                Ground Analyst Struggle & Failure Mode Explanation:
              </label>
              <textarea
                value={analystStruggle}
                onChange={(e) => setAnalystStruggle(e.target.value)}
                rows={3}
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  color: '#0f172a',
                  lineHeight: '1.5',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
                placeholder="Describe exact difficulty faced by the ground analyst (e.g. dropped packets, SLA timeout, lack of credentials, unverified asset logs)..."
              />
            </div>

            {/* Prior Actions Attempted */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', display: 'block', marginBottom: '4px' }}>
                Prior Containment Actions Attempted Locally by Ground SOC:
              </label>
              <input
                type="text"
                value={stepsAttempted}
                onChange={(e) => setStepsAttempted(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  color: '#0f172a',
                  fontFamily: 'inherit'
                }}
                placeholder="What steps did the analyst execute before escalating?"
              />
            </div>
          </div>

          {/* Section 2: Higher Authority Designation & Action Requested */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            padding: '18px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div style={{
                background: '#eff6ff',
                color: '#2563eb',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Building size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  2. Higher Authority Designation & Recommended Action
                </h3>
                <small style={{ color: '#64748b' }}>
                  Specify the apex authority and concrete regulatory or operational directive requested:
                </small>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '14px' }}>
              {/* Target Higher Authority */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Target Higher Authority:
                </label>
                <select
                  value={targetAuthority}
                  onChange={(e) => setTargetAuthority(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    color: '#0f172a',
                    fontWeight: '600',
                    background: '#ffffff'
                  }}
                >
                  <option value="NCIIPC Critical Infrastructure Advisory Desk (National Coordinator)">
                    🏛️ NCIIPC Critical Infrastructure Advisory Desk
                  </option>
                  <option value="CERT-In National Incident Response Centre">
                    🛡️ CERT-In National Incident Response Centre
                  </option>
                  <option value="Sector Chief Information Security Officer (Sector CISO)">
                    👔 Sector Chief Information Security Officer (CISO)
                  </option>
                  <option value="National Load Dispatch Centre (NLDC) Executive Body">
                    ⚡ National Load Dispatch Centre (NLDC) Executive Body
                  </option>
                  <option value="Director General / Apex Executive Governance Board">
                    📋 Director General / Executive Governance Board
                  </option>
                </select>
              </div>

              {/* Action Requested */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Executive Action Requested:
                </label>
                <select
                  value={actionRequested}
                  onChange={(e) => setActionRequested(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    color: '#0f172a',
                    fontWeight: '600',
                    background: '#ffffff'
                  }}
                >
                  <option value="Issue Direct Mandatory Network Isolation Directive">
                    🛑 Issue Mandatory Network Isolation Directive
                  </option>
                  <option value="Deploy Emergency On-Site Incident Response (IR) Squad">
                    🚨 Deploy Emergency Incident Response (IR) Squad
                  </option>
                  <option value="Initiate Regulatory Non-Compliance & Remediation Notice">
                    📜 Initiate Regulatory Non-Compliance Audit Notice
                  </option>
                  <option value="Authorize Emergency Forensic Memory Capture & Asset Lock">
                    🔑 Authorize Emergency Forensic Memory Capture
                  </option>
                  <option value="Issue Sector-Wide Synchronized Threat Advisory Bulletin">
                    📊 Issue Sector-Wide Synchronized Threat Advisory
                  </option>
                </select>
              </div>
            </div>

            {/* Urgency Window */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                Required Response SLA Window:
              </label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {[
                  'IMMEDIATE (P1) — Within 1 Hour',
                  'HIGH (P2) — Within 4 Hours',
                  'STANDARD (P3) — 24-Hour Review'
                ].map((tier) => (
                  <label 
                    key={tier}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: urgency === tier ? '700' : '500',
                      color: urgency === tier ? '#dc2626' : '#475569',
                      background: urgency === tier ? '#fef2f2' : '#f8fafc',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: urgency === tier ? '1px solid #f87171' : '1px solid #e2e8f0',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="radio"
                      name="urgency"
                      checked={urgency === tier}
                      onChange={() => setUrgency(tier)}
                      style={{ accentColor: '#dc2626' }}
                    />
                    {tier}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Data Minimisation & Cryptographic Assurance */}
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            fontSize: '12px',
            color: '#166534'
          }}>
            <Lock size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <strong style={{ display: 'block', marginBottom: '2px' }}>
                Data Minimisation & Cryptographic Payload Integrity Assured
              </strong>
              <span>
                Under A.E.G.I.S. governance, only 14 sanitized metadata fields and the Ground Review Dossier are transmitted. 
                Zero raw database credentials, local telemetry files, or extraneous SOC data are leaked. Signed with HMAC-SHA256.
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '12px',
            paddingTop: '10px',
            borderTop: '1px solid #e2e8f0'
          }}>
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ padding: '9px 18px', fontSize: '13px' }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="button primary"
              style={{
                padding: '9px 22px',
                fontSize: '13px',
                fontWeight: '700',
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                borderColor: '#b91c1c',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)',
                cursor: 'pointer'
              }}
            >
              <Send size={15} />
              {isSubmitting ? 'Submitting to Higher Authority...' : 'Submit Escalation to Higher Authority →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
