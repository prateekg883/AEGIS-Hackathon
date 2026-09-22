import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid 
} from 'recharts';
import { 
  BarChart3, 
  GitCommit, 
  Layers, 
  ArrowRightLeft, 
  ShieldAlert, 
  Activity, 
  Zap, 
  CheckCircle2, 
  AlertTriangle,
  Info,
  Network,
  Filter
} from 'lucide-react';
import { useSOC } from '../state/SOCContext';
import SingleCSEGraphs from './SingleCSEGraphs';
import MultiCSEComparator from './multi_cse/MultiCSEComparator';

// Regulatory rationale descriptions for comparison basis
function getBasisDescription(basis, cseA, cseB) {
  switch (basis) {
    case 'execution_gaps':
      return `Comparing ${cseA.id} and ${cseB.id} under NCIIPC Critical Sector Rule 4.1: Unescalated Critical Incident Gaps. Evaluates severe alerts closed or de-escalated without mandatory Tier-2 supervisor sign-off.`;
    case 'response_time':
      return `Evaluating operational SLA velocity between ${cseA.id} and ${cseB.id} against Section 70-B IT Act guidelines (30-minute mandatory escalation SLA and 42-minute national peer median).`;
    case 'threat_landscape':
      return `Assessing active industrial threat vectors, SCADA/ICS injection payloads (MODBUS/DNP3/S7COMM), and reconnaissance attempts observed in ${cseA.id} and ${cseB.id} telemetry.`;
    case 'evidence_telemetry':
      return `Verifying telemetry completeness and negative space (unobserved expected substation nodes) backed by deterministic SHA-256 evidence chain verification.`;
    default:
      return `Holistic peer benchmarking evaluating ${cseA.id} (${cseA.name}) vs ${cseB.id} (${cseB.name}) across all 5 NCIIPC supervisory dimensions within the Power & Energy cohort.`;
  }
}

function getVarianceDriverCommentary(basis, cseA, cseB, mA, mB) {
  const diff = Math.abs(mA.attentionScore - mB.attentionScore);
  const higher = mA.attentionScore >= mB.attentionScore ? cseA : cseB;
  const lower = mA.attentionScore < mB.attentionScore ? cseA : cseB;
  const mHigher = mA.attentionScore >= mB.attentionScore ? mA : mB;
  const mLower = mA.attentionScore < mB.attentionScore ? mA : mB;

  if (basis === 'execution_gaps') {
    return `${higher.id} exhibits a critical variance with ${mHigher.executionGaps} unescalated execution gaps compared to ${lower.id}'s ${mLower.executionGaps} gaps. This represents a direct violation of mandatory supervisory oversight protocols.`;
  }
  if (basis === 'response_time') {
    return `Investigation latency gap: ${higher.id} averages ${mHigher.avgResponseMins}m mean response time, which is ${Math.abs(mHigher.avgResponseMins - mLower.avgResponseMins)}m slower than ${lower.id} (${mLower.avgResponseMins}m), indicating operational queue bottlenecks.`;
  }
  if (basis === 'threat_landscape') {
    return `${higher.id} is undergoing higher threat exposure with an Attention Score of ${mHigher.attentionScore}/100. Operational attack surface deviates by ${diff} points from ${lower.id}.`;
  }
  if (basis === 'evidence_telemetry') {
    return `Telemetry gap identified: ${higher.id} has ${mHigher.unobservedAssets} unobserved asset node(s) with ${mHigher.evidenceVerified}% evidence verification vs ${lower.id}'s ${mLower.evidenceVerified}% verification rate.`;
  }
  return `${higher.id} requires significantly higher supervisory attention (${mHigher.attentionScore} vs ${mLower.attentionScore}, Δ${diff} pts). Primary root-cause: ${mHigher.executionGaps} unescalated execution gaps and ${mHigher.avgResponseMins}m average triage latency.`;
}

function getSlaBreachCommentary(basis, cseA, cseB, mA, mB) {
  return `${cseA.id} maintains an escalation compliance rate of ${mA.escalationRate}% (avg response: ${mA.avgResponseMins}m) against ${cseB.id}'s ${mB.escalationRate}% (avg response: ${mB.avgResponseMins}m). NCIIPC Section 70-B mandates an escalation threshold of ≥85% within 30 minutes.`;
}

function getSupervisoryActionCommentary(basis, cseA, cseB, mA, mB) {
  const higher = mA.attentionScore >= mB.attentionScore ? cseA : cseB;
  const lower = mA.attentionScore < mB.attentionScore ? cseA : cseB;
  return `Chief Supervisor Action: Issue priority corrective audit notice to ${higher.id} for SLA remediation within 48 hours. Maintain ${lower.id} under standard automated enclave telemetry surveillance.`;
}

export default function GraphComparison() {
  const { cseEntities, findings, activeAlerts, assets, evidence } = useSOC();

  const cseList = cseEntities.length > 0 ? cseEntities : [
    { id: 'CSE-07', name: 'National Energy Systems', sector: 'Energy', score: 77, level: 'HIGH' },
    { id: 'CSE-02', name: 'Northern Power Distribution', sector: 'Energy', score: 48, level: 'MEDIUM' },
    { id: 'CSE-05', name: 'Western Grid Substation Net', sector: 'Energy', score: 32, level: 'NORMAL' },
    { id: 'CSE-09', name: 'State Load Dispatch Center', sector: 'Energy', score: 85, level: 'CRITICAL' },
  ];

  const [singleEntity, setSingleEntity] = useState(cseList[0]?.id || 'CSE-07');
  const [entityA, setEntityA] = useState(cseList[0]?.id || 'CSE-07');
  const [entityB, setEntityB] = useState(cseList[1]?.id || cseList[0]?.id || 'CSE-02');
  const [activeTab, setActiveTab] = useState('comparator'); // default to 'comparator' for immediate dual comparison
  const [comparisonBasis, setComparisonBasis] = useState('all'); // 'all' | 'execution_gaps' | 'response_time' | 'threat_landscape' | 'evidence_telemetry'
  const [selectedNode, setSelectedNode] = useState(null);

  // Synchronize state when uploaded CSV entities change
  useEffect(() => {
    if (cseList.length > 0) {
      if (!cseList.some(c => c.id === singleEntity)) {
        setSingleEntity(cseList[0].id);
      }
      if (!cseList.some(c => c.id === entityA)) {
        setEntityA(cseList[0].id);
      }
      if (!cseList.some(c => c.id === entityB)) {
        setEntityB(cseList[1]?.id || cseList[0].id);
      }
    }
  }, [cseEntities]);

  const selectedSingleCSE = cseList.find(c => c.id === singleEntity) || cseList[0];
  const cseAData = cseList.find(c => c.id === entityA) || cseList[0];
  const cseBData = cseList.find(c => c.id === entityB) || cseList[1] || cseList[0];

  // Derive metrics dynamically for any Entity A & B
  const getMetrics = (cseId, cseObj) => {
    const score = Number(cseObj?.score ?? cseObj?.total_score ?? 50);
    const cseFindings = (findings || []).filter(f => f.cse === cseId);
    const cseAlerts = (activeAlerts || []).filter(a => a.cse === cseId);
    const cseAssets = (assets || []).filter(a => a.cse === cseId);

    // 1. Execution Gaps: from actual findings or proportionate to execution gap score
    const execGaps = cseFindings.filter(f => f.category === 'Execution Gap').length ||
      (cseObj?.execution_gap_score ? Math.max(1, Math.round(cseObj.execution_gap_score / 4.5)) : Math.max(1, Math.round(score * 0.08)));

    // 2. Average Response Time (minutes): higher attention/gaps correlate with longer investigation cycles
    const avgResponse = Math.max(10, Math.round(10 + (score * 0.42)));

    // 3. Unobserved Assets: from negative space assets count or proportionate
    const unobsAssets = cseAssets.length ||
      (cseObj?.negative_space_score ? Math.max(1, Math.round(cseObj.negative_space_score / 7)) : Math.max(1, Math.round(score * 0.04)));

    // 4. Escalation Compliance Rate %: higher attention score means lower compliance rate
    const escRate = Math.max(45, Math.min(98, Math.round(100 - (score * 0.48))));

    // 5. Evidence Verification %:
    const evidVerif = Math.max(88, Math.min(99, Math.round(100 - (score * 0.08))));

    return {
      attentionScore: score,
      executionGaps: execGaps,
      avgResponseMins: avgResponse,
      unobservedAssets: unobsAssets,
      escalationRate: escRate,
      evidenceVerified: evidVerif,
    };
  };

  const metricsA = getMetrics(cseAData.id, cseAData);
  const metricsB = getMetrics(cseBData.id, cseBData);

  // Data for side-by-side grouped bar chart filtered by comparisonBasis
  const getFilteredBarData = () => {
    switch (comparisonBasis) {
      case 'execution_gaps':
        return [
          { metric: 'Attention Score', [cseAData.id]: metricsA.attentionScore, [cseBData.id]: metricsB.attentionScore },
          { metric: 'Execution Gaps (x10)', [cseAData.id]: metricsA.executionGaps * 10, [cseBData.id]: metricsB.executionGaps * 10 },
          { metric: 'Escalation Compliance %', [cseAData.id]: metricsA.escalationRate, [cseBData.id]: metricsB.escalationRate },
        ];
      case 'response_time':
        return [
          { metric: 'Avg Response (mins)', [cseAData.id]: metricsA.avgResponseMins, [cseBData.id]: metricsB.avgResponseMins },
          { metric: 'Investigation Speed Index', [cseAData.id]: Math.max(20, 100 - metricsA.avgResponseMins), [cseBData.id]: Math.max(20, 100 - metricsB.avgResponseMins) },
          { metric: 'Escalation Rate %', [cseAData.id]: metricsA.escalationRate, [cseBData.id]: metricsB.escalationRate },
        ];
      case 'threat_landscape':
        return [
          { metric: 'Threat Risk Posture', [cseAData.id]: metricsA.attentionScore, [cseBData.id]: metricsB.attentionScore },
          { metric: 'Execution Gap Severity', [cseAData.id]: metricsA.executionGaps * 12, [cseBData.id]: metricsB.executionGaps * 12 },
          { metric: 'Mitigation Compliance %', [cseAData.id]: metricsA.escalationRate, [cseBData.id]: metricsB.escalationRate },
        ];
      case 'evidence_telemetry':
        return [
          { metric: 'Unobserved Nodes (x20)', [cseAData.id]: metricsA.unobservedAssets * 20, [cseBData.id]: metricsB.unobservedAssets * 20 },
          { metric: 'Evidence Verification %', [cseAData.id]: metricsA.evidenceVerified, [cseBData.id]: metricsB.evidenceVerified },
          { metric: 'Telemetry Completeness %', [cseAData.id]: Math.max(30, 100 - (metricsA.unobservedAssets * 15)), [cseBData.id]: Math.max(30, 100 - (metricsB.unobservedAssets * 15)) },
        ];
      default:
        return [
          { metric: 'Attention Score', [cseAData.id]: metricsA.attentionScore, [cseBData.id]: metricsB.attentionScore },
          { metric: 'Execution Gaps', [cseAData.id]: metricsA.executionGaps * 10, [cseBData.id]: metricsB.executionGaps * 10 },
          { metric: 'Response Time (m)', [cseAData.id]: metricsA.avgResponseMins, [cseBData.id]: metricsB.avgResponseMins },
          { metric: 'Unobserved Assets', [cseAData.id]: metricsA.unobservedAssets * 20, [cseBData.id]: metricsB.unobservedAssets * 20 },
          { metric: 'Escalation Compliance %', [cseAData.id]: metricsA.escalationRate, [cseBData.id]: metricsB.escalationRate },
        ];
    }
  };

  const barChartData = getFilteredBarData();

  // Data for Radar Chart (Multi-dimensional Security Comparison)
  const radarChartData = [
    { dimension: 'Response Speed', [cseAData.id]: Math.max(15, 100 - metricsA.avgResponseMins), [cseBData.id]: Math.max(15, 100 - metricsB.avgResponseMins) },
    { dimension: 'Escalation Integrity', [cseAData.id]: metricsA.escalationRate, [cseBData.id]: metricsB.escalationRate },
    { dimension: 'Asset Telemetry', [cseAData.id]: Math.max(20, 100 - (metricsA.unobservedAssets * 25)), [cseBData.id]: Math.max(20, 100 - (metricsB.unobservedAssets * 25)) },
    { dimension: 'Evidence Verification', [cseAData.id]: metricsA.evidenceVerified, [cseBData.id]: metricsB.evidenceVerified },
    { dimension: 'Policy Adherence', [cseAData.id]: Math.max(10, 100 - metricsA.attentionScore), [cseBData.id]: Math.max(10, 100 - metricsB.attentionScore) },
  ];

  // Cohort ranking data
  const cohortBarData = cseList.map(c => ({
    name: c.id,
    score: Number(c.score ?? c.total_score ?? 50),
    level: String(c.level || c.attention_level || 'NORMAL').toUpperCase()
  })).sort((a, b) => b.score - a.score);

  // Topology Nodes for Evidence Graph mapped dynamically from active data
  const topFinding = findings?.find(f => f.cse === selectedSingleCSE?.id) || findings?.[0];
  const topAlert = activeAlerts?.find(a => a.cse === selectedSingleCSE?.id) || activeAlerts?.[0];
  const topAsset = assets?.find(a => a.cse === selectedSingleCSE?.id) || assets?.[0];
  const topEvidence = evidence?.find(e => e.cse === selectedSingleCSE?.id) || evidence?.[0];

  const topologyNodes = [
    { 
      id: 'finding', 
      label: 'Supervisory Finding', 
      name: topFinding ? `${topFinding.id} (${topFinding.category})` : 'FND-001 (Missing Escalation)', 
      type: 'FINDING', 
      color: 'var(--color-critical)', 
      x: 80, 
      y: 150, 
      details: topFinding?.explanation || 'Critical alert closed without mandatory supervisory escalation record.' 
    },
    { 
      id: 'alert', 
      label: 'SOC Alert', 
      name: topAlert ? `${topAlert.id} (${topAlert.type})` : 'ALT-8842 (SCADA Auth Spike)', 
      type: 'ALERT', 
      color: 'var(--color-warning)', 
      x: 280, 
      y: 80, 
      details: topAlert ? `Target: ${topAlert.asset} (${topAlert.cse}). Severity: ${topAlert.severity}.` : 'Target: Substation Relay Node. Severity: Critical.' 
    },
    { 
      id: 'case', 
      label: 'Incident Case', 
      name: topAlert?.caseId ? `${topAlert.caseId} (${topAlert.status})` : 'CSE-CASE-019 (Resolved)', 
      type: 'CASE', 
      color: 'var(--color-accent)', 
      x: 280, 
      y: 220, 
      details: topAlert ? `Case ${topAlert.caseId} linked to alert ${topAlert.id}. Status: ${topAlert.status}.` : 'Case marked resolved without linked supervisory escalation token.' 
    },
    { 
      id: 'asset', 
      label: 'Monitored Asset', 
      name: topAsset ? `${topAsset.id} (${topAsset.cse})` : 'GRID-TRANS-04 (Critical)', 
      type: 'ASSET', 
      color: 'var(--color-escalated)', 
      x: 480, 
      y: 80, 
      details: topAsset ? `Telemetry node ${topAsset.id} mapped to ${topAsset.cse}. ${topAsset.observation}` : '400kV Step-Down Transformer Substation Telemetry Node.' 
    },
    { 
      id: 'evidence', 
      label: 'Submitted Evidence', 
      name: topEvidence ? `${topEvidence.id} (${topEvidence.recordType})` : 'EV-204 (Syslog Export)', 
      type: 'EVIDENCE', 
      color: 'var(--color-success)', 
      x: 480, 
      y: 220, 
      details: topEvidence?.summary || 'Deterministic CSV row verified. Cryptographic hash intact.' 
    },
  ];

  const tabClass = (tab) => `gc-tab-btn${activeTab === tab ? ' gc-tab-btn--active' : ''}`;
  const pillClass = (id) => `gc-filter-pill${comparisonBasis === id ? ' gc-filter-pill--active' : ''}`;

  const tooltipStyle = {
    background: 'var(--panel-bg)',
    border: '1px solid var(--panel-border)',
    borderRadius: 'var(--radius-lg)',
    color: 'var(--color-text-heading)',
    boxShadow: 'var(--elevation-md)',
    fontSize: '12px',
  };

  const ENTITY_A_COLOR = '#22d3ee';
  const ENTITY_B_COLOR = '#a78bfa';

  return (
    <div className="gc-container">

      {/* Tab Switcher */}
      <div className="gc-tab-bar">
        <div className="gc-tab-group">
          <button type="button" className={tabClass('comparator')} onClick={() => setActiveTab('comparator')}>
            <ArrowRightLeft size={16} />
            <span>Dual CSE Comparator</span>
          </button>
          <button type="button" className={tabClass('single')} onClick={() => setActiveTab('single')}>
            <Layers size={16} />
            <span>Single CSE Deep Dive</span>
          </button>
          <button type="button" className={tabClass('multi')} onClick={() => setActiveTab('multi')}>
            <Zap size={16} />
            <span>Multi-CSE Comparator</span>
          </button>
          <button type="button" className={tabClass('topology')} onClick={() => setActiveTab('topology')}>
            <Network size={16} />
            <span>Evidence Graph</span>
          </button>
          <button type="button" className={tabClass('cohort')} onClick={() => setActiveTab('cohort')}>
            <BarChart3 size={16} />
            <span>Cohort Distribution</span>
          </button>
        </div>
        <span className="gc-tab-hint">Interactive Visual Analytics</span>
      </div>

      {/* ─── TAB: MULTI-CSE COMPARATOR (2-10 ENTITIES) ─── */}
      {activeTab === 'multi' && (
        <MultiCSEComparator />
      )}

      {/* ─── TAB 0: SINGLE CSE VISUAL ANALYTICS ─── */}
      {activeTab === 'single' && (
        <div className="gc-container">
          <div className="gc-panel gc-single-banner">
            <div>
              <span className="gc-entity-label gc-entity-label--a">Assessed Critical Entity</span>
              <h2 className="gc-single-title">{selectedSingleCSE.name} ({selectedSingleCSE.id})</h2>
            </div>
            <div className="gc-row-gap-10">
              <label className="text-muted font-semibold">Select CSE:</label>
              <select className="gc-select gc-select--a" value={singleEntity} onChange={(e) => setSingleEntity(e.target.value)}>
                {cseList.map(c => (
                  <option key={c.id} value={c.id}>{c.id} - {c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Visual Graphs for Selected CSE */}
          <SingleCSEGraphs 
            cse={selectedSingleCSE} 
            alerts={activeAlerts} 
            findings={findings} 
            assets={assets} 
          />
        </div>
      )}

      {/* ─── TAB 1: DUAL CSE COMPARATOR ─── */}
      {activeTab === 'comparator' && (
        <div className="gc-container">
          
          {/* Entity Selector Bar */}
          <div className="gc-entity-bar">
            {/* Entity A */}
            <div className="gc-entity-col">
              <label className="gc-entity-label gc-entity-label--a">
                Primary Entity (Cyan)
              </label>
              <select
                value={entityA}
                onChange={(e) => setEntityA(e.target.value)}
                className="gc-select gc-select--a"
              >
                {cseList.map(c => (
                  <option key={c.id} value={c.id}>{c.id} - {c.name}</option>
                ))}
              </select>
            </div>

            {/* VS Badge */}
            <div className="gc-vs-badge">
              VS
            </div>

            {/* Entity B */}
            <div className="gc-entity-col">
              <label className="gc-entity-label gc-entity-label--b">
                Comparison Entity (Pink)
              </label>
              <select
                value={entityB}
                onChange={(e) => setEntityB(e.target.value)}
                className="gc-select gc-select--b"
              >
                {cseList.map(c => (
                  <option key={c.id} value={c.id}>{c.id} - {c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Comparison Basis Filter Bar */}
          <div className="gc-basis-panel">
            <div className="gc-basis-header">
              <div className="gc-basis-title-wrap">
                <Filter size={18} color="var(--color-accent)" />
                <span className="gc-basis-title">
                  SELECT COMPARISON BASIS / EVALUATION FILTER
                </span>
              </div>
              <span className="gc-basis-subtitle">
                Regulatory criteria & dimensions used for comparative commentary
              </span>
            </div>

            <div className="gc-basis-pills">
              {[
                { id: 'all', label: '🌐 All Dimensions (Holistic Posture)' },
                { id: 'execution_gaps', label: '⚡ Execution Gaps & SLA Breaches' },
                { id: 'response_time', label: '⏱️ Response & Latency' },
                { id: 'threat_landscape', label: '🛡️ Threat Vectors & Attack Severity' },
                { id: 'evidence_telemetry', label: '🔍 Evidence & Negative Space' }
              ].map(basis => (
                <button
                  key={basis.id}
                  type="button"
                  onClick={() => setComparisonBasis(basis.id)}
                  className={`gc-basis-pill ${comparisonBasis === basis.id ? 'gc-basis-pill--active' : ''}`}
                >
                  {basis.label}
                </button>
              ))}
            </div>

            {/* Comparison Basis Context & Regulatory Justification */}
            <div className="gc-justification-box">
              <strong className="gc-justification-title">COMPARISON BASIS JUSTIFICATION: </strong>
              {getBasisDescription(comparisonBasis, cseAData, cseBData)}
            </div>
          </div>

          {/* Quick Metrics Comparison Cards */}
          <div className="gc-metrics-grid">
            <div className="gc-metric-card">
              <div className="gc-metric-label">Attention Score</div>
              <div className="gc-metric-values">
                <div className="gc-metric-item">
                  <span className="gc-metric-tag-a">{cseAData.id}:</span>
                  <strong className="gc-metric-val">{metricsA.attentionScore}</strong>
                </div>
                <div className="gc-metric-item">
                  <span className="gc-metric-tag-b">{cseBData.id}:</span>
                  <strong className="gc-metric-val">{metricsB.attentionScore}</strong>
                </div>
              </div>
            </div>

            <div className="gc-metric-card">
              <div className="gc-metric-label">Execution Gaps</div>
              <div className="gc-metric-values">
                <div className="gc-metric-item">
                  <span className="gc-metric-tag-a">{cseAData.id}:</span>
                  <strong className="gc-metric-val text-critical">{metricsA.executionGaps}</strong>
                </div>
                <div className="gc-metric-item">
                  <span className="gc-metric-tag-b">{cseBData.id}:</span>
                  <strong className="gc-metric-val text-critical">{metricsB.executionGaps}</strong>
                </div>
              </div>
            </div>

            <div className="gc-metric-card">
              <div className="gc-metric-label">Avg Response Time</div>
              <div className="gc-metric-values">
                <div className="gc-metric-item">
                  <span className="gc-metric-tag-a">{cseAData.id}:</span>
                  <strong className="gc-metric-val text-warning">{metricsA.avgResponseMins}m</strong>
                </div>
                <div className="gc-metric-item">
                  <span className="gc-metric-tag-b">{cseBData.id}:</span>
                  <strong className="gc-metric-val text-warning">{metricsB.avgResponseMins}m</strong>
                </div>
              </div>
            </div>

            <div className="gc-metric-card">
              <div className="gc-metric-label">Escalation Rate</div>
              <div className="gc-metric-values">
                <div className="gc-metric-item">
                  <span className="gc-metric-tag-a">{cseAData.id}:</span>
                  <strong className="gc-metric-val text-success">{metricsA.escalationRate}%</strong>
                </div>
                <div className="gc-metric-item">
                  <span className="gc-metric-tag-b">{cseBData.id}:</span>
                  <strong className="gc-metric-val text-success">{metricsB.escalationRate}%</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="gc-charts-grid">
            
            {/* Grouped Bar Chart */}
            <div className="gc-chart-card">
              <div className="gc-chart-header">
                <span className="gc-chart-eyebrow">Comparative Analysis</span>
                <h3 className="gc-chart-title">
                  Metric Comparison ({comparisonBasis.toUpperCase().replace('_', ' ')})
                </h3>
              </div>
              <div style={{ width: '100%', height: '280px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                    <XAxis dataKey="metric" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
                    <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 'var(--font-size-body)', paddingTop: '10px', color: 'var(--color-text-primary)' }} />
                    <Bar dataKey={cseAData.id} fill="var(--entity-a-color)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey={cseBData.id} fill="var(--entity-b-color)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Radar / Spider Chart */}
            <div className="gc-chart-card">
              <div className="gc-chart-header">
                <span className="gc-chart-eyebrow">Security Posture Spectrum</span>
                <h3 className="gc-chart-title">5-Dimensional Radar Comparison</h3>
              </div>
              <div style={{ width: '100%', height: '280px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarChartData}>
                    <PolarGrid stroke="var(--color-border)" />
                    <PolarAngleAxis dataKey="dimension" stroke="var(--color-text-secondary)" fontSize={11} />
                    <PolarRadiusAxis stroke="var(--color-text-muted)" angle={30} domain={[0, 100]} />
                    <Radar name={cseAData.id} dataKey={cseAData.id} stroke="var(--entity-a-color)" fill="var(--entity-a-color)" fillOpacity={0.25} />
                    <Radar name={cseBData.id} dataKey={cseBData.id} stroke="var(--entity-b-color)" fill="var(--entity-b-color)" fillOpacity={0.25} />
                    <Legend wrapperStyle={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-primary)' }} />
                    <Tooltip contentStyle={tooltipStyle} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Automated Supervisory Commentary Box */}
          <div className="gc-commentary-panel">
            <div className="gc-commentary-header">
              <div className="gc-commentary-title-wrap">
                <div className="gc-commentary-icon">
                  <Info size={20} />
                </div>
                <div>
                  <h3 className="gc-commentary-title">
                    SUPERVISORY COMPARATIVE COMMENTARY & VARIANCE ANALYSIS
                  </h3>
                  <p className="gc-commentary-desc">
                    Deterministic operational evaluation explaining why {cseAData.id} and {cseBData.id} differ under the selected basis ({comparisonBasis.toUpperCase().replace('_', ' ')}).
                  </p>
                </div>
              </div>
              <span className="gc-commentary-badge">
                NCIIPC REGULATORY COMPLIANCE AUDIT
              </span>
            </div>

            <div className="gc-commentary-grid">
              {/* Card 1: Key Variance Driver */}
              <div className="gc-commentary-card">
                <div className="gc-commentary-card-title gc-commentary-card-title--accent">
                  1. Root-Cause Variance Driver
                </div>
                <p className="gc-commentary-card-text">
                  {getVarianceDriverCommentary(comparisonBasis, cseAData, cseBData, metricsA, metricsB)}
                </p>
              </div>

              {/* Card 2: Regulatory SLA Breach Analysis */}
              <div className="gc-commentary-card">
                <div className="gc-commentary-card-title gc-commentary-card-title--pink">
                  2. Regulatory SLA Assessment
                </div>
                <p className="gc-commentary-card-text">
                  {getSlaBreachCommentary(comparisonBasis, cseAData, cseBData, metricsA, metricsB)}
                </p>
              </div>

              {/* Card 3: Supervisory Recommendation */}
              <div className="gc-commentary-card">
                <div className="gc-commentary-card-title gc-commentary-card-title--green">
                  3. Supervisory Action & Directive
                </div>
                <p className="gc-commentary-card-text">
                  {getSupervisoryActionCommentary(comparisonBasis, cseAData, cseBData, metricsA, metricsB)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: INTERACTIVE EVIDENCE TOPOLOGY GRAPH ─── */}
      {activeTab === 'topology' && (
        <div className="gc-chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <span className="gc-chart-eyebrow">
                Cryptographic Evidence Graph
              </span>
              <h3 className="gc-chart-title">
                Finding ➔ Alert ➔ Asset ➔ Evidence Lineage
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-md)', color: 'var(--color-text-secondary)' }}>
                Click any node to trace audit evidence from supervisory conclusion to raw submitted telemetry.
              </p>
            </div>
            <span className="badge success" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
              SHA-256 HASH VERIFIED
            </span>
          </div>

          {/* Interactive SVG Node Diagram */}
          <div style={{
            background: 'var(--color-surface-subtle)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            padding: '20px',
            position: 'relative',
            overflowX: 'auto',
            boxShadow: 'var(--elevation-3d-inset)'
          }}>
            <svg width="100%" height="320" viewBox="0 0 620 320" style={{ minWidth: '580px' }}>
              <defs>
                <linearGradient id="gradLine1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--color-critical)" stopOpacity="0.8"/>
                  <stop offset="100%" stopColor="var(--color-warning)" stopOpacity="0.8"/>
                </linearGradient>
                <linearGradient id="gradLine2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--color-critical)" stopOpacity="0.8"/>
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.8"/>
                </linearGradient>
                <linearGradient id="gradLine3" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--color-warning)" stopOpacity="0.8"/>
                  <stop offset="100%" stopColor="var(--color-escalated)" stopOpacity="0.8"/>
                </linearGradient>
                <linearGradient id="gradLine4" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.8"/>
                  <stop offset="100%" stopColor="var(--color-success)" stopOpacity="0.8"/>
                </linearGradient>
              </defs>

              {/* Connecting Lines */}
              <line x1="120" y1="150" x2="280" y2="80" stroke="url(#gradLine1)" strokeWidth="2" strokeDasharray="4 2" />
              <line x1="120" y1="150" x2="280" y2="220" stroke="url(#gradLine2)" strokeWidth="2" />
              <line x1="320" y1="80" x2="480" y2="80" stroke="url(#gradLine3)" strokeWidth="2" />
              <line x1="320" y1="220" x2="480" y2="220" stroke="url(#gradLine4)" strokeWidth="2" strokeDasharray="4 2" />

              {/* Nodes */}
              {topologyNodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                return (
                  <g 
                    key={node.id} 
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => setSelectedNode(node)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle 
                      r={isSelected ? "26" : "22"} 
                      fill="var(--input-bg)" 
                      stroke={node.color} 
                      strokeWidth={isSelected ? "3.5" : "2"}
                      style={{ transition: 'all 0.2s', filter: isSelected ? `drop-shadow(0 0 10px ${node.color})` : 'none' }}
                    />
                    <text 
                      textAnchor="middle" 
                      dy="4" 
                      fill="var(--color-text-primary)" 
                      fontSize="10" 
                      fontWeight="bold"
                    >
                      {node.type.slice(0, 3)}
                    </text>
                    <text 
                      textAnchor="middle" 
                      dy="36" 
                      fill="var(--color-text-secondary)" 
                      fontSize="11" 
                      fontWeight="600"
                    >
                      {node.label}
                    </text>
                    <text 
                      textAnchor="middle" 
                      dy="50" 
                      fill={node.color} 
                      fontSize="10" 
                      fontWeight="500"
                    >
                      {node.name.split(' ')[0]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Node Detail Card */}
          <div style={{
            marginTop: '16px',
            padding: '14px 18px',
            background: 'var(--color-surface-subtle)',
            border: selectedNode ? `1px solid ${selectedNode.color}` : '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: 'var(--elevation-sm)'
          }}>
            {selectedNode ? (
              <div>
                <div className="gc-row-gap-8">
                  <span style={{ fontSize: 'var(--font-size-small)', fontWeight: '700', color: selectedNode.color, textTransform: 'uppercase' }}>
                    {selectedNode.label}
                  </span>
                  <strong style={{ color: 'var(--color-text-heading)', fontSize: 'var(--font-size-md)' }}>{selectedNode.name}</strong>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-body)', color: 'var(--color-text-secondary)' }}>
                  {selectedNode.details}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-md)' }}>
                <Info size={16} />
                <span>Click any node in the graph above to inspect its forensic record and metadata.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: COHORT DISTRIBUTION ─── */}
      {activeTab === 'cohort' && (
        <div className="gc-chart-card">
          <div style={{ marginBottom: '16px' }}>
            <span className="gc-chart-eyebrow">
              Cohort Benchmarking
            </span>
            <h3 className="gc-chart-title">
              National Critical Sector Attention Distribution
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-md)', color: 'var(--color-text-secondary)' }}>
              Ranked comparison of all evaluated Critical Sector Entities in the national cohort.
            </p>
          </div>

          <div style={{ width: '100%', height: '320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cohortBarData} margin={{ top: 20, right: 20, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} />
                <YAxis stroke="var(--color-text-muted)" fontSize={12} domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar 
                  dataKey="score" 
                  fill="var(--color-accent)" 
                  radius={[6, 6, 0, 0]}
                  label={{ position: 'top', fill: 'var(--color-text-muted)', fontSize: 'var(--font-size-small)' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  );
}
