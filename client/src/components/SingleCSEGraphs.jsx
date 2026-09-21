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
    { name: 'Execution Gaps', score: execGapScore, fill: 'var(--color-critical)' },
    { name: 'Negative Space', score: negSpaceScore, fill: 'var(--color-warning)' },
    { name: 'Peer Deviation', score: peerDevScore, fill: 'var(--color-accent)' },
    { name: 'Anomalies', score: anomalyScore, fill: 'var(--color-escalated)' },
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
    { severity: 'Critical', count: criticalCount, fill: 'var(--color-critical)' },
    { severity: 'High', count: highCount, fill: '#ea580c' },
    { severity: 'Medium', count: mediumCount, fill: 'var(--color-warning)' },
    { severity: 'Low', count: lowCount, fill: 'var(--color-success)' },
  ];

  const paginatedAlerts = filteredAlerts.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(filteredAlerts.length / itemsPerPage) || 1;

  return (
    <div className="scg-container">
      
      {/* Visual Graphs Grid */}
      <div className="scg-grid-charts">
        
        {/* Graph 1: Risk Contribution Breakdown */}
        <div style={{
          background: 'var(--color-navy)',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: 'var(--radius-xl)',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
                Score Composition
              </span>
              <h3 className="scg-stat-val-lg">
                Risk Contribution Breakdown
              </h3>
            </div>
            <span style={{ fontSize: 'var(--font-size-body)', fontWeight: '800', color: score > 70 ? 'var(--color-critical)' : 'var(--color-warning)' }}>
              Total: {score}/100
            </span>
          </div>

          <div className="scg-chart-box-sm">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskBreakdown} layout="vertical" margin={{ top: 10, right: 20, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" horizontal={false} />
                <XAxis type="number" stroke="var(--color-text-muted)" fontSize={11} domain={[0, 40]} />
                <YAxis dataKey="name" type="category" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ background: 'var(--color-login-bg)', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: 'var(--radius-lg)', color: 'var(--color-surface)' }}
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
          background: 'var(--color-navy)',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: 'var(--radius-xl)',
          padding: '20px'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
              Security Posture
            </span>
            <h3 className="scg-stat-val-lg">
              Multi-Dimensional Posture Radar
            </h3>
          </div>

          <div className="scg-chart-box-sm">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="rgba(148, 163, 184, 0.15)" />
                <PolarAngleAxis dataKey="dimension" stroke="var(--color-text-muted)" fontSize={10} />
                <PolarRadiusAxis stroke="var(--color-text-muted)" angle={30} domain={[0, 100]} />
                <Radar name={cse.id} dataKey="value" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.35} />
                <Tooltip 
                  contentStyle={{ background: 'var(--color-login-bg)', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: 'var(--radius-lg)', color: 'var(--color-surface)' }} 
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 3: Alert Severity Distribution */}
        <div style={{
          background: 'var(--color-navy)',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: 'var(--radius-xl)',
          padding: '20px'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
              Incident Load
            </span>
            <h3 className="scg-stat-val-lg">
              Operational Alert Severity Profile
            </h3>
          </div>

          <div className="scg-chart-box-sm">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={alertSeverityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                <XAxis dataKey="severity" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--color-text-muted)" fontSize={11} />
                <Tooltip 
                  contentStyle={{ background: 'var(--color-login-bg)', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: 'var(--radius-lg)', color: 'var(--color-surface)' }} 
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
        borderRadius: 'var(--radius-xl)',
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
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-xl)', color: 'var(--color-surface-subtle)', fontWeight: '700' }}>
                Entity Parameter Filter & Telemetry Drill-Down
              </h3>
              <span style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--color-accent)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-small)',
                fontWeight: '700'
              }}>
                {cse.id} ({cse.name})
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-body)', color: 'var(--color-text-muted)' }}>
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
              background: 'var(--color-critical-bg)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--color-critical-border)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-lg)',
              fontSize: 'var(--font-size-body)',
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
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(148, 163, 184, 0.15)'
        }}>
          
          {/* Filter 1: Attack / Threat Type */}
          <div className="scg-col-gap-4">
            <label className="scg-stat-label">
              Threat / Attack Type
            </label>
            <select
              value={selectedAttack}
              onChange={(e) => { setSelectedAttack(e.target.value); setPage(1); }}
              style={{
                height: '36px',
                background: 'var(--color-login-bg)',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-surface-subtle)',
                padding: '0 10px',
                fontSize: 'var(--font-size-body)',
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
          <div className="scg-col-gap-4">
            <label className="scg-stat-label">
              Severity Level
            </label>
            <select
              value={selectedSeverity}
              onChange={(e) => { setSelectedSeverity(e.target.value); setPage(1); }}
              style={{
                height: '36px',
                background: 'var(--color-login-bg)',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-surface-subtle)',
                padding: '0 10px',
                fontSize: 'var(--font-size-body)',
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
          <div className="scg-col-gap-4">
            <label className="scg-stat-label">
              Monitored Node / Asset
            </label>
            <select
              value={selectedAsset}
              onChange={(e) => { setSelectedAsset(e.target.value); setPage(1); }}
              style={{
                height: '36px',
                background: 'var(--color-login-bg)',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-surface-subtle)',
                padding: '0 10px',
                fontSize: 'var(--font-size-body)',
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
          <div className="scg-col-gap-4">
            <label className="scg-stat-label">
              Supervisory Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
              style={{
                height: '36px',
                background: 'var(--color-login-bg)',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-surface-subtle)',
                padding: '0 10px',
                fontSize: 'var(--font-size-body)',
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
          <div className="scg-col-gap-4">
            <label className="scg-stat-label">
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
                  background: 'var(--color-login-bg)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-surface-subtle)',
                  padding: '0 10px 0 30px',
                  fontSize: 'var(--font-size-body)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <Search size={14} color="var(--color-text-muted)" style={{ position: 'absolute', left: '10px', top: '11px' }} />
            </div>
          </div>

        </div>

        {/* Filter Outcome Metric Badges */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px'
        }}>
          <div style={{ background: 'var(--color-login-bg)', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: 'var(--radius-lg)', padding: '12px' }}>
            <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', fontWeight: '600' }}>Filtered Records</div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '800', color: 'var(--color-accent)', marginTop: '4px' }}>
              {filteredAlerts.length} <span className="scg-text-muted-500">/ {cseAlerts.length} total</span>
            </div>
          </div>

          <div style={{ background: 'var(--color-login-bg)', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: 'var(--radius-lg)', padding: '12px' }}>
            <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', fontWeight: '600' }}>High/Critical Density</div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '800', color: (filteredCritical + filteredHigh) > 0 ? 'var(--color-critical)' : 'var(--color-success)', marginTop: '4px' }}>
              {filteredCritical + filteredHigh} <span className="scg-text-muted-500">records</span>
            </div>
          </div>

          <div style={{ background: 'var(--color-login-bg)', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: 'var(--radius-lg)', padding: '12px' }}>
            <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', fontWeight: '600' }}>Supervisory Findings Linked</div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '800', color: 'var(--color-warning)', marginTop: '4px' }}>
              {cseFindings.length} <span className="scg-text-muted-500">compliance items</span>
            </div>
          </div>

          <div style={{ background: 'var(--color-login-bg)', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: 'var(--radius-lg)', padding: '12px' }}>
            <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', fontWeight: '600' }}>Mitigation / Resolution Rate</div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '800', color: 'var(--color-success)', marginTop: '4px' }}>
              {filteredAlerts.length > 0 ? Math.round((filteredResolved / filteredAlerts.length) * 100) : 100}%
            </div>
          </div>
        </div>

        {/* Filtered Telemetry Stream Table */}
        <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-body)', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--color-login-bg)', color: 'var(--color-text-muted)', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
                <th className="scg-th-cell">Alert ID</th>
                <th className="scg-th-cell">Timestamp</th>
                <th className="scg-th-cell">Target Asset</th>
                <th className="scg-th-cell">Threat Signature</th>
                <th className="scg-th-cell">Severity</th>
                <th className="scg-th-cell">Status</th>
                <th className="scg-th-cell">Supervisory Compliance</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAlerts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
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
                        color: 'var(--color-surface-subtle)'
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--color-accent)', fontWeight: '600' }}>
                        {row.id}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)' }}>
                        {row.created}
                      </td>
                      <td className="scg-td-cell">
                        <strong style={{ color: 'var(--color-border)' }}>{row.asset}</strong>
                      </td>
                      <td className="scg-td-cell">
                        <span style={{
                          background: isCrit ? 'rgba(239, 68, 68, 0.15)' : isHigh ? 'rgba(234, 88, 12, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: isCrit ? 'var(--color-critical-border)' : isHigh ? '#fb923c' : 'var(--color-login-accent)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontWeight: '600'
                        }}>
                          {row.type}
                        </span>
                      </td>
                      <td className="scg-td-cell">
                        <span style={{
                          color: isCrit ? 'var(--color-critical)' : isHigh ? '#ea580c' : 'var(--color-warning)',
                          fontWeight: '700'
                        }}>
                          {row.severity}
                        </span>
                      </td>
                      <td className="scg-td-cell">
                        <span style={{
                          background: row.status === 'Resolved' || row.status === 'Closed' ? 'rgba(16, 185, 129, 0.2)' : row.status === 'Escalated' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                          color: row.status === 'Resolved' || row.status === 'Closed' ? 'var(--color-secure)' : row.status === 'Escalated' ? 'var(--color-critical-border)' : 'var(--color-text-muted)',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--font-size-small)',
                          fontWeight: '700'
                        }}>
                          {row.status || 'OPEN'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-small)' }}>
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
            <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-muted)' }}>
              Showing {((page - 1) * itemsPerPage) + 1} - {Math.min(page * itemsPerPage, filteredAlerts.length)} of {filteredAlerts.length} records
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={{
                  padding: '4px 10px',
                  background: page === 1 ? 'rgba(30, 41, 59, 0.5)' : 'var(--color-navy)',
                  color: page === 1 ? 'var(--color-text-muted)' : 'var(--color-surface-subtle)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-body)',
                  cursor: page === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                Previous
              </button>
              <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-surface-subtle)', padding: '4px 8px', fontWeight: '700' }}>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                style={{
                  padding: '4px 10px',
                  background: page === totalPages ? 'rgba(30, 41, 59, 0.5)' : 'var(--color-navy)',
                  color: page === totalPages ? 'var(--color-text-muted)' : 'var(--color-surface-subtle)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-body)',
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

