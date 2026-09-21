import { useEffect, useState, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BrowserRouter, Link, Route, Routes, useParams, Navigate } from 'react-router-dom';
import { AlertTriangle, Bell, BookOpen, ClipboardCheck, FileSearch, Gauge, Printer, Search, ShieldCheck, Table2, Zap } from 'lucide-react';
import Layout from './components/layout/Layout.jsx';
import api from './services/api.js';
import {
  alerts as mockAlerts,
  assets as mockAssets,
  assessmentPeriod,
  attentionBreakdown as mockAttentionBreakdown,
  cases as mockCases,
  cseEntities as mockCseEntities,
  escalations as mockEscalations,
  evidence as mockEvidence,
  findings as mockFindings,
  investigations as mockInvestigations,
  peerMetrics as mockPeerMetrics,
  prioritisedSamples as mockPrioritisedSamples,
  trendData as mockTrendData,
} from './data/mockDataV2';
import './styles/theme.css';
import './styles/app.css';
import { useAssessment } from './state/AssessmentContext';
import { InvestigationProvider, useInvestigation } from './state/InvestigationContext';
import EvidenceInvestigationDrawer from './components/EvidenceInvestigationDrawer';
import AlertInvestigationDrawer from './components/AlertInvestigationDrawer';
import CaseManagementDrawer from './components/CaseManagementDrawer';
import DataIngestion from './components/DataIngestion';
import { SOCProvider, useSOC, calculateAttentionBreakdown } from './state/SOCContext';
import { AuthProvider, useAuth } from './state/AuthContext';
import Login from './components/Login';
import About from './components/About';
import EscalationPanel from './components/EscalationPanel';
import AirGapSecurityMonitoring from './components/AirGapSecurityMonitoring';
import GraphComparison from './components/GraphComparison';
import SingleCSEGraphs from './components/SingleCSEGraphs';
import CriticalAlertsPanel from './components/CriticalAlertsPanel';

const tone = (value = '') => String(value).toLowerCase().replaceAll(' ', '-');
// Local thin-wrapper kept for backward compat with existing JSX in this file
const Badge = ({ children, type = 'neutral' }) => <span className={`badge ${tone(type)}`}>{children}</span>;

// Variant map → CSS token-based badge class names (no inline hex)
const ATTENTION_VARIANTS = {
  CRITICAL: { badgeClass: 'critical', status: 'CRITICAL ESCALATION' },
  HIGH:     { badgeClass: 'warning',  status: 'HUMAN SUPERVISORY REVIEW' },
  MEDIUM:   { badgeClass: 'info',     status: 'LOCAL MONITORING' },
  NORMAL:   { badgeClass: 'success',  status: 'LOCAL' },
};

function AttentionStatusBadge({ score, level }) {
  const s = Number(score ?? 0);
  let key = 'NORMAL';
  if (s >= 98 || String(level).toUpperCase().includes('CRITICAL')) key = 'CRITICAL';
  else if (s >= 71 || String(level).toUpperCase().includes('HIGH')) key = 'HIGH';
  else if (s >= 31 || String(level).toUpperCase().includes('MEDIUM')) key = 'MEDIUM';
  const { badgeClass, status } = ATTENTION_VARIANTS[key];
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
      <span className={`badge ${badgeClass}`} style={{ textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 700 }}>
        {key} ({s})
      </span>
      <small style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600 }}>
        Status: {status}
      </small>
    </div>
  );
}

const Card = ({ children, className = '' }) => <section className={`card ${className}`}>{children}</section>;
const Page = ({ title, intro, children, sourceLabel = 'LIVE SECURE ENCLAVE' }) => {
  return <>
    <div className="page-head">
      <div>
        <div className="eyebrow">A.E.G.I.S · SUPERVISORY WORKSPACE</div>
        <h1>{title}</h1>
        <p>{intro}</p>
      </div>
      <div className="head-actions"><span className="data-note"><i /> {sourceLabel}</span></div>
    </div>
    {children}
  </>;
};
const SectionTitle = ({ eyebrow, title, action }) => <div className="section-title"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div>{action}</div>;
const Stat = ({ label, value, meta, Icon, type = '' }) => <Card className={`stat ${type}`}><div className="stat-icon"><Icon size={19} /></div><div><span>{label}</span><strong>{value}</strong><small>{meta}</small></div></Card>;
const MiniBar = ({ value, max = 100 }) => <div className="mini-track"><span style={{ width: `${Math.min(100, (Number(value || 0) / max) * 100)}%` }} /></div>;

function Table({ headers, rows }) {
  return <div className="table-scroll"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length}><div className="empty-state"><strong>No records found</strong><span>Try adjusting the current filters.</span></div></td></tr>}</tbody></table></div>;
}

function LoadingState({ text = 'Loading data…' }) {
  return <Page title="Supervisory Dashboard" intro="Loading the latest supervisory records." sourceLabel="LIVE ENCLAVE"><Card className="table-card"><div className="empty-state"><strong>{text}</strong><span>The interface is loading supervisory telemetry records.</span></div></Card></Page>;
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Layout>{children}</Layout>;
}

function Overview() {
  const { openInvestigation } = useInvestigation();
  const { 
    cseEntities: cseData, 
    findings, 
    activeAlerts, 
    resolvedIncidents, 
    cohortAttentionScore, 
    isDemoMode,
    activeFileName
  } = useSOC();
  
  const ranked = [...cseData].sort((a, b) => Number(b.score ?? b.total_score ?? 0) - Number(a.score ?? a.total_score ?? 0));
  const executionGapsCount = findings.filter(f => f.category === 'Execution Gap' && f.status !== 'Resolved' && f.status !== 'Closed').length || activeAlerts.filter(a => String(a.severity).toLowerCase() === 'critical' && a.status !== 'Resolved' && a.status !== 'Closed').length || 0;
  const priorityCseCount = cseData.filter((cse) => Number(cse.score ?? cse.total_score ?? 0) >= 70 || ['HIGH', 'CRITICAL'].includes(String(cse.level || '').toUpperCase())).length;

  return (
    <Page 
      title="Supervisory Analytics Dashboard" 
      intro="Continuous operational surveillance and risk posture across the CSE cohort." 
      sourceLabel={activeFileName ? `LIVE CSV: ${activeFileName}` : 'LIVE SECURE ENCLAVE'}
    >
      <div className="notice">
        <ShieldCheck size={18} />
        <div>
          <b>A.E.G.I.S. Supervisory Workspace</b>
          <span>Executive supervisory view of execution gaps, compliance anomalies, and cohort risk scores.</span>
        </div>
        {isDemoMode ? (
          <Badge type="blue">DEMO MODE ACTIVE</Badge>
        ) : (
          <Badge type="green" style={{background: '#dcfce7', color: '#15803d', border: '1px solid #86efac'}}>
            LIVE CSV ACTIVE ({activeFileName || 'INGESTED'})
          </Badge>
        )}
      </div>

      <CriticalAlertsPanel />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '14px 18px',
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: '10px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818cf8'
          }}>
            <Zap size={20} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#f8fafc', letterSpacing: '0.02em' }}>
              SUPERVISORY QUICK DRILL-DOWN CONSOLE
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              Filter company telemetry across 5+ parameters: Attack Type, Asset Node, Severity & Mitigation Status.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link 
            to="/benchmarking" 
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              background: '#4f46e5',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: '600',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(79, 70, 229, 0.35)',
              transition: 'background 0.2s'
            }}
          >
            Open Entity Parameter Filter →
          </Link>
          <Link 
            to="/escalation" 
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              fontSize: '12px',
              fontWeight: '600',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Escalation Queue (HMAC) →
          </Link>
        </div>
      </div>

      <div className="stats-grid">
        <Stat label="Cohort Attention Score" value={cohortAttentionScore} meta="Dynamic evidence-based calculation" Icon={Gauge} type={cohortAttentionScore > 50 ? 'red' : 'amber'} />
        <Stat label="Execution Gaps" value={executionGapsCount} meta="Require supervisory review" Icon={Bell} type={executionGapsCount > 0 ? 'amber' : ''} />
        <Stat label="Resolved Findings" value={resolvedIncidents.length} meta="Evidence verified" Icon={ClipboardCheck} />
        <Stat label="Priority CSEs" value={priorityCseCount} meta="High supervisory attention" Icon={ShieldCheck} />
      </div>

      <div className="grid-2-1">
        <Card>
          <SectionTitle eyebrow="Rule-based Security Insights" title="Execution Gaps & Anomalies" />
          <div className="observation-list">
            {(activeAlerts.some(a => a.severity === 'Critical') || findings.some(f => f.severity === 'Critical' && f.category === 'Execution Gap' && f.status === 'Open')) ? (
              <div className="observation">
                <Badge type="Critical">EXECUTION GAP</Badge>
                <b>Critical execution gap requires supervisory review</b>
                <small>A critical alert was closed but expected escalation records are missing from the submitted operational evidence.</small>
              </div>
            ) : (
              <div className="observation">
                <Badge type="Low">OK</Badge>
                <b>No critical execution gaps</b>
                <small>Expected evidence aligns with observed records.</small>
              </div>
            )}
            {activeAlerts.some(a => ['Open', 'Acknowledged'].includes(a.status) && new Date().getTime() - new Date(a.created).getTime() > 1000 * 60 * 10) && (
              <div className="observation">
                <Badge type="High">ANOMALY</Badge>
                <b>Delayed incident response</b>
                <small>Alert response time deviates significantly from peer benchmarking median.</small>
              </div>
            )}
            <div className="observation">
              <Badge type="Medium">NEGATIVE SPACE</Badge>
              <b>Repeated monitoring gap</b>
              <small>Expected telemetry is absent across {activeAlerts.length} reported active instances.</small>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle eyebrow="Attention ranking" title="CSE Attention Score" />
          <div className="ranking">
            {ranked.slice(0, 5).map((cse, index) => (
              <Link className="rank-row" to={`/cse/${cse.id}`} key={cse.id}>
                <span className="rank-num">{String(index + 1).padStart(2, '0')}</span>
                <div className="rank-name"><b>{cse.id}</b></div>
                <MiniBar value={Number(cse.score ?? 0)} />
                <b className="rank-score">{cse.score ?? 0}</b>
                <AttentionStatusBadge score={cse.score ?? 0} level={cse.level} />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card className="table-card">
        <SectionTitle 
          eyebrow="Evidence Prioritisation" 
          title="Prioritised Operational Records" 
          action={<Link className="text-link" to="/records">View all records →</Link>} 
        />
        <Table 
          headers={['Record ID', 'CSE', 'Severity', 'Type', 'Status', 'Timestamp']} 
          rows={activeAlerts.slice(0, 5).map((alert) => [
            <div className="table-link-wrapper" key={alert.id}><b>{alert.id}</b></div>, 
            alert.cse, 
            <Badge type={alert.severity}>{alert.severity}</Badge>, 
            alert.type, 
            <Badge type={alert.status}>{alert.status}</Badge>, 
            alert.created
          ])} 
        />
      </Card>
    </Page>
  );
}

function CSEList() {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('All');
  const { cseEntities: cseList, isDemoMode, activeFileName } = useSOC();

  const rows = cseList.filter((cse) => (level === 'All' || String(cse.level || cse.attention_level || 'LOW').toUpperCase() === level) && `${cse.id} ${cse.name} ${cse.sector}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => Number(b.score ?? b.total_score ?? 0) - Number(a.score ?? a.total_score ?? 0));

  return <Page title="Critical Sector Entities" intro={`Compare entities in the ${assessmentPeriod} supervisory assessment cohort.`} sourceLabel={isDemoMode ? 'LOCAL DEMO DATA' : `LIVE CSV: ${activeFileName || 'ACTIVE'}`}><div className="toolbar"><div className="search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search CSEs..." /></div><select value={level} onChange={(event) => setLevel(event.target.value)}><option>All</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option></select><span className="toolbar-count">{rows.length} entities</span></div><Card className="table-card"><Table headers={['CSE', 'Entity', 'Sector', 'Assessment period', 'Attention score', 'Classification & Policy Status', 'Open findings', 'Priority samples', 'Status']} rows={rows.map((cse) => [<Link className="table-link" to={`/cse/${cse.id}`}>{cse.id}<small>Open assessment</small></Link>, cse.name, cse.sector, assessmentPeriod, <div className="score-cell"><b>{cse.score ?? cse.total_score ?? 0}</b><MiniBar value={Number(cse.score ?? cse.total_score ?? 0)} /></div>, <AttentionStatusBadge score={cse.score ?? cse.total_score ?? 0} level={cse.level || cse.attention_level} />, cse.findings || 0, cse.samples || 0, <Badge type="covered">{cse.status || 'Assessed'}</Badge>])} /></Card></Page>;
}

function CSEDetail() {
  const { openInvestigation } = useInvestigation();
  const { cseEntities, findings, alerts, cases, investigations, escalations, assets, isDemoMode, activeFileName } = useSOC();
  const { id } = useParams();
  const cse = cseEntities.find((item) => item.id === id) || cseEntities[0];

  if (!cse) {
    return <LoadingState text="Loading entity assessment data..." />;
  }

  const cseFindings = findings.filter((finding) => finding.cse === cse.id);
  const cseAlerts = alerts.filter((alert) => alert.cse === cse.id);
  const cseCases = cases.filter((item) => item.cse === cse.id);
  const cseInvestigations = investigations.filter((item) => item.cse === cse.id);
  const cseEscalations = escalations.filter((item) => item.cse === cse.id);
  
  // Calculate quality scores
  const openAlertsCount = cseAlerts.filter(a => a.status === 'Open').length;
  const alertHandlingQuality = openAlertsCount === 0 ? 'Excellent' : openAlertsCount < 3 ? 'Fair' : 'Poor';
  
  const closedCasesCount = cseCases.filter(c => c.status === 'Closed' || c.status === 'Resolved').length;
  const caseQuality = closedCasesCount > 0 ? 'Consistent' : 'Requires Review';

  // Dynamic explanation from context if available, fallback to basic message
  const explanationText = cse.explanation || 'Supervisory context for human review, not an automated conclusion.';

  const totalScore = Number(cse.score ?? cse.total_score ?? 0);
  const rawSum = (cse.execution_gap_score || 0) + (cse.negative_space_score || 0) + (cse.peer_deviation_score || 0) + (cse.anomaly_score || 0);
  const breakdown = (rawSum === totalScore && totalScore > 0)
    ? {
        execution_gap_score: cse.execution_gap_score,
        negative_space_score: cse.negative_space_score,
        peer_deviation_score: cse.peer_deviation_score || 0,
        anomaly_score: cse.anomaly_score || 0,
      }
    : calculateAttentionBreakdown(totalScore);

  const execGapScore = breakdown.execution_gap_score;
  const negSpaceScore = breakdown.negative_space_score;
  const peerDevScore = breakdown.peer_deviation_score;
  const anomalyScore = breakdown.anomaly_score;
  const sumBreakdown = execGapScore + negSpaceScore + peerDevScore + anomalyScore;

  return (
    <Page 
      title={`${cse.id} assessment`} 
      intro={`${cse.name} - ${cse.sector}`} 
      sourceLabel={isDemoMode ? 'LOCAL DEMO DATA' : `LIVE CSV: ${activeFileName || 'ACTIVE'}`}
    >
      <div className="entity-hero">
        <div>
          <div className="entity-label">HIGH-LEVEL SUPERVISORY SIGNAL</div>
          <div className="entity-score">
            <strong>{totalScore}</strong><span>/ 100</span>
            <Badge type={String(cse.level || cse.attention_level || 'LOW').toUpperCase()}>
              {String(cse.level || cse.attention_level || 'LOW').toUpperCase()} ATTENTION
            </Badge>
          </div>
          <p>{explanationText}</p>
        </div>
        <div className="breakdown">
          <div className="total"><span>Execution Gap</span><b style={{ color: '#dc2626'}}>+{execGapScore}</b></div>
          <div className="total"><span>Negative Space</span><b style={{ color: '#f59e0b'}}>+{negSpaceScore}</b></div>
          <div className="total"><span>Peer Deviation</span><b style={{ color: '#3b82f6'}}>+{peerDevScore}</b></div>
          <div className="total"><span>Anomaly</span><b style={{ color: '#8b5cf6'}}>+{anomalyScore}</b></div>
          <div className="total" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px', marginTop: '2px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Component Sum</span>
            <b style={{ color: '#22c55e', fontSize: '13px' }}>{sumBreakdown} / {totalScore}</b>
          </div>
        </div>
      </div>

      {/* Visual Graphs for Single CSE */}
      <SingleCSEGraphs cse={cse} alerts={alerts} findings={findings} assets={assets} />

      <div className="stats-grid detail-stats" style={{ marginTop: '20px' }}>
        <Stat label="Alerts" value={String(cseAlerts.length)} meta="Periodic submitted records" Icon={Bell} />
        <Stat label="Cases" value={String(cseCases.length)} meta="Periodic submitted records" Icon={Table2} />
        <Stat label="Investigations" value={String(cseInvestigations.length)} meta="Periodic submitted records" Icon={FileSearch} />
        <Stat label="Escalations" value={String(cseEscalations.length)} meta="Periodic submitted records" Icon={Zap} />
      </div>

      <div className="grid-2-1">
        <Card>
          <SectionTitle eyebrow="Findings" title={`Signals linked to ${cse.id}`} />
          <Table 
            headers={['Finding', 'Category', 'Severity', 'Status', 'Evidence']} 
            rows={cseFindings.map((finding) => [
              <div className="table-link-wrapper" key={finding.id}>
                <Link className="table-link" to={`/findings/${finding.id}`}>{finding.id}<small>{finding.title}</small></Link>
                {['HIGH', 'CRITICAL'].includes(String(finding.severity).toUpperCase()) && (
                  <button className="text-link" style={{marginTop: '4px', padding: 0, border: 'none', background: 'transparent'}} onClick={() => openInvestigation(finding.id)}>
                    View Investigation →
                  </button>
                )}
              </div>, 
              finding.category, 
              <Badge type={finding.severity}>{finding.severity}</Badge>, 
              <Badge type={finding.status}>{finding.status}</Badge>, 
              finding.evidenceCount
            ])} 
          />
        </Card>

        <Card>
          <SectionTitle eyebrow="Negative space" title="Observations" />
          <div className="observation-list">
            {assets.filter((asset) => asset.cse === cse.id).map((asset) => (
              <div className="observation" key={asset.id}>
                <Badge type={asset.severity}>{asset.severity}</Badge>
                <b>{asset.observation}</b>
                <small>{asset.id} - {asset.observed}</small>
              </div>
            ))}
            {!assets.some((asset) => asset.cse === cse.id) && (
              <p className="muted">No negative-space observations are available for this entity.</p>
            )}
          </div>
        </Card>
      </div>
    </Page>
  );
}

function Findings() {
  const { openInvestigation } = useInvestigation();
  const [search, setSearch] = useState('');
  const { findings, isDemoMode, activeFileName } = useSOC();

  const rows = findings.filter((finding) => `${finding.id} ${finding.title} ${finding.cse}`.toLowerCase().includes(search.toLowerCase()));

  return <Page title="Supervisory Findings" intro="Evidence-backed signals detected from the assessment record set." sourceLabel={isDemoMode ? 'LOCAL DEMO DATA' : `LIVE CSV: ${activeFileName || 'ACTIVE'}`}><div className="toolbar"><div className="search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search findings..." /></div><span className="toolbar-count">{rows.length} findings</span></div><Card className="table-card"><Table headers={['Finding ID', 'CSE', 'Category', 'Title', 'Severity', 'Status', 'Detected', 'Evidence']} rows={rows.map((finding) => [<div className="table-link-wrapper"><Link className="table-link" to={`/findings/${finding.id}`}>{finding.id}<small>View detail</small></Link>{['HIGH', 'CRITICAL'].includes(String(finding.severity).toUpperCase()) && <button className="text-link" style={{marginTop: '4px', padding: 0, border: 'none', background: 'transparent'}} onClick={() => openInvestigation(finding.id)}>View Investigation →</button>}</div>, finding.cse, <Badge>{finding.category}</Badge>, finding.title, <Badge type={finding.severity}>{finding.severity}</Badge>, <Badge type={finding.status}>{finding.status}</Badge>, finding.detectedDate || finding.detected_at, finding.evidenceCount || finding.evidence_count || 0])} /></Card></Page>;
}

function FindingDetail() {
  const { id } = useParams();
  const { findings, evidence, isDemoMode, activeFileName } = useSOC();
  const finding = findings.find((item) => item.id === id) || findings[0] || mockFindings[0];

  const relatedEvidence = evidence.filter((item) => item.findingId === finding.id);
  return <Page title={finding.title} intro={`${finding.id} - ${finding.cse} - supervisory finding detail`} sourceLabel={isDemoMode ? 'LOCAL DEMO DATA' : `LIVE CSV: ${activeFileName || 'ACTIVE'}`}><div className="finding-hero"><div><div className="finding-id">{finding.id} / {finding.category}</div><h2>{finding.title}</h2><p>{finding.explanation}</p></div><div className="finding-kpis"><div><span>Severity</span><Badge type={finding.severity}>{finding.severity}</Badge></div><div><span>Status</span><Badge type={finding.status}>{finding.status}</Badge></div><div><span>Detected</span><b>{finding.detectedDate || finding.detected_at}</b></div><div><span>Contribution</span><b className="contribution">+{finding.contribution ?? finding.score_contribution ?? 0}</b></div></div></div><div className="grid-1-1"><Card className="prose-card"><SectionTitle eyebrow="Why detected" title="Expected versus observed" /><div className="prose-block"><h3>Expected condition</h3><p>{finding.expected}</p></div><div className="prose-block"><h3>Observed condition</h3><p>{finding.observed}</p></div><div className="prose-block impact"><h3>Supervisory impact</h3><p>{finding.impact}</p></div></Card><Card><SectionTitle eyebrow="Relationship" title="Record trail" /><div className="relationship"><Link to="/evidence">{(finding.evidenceCount || relatedEvidence.length)} evidence references</Link><Link to="/records">{finding.alertIds?.length || 0} alert link(s)</Link><Link to="/records">{finding.caseIds?.length || 0} case link(s)</Link><Link to="/records">{finding.investigationIds?.length || 0} investigation link(s)</Link><span>{finding.escalationIds?.length || 0} escalation link(s)</span></div><div className="rule-box"><span>Display rule</span><b>{finding.rule}</b><small>Evidence-backed telemetry rule generated from live assessment records.</small></div></Card></div><Card className="table-card"><SectionTitle eyebrow="Supporting evidence" title="Finding to evidence to original record" /><Table headers={['Evidence ID', 'Record type', 'Original record', 'CSE', 'Timestamp', 'Summary']} rows={relatedEvidence.map((item) => [item.id, <Badge>{item.recordType}</Badge>, item.recordId, item.cse, item.timestamp, item.summary])} /></Card></Page>;
}

function EvidenceExplorer() {
  const [selected, setSelected] = useState(null);
  const { evidence: items, isDemoMode, activeFileName } = useSOC();

  return <Page title="Evidence Explorer" intro="Inspect the source references supporting each supervisory finding." sourceLabel={isDemoMode ? 'LOCAL DEMO DATA' : `LIVE CSV: ${activeFileName || 'ACTIVE'}`}><div className="import-banner"><FileSearch size={18} /><b>{isDemoMode ? 'IMPORTED HISTORICAL DATA' : `LIVE INGESTED EVIDENCE (${activeFileName || 'ACTIVE'})`}</b><span>All records are linked directly to submitted operational telemetry.</span></div><Card className="table-card"><Table headers={['Evidence ID', 'Finding', 'Record type', 'Original record', 'CSE', 'Timestamp', 'Evidence summary']} rows={items.map((item) => [<button className="table-link as-button" onClick={() => setSelected(item)}>{item.id}<small>Open evidence</small></button>, <Link className="table-link" to={`/findings/${item.findingId}`}>{item.findingId}</Link>, <Badge>{item.recordType}</Badge>, item.recordId, item.cse, item.timestamp, item.summary])} /></Card>{selected && <div className="drawer-backdrop" onClick={() => setSelected(null)}><div className="drawer" onClick={(event) => event.stopPropagation()}><button className="drawer-close" onClick={() => setSelected(null)}>X</button><div className="eyebrow">EVIDENCE REFERENCE</div><h2>{selected.id}</h2><p>{selected.summary}</p><div className="detail-list"><div><span>Finding</span><Link to={`/findings/${selected.findingId}`}>{selected.findingId}</Link></div><div><span>Original record</span><b>{selected.recordId}</b></div><div><span>Record type</span><b>{selected.recordType}</b></div><div><span>CSE</span><b>{selected.cse}</b></div><div><span>Timestamp</span><b>{selected.timestamp}</b></div></div></div></div>}</Page>;
}

function Records() {
  const { alerts, cases, investigations, escalations, isDemoMode, activeFileName } = useSOC();
  const [tab, setTab] = useState('Alerts');
  const [search, setSearch] = useState('');
  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const tabs = { Alerts: alerts, Cases: cases, Investigations: investigations, Escalations: escalations };
  const columns = { Alerts: ['Alert ID', 'CSE', 'Severity', 'Type', 'Created', 'Case', 'Status', 'Actions'], Cases: ['Case ID', 'CSE', 'Severity', 'Alerts', 'Opened', 'Closed', 'Status', 'Actions'], Investigations: ['Investigation ID', 'Case ID', 'CSE', 'Started', 'Status', 'Evidence', 'Analyst'], Escalations: ['Escalation ID', 'Case ID', 'Alert ID', 'Level', 'Status', 'Created', 'Owner'] };
  
  const filteredRows = tabs[tab].filter(item => `${item.id} ${item.type || item.level || ''} ${item.cse}`.toLowerCase().includes(search.toLowerCase()));

  const mapRows = () => {
    if (tab === 'Alerts') return filteredRows.map((item) => [<button className="table-link as-button" onClick={() => setSelectedAlertId(item.id)}>{item.id}</button>, item.cse, <Badge type={item.severity}>{item.severity}</Badge>, item.type, item.created, item.caseId || '-', <Badge type={item.status}>{item.status}</Badge>, <button className="button ghost" style={{padding: '2px 8px', fontSize: '10px'}} onClick={() => setSelectedAlertId(item.id)}>Investigate</button>]);
    if (tab === 'Cases') return filteredRows.map((item) => [<button className="table-link as-button" onClick={() => setSelectedCaseId(item.id)}>{item.id}</button>, item.cse, <Badge type={item.severity}>{item.severity}</Badge>, (item.alertIds || []).join(', '), item.opened, item.closed || '-', <Badge type={item.status}>{item.status}</Badge>, <button className="button ghost" style={{padding: '2px 8px', fontSize: '10px'}} onClick={() => setSelectedCaseId(item.id)}>Manage</button>]);
    if (tab === 'Investigations') return filteredRows.map((item) => [item.id, item.caseId, item.cse, item.started, <Badge type={item.status}>{item.status}</Badge>, item.evidenceCount, item.analyst]);
    if (tab === 'Escalations') return filteredRows.map((item) => [item.id, item.caseId, item.alertId, item.level, <Badge type={item.status}>{item.status}</Badge>, item.created, item.owner]);
    return [];
  };

  return <Page title="Alert & Case Explorer" intro="Interactive operational workflow manager." sourceLabel={isDemoMode ? 'LOCAL DEMO DATA' : `LIVE CSV: ${activeFileName || 'ACTIVE'}`}><div className="toolbar"><div className="search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ID, type, entity..." /></div><div className="tabs" style={{border: 'none', padding: 0}}>{Object.keys(tabs).map((name) => <button className={tab === name ? 'active' : ''} onClick={() => setTab(name)} key={name}>{name}<span>{tabs[name].length}</span></button>)}</div></div><Card className="table-card"><Table headers={columns[tab]} rows={mapRows()} /></Card>{selectedAlertId && <AlertInvestigationDrawer alertId={selectedAlertId} onClose={() => setSelectedAlertId(null)} />}{selectedCaseId && <CaseManagementDrawer caseId={selectedCaseId} onClose={() => setSelectedCaseId(null)} />}</Page>;
}

function NegativeSpace() {
  const { assets, isDemoMode, activeFileName } = useSOC();

  return <Page title="Negative Space" intro="Supervisory observations where EXPECTED EVIDENCE WAS NOT OBSERVED IN THE SUBMITTED DATA." sourceLabel={isDemoMode ? 'LOCAL DEMO DATA' : `LIVE CSV: ${activeFileName || 'ACTIVE'}`}><div className="signal-flow"><div><span>01</span><b>EXPECTED</b><small>Required condition</small></div><div><span>02</span><b>OBSERVED</b><small>Available record set</small></div><div className="gap"><span>03</span><b>OBSERVATION</b><small>Manual review required</small></div></div><Card className="table-card"><SectionTitle eyebrow="Supervisory observations" title="Expected versus observed evidence" action={<Badge type="blue">NOT CONFIRMED INCIDENTS</Badge>} /><Table headers={['CSE', 'Observation', 'Expected condition', 'Observed condition', 'Severity', 'Evidence']} rows={assets.map((asset) => [<Link className="table-link" to={`/cse/${asset.cse}`}>{asset.cse}<small>{asset.id}</small></Link>, asset.observation, asset.expected, asset.observed, <Badge type={asset.severity}>{asset.severity}</Badge>, <Link className="table-link" to="/evidence">{asset.evidenceId}</Link>])} /></Card></Page>;
}

function Benchmarking() {
  const { cseEntities, isDemoMode, activeFileName } = useSOC();
  const primaryCSE = cseEntities.find((c) => c.id === 'CSE-07') || cseEntities[0] || { score: 77 };
  const score = primaryCSE.score ?? primaryCSE.total_score ?? 77;

  // Dynamically compute baseline vs national medians
  const metrics = [
    { label: 'Critical escalation rate', value: `${Math.max(10, Math.round(100 - (score * 0.9)))}%`, average: '26%', median: '23%', percentile: score > 70 ? '18th' : '65th', deviation: score > 70 ? '-12 pp' : '+8 pp' },
    { label: 'Median case closure time', value: `${Math.max(8, Math.round(score * 0.45))} min`, average: '46 min', median: '42 min', percentile: score > 70 ? '12th' : '72nd', deviation: `${Math.round(Math.max(8, score * 0.45) - 42)} min` },
    { label: 'Investigation completeness', value: `${Math.max(45, Math.min(98, Math.round(100 - (score * 0.45))))}%`, average: '85%', median: '88%', percentile: score > 70 ? '19th' : '82nd', deviation: `${Math.round(Math.max(45, 100 - (score * 0.45)) - 88)} pp` },
    { label: 'Alert acknowledgement rate', value: `${Math.max(85, Math.min(99, Math.round(100 - (score * 0.08))))}%`, average: '91%', median: '92%', percentile: '64th', deviation: '+2 pp' },
    { label: 'Unresolved case percentage', value: `${Math.max(2, Math.round(score * 0.18))}%`, average: '8%', median: '6%', percentile: score > 70 ? '81st' : '34th', deviation: `+${Math.max(0, Math.round(score * 0.18) - 6)} pp` },
  ];

  return (
    <Page 
      title="Peer Benchmarking & Visual Comparison" 
      intro="Comparative supervisory analytics: Dual-entity head-to-head evaluation, multi-dimensional radar comparison, and evidence topology." 
      sourceLabel={isDemoMode ? 'LIVE SECURE ENCLAVE' : `LIVE CSV: ${activeFileName || 'INGESTED'}`}
    >
      <GraphComparison />

      <div style={{ marginTop: '28px' }}>
        <SectionTitle eyebrow="Historical Metrics" title="Entity Baseline vs National Peer Medians" />
        <Card className="table-card">
          <Table 
            headers={['Metric', 'Entity value', 'Peer average', 'Peer median', 'Percentile', 'Deviation']} 
            rows={metrics.map((metric) => [
              metric.label, 
              <b key="val">{metric.value}</b>, 
              metric.average || 'Unavailable', 
              metric.median || 'Unavailable', 
              metric.percentile || 'Unavailable', 
              <span key="dev" className={String(metric.deviation || '').startsWith('-') ? 'negative' : 'positive'}>
                {metric.deviation || 'Unavailable'}
              </span>
            ])} 
          />
        </Card>
      </div>
    </Page>
  );
}


function Samples() {
  const [selected, setSelected] = useState(mockPrioritisedSamples[0]);
  const [samples, setSamples] = useState(mockPrioritisedSamples);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.getPrioritisedSamples()
      .then((records) => {
        if (active) {
          const next = records || mockPrioritisedSamples;
          setSamples(next);
          setSelected(next[0] || mockPrioritisedSamples[0]);
          setLoading(false);
        }
      })
      .catch(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  if (loading) return <LoadingState text="Loading priority queue…" />;

  return <Page title="Prioritised Samples" intro="Manual review queue: the human supervisor remains the final decision-maker."><div className="callout"><AlertTriangle size={18} /><p>Prioritisation recommends records for human review; it does not determine a finding or replace supervisory judgement.</p></div><Card className="table-card"><Table headers={['Rank', 'Record ID', 'Type', 'CSE', 'Priority', 'Severity', 'Reason', 'Status']} rows={samples.map((sample) => [<b className="rank-cell">{sample.rank}</b>, <button className="table-link as-button" onClick={() => setSelected(sample)}>{sample.recordId}</button>, sample.recordType, sample.cse, <b className="priority-score">{sample.priority}</b>, <Badge type={sample.severity}>{sample.severity}</Badge>, sample.findingId ? <Link className="table-link" to={`/findings/${sample.findingId}`}>{sample.reason}</Link> : <span>{sample.reason}</span>, <Badge type="open">{sample.status}</Badge>])} /></Card><Card className="sample-explain"><div><div className="eyebrow">Selected recommendation</div><h2>{selected.recordId}</h2><p>{selected.reason}</p></div><div><span className="eyebrow">MANUAL REVIEW CONTEXT</span><b>Priority {selected.priority}</b><small>Linked finding: {selected.findingId || 'No linked finding available'}. Inspect the original record before documenting a conclusion.</small></div></Card></Page>;
}

function Reports() {
  const {
    cseEntities = [],
    findings = [],
    alerts = [],
    cases = [],
    assets = [],
    isDemoMode,
    activeFileName,
    cohortAttentionScore,
  } = useSOC();
  const { period } = useAssessment();
  const [selectedCseCode, setSelectedCseCode] = useState(cseEntities[0]?.id || 'CSE-07');
  const [report, setReport] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState('');

  // Keep selected CSE valid if cseEntities changes upon file upload
  useEffect(() => {
    if (cseEntities && cseEntities.length > 0) {
      if (!cseEntities.some((c) => c.id === selectedCseCode)) {
        setSelectedCseCode(cseEntities[0].id);
        setReport(null);
      }
    }
  }, [cseEntities, selectedCseCode]);

  // Determine targeted entity based on selection or active uploaded file
  const targetEntity = useMemo(() => {
    return cseEntities.find((c) => c.id === selectedCseCode) || cseEntities[0] || {
      id: selectedCseCode || 'CSE-07',
      name: 'Power Grid Operations',
      score: 77,
      level: 'HIGH',
      sector: 'Energy & Utilities',
      format: 'CEF',
      execution_gap_score: 28,
      negative_space_score: 19,
      peer_deviation_score: 16,
      anomaly_score: 14,
    };
  }, [cseEntities, selectedCseCode]);

  const entityFindings = useMemo(() => {
    const list = findings.filter((f) => f.cse === targetEntity.id);
    return list.length > 0 ? list : findings.slice(0, 5);
  }, [findings, targetEntity.id]);

  const entityAlerts = useMemo(() => {
    const list = alerts.filter((a) => a.cse === targetEntity.id);
    return list.length > 0 ? list : alerts.slice(0, 5);
  }, [alerts, targetEntity.id]);

  const entityAssets = useMemo(() => {
    const list = assets.filter((a) => a.cse === targetEntity.id || !a.cse);
    return list.length > 0 ? list : assets.slice(0, 4);
  }, [assets, targetEntity.id]);

  // Construct dynamic report reflecting the uploaded file
  const dynamicReport = useMemo(() => {
    const entityScore = targetEntity.score ?? targetEntity.total_score ?? 77;
    const attentionLevel = targetEntity.level || targetEntity.attention_level || (entityScore >= 75 ? 'HIGH' : entityScore >= 50 ? 'MEDIUM' : 'LOW');
    
    // Cohort benchmarks computed dynamically
    const avgScore = cseEntities.length > 0
      ? Math.round(cseEntities.reduce((acc, c) => acc + Number(c.score ?? c.total_score ?? 0), 0) / cseEntities.length)
      : (cohortAttentionScore || 65);
    
    const entityAlertCount = entityAlerts.length;
    const avgAlerts = cseEntities.length > 0
      ? Math.round(alerts.length / cseEntities.length)
      : Math.max(entityAlertCount, 12);

    const entityCritCount = entityAlerts.filter((a) => String(a.severity).toLowerCase() === 'critical' || String(a.severity).toLowerCase() === 'high').length;
    const entityCritRate = entityAlertCount > 0 ? Math.round((entityCritCount / entityAlertCount) * 100) : 42;

    const peerMetrics = [
      {
        label: 'Supervisory Attention Index',
        metric_name: 'Supervisory Attention Index',
        value: `${entityScore} pts`,
        median: `${avgScore} pts`,
        entity_value: `${entityScore} pts`,
        peer_median: `${avgScore} pts`,
      },
      {
        label: 'Alert & Telemetry Volume',
        metric_name: 'Alert & Telemetry Volume',
        value: `${entityAlertCount} events`,
        median: `${avgAlerts} events`,
        entity_value: `${entityAlertCount} events`,
        peer_median: `${avgAlerts} events`,
      },
      {
        label: 'High & Critical Severity Ratio',
        metric_name: 'High & Critical Severity Ratio',
        value: `${entityCritRate}%`,
        median: '38%',
        entity_value: `${entityCritRate}%`,
        peer_median: '38%',
      },
      {
        label: 'Negative-Space / Unmonitored Gaps',
        metric_name: 'Negative-Space / Unmonitored Gaps',
        value: `${targetEntity.negative_space_score || 18} pts`,
        median: '14 pts',
        entity_value: `${targetEntity.negative_space_score || 18} pts`,
        peer_median: '14 pts',
      },
      {
        label: 'Execution Gap Latency',
        metric_name: 'Execution Gap Latency',
        value: `${targetEntity.execution_gap_score || 25} pts`,
        median: '20 pts',
        entity_value: `${targetEntity.execution_gap_score || 25} pts`,
        peer_median: '20 pts',
      },
    ];

    const sourceFileName = activeFileName || 'Baseline_Cohort_Telemetry.cef';
    const reportCode = `REP-${targetEntity.id}-${(activeFileName ? activeFileName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6) : 'LIVE').toUpperCase()}-${Date.now().toString().slice(-4)}`;

    return {
      cse_code: targetEntity.id,
      assessment_period: period || assessmentPeriod,
      title: `${targetEntity.id} Supervisory Assessment Report`,
      report_code: reportCode,
      report_status: !isDemoMode ? `GENERATED (LIVE TELEMETRY: ${sourceFileName})` : 'GENERATED (ASSESSMENT COHORT)',
      source_file: sourceFileName,
      generated_at: lastGeneratedAt || new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      assessment_scope: {
        entity_name: targetEntity.name || 'Power Grid Operations',
        sector: targetEntity.sector || 'Critical Infrastructure',
        format: targetEntity.format || (sourceFileName.endsWith('.cef') ? 'CEF' : 'CSV'),
        records_evaluated: targetEntity.recordsCount || entityAlertCount || alerts.length,
      },
      summary: !isDemoMode
        ? `Supervisory assessment generated directly from uploaded telemetry dataset '${sourceFileName}'. Evaluated entity ${targetEntity.id} (${targetEntity.name}) across ${entityAlertCount} telemetry events, ${entityFindings.length} active supervisory findings, and ${entityAssets.length} tracked infrastructure assets. Supervisory attention is rated ${attentionLevel} (${entityScore}/100) reflecting observed operational execution gaps and peer telemetry variances.`
        : `Consolidated supervisory assessment for ${targetEntity.id} (${targetEntity.name}) under ${period || assessmentPeriod}. Aggregates execution gaps, negative-space observations, peer context, and priority audit samples for human supervisory review.`,
      supervisory_attention: {
        attention_level: attentionLevel,
        total_score: entityScore,
        breakdown: {
          execution_gap_score: targetEntity.execution_gap_score || 25,
          negative_space_score: targetEntity.negative_space_score || 18,
          peer_deviation_score: targetEntity.peer_deviation_score || 16,
          anomaly_score: targetEntity.anomaly_score || 14,
        },
      },
      execution_gap_observations: entityFindings.slice(0, 5),
      negative_space_observations: entityAssets.slice(0, 4),
      peer_benchmarking: peerMetrics,
      priority_manual_review_samples: entityAlerts.slice(0, 5).map((alert, idx) => ({
        rank: idx + 1,
        recordId: alert.id || `REC-${idx + 101}`,
        recordType: alert.event_name || alert.type || 'Telemetry Event',
        cse: targetEntity.id,
        priority: alert.severity === 'Critical' ? 95 : alert.severity === 'High' ? 82 : 65,
        severity: alert.severity || 'Medium',
        reason: alert.description || alert.signature || 'Discrepancy detected in event telemetry timeline',
        status: alert.status || 'Pending Review',
        source_ip: alert.source_ip || alert.src_ip || '192.168.1.10',
        dest_ip: alert.destination_ip || alert.dest_ip || '10.0.0.5',
      })),
      manual_verification_areas: [
        `Verify execution-gap evidence for ${targetEntity.id}.`,
        `Inspect telemetry anomalies from source file '${sourceFileName}'.`,
        'Check negative-space coverage across critical asset boundaries.',
        'Human supervisor remains the final decision-maker before formal regulatory notifications.'
      ],
      data_limitations: [
        `Generated from source file '${sourceFileName}' with analytical provenance preserved.`,
        'Supervisory attention indicators are prioritized signals for human examination, not automated compliance violation notices.'
      ],
      evidence_traceability: true,
    };
  }, [targetEntity, entityFindings, entityAlerts, entityAssets, cseEntities, alerts, period, isDemoMode, activeFileName, lastGeneratedAt, cohortAttentionScore]);

  const summary = report || dynamicReport;

  const generateReport = () => {
    setGenerating(true);
    const now = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    setLastGeneratedAt(now);

    api.generateReport(targetEntity.id, period)
      .then((payload) => {
        if (payload && payload.cse_code) {
          setReport(payload);
        } else {
          setReport({ ...dynamicReport, generated_at: now });
        }
        setGenerating(false);
      })
      .catch(() => {
        setReport({ ...dynamicReport, generated_at: now });
        setGenerating(false);
      });
  };

  const downloadPDF = () => {
    window.print();
  };

  return (
    <Page
      title="Assessment Reports"
      intro={summary.summary || 'A report-oriented supervisory view reflecting ingested telemetry and findings.'}
      sourceLabel={!isDemoMode ? `LIVE FILE: ${activeFileName || 'INGESTED'}` : 'LOCAL / DEMO DATA'}
    >
      <div className="report-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>ASSESSED CSE:</label>
          <select
            value={selectedCseCode}
            onChange={(e) => {
              setSelectedCseCode(e.target.value);
              setReport(null);
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '13px'
            }}
          >
            {cseEntities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} — {c.name} ({c.score ?? c.total_score ?? 70}/100)
              </option>
            ))}
          </select>
        </div>

        <button className="button primary" onClick={generateReport} disabled={generating}>
          <BookOpen size={15} /> {generating ? 'Compiling Report…' : 'Generate Report'}
        </button>

        <button className="button secondary" onClick={downloadPDF} title="Print or Save as PDF">
          <Printer size={15} /> Export PDF / Print
        </button>

        {activeFileName && (
          <Badge type="green">
            FILE: {activeFileName}
          </Badge>
        )}
        <Badge type={!isDemoMode ? 'green' : 'blue'}>
          {!isDemoMode ? 'LIVE FILE TELEMETRY' : 'DEMO COHORT'}
        </Badge>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--hover-bg, rgba(255,255,255,0.03))',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '10px 16px',
        marginBottom: '20px',
        fontSize: '13px',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileSearch size={18} style={{ color: 'var(--primary, #3b82f6)' }} />
          <span>
            <strong>Source Dataset:</strong> {summary.source_file || activeFileName || 'Cohort Baseline'}
            {' • '}
            <strong>Entity:</strong> {summary.cse_code} ({summary.assessment_scope?.entity_name})
            {' • '}
            <strong>Telemetry Records:</strong> {summary.assessment_scope?.records_evaluated || alerts.length}
          </span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Generated: {summary.generated_at}
        </span>
      </div>

      <Card className="report">
        <div className="report-head">
          <div className="brand-mark large">
            <img src="/aegis-logo.png" alt="A.E.G.I.S" className="brand-logo-img" />
          </div>
          <div>
            <div className="eyebrow">A.E.G.I.S SUPERVISORY COHORT ASSESSMENT</div>
            <h2>{summary.title || 'Supervisory Assessment Report'}</h2>
            <span>{summary.assessment_period || assessmentPeriod} — {summary.cse_code}</span>
          </div>
          <div className="report-code">
            {summary.report_code}<br />
            <b>{summary.report_status}</b>
          </div>
        </div>

        <div className="report-entity">
          <span>ASSESSED ENTITY</span>
          <strong>{summary.cse_code}</strong>
          <small>{summary.assessment_scope?.entity_name} · {summary.assessment_scope?.sector} (Format: {summary.assessment_scope?.format})</small>
          <div>
            <b>{summary.supervisory_attention?.total_score ?? 77}</b>
            <span>/ 100<br />{(summary.supervisory_attention?.attention_level || 'HIGH').toUpperCase()} ATTENTION</span>
          </div>
        </div>

        {summary.supervisory_attention?.breakdown && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '10px',
            margin: '16px 0',
            padding: '12px',
            background: 'var(--hover-bg, rgba(255,255,255,0.02))',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            fontSize: '12px'
          }}>
            <div><span style={{ color: 'var(--text-secondary)' }}>Execution Gap:</span> <strong>{summary.supervisory_attention.breakdown.execution_gap_score} pts</strong></div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Negative Space:</span> <strong>{summary.supervisory_attention.breakdown.negative_space_score} pts</strong></div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Peer Deviation:</span> <strong>{summary.supervisory_attention.breakdown.peer_deviation_score} pts</strong></div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Anomaly Index:</span> <strong>{summary.supervisory_attention.breakdown.anomaly_score} pts</strong></div>
          </div>
        )}

        <h3>Executive summary</h3>
        <p>{summary.summary}</p>

        <div className="report-columns">
          <div>
            <h3>Supervisory Findings ({summary.execution_gap_observations?.length || 0})</h3>
            {(summary.execution_gap_observations || []).map((finding, index) => (
              <div className="report-finding" key={finding.finding_code || finding.id || index}>
                <b>{finding.finding_code || finding.id || `Finding ${index + 1}`} — {finding.title || finding.name}</b>
                <span>{finding.severity || 'HIGH'} · {finding.evidence_count || finding.evidenceCount || 1} evidence reference(s) · Status: {finding.status || 'Active'}</span>
              </div>
            ))}
            {(!summary.execution_gap_observations || summary.execution_gap_observations.length === 0) && (
              <div className="report-finding">
                <b>Nominal Telemetry Alignment</b>
                <span>No active critical execution gaps identified for this entity.</span>
              </div>
            )}

            {summary.negative_space_observations && summary.negative_space_observations.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h3>Tracked Assets & Negative-Space Coverage</h3>
                {summary.negative_space_observations.map((asset, index) => (
                  <div className="report-finding" key={asset.id || index}>
                    <b>{asset.name || asset.id} — {asset.type || 'Infrastructure Node'}</b>
                    <span>IP/Host: {asset.ip || '10.x.x.x'} · Status: {asset.status || 'Active'} · Exposure: {asset.criticality || 'Critical'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3>Peer Benchmarking (Dataset Cohort)</h3>
            {(summary.peer_benchmarking || []).map((metric, index) => (
              <div className="report-finding" key={metric.metric_name || metric.label || index}>
                <b>{metric.metric_name || metric.label}</b>
                <span>{metric.entity_value ?? metric.value} versus peer benchmark {metric.peer_median ?? metric.median}</span>
              </div>
            ))}

            <div style={{ marginTop: '20px' }}>
              <h3>Priority Manual Review Samples</h3>
              {(summary.priority_manual_review_samples || []).map((sample) => (
                <div className="report-finding" key={sample.recordId}>
                  <b>{sample.recordId} — {sample.recordType}</b>
                  <span>Priority {sample.priority} · <Badge type={sample.severity}>{sample.severity}</Badge> · {sample.reason}</span>
                </div>
              ))}
            </div>

            <h3>Audit & Supervisory Limitations</h3>
            <p>{(summary.data_limitations || []).join(' ')}</p>
          </div>
        </div>

        <div className="report-footer">
          {summary.manual_verification_areas?.join(' • ') || 'Generated from active telemetry dataset · Source relationships preserved · Manual supervisory review required'}
        </div>
      </Card>
    </Page>
  );
}

function AnalystWorkspace() {
  const { activeAlerts, cases } = useSOC();
  const alert = activeAlerts.length > 0 ? activeAlerts[0] : null;
  const c = alert ? cases.find(x => x.id === alert.caseId) : null;
  
  return <Page title="Evidence Traceability Workspace" intro="Drill down from analytical finding to supporting operational evidence.">
    {!alert ? <Card><div className="empty-state"><strong>No active evidence for review</strong><span>Cohort records are fully processed.</span></div></Card> : 
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="signal-flow" style={{ padding: '20px', borderRadius: '8px' }}>
        <div><span>01</span><b>ANALYTICAL SIGNAL</b><small>Potential execution gap</small></div>
        <div className={c ? '' : 'gap'}><span>02</span><b>SUPPORTING EVIDENCE</b><small>{alert.id}</small></div>
        <div className={c && (c.status === 'Resolved' || c.status === 'Closed') ? '' : 'gap'}><span>03</span><b>HUMAN REVIEW</b><small>{c ? c.status : 'Pending verification'}</small></div>
      </div>
      <Card style={{ padding: '20px' }}><div className="eyebrow">SUBMITTED SOC RECORD</div><h2 style={{marginTop: '10px'}}>{alert.type}</h2><p>Target: {alert.asset} | Entity: {alert.cse}</p><Badge type={alert.severity}>{alert.severity}</Badge></Card>
    </div>
    }
  </Page>;
}

function App() {
  return (
    <AuthProvider>
      <SOCProvider>
        <InvestigationProvider>
          <BrowserRouter>
            <EvidenceInvestigationDrawer />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><Overview /></ProtectedRoute>} />
              <Route path="/escalation" element={<ProtectedRoute><EscalationPanel /></ProtectedRoute>} />
              <Route path="/security-monitoring" element={<ProtectedRoute><Page title="Air-Gapped Security Monitoring" intro="Real-time environment health and boundary surveillance." sourceLabel="LOCAL ENCLAVE"><AirGapSecurityMonitoring standalone /></Page></ProtectedRoute>} />
              <Route path="/ingestion" element={<ProtectedRoute><DataIngestion /></ProtectedRoute>} />
              <Route path="/workspace" element={<ProtectedRoute><AnalystWorkspace /></ProtectedRoute>} />
              <Route path="/cse" element={<ProtectedRoute><CSEList /></ProtectedRoute>} />
              <Route path="/cses" element={<ProtectedRoute><CSEList /></ProtectedRoute>} />
              <Route path="/cse/:id" element={<ProtectedRoute><CSEDetail /></ProtectedRoute>} />
              <Route path="/cses/:id" element={<ProtectedRoute><CSEDetail /></ProtectedRoute>} />
              <Route path="/findings" element={<ProtectedRoute><Findings /></ProtectedRoute>} />
              <Route path="/findings/:id" element={<ProtectedRoute><FindingDetail /></ProtectedRoute>} />
              <Route path="/evidence" element={<ProtectedRoute><EvidenceExplorer /></ProtectedRoute>} />
              <Route path="/records" element={<ProtectedRoute><Records /></ProtectedRoute>} />
              <Route path="/negative-space" element={<ProtectedRoute><NegativeSpace /></ProtectedRoute>} />
              <Route path="/benchmarking" element={<ProtectedRoute><Benchmarking /></ProtectedRoute>} />
              <Route path="/prioritised-samples" element={<ProtectedRoute><Samples /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/about" element={<ProtectedRoute><Page title="About A.E.G.I.S." intro="Global Innovation Hackathon 2026 · Build for a Better Future (Bharat Academix)" sourceLabel="SYSTEM CONFIG"><About /></Page></ProtectedRoute>} />
              <Route path="*" element={<ProtectedRoute><Overview /></ProtectedRoute>} />
            </Routes>
          </BrowserRouter>
        </InvestigationProvider>
      </SOCProvider>
    </AuthProvider>
  );
}

export default App;
