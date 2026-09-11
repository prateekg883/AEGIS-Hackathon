import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid
} from 'recharts';
import { 
  ShieldAlert, AlertTriangle, Activity, CheckCircle2, Zap, Layers, Bell, 
  Filter, Search, RefreshCw, Cpu, Radio, ArrowUpRight, Check, ShieldCheck
} from 'lucide-react';
import { calculateAttentionBreakdown } from '../state/SOCContext';

export default function SingleCSEGraphs({ cse, alerts = [], findings = [], assets = [] }) {
  if (!cse) return null;

  const score = Number(cse.score ?? cse.total_score ?? 65);
  const rawSum = (cse.execution_gap_score || 0) + (cse.negative_space_score || 0) + (cse.peer_deviation_score || 0) + (cse.anomaly_score || 0);
  const breakdown = (rawSum === score && score > 0)
    ? {
        execution_gap_score: cse.execution_gap_score,
        negative_space_score: cse.negative_space_score,
        peer_deviation_score: cse.peer_deviation_score || 0,
        anomaly_score: cse.anomaly_score || 0,
      }
    : calculateAttentionBreakdown(score);

  const execGapScore = breakdown.execution_gap_score;
  const negSpaceScore = breakdown.negative_space_score;
  const peerDevScore = breakdown.peer_deviation_score;
  const anomalyScore = breakdown.anomaly_score;

  // Filter States for Parameter Drill-Down
  const [selectedAttack, setSelectedAttack] = useState('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [selectedAsset, setSelectedAsset] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 6;

  // Get raw records for this specific CSE
  const cseAlerts = useMemo(() => {
    return alerts.filter(a => a.cse === cse.id);
  }, [alerts, cse.id]);

  const cseFindings = useMemo(() => {
    return findings.filter(f => f.cse === cse.id);
  }, [findings, cse.id]);

  // Unique parameter lists for dropdowns
  const uniqueAttacks = useMemo(() => {
    const set = new Set(cseAlerts.map(a => a.type).filter(Boolean));
    return Array.from(set);
  }, [cseAlerts]);

  const uniqueAssets = useMemo(() => {
    const set = new Set(cseAlerts.map(a => a.asset).filter(Boolean));
    return Array.from(set);
  }, [cseAlerts]);

  // Filtered dataset based on supervisor parameters
  const filteredAlerts = useMemo(() => {
    return cseAlerts.filter(a => {
      const matchAttack = selectedAttack === 'ALL' || a.type === selectedAttack;
      const matchSeverity = selectedSeverity === 'ALL' || String(a.severity).toUpperCase() === selectedSeverity;
      const matchAsset = selectedAsset === 'ALL' || a.asset === selectedAsset;
      const matchStatus = selectedStatus === 'ALL' || String(a.status).toUpperCase() === selectedStatus;
      const matchSearch = !searchQuery || 
        `${a.id} ${a.type} ${a.asset} ${a.message || ''}`.toLowerCase().includes(searchQuery.toLowerCase());
      return matchAttack && matchSeverity && matchAsset && matchStatus && matchSearch;
    });
  }, [cseAlerts, selectedAttack, selectedSeverity, selectedAsset, selectedStatus, searchQuery]);

  // Reset all filters
  const resetFilters = () => {
    setSelectedAttack('ALL');
    setSelectedSeverity('ALL');
    setSelectedAsset('ALL');
    setSelectedStatus('ALL');
    setSearchQuery('');
    setPage(1);
  };

  // Severity counts for this CSE
  const criticalCount = cseAlerts.filter(a => String(a.severity).toLowerCase() === 'critical').length || (score > 60 ? 4 : 1);
  const highCount = cseAlerts.filter(a => String(a.severity).toLowerCase() === 'high').length || (score > 60 ? 7 : 3);
  const mediumCount = cseAlerts.filter(a => String(a.severity).toLowerCase() === 'medium').length || 6;
  const lowCount = cseAlerts.filter(a => String(a.severity).toLowerCase() === 'low').length || 12;

  // Filtered metrics
  const filteredCritical = filteredAlerts.filter(a => String(a.severity).toLowerCase() === 'critical').length;
  const filteredHigh = filteredAlerts.filter(a => String(a.severity).toLowerCase() === 'high').length;
  const filteredResolved = filteredAlerts.filter(a => a.status === 'Resolved' || a.status === 'Closed').length;

  // Risk breakdown data
  const riskBreakdown = [
    { name: 'Execution Gaps', score: execGapScore, fill: '#dc2626' },
    { name: 'Negative Space', score: negSpaceScore, fill: '#f59e0b' },
    { name: 'Peer Deviation', score: peerDevScore, fill: '#3b82f6' },
    { name: 'Anomalies', score: anomalyScore, fill: '#8b5cf6' },
  ];

  // Radar Posture data
  const radarData = [
    { dimension: 'Response Speed', value: Math.max(30, 100 - (score * 0.75)), fullMark: 100 },
    { dimension: 'Escalation Rate', value: Math.max(25, 100 - (execGapScore * 2.5)), fullMark: 100 },
    { dimension: 'Asset Coverage', value: Math.max(40, 100 - (negSpaceScore * 3)), fullMark: 100 },
    { dimension: 'Evidence Depth', value: 95, fullMark: 100 },
    { dimension: 'Policy Health', value: Math.max(20, 100 - score), fullMark: 100 },
  ];

  const alertSeverityData = [
    { severity: 'Critical', count: criticalCount, fill: '#dc2626' },
    { severity: 'High', count: highCount, fill: '#ea580c' },
    { severity: 'Medium', count: mediumCount, fill: '#f59e0b' },
    { severity: 'Low', count: lowCount, fill: '#10b981' },
  ];

  const paginatedAlerts = filteredAlerts.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(filteredAlerts.length / itemsPerPage) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
      
      {/* Visual Graphs Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Graph 1: Risk Contribution Breakdown */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
                Score Composition
              </span>
              <h3 style={{ margin: '2px 0 0 0', fontSize: '15px', color: '#f8fafc' }}>
                Risk Contribution Breakdown
              </h3>
            </div>
            <span style={{ fontSize: '12px', fontWeight: '800', color: score > 70 ? '#ef4444' : '#f59e0b' }}>
              Total: {score}/100
            </span>
          </div>

          <div style={{ width: '100%', height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskBreakdown} layout="vertical" margin={{ top: 10, right: 20, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={11} domain={[0, 40]} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ background: '#0b1329', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '8px', color: '#fff' }}
                  formatter={(val) => [`+${val} pts`, 'Contribution']}
                />
                <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                  {riskBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 2: 5-Dimensional Posture Radar */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
              Security Posture
            </span>
            <h3 style={{ margin: '2px 0 0 0', fontSize: '15px', color: '#f8fafc' }}>
              Multi-Dimensional Posture Radar
            </h3>
          </div>

          <div style={{ width: '100%', height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="rgba(148, 163, 184, 0.15)" />
                <PolarAngleAxis dataKey="dimension" stroke="#94a3b8" fontSize={10} />
                <PolarRadiusAxis stroke="#64748b" angle={30} domain={[0, 100]} />
                <Radar name={cse.id} dataKey="value" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.35} />
                <Tooltip 
                  contentStyle={{ background: '#0b1329', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '8px', color: '#fff' }} 
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 3: Alert Severity Distribution */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
              Incident Load
            </span>
            <h3 style={{ margin: '2px 0 0 0', fontSize: '15px', color: '#f8fafc' }}>
              Operational Alert Severity Profile
            </h3>
          </div>

          <div style={{ width: '100%', height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={alertSeverityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                <XAxis dataKey="severity" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip 
                  contentStyle={{ background: '#0b1329', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '8px', color: '#fff' }} 
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {alertSeverityData.map((entry, index) => (
                    <Cell key={`cell-sev-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ─── SECTION 2: INTERACTIVE MULTI-PARAMETER FILTER & DRILL-DOWN CONSOLE ─── */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: '14px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)'
      }}>
        
        {/* Header & Badges */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={18} color="#38bdf8" />
              <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc', fontWeight: '700' }}>
                Entity Parameter Filter & Telemetry Drill-Down
              </h3>
              <span style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700'
              }}>
                {cse.id} ({cse.name})
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
              Filter and isolate specific operational parameters, threat vectors, nodes, and supervisory compliance items for this entity.
            </p>
          </div>

          <button
            type="button"
            onClick={resetFilters}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <RefreshCw size={13} /> Reset Filters
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          background: 'rgba(30, 41, 59, 0.5)',
          padding: '14px',
          borderRadius: '10px',
          border: '1px solid rgba(148, 163, 184, 0.15)'
        }}>
          
          {/* Filter 1: Attack / Threat Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>
              Threat / Attack Type
            </label>
            <select
              value={selectedAttack}
              onChange={(e) => { setSelectedAttack(e.target.value); setPage(1); }}
              style={{
                height: '36px',
                background: '#0b1329',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                borderRadius: '6px',
                color: '#f8fafc',
                padding: '0 10px',
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Threat Signatures ({uniqueAttacks.length})</option>
              {uniqueAttacks.map(atk => (
                <option key={atk} value={atk}>{atk}</option>
              ))}
            </select>
          </div>

          {/* Filter 2: Severity */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>
              Severity Level
            </label>
            <select
              value={selectedSeverity}
              onChange={(e) => { setSelectedSeverity(e.target.value); setPage(1); }}
              style={{
                height: '36px',
                background: '#0b1329',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                borderRadius: '6px',
                color: '#f8fafc',
                padding: '0 10px',
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">🔴 Critical Priority ({criticalCount})</option>
              <option value="HIGH">🟠 High Priority ({highCount})</option>
              <option value="MEDIUM">🟡 Medium Priority ({mediumCount})</option>
              <option value="LOW">🟢 Low / Benign ({lowCount})</option>
            </select>
          </div>

          {/* Filter 3: Target Node / Asset */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>
              Monitored Node / Asset
            </label>
            <select
              value={selectedAsset}
              onChange={(e) => { setSelectedAsset(e.target.value); setPage(1); }}
              style={{
                height: '36px',
                background: '#0b1329',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                borderRadius: '6px',
                color: '#f8fafc',
                padding: '0 10px',
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Assets ({uniqueAssets.length})</option>
              {uniqueAssets.map(ast => (
                <option key={ast} value={ast}>{ast}</option>
              ))}
            </select>
          </div>

          {/* Filter 4: Disposition / Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>
              Supervisory Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
              style={{
                height: '36px',
                background: '#0b1329',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                borderRadius: '6px',
                color: '#f8fafc',
                padding: '0 10px',
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open Actions</option>
              <option value="ESCALATED">Gateway Escalated</option>
              <option value="RESOLVED">Resolved & Verified</option>
              <option value="UNDER REVIEW">Under Supervisory Review</option>
            </select>
          </div>

          {/* Search Box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>
              Instant Search
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search IP, alert code, payload..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                style={{
                  width: '100%',
                  height: '36px',
                  background: '#0b1329',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  padding: '0 10px 0 30px',
                  fontSize: '12px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '11px' }} />
            </div>
          </div>

        </div>

        {/* Filter Outcome Metric Badges */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px'
        }}>
          <div style={{ background: '#0b1329', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Filtered Records</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#38bdf8', marginTop: '4px' }}>
              {filteredAlerts.length} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>/ {cseAlerts.length} total</span>
            </div>
          </div>

          <div style={{ background: '#0b1329', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>High/Critical Density</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: (filteredCritical + filteredHigh) > 0 ? '#ef4444' : '#10b981', marginTop: '4px' }}>
              {filteredCritical + filteredHigh} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>records</span>
            </div>
          </div>

          <div style={{ background: '#0b1329', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Supervisory Findings Linked</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#f59e0b', marginTop: '4px' }}>
              {cseFindings.length} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>compliance items</span>
            </div>
          </div>

          <div style={{ background: '#0b1329', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Mitigation / Resolution Rate</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>
              {filteredAlerts.length > 0 ? Math.round((filteredResolved / filteredAlerts.length) * 100) : 100}%
            </div>
          </div>
        </div>

        {/* Filtered Telemetry Stream Table */}
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#0b1329', color: '#94a3b8', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
                <th style={{ padding: '10px 14px', fontWeight: '700' }}>Alert ID</th>
                <th style={{ padding: '10px 14px', fontWeight: '700' }}>Timestamp</th>
                <th style={{ padding: '10px 14px', fontWeight: '700' }}>Target Asset</th>
                <th style={{ padding: '10px 14px', fontWeight: '700' }}>Threat Signature</th>
                <th style={{ padding: '10px 14px', fontWeight: '700' }}>Severity</th>
                <th style={{ padding: '10px 14px', fontWeight: '700' }}>Status</th>
                <th style={{ padding: '10px 14px', fontWeight: '700' }}>Supervisory Compliance</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAlerts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                    No telemetry records matched the selected filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedAlerts.map((row, idx) => {
                  const isCrit = String(row.severity).toLowerCase() === 'critical';
                  const isHigh = String(row.severity).toLowerCase() === 'high';
                  return (
                    <tr 
                      key={row.id || idx}
                      style={{
                        background: idx % 2 === 0 ? 'rgba(15, 23, 42, 0.6)' : 'rgba(30, 41, 59, 0.3)',
                        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                        color: '#f8fafc'
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#38bdf8', fontWeight: '600' }}>
                        {row.id}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#94a3b8' }}>
                        {row.created}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <strong style={{ color: '#e2e8f0' }}>{row.asset}</strong>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          background: isCrit ? 'rgba(239, 68, 68, 0.15)' : isHigh ? 'rgba(234, 88, 12, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: isCrit ? '#f87171' : isHigh ? '#fb923c' : '#60a5fa',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: '600'
                        }}>
                          {row.type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          color: isCrit ? '#ef4444' : isHigh ? '#ea580c' : '#f59e0b',
                          fontWeight: '700'
                        }}>
                          {row.severity}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          background: row.status === 'Resolved' || row.status === 'Closed' ? 'rgba(16, 185, 129, 0.2)' : row.status === 'Escalated' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                          color: row.status === 'Resolved' || row.status === 'Closed' ? '#34d399' : row.status === 'Escalated' ? '#f87171' : '#94a3b8',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700'
                        }}>
                          {row.status || 'OPEN'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '11px' }}>
                        {isCrit ? '🚨 Mandatory Tier-2 Escalation' : isHigh ? '⚠️ Investigation Audit Required' : '✅ Standard Baseline'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Showing {((page - 1) * itemsPerPage) + 1} - {Math.min(page * itemsPerPage, filteredAlerts.length)} of {filteredAlerts.length} records
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={{
                  padding: '4px 10px',
                  background: page === 1 ? 'rgba(30, 41, 59, 0.5)' : '#1e293b',
                  color: page === 1 ? '#64748b' : '#f8fafc',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: page === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                Previous
              </button>
              <span style={{ fontSize: '12px', color: '#f8fafc', padding: '4px 8px', fontWeight: '700' }}>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                style={{
                  padding: '4px 10px',
                  background: page === totalPages ? 'rgba(30, 41, 59, 0.5)' : '#1e293b',
                  color: page === totalPages ? '#64748b' : '#f8fafc',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}

