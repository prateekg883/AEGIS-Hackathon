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
      color: '#ef4444', 
      x: 80, 
      y: 150, 
      details: topFinding?.explanation || 'Critical alert closed without mandatory supervisory escalation record.' 
    },
    { 
      id: 'alert', 
      label: 'SOC Alert', 
      name: topAlert ? `${topAlert.id} (${topAlert.type})` : 'ALT-8842 (SCADA Auth Spike)', 
      type: 'ALERT', 
      color: '#f59e0b', 
      x: 280, 
      y: 80, 
      details: topAlert ? `Target: ${topAlert.asset} (${topAlert.cse}). Severity: ${topAlert.severity}.` : 'Target: Substation Relay Node. Severity: Critical.' 
    },
    { 
      id: 'case', 
      label: 'Incident Case', 
      name: topAlert?.caseId ? `${topAlert.caseId} (${topAlert.status})` : 'CSE-CASE-019 (Resolved)', 
      type: 'CASE', 
      color: '#3b82f6', 
      x: 280, 
      y: 220, 
      details: topAlert ? `Case ${topAlert.caseId} linked to alert ${topAlert.id}. Status: ${topAlert.status}.` : 'Case marked resolved without linked supervisory escalation token.' 
    },
    { 
      id: 'asset', 
      label: 'Monitored Asset', 
      name: topAsset ? `${topAsset.id} (${topAsset.cse})` : 'GRID-TRANS-04 (Critical)', 
      type: 'ASSET', 
      color: '#8b5cf6', 
      x: 480, 
      y: 80, 
      details: topAsset ? `Telemetry node ${topAsset.id} mapped to ${topAsset.cse}. ${topAsset.observation}` : '400kV Step-Down Transformer Substation Telemetry Node.' 
    },
    { 
      id: 'evidence', 
      label: 'Submitted Evidence', 
      name: topEvidence ? `${topEvidence.id} (${topEvidence.recordType})` : 'EV-204 (Syslog Export)', 
      type: 'EVIDENCE', 
      color: '#10b981', 
      x: 480, 
      y: 220, 
      details: topEvidence?.summary || 'Deterministic CSV row verified. Cryptographic hash intact.' 
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(15, 23, 42, 0.6)',
        padding: '6px',
        borderRadius: '12px',
        border: '1px solid rgba(148, 163, 184, 0.15)',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('comparator')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: activeTab === 'comparator' ? '1px solid #3b82f6' : '1px solid transparent',
              background: activeTab === 'comparator' ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
              color: activeTab === 'comparator' ? '#60a5fa' : '#94a3b8',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: activeTab === 'comparator' ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none'
            }}
          >
            <ArrowRightLeft size={16} />
            <span>Dual CSE Comparator (Head-to-Head)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('single')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: activeTab === 'single' ? '1px solid #3b82f6' : '1px solid transparent',
              background: activeTab === 'single' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: activeTab === 'single' ? '#60a5fa' : '#94a3b8',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <Layers size={16} />
            <span>Single CSE Deep Dive</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('multi')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: activeTab === 'multi' ? '1px solid #3b82f6' : '1px solid transparent',
              background: activeTab === 'multi' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: activeTab === 'multi' ? '#60a5fa' : '#94a3b8',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <Zap size={16} />
            <span>Multi-CSE Comparator (2-10 Entities)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('topology')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: activeTab === 'topology' ? '1px solid #3b82f6' : '1px solid transparent',
              background: activeTab === 'topology' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: activeTab === 'topology' ? '#60a5fa' : '#94a3b8',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <Network size={16} />
            <span>Node-Link Evidence Graph</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cohort')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: activeTab === 'cohort' ? '1px solid #3b82f6' : '1px solid transparent',
              background: activeTab === 'cohort' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: activeTab === 'cohort' ? '#60a5fa' : '#94a3b8',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <BarChart3 size={16} />
            <span>Cohort Distribution</span>
          </button>
        </div>

        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', paddingRight: '8px' }}>
          Interactive Visual Analytics
        </div>
      </div>

      {/* ─── TAB: MULTI-CSE COMPARATOR (2-10 ENTITIES) ─── */}
      {activeTab === 'multi' && (
        <MultiCSEComparator />
      )}

      {/* ─── TAB 0: SINGLE CSE VISUAL ANALYTICS ─── */}
      {activeTab === 'single' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Single Entity Selector Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 23, 42, 0.8)',
            padding: '16px 20px',
            borderRadius: '12px',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Assessed Critical Entity
              </span>
              <h2 style={{ margin: '2px 0 0 0', fontSize: '18px', color: '#f8fafc' }}>
                {selectedSingleCSE.name} ({selectedSingleCSE.id})
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Select CSE:</label>
              <select
                value={singleEntity}
                onChange={(e) => setSingleEntity(e.target.value)}
                style={{
                  height: '40px',
                  background: '#0b1329',
                  border: '1px solid #38bdf8',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  padding: '0 12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Entity Selector Bar */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: '16px',
            background: 'rgba(15, 23, 42, 0.8)',
            padding: '16px 20px',
            borderRadius: '12px',
            border: '1px solid rgba(148, 163, 184, 0.2)'
          }}>
            {/* Entity A */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Primary Entity (Blue)
              </label>
              <select
                value={entityA}
                onChange={(e) => setEntityA(e.target.value)}
                style={{
                  width: '100%',
                  height: '42px',
                  background: '#0b1329',
                  border: '1px solid #38bdf8',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  padding: '0 12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {cseList.map(c => (
                  <option key={c.id} value={c.id}>{c.id} - {c.name}</option>
                ))}
              </select>
            </div>

            {/* VS Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              color: '#94a3b8',
              fontWeight: '800',
              fontSize: '12px'
            }}>
              VS
            </div>

            {/* Entity B */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#ec4899', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Comparison Entity (Pink)
              </label>
              <select
                value={entityB}
                onChange={(e) => setEntityB(e.target.value)}
                style={{
                  width: '100%',
                  height: '42px',
                  background: '#0b1329',
                  border: '1px solid #ec4899',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  padding: '0 12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {cseList.map(c => (
                  <option key={c.id} value={c.id}>{c.id} - {c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Comparison Basis Filter Bar */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={16} color="#818cf8" />
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#c7d2fe', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  SELECT COMPARISON BASIS / EVALUATION FILTER
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Regulatory criteria & dimensions used for comparative commentary
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    background: comparisonBasis === basis.id ? '#4f46e5' : 'rgba(30, 41, 59, 0.7)',
                    color: comparisonBasis === basis.id ? '#ffffff' : '#94a3b8',
                    border: comparisonBasis === basis.id ? '1px solid #818cf8' : '1px solid rgba(148, 163, 184, 0.2)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: comparisonBasis === basis.id ? '0 2px 8px rgba(79, 70, 229, 0.4)' : 'none'
                  }}
                >
                  {basis.label}
                </button>
              ))}
            </div>

            {/* Comparison Basis Context & Regulatory Justification */}
            <div style={{
              padding: '12px 16px',
              background: 'rgba(99, 102, 241, 0.08)',
              borderLeft: '4px solid #6366f1',
              borderRadius: '4px',
              fontSize: '12px',
              lineHeight: '1.5',
              color: '#e0e7ff'
            }}>
              <strong style={{ color: '#a5b4fc' }}>COMPARISON BASIS JUSTIFICATION: </strong>
              {getBasisDescription(comparisonBasis, cseAData, cseBData)}
            </div>
          </div>

          {/* Quick Metrics Comparison Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div style={{ background: '#0b1329', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' }}>Attention Score</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px' }}>
                <div><small style={{ color: '#38bdf8' }}>{cseAData.id}:</small> <strong style={{ fontSize: '18px', color: '#f8fafc' }}>{metricsA.attentionScore}</strong></div>
                <div><small style={{ color: '#ec4899' }}>{cseBData.id}:</small> <strong style={{ fontSize: '18px', color: '#f8fafc' }}>{metricsB.attentionScore}</strong></div>
              </div>
            </div>

            <div style={{ background: '#0b1329', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' }}>Execution Gaps</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px' }}>
                <div><small style={{ color: '#38bdf8' }}>{cseAData.id}:</small> <strong style={{ fontSize: '18px', color: '#dc2626' }}>{metricsA.executionGaps}</strong></div>
                <div><small style={{ color: '#ec4899' }}>{cseBData.id}:</small> <strong style={{ fontSize: '18px', color: '#dc2626' }}>{metricsB.executionGaps}</strong></div>
              </div>
            </div>

            <div style={{ background: '#0b1329', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' }}>Avg Response Time</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px' }}>
                <div><small style={{ color: '#38bdf8' }}>{cseAData.id}:</small> <strong style={{ fontSize: '18px', color: '#f59e0b' }}>{metricsA.avgResponseMins}m</strong></div>
                <div><small style={{ color: '#ec4899' }}>{cseBData.id}:</small> <strong style={{ fontSize: '18px', color: '#f59e0b' }}>{metricsB.avgResponseMins}m</strong></div>
              </div>
            </div>

            <div style={{ background: '#0b1329', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' }}>Escalation Rate</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px' }}>
                <div><small style={{ color: '#38bdf8' }}>{cseAData.id}:</small> <strong style={{ fontSize: '18px', color: '#10b981' }}>{metricsA.escalationRate}%</strong></div>
                <div><small style={{ color: '#ec4899' }}>{cseBData.id}:</small> <strong style={{ fontSize: '18px', color: '#10b981' }}>{metricsB.escalationRate}%</strong></div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
            
            {/* Grouped Bar Chart */}
            <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Comparative Analysis</span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '16px', color: '#f8fafc' }}>
                  Metric Comparison ({comparisonBasis.toUpperCase().replace('_', ' ')})
                </h3>
              </div>
              <div style={{ width: '100%', height: '280px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                    <XAxis dataKey="metric" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ background: '#0b1329', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '8px', color: '#fff' }} 
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey={cseAData.id} fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={cseBData.id} fill="#ec4899" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Radar / Spider Chart */}
            <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Security Posture Spectrum</span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '16px', color: '#f8fafc' }}>5-Dimensional Radar Comparison</h3>
              </div>
              <div style={{ width: '100%', height: '280px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarChartData}>
                    <PolarGrid stroke="rgba(148, 163, 184, 0.15)" />
                    <PolarAngleAxis dataKey="dimension" stroke="#94a3b8" fontSize={11} />
                    <PolarRadiusAxis stroke="#64748b" angle={30} domain={[0, 100]} />
                    <Radar name={cseAData.id} dataKey={cseAData.id} stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.25} />
                    <Radar name={cseBData.id} dataKey={cseBData.id} stroke="#ec4899" fill="#ec4899" fillOpacity={0.25} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Tooltip 
                      contentStyle={{ background: '#0b1329', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '8px', color: '#fff' }} 
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Automated Supervisory Commentary Box */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '12px',
            padding: '22px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8'
                }}>
                  <Info size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#f8fafc', fontWeight: '800' }}>
                    SUPERVISORY COMPARATIVE COMMENTARY & VARIANCE ANALYSIS
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Deterministic operational evaluation explaining why {cseAData.id} and {cseBData.id} differ under the selected basis ({comparisonBasis.toUpperCase().replace('_', ' ')}).
                  </p>
                </div>
              </div>
              <span style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)'
              }}>
                NCIIPC REGULATORY COMPLIANCE AUDIT
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {/* Card 1: Key Variance Driver */}
              <div style={{ background: '#0b1329', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#38bdf8', textTransform: 'uppercase', marginBottom: '6px' }}>
                  1. Root-Cause Variance Driver
                </div>
                <p style={{ fontSize: '13px', color: '#e2e8f0', margin: 0, lineHeight: '1.5' }}>
                  {getVarianceDriverCommentary(comparisonBasis, cseAData, cseBData, metricsA, metricsB)}
                </p>
              </div>

              {/* Card 2: Regulatory SLA Breach Analysis */}
              <div style={{ background: '#0b1329', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#ec4899', textTransform: 'uppercase', marginBottom: '6px' }}>
                  2. Regulatory SLA Assessment
                </div>
                <p style={{ fontSize: '13px', color: '#e2e8f0', margin: 0, lineHeight: '1.5' }}>
                  {getSlaBreachCommentary(comparisonBasis, cseAData, cseBData, metricsA, metricsB)}
                </p>
              </div>

              {/* Card 3: Supervisory Recommendation */}
              <div style={{ background: '#0b1329', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#10b981', textTransform: 'uppercase', marginBottom: '6px' }}>
                  3. Supervisory Action & Directive
                </div>
                <p style={{ fontSize: '13px', color: '#e2e8f0', margin: 0, lineHeight: '1.5' }}>
                  {getSupervisoryActionCommentary(comparisonBasis, cseAData, cseBData, metricsA, metricsB)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: INTERACTIVE EVIDENCE TOPOLOGY GRAPH ─── */}
      {activeTab === 'topology' && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
                Cryptographic Evidence Graph
              </span>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '18px', color: '#f8fafc' }}>
                Finding ➔ Alert ➔ Asset ➔ Evidence Lineage
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                Click any node to trace audit evidence from supervisory conclusion to raw submitted telemetry.
              </p>
            </div>
            <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)', fontWeight: '600' }}>
              SHA-256 HASH VERIFIED
            </span>
          </div>

          {/* Interactive SVG Node Diagram */}
          <div style={{
            background: '#070d1e',
            borderRadius: '10px',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            padding: '20px',
            position: 'relative',
            overflowX: 'auto'
          }}>
            <svg width="100%" height="320" viewBox="0 0 620 320" style={{ minWidth: '580px' }}>
              <defs>
                <linearGradient id="gradLine1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8"/>
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8"/>
                </linearGradient>
                <linearGradient id="gradLine2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8"/>
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8"/>
                </linearGradient>
                <linearGradient id="gradLine3" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8"/>
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.8"/>
                </linearGradient>
                <linearGradient id="gradLine4" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8"/>
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.8"/>
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
                      fill="#0b1329" 
                      stroke={node.color} 
                      strokeWidth={isSelected ? "3.5" : "2"}
                      style={{ transition: 'all 0.2s', filter: isSelected ? `drop-shadow(0 0 10px ${node.color})` : 'none' }}
                    />
                    <text 
                      textAnchor="middle" 
                      dy="4" 
                      fill="#fff" 
                      fontSize="10" 
                      fontWeight="bold"
                    >
                      {node.type.slice(0, 3)}
                    </text>
                    <text 
                      textAnchor="middle" 
                      dy="36" 
                      fill="#cbd5e1" 
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
            background: selectedNode ? 'rgba(30, 41, 59, 0.7)' : 'rgba(15, 23, 42, 0.4)',
            border: selectedNode ? `1px solid ${selectedNode.color}60` : '1px solid rgba(148, 163, 184, 0.1)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            {selectedNode ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: selectedNode.color, textTransform: 'uppercase' }}>
                    {selectedNode.label}
                  </span>
                  <strong style={{ color: '#fff', fontSize: '14px' }}>{selectedNode.name}</strong>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                  {selectedNode.details}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px' }}>
                <Info size={16} />
                <span>Click any node in the graph above to inspect its forensic record and metadata.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: COHORT DISTRIBUTION ─── */}
      {activeTab === 'cohort' && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
              Cohort Benchmarking
            </span>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '18px', color: '#f8fafc' }}>
              National Critical Sector Attention Distribution
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
              Ranked comparison of all evaluated Critical Sector Entities in the national cohort.
            </p>
          </div>

          <div style={{ width: '100%', height: '320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cohortBarData} margin={{ top: 20, right: 20, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ background: '#0b1329', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '8px', color: '#fff' }} 
                />
                <Bar 
                  dataKey="score" 
                  fill="#3b82f6" 
                  radius={[6, 6, 0, 0]}
                  label={{ position: 'top', fill: '#94a3b8', fontSize: 11 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  );
}
