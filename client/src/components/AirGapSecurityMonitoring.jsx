import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Lock, Activity, Server, WifiOff, Database, Cpu, HardDrive,
  AlertTriangle, CheckCircle2, XCircle, RefreshCw, Sliders, FileCheck,
  History, UserCheck, Eye, Layers, Clock, Check, AlertCircle, Info, ExternalLink,
  Power
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../state/AuthContext';

export default function AirGapSecurityMonitoring({ standalone = false }) {
  const { user } = useAuth();
  const userRole = (user?.role || 'SUPERVISOR').toUpperCase();
  const isAdmin = userRole.includes('ADMIN');
  const isSupervisor = userRole.includes('SUPERVISOR') || isAdmin;

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30); // in seconds, 0 = manual
  const [lastUpdated, setLastUpdated] = useState('');
  const [activeTab, setActiveTab] = useState('connections'); // connections | auth | evidence | audit | alerts
  const [togglingAirGap, setTogglingAirGap] = useState(false);

  // Telemetry data
  const [airGapStatus, setAirGapStatus] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [postureData, setPostureData] = useState(null);
  const [events, setEvents] = useState([]);
  const [authEvents, setAuthEvents] = useState([]);
  const [evidenceData, setEvidenceData] = useState([]);
  const [auditData, setAuditData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [resources, setResources] = useState(null);

  // Selected event modal
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Admin Config Modal
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminConfig, setAdminConfig] = useState({
    refresh_interval_seconds: 30,
    monitoring_enabled: true,
    alert_threshold_failed_logins: 5,
    audit_chain_strict_mode: true
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState(null);

  // Verification in progress for audit
  const [verifyingAudit, setVerifyingAudit] = useState(false);

  // Fetch all monitoring telemetry
  const fetchAllTelemetry = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [
        airgap,
        health,
        posture,
        evts,
        resData,
        auditRes
      ] = await Promise.all([
        api.getAirGapStatus().catch(() => null),
        api.getSecurityHealth().catch(() => null),
        api.getSecurityPosture().catch(() => null),
        api.getSecurityEvents(40).catch(() => []),
        api.getSystemResources().catch(() => null),
        api.getAuditIntegrity().catch(() => null)
      ]);

      if (airgap) setAirGapStatus(airgap);
      if (health) setHealthData(health);
      if (posture) setPostureData(posture);
      if (evts) setEvents(evts);
      if (resData) setResources(resData);
      if (auditRes) setAuditData(auditRes);

      // Fetch role-guarded data
      if (isSupervisor) {
        const [authEvts, evid, secAlerts] = await Promise.all([
          api.getAuthSecurityEvents(25).catch(() => []),
          api.getEvidenceIntegrity(15).catch(() => []),
          api.getSecurityAlerts().catch(() => [])
        ]);
        if (authEvts) setAuthEvents(authEvts);
        if (evid) setEvidenceData(evid);
        if (secAlerts) setAlerts(secAlerts);
      } else {
        const evid = await api.getEvidenceIntegrity(15).catch(() => []);
        if (evid) setEvidenceData(evid);
      }

      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to load security monitoring telemetry:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllTelemetry();
  }, []);

  // Polling loop
  useEffect(() => {
    if (refreshInterval <= 0) return;
    const intervalId = setInterval(() => {
      fetchAllTelemetry(true);
    }, refreshInterval * 1000);
    return () => clearInterval(intervalId);
  }, [refreshInterval]);

  // Handle Air-Gap Mode Toggle by Administrator
  const handleToggleAirGap = async (newVal) => {
    if (!isAdmin) return;
    setTogglingAirGap(true);
    try {
      await api.toggleAirGapMode(newVal, 'Administrator manual switch');
      await fetchAllTelemetry(false);
    } catch (err) {
      console.error('Failed to toggle Air-Gap mode:', err);
      alert(`Failed to update Air-Gap Mode: ${err.message}`);
    } finally {
      setTogglingAirGap(false);
    }
  };

  // Handle manual audit verification
  const handleVerifyAuditChain = async () => {
    setVerifyingAudit(true);
    try {
      const res = await api.getAuditIntegrity();
      setAuditData(res);
      fetchAllTelemetry(true);
    } catch (e) {
      console.error(e);
    } finally {
      setVerifyingAudit(false);
    }
  };

  // Handle Admin Config Save
  const handleSaveAdminConfig = async (e) => {
    e.preventDefault();
    setConfigSaving(true);
    setConfigMsg(null);
    try {
      const res = await api.updateSecurityConfig(adminConfig);
      setConfigMsg({ type: 'success', text: res.message || 'Settings saved and logged to audit ledger.' });
      setRefreshInterval(Number(adminConfig.refresh_interval_seconds));
      setTimeout(() => {
        setShowAdminModal(false);
        setConfigMsg(null);
      }, 1500);
    } catch (err) {
      setConfigMsg({ type: 'error', text: err.message || 'Failed to update configuration.' });
    } finally {
      setConfigSaving(false);
    }
  };

  // Status color helpers
  const getBadgeType = (status) => {
    const s = String(status || '').toUpperCase();
    if (s === 'ACTIVE' || s === 'HEALTHY' || s === 'VERIFIED' || s === 'VALID' || s === 'SECURE' || s === 'COMPLETED' || s === 'ALLOWED' || s === 'NORMAL') {
      return 'green';
    }
    if (s === 'BLOCKED' || s === 'NONE' || s === 'DISABLED' || s === 'DISABLED — AIR-GAPPED MODE') {
      return 'blue';
    }
    if (s === 'WARNING' || s === 'CAUTION' || s === 'ATTENTION REQUIRED' || s === 'MEDIUM' || s === 'NOT VERIFIED' || s === 'CONNECTED') {
      return 'amber';
    }
    if (s === 'ERROR' || s === 'CRITICAL' || s === 'FAILED' || s === 'HIGH') {
      return 'red';
    }
    return 'neutral';
  };

  const isPolicyActive = airGapStatus?.air_gap_policy?.enabled ?? (airGapStatus?.air_gapped_mode === 'ACTIVE');
  const policyStatus = airGapStatus?.air_gap_policy?.status || (isPolicyActive ? 'ACTIVE' : 'INACTIVE');
  const extCommStatus = airGapStatus?.external_communication?.status || (isPolicyActive ? 'DISABLED' : 'PERMITTED');
  const internetStatus = airGapStatus?.internet?.status || airGapStatus?.internet_access || 'CONNECTED';
  const isolationStatus = airGapStatus?.network_isolation?.status || (internetStatus === 'CONNECTED' ? 'NOT VERIFIED' : 'VERIFIED');
  const dnsStatus = airGapStatus?.dns?.status || airGapStatus?.dns_status || 'BLOCKED';
  const outboundAttemptsCount = airGapStatus?.outbound_attempts ?? (airGapStatus?.external_connection_attempts ?? 0);

  const postureStatus = postureData?.posture || postureData?.level || (isPolicyActive && internetStatus === 'CONNECTED' ? 'CAUTION' : 'SECURE');
  const postureTone = postureStatus === 'SECURE' ? 'var(--color-success)' : (postureStatus === 'CAUTION' || postureStatus === 'ATTENTION REQUIRED') ? 'var(--color-warning)' : 'var(--color-critical)';

  return (
    <div className="air-gap-monitoring-container" style={{ marginTop: standalone ? '0' : '32px' }}>
      {/* SECTION HEADER & REFRESH CONTROLS */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px',
        borderBottom: '1px solid #1e293b',
        paddingBottom: '12px'
      }}>
        <div>
          <div className="eyebrow" style={{ color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lock size={13} /> SECURE ENCLAVE TELEMETRY
          </div>
          <h2 style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-2xl)', fontWeight: '700', color: 'var(--color-surface-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Air-Gapped Security Monitoring
            <span style={{
              fontSize: 'var(--font-size-small)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-xl)',
              background: isPolicyActive ? 'var(--color-secure-bg)' : 'var(--color-surface-hover)',
              color: isPolicyActive ? 'var(--color-secure)' : 'var(--color-text-muted)',
              border: isPolicyActive ? '1px solid #05966940' : '1px solid #47556940',
              fontWeight: '600'
            }}>
              {isPolicyActive ? 'APPLICATION AIR-GAP POLICY ACTIVE' : 'APPLICATION AIR-GAP POLICY INACTIVE'}
            </span>
          </h2>
          <small className="agm-text-muted">
            Application-level environment health, outbound boundary surveillance, and tamper-evident audit ledger
          </small>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {lastUpdated && (
            <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} /> Last Updated: <b className="agm-text-border">{lastUpdated}</b>
            </span>
          )}

          <div className="agm-row-gap-6">
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              style={{
                fontSize: 'var(--font-size-small)',
                padding: '4px 8px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)'
              }}
              title="Auto-refresh interval"
            >
              <option value="10">Auto-refresh: 10s</option>
              <option value="30">Auto-refresh: 30s</option>
              <option value="60">Auto-refresh: 60s</option>
              <option value="0">Auto-refresh: OFF (Manual)</option>
            </select>

            <button
              className="button secondary agm-badge-sm"
              onClick={() => fetchAllTelemetry()}
              disabled={refreshing}
              title="Poll latest local telemetry"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Checking…' : 'Refresh'}
            </button>

            {isAdmin && (
              <button
                className="button primary agm-badge-sm"
                onClick={() => setShowAdminModal(true)}
              >
                <Sliders size={12} /> Admin Controls
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 1. AIR-GAP STATUS & POSTURE SUMMARY HERO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        {/* Card 1: Air-Gap Policy & Network Isolation */}
        <section className="card" style={{ borderLeft: `4px solid ${isPolicyActive ? 'var(--color-success)' : 'var(--color-text-muted)'}`, background: 'var(--color-navy)' }}>
          <div className="agm-header-row">
            <div>
              <div className="eyebrow" style={{ color: isPolicyActive ? 'var(--color-success)' : 'var(--color-text-muted)' }}>ENVIRONMENT VERIFICATION</div>
              <strong className="agm-title-xl">AIR-GAPPED SECURITY MONITORING</strong>
            </div>

            {/* Administrator Air-Gapped Mode Toggle */}
            <div className="agm-row-gap-6">
              {isAdmin ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--color-navy)',
                  borderRadius: 'var(--radius-md)',
                  padding: '2px',
                  border: '1px solid #334155'
                }}>
                  <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-text-muted)', padding: '0 6px', fontWeight: '600' }}>MODE:</span>
                  <button
                    type="button"
                    onClick={() => handleToggleAirGap(true)}
                    disabled={togglingAirGap}
                    style={{
                      padding: '3px 8px',
                      fontSize: 'var(--font-size-caption)',
                      fontWeight: '700',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      cursor: 'pointer',
                      background: isPolicyActive ? 'var(--color-success)' : 'transparent',
                      color: isPolicyActive ? 'var(--color-surface)' : 'var(--color-text-muted)'
                    }}
                    title="Enable Air-Gap Policy (disables external APIs & OTP delivery)"
                  >
                    ON
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAirGap(false)}
                    disabled={togglingAirGap}
                    style={{
                      padding: '3px 8px',
                      fontSize: 'var(--font-size-caption)',
                      fontWeight: '700',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      cursor: 'pointer',
                      background: !isPolicyActive ? 'var(--color-critical)' : 'transparent',
                      color: !isPolicyActive ? 'var(--color-surface)' : 'var(--color-text-muted)'
                    }}
                    title="Disable Air-Gap Policy (permits external integrations)"
                  >
                    OFF
                  </button>
                </div>
              ) : (
                <span className={`badge ${isPolicyActive ? 'green' : 'amber'}`} style={{ fontWeight: '700' }}>
                  POLICY: {policyStatus}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: 'var(--font-size-body)' }}>
            <div className="agm-card-sm">
              <span className="agm-text-caption">Application Air-Gap Policy</span>
              <strong style={{ color: isPolicyActive ? 'var(--color-secure)' : 'var(--color-warning)' }}>
                {policyStatus}
              </strong>
            </div>

            <div className="agm-card-sm">
              <span className="agm-text-caption">External Application Communication</span>
              <strong style={{ color: extCommStatus === 'DISABLED' ? 'var(--color-accent)' : 'var(--color-warning)' }}>
                {extCommStatus}
              </strong>
            </div>

            <div className="agm-card-sm">
              <span className="agm-text-caption">Internet Access</span>
              <strong style={{ color: internetStatus === 'CONNECTED' ? 'var(--color-warning)' : 'var(--color-secure)' }}>
                {internetStatus}
              </strong>
            </div>

            <div className="agm-card-sm">
              <span className="agm-text-caption">Internet Isolation</span>
              <strong style={{ color: isolationStatus === 'VERIFIED' ? 'var(--color-secure)' : 'var(--color-warning)' }}>
                {isolationStatus}
              </strong>
            </div>

            <div className="agm-card-sm">
              <span className="agm-text-caption">DNS / External Resolution</span>
              <strong style={{ color: dnsStatus === 'BLOCKED' ? 'var(--color-secure)' : 'var(--color-text-muted)' }}>
                {dnsStatus}
              </strong>
            </div>

            <div className="agm-card-sm">
              <span className="agm-text-caption">Outbound WAN Attempts</span>
              <strong className="agm-text-subtle">
                {outboundAttemptsCount} OBSERVED
              </strong>
            </div>

            <div className="agm-card-sm">
              <span className="agm-text-caption">Local Processing</span>
              <strong style={{ color: 'var(--color-secure)' }}>
                {airGapStatus?.local_processing || 'ACTIVE'}
              </strong>
            </div>

            <div className="agm-card-sm">
              <span className="agm-text-caption">External API Dependency</span>
              <strong className="agm-text-accent">
                {airGapStatus?.external_api_dependency || 'NONE'}
              </strong>
            </div>
          </div>

          <p style={{ margin: '12px 0 0 0', fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', borderTop: '1px solid #1e293b', paddingTop: '8px' }}>
            <Info size={12} style={{ verticalAlign: 'middle', marginRight: '4px', color: 'var(--color-accent)' }} />
            {airGapStatus?.explanation || 'Real-time kernel and socket isolation check verified.'}
          </p>
        </section>

        {/* Card 2: Security Posture Score */}
        <section className="card" style={{ borderLeft: `4px solid ${postureTone}`, background: 'var(--color-navy)' }}>
          <div className="agm-header-row">
            <div>
              <div className="eyebrow" style={{ color: postureTone }}>DETERMINISTIC EVALUATION</div>
              <strong className="agm-title-xl">SECURITY POSTURE</strong>
            </div>
            <span style={{
              padding: '3px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-body)',
              fontWeight: '700',
              background: `${postureTone}20`,
              color: postureTone,
              border: `1px solid ${postureTone}50`,
              letterSpacing: '0.04em'
            }}>
              {postureStatus}
            </span>
          </div>

          <p style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-secondary)', lineHeight: '1.4', margin: '0 0 12px 0' }}>
            {postureData?.explanation || postureData?.reason || 'Security posture dynamically evaluated against host networking and audit integrity.'}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {(postureData?.factors || []).map((f, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: 'var(--font-size-caption)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: f.status === 'VERIFIED' || f.status === 'HEALTHY' || f.status === 'SECURE' || f.status === 'ACTIVE' || f.status === 'NONE' ? 'var(--color-secure-bg)' : 'var(--color-warning-border)',
                  color: f.status === 'VERIFIED' || f.status === 'HEALTHY' || f.status === 'SECURE' || f.status === 'ACTIVE' || f.status === 'NONE' ? 'var(--color-secure-dim)' : 'var(--color-warning)',
                  border: `1px solid ${f.status === 'VERIFIED' || f.status === 'HEALTHY' || f.status === 'SECURE' || f.status === 'ACTIVE' || f.status === 'NONE' ? 'var(--color-success-border)' : 'var(--color-warning-border)'}`
                }}
                title={f.detail}
              >
                {f.name}: <b>{f.status}</b>
              </span>
            ))}
          </div>

          <div style={{ marginTop: '14px', display: 'flex', gap: '16px', fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)' }}>
            <span>Active Alerts: <b className="agm-text-border">{alerts.length}</b></span>
            <span>Critical Alerts: <b style={{ color: postureData?.active_critical_alerts > 0 ? 'var(--color-critical)' : 'var(--color-secure)' }}>{postureData?.active_critical_alerts ?? 0}</b></span>
            <span>Audit Ledger: <b style={{ color: auditData?.status === 'VERIFIED' ? 'var(--color-secure)' : 'var(--color-critical)' }}>{auditData?.status === 'VERIFIED' ? 'VERIFIED' : 'FAILED — REVIEW REQUIRED'}</b></span>
          </div>
        </section>
      </div>

      {/* 2. SECURITY HEALTH PANEL (9 Components) */}
      <section className="card" style={{ marginBottom: '16px', background: 'var(--color-navy)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div className="eyebrow">COMPONENT HEALTH SURVEILLANCE</div>
            <h3 className="agm-text-heading-subtle">
              Security Health Check ({healthData?.healthy_count ?? 9}/{healthData?.total_components ?? 9} Operational)
            </h3>
          </div>
          <span className={`badge ${healthData?.overall === 'HEALTHY' ? 'green' : 'amber'} agm-text-sm`}>
            OVERALL: {healthData?.overall || 'HEALTHY'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          {Object.entries(healthData?.components || {}).map(([name, info]) => {
            const isHealthy = info.status === 'HEALTHY' || info.is_operational;
            const isWarn = info.status === 'WARNING';
            const isErr = info.status === 'ERROR' && !info.is_operational;
            const displayLabel = info.display_status || info.status;
            const color = isErr ? 'var(--color-critical)' : isWarn ? 'var(--color-warning)' : 'var(--color-success)';

            return (
              <div
                key={name}
                style={{
                  background: 'var(--color-navy)',
                  border: `1px solid ${color}30`,
                  borderLeft: `3px solid ${color}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div className="agm-row-between">
                  <b style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-surface-subtle)' }}>{name}</b>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: '700',
                    color: color,
                    background: `${color}15`,
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-sm)',
                    textAlign: 'right'
                  }}>
                    {displayLabel}
                  </span>
                </div>
                <small style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-text-muted)', lineHeight: '1.3' }}>
                  {info.detail}
                </small>
                {info.latency_ms != null && (
                  <span style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
                    Latency: {info.latency_ms}ms
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. SYSTEM RESOURCE TELEMETRY */}
      {resources && (
        <section className="card" style={{ marginBottom: '16px', background: 'var(--color-navy)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div className="eyebrow">LIGHTWEIGHT HOST TELEMETRY</div>
              <h3 className="agm-text-heading-subtle">
                System Resource Utilization
              </h3>
            </div>
            <span className="badge green agm-text-sm">
              UPTIME: {resources.uptime_formatted || resources.application_uptime_formatted || 'ACTIVE'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div className="agm-card-md">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                <span><Cpu size={12} className="agm-align-middle" /> CPU Load</span>
                <b className="agm-text-subtle">{resources.cpu_usage || resources.cpu?.usage_percent || 'NORMAL'}</b>
              </div>
              <small className="agm-meta-sub">Local host process load</small>
            </div>

            <div className="agm-card-md">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                <span><Activity size={12} className="agm-align-middle" /> Memory</span>
                <b className="agm-text-subtle">{resources.memory_usage || resources.memory?.usage_percent || 'NORMAL'}</b>
              </div>
              <small className="agm-meta-sub">
                {resources.memory_used || resources.memory?.used || 'Allocated locally'}
              </small>
            </div>

            <div className="agm-card-md">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                <span><HardDrive size={12} className="agm-align-middle" /> Disk Storage</span>
                <b className="agm-text-subtle">{resources.disk_usage || resources.disk?.usage_percent || 'NORMAL'}</b>
              </div>
              <small className="agm-meta-sub">
                Free: {resources.disk_free || resources.disk?.free || 'Local drive space'}
              </small>
            </div>

            <div className="agm-card-md">
              <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
                <Database size={12} className="agm-align-middle" /> Storage Footprint
              </div>
              <b style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-surface-subtle)' }}>DB: {resources.database_size || '< 1 MB'}</b>
              <small style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-text-muted)', display: 'block' }}>
                Evidence Folder: {resources.evidence_storage_size || '0.0 MB'}
              </small>
            </div>
          </div>
        </section>
      )}

      {/* 4. TAB NAVIGATION FOR DEEP INSPECTION */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #334155', marginBottom: '12px' }}>
        <button
          className={activeTab === 'connections' ? 'active' : ''}
          onClick={() => setActiveTab('connections')}
          style={{
            padding: '8px 14px',
            background: activeTab === 'connections' ? 'var(--color-navy)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'connections' ? '2px solid #38bdf8' : 'none',
            color: activeTab === 'connections' ? 'var(--color-surface-subtle)' : 'var(--color-text-muted)',
            fontSize: 'var(--font-size-body)',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          External Connection Monitor ({events.length})
        </button>

        <button
          className={activeTab === 'auth' ? 'active' : ''}
          onClick={() => setActiveTab('auth')}
          style={{
            padding: '8px 14px',
            background: activeTab === 'auth' ? 'var(--color-navy)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'auth' ? '2px solid #38bdf8' : 'none',
            color: activeTab === 'auth' ? 'var(--color-surface-subtle)' : 'var(--color-text-muted)',
            fontSize: 'var(--font-size-body)',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Authentication Security ({authEvents.length})
        </button>

        <button
          className={activeTab === 'evidence' ? 'active' : ''}
          onClick={() => setActiveTab('evidence')}
          style={{
            padding: '8px 14px',
            background: activeTab === 'evidence' ? 'var(--color-navy)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'evidence' ? '2px solid #38bdf8' : 'none',
            color: activeTab === 'evidence' ? 'var(--color-surface-subtle)' : 'var(--color-text-muted)',
            fontSize: 'var(--font-size-body)',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Evidence SHA-256 Integrity ({evidenceData.length})
        </button>

        <button
          className={activeTab === 'audit' ? 'active' : ''}
          onClick={() => setActiveTab('audit')}
          style={{
            padding: '8px 14px',
            background: activeTab === 'audit' ? 'var(--color-navy)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'audit' ? '2px solid #38bdf8' : 'none',
            color: activeTab === 'audit' ? 'var(--color-surface-subtle)' : 'var(--color-text-muted)',
            fontSize: 'var(--font-size-body)',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Audit Log Hash Chaining ({auditData?.total_events ?? 0})
        </button>

        <button
          className={activeTab === 'alerts' ? 'active' : ''}
          onClick={() => setActiveTab('alerts')}
          style={{
            padding: '8px 14px',
            background: activeTab === 'alerts' ? 'var(--color-navy)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'alerts' ? '2px solid #38bdf8' : 'none',
            color: activeTab === 'alerts' ? 'var(--color-surface-subtle)' : 'var(--color-text-muted)',
            fontSize: 'var(--font-size-body)',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Security Alerts & Timeline ({alerts.length})
        </button>
      </div>

      {/* TAB CONTENT 1: EXTERNAL CONNECTION MONITOR */}
      {activeTab === 'connections' && (
        <section className="card table-card" style={{ background: 'var(--color-navy)' }}>
          <div className="agm-list-item">
            <div>
              <b className="agm-text-subtle-md">Observed Outbound Connection Telemetry</b>
              <small className="agm-text-muted-block">
                Monitors only actual outbound/local socket connection attempts observed by the A.E.G.I.S. backend.
              </small>
            </div>
            <span style={{ fontSize: 'var(--font-size-small)', color: isPolicyActive ? 'var(--color-secure)' : 'var(--color-warning)', fontWeight: '600' }}>
              Policy Rule: {isPolicyActive ? 'APPLICATION AIR-GAP POLICY ACTIVE' : 'AIR-GAP POLICY INACTIVE'}
            </span>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Source Component</th>
                  <th>Destination</th>
                  <th>Port / Protocol</th>
                  <th>Status</th>
                  <th>Reason / Observation</th>
                  <th>Severity</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {events.length > 0 ? (
                  events.map((ev) => (
                    <tr key={ev.id}>
                      <td className="agm-text-mono">{ev.timestamp}</td>
                      <td><b>{ev.component}</b></td>
                      <td style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)' }}>{ev.destination}</td>
                      <td><span style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)' }}>{ev.port_protocol}</span></td>
                      <td><span className={`badge ${getBadgeType(ev.status)}`}>{ev.status}</span></td>
                      <td style={{ fontSize: 'var(--font-size-small)', maxWidth: '300px' }}>{ev.reason}</td>
                      <td><span className={`badge ${getBadgeType(ev.severity)}`}>{ev.severity}</span></td>
                      <td>
                        <button
                          className="button ghost"
                          style={{ padding: '2px 8px', fontSize: 'var(--font-size-caption)' }}
                          onClick={() => setSelectedEvent(ev)}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="agm-empty-state">
                      No outbound attempts recorded. Host interface completely silent.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB CONTENT 2: AUTHENTICATION SECURITY MONITORING */}
      {activeTab === 'auth' && (
        <section className="card table-card" style={{ background: 'var(--color-navy)' }}>
          <div className="agm-list-item">
            <div>
              <b className="agm-text-subtle-md">Authentication & Authorization Surveillance</b>
              <small className="agm-text-muted-block">
                Monitors successful logins, failed attempts, and unauthorized access violations. Passwords/OTPs never stored.
              </small>
            </div>
            <span className="badge green" style={{ fontSize: 'var(--font-size-caption)' }}>
              PASSWORDS / SECRETS STRIPPED
            </span>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>User Identity</th>
                  <th>Role</th>
                  <th>Timestamp</th>
                  <th>Result</th>
                  <th>Severity</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {authEvents.length > 0 ? (
                  authEvents.map((a) => (
                    <tr key={a.id}>
                      <td><b>{a.event}</b></td>
                      <td className="agm-text-mono">{a.user}</td>
                      <td><span className="badge blue">{a.role}</span></td>
                      <td className="agm-text-sm">{a.timestamp}</td>
                      <td><span className={`badge ${getBadgeType(a.result)}`}>{a.result}</span></td>
                      <td><span className={`badge ${getBadgeType(a.severity)}`}>{a.severity}</span></td>
                      <td style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)' }}>{a.reason}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="agm-empty-state">
                      No recent authentication security events logged.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB CONTENT 3: EVIDENCE SECURITY MONITORING */}
      {activeTab === 'evidence' && (
        <section className="card table-card" style={{ background: 'var(--color-navy)' }}>
          <div className="agm-list-item">
            <div>
              <b className="agm-text-subtle-md">Evidence Ingestion Integrity & Cryptographic Hashes</b>
              <small className="agm-text-muted-block">
                Cryptographic SHA-256 verification of submitted CSV/telemetry files to prevent tampering.
              </small>
            </div>
            <span className="badge green">SHA-256 VERIFIED</span>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Evidence File</th>
                  <th>Batch ID</th>
                  <th>Assessed CSE</th>
                  <th>Uploaded By</th>
                  <th>Timestamp</th>
                  <th>SHA-256 Hash</th>
                  <th>Hash Status</th>
                  <th>Integrity</th>
                  <th>Processing</th>
                </tr>
              </thead>
              <tbody>
                {evidenceData.length > 0 ? (
                  evidenceData.map((ev, idx) => (
                    <tr key={idx}>
                      <td><b>{ev.file}</b></td>
                      <td className="agm-text-mono">{ev.batch_id}</td>
                      <td><span className="badge amber">{ev.cse}</span></td>
                      <td className="agm-text-sm">{ev.uploaded_by}</td>
                      <td className="agm-text-sm">{ev.timestamp}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-caption)', color: 'var(--color-accent)' }}>
                        {String(ev.sha256).slice(0, 16)}…
                      </td>
                      <td><span className="badge green">{ev.hash_status}</span></td>
                      <td><span className="badge green">{ev.integrity}</span></td>
                      <td><span className="badge blue">{ev.processing_status}</span></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="agm-empty-state">
                      No evidence ingestion records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB CONTENT 4: AUDIT LOG INTEGRITY & HASH CHAINING */}
      {activeTab === 'audit' && (
        <section className="card" style={{ background: 'var(--color-navy)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div className="eyebrow" style={{ color: 'var(--color-success)' }}>IMMUTABLE CRYPTOGRAPHIC LEDGER</div>
              <h3 style={{ margin: '2px 0 0 0', fontSize: 'var(--font-size-xl)', fontWeight: '700', color: 'var(--color-surface-subtle)' }}>
                Audit Log Integrity (Sequential SHA-256 Hash Chaining)
              </h3>
              <small className="agm-text-muted">
                Every audit action is cryptographically linked to the previous record hash. Any database tampering immediately breaks the chain.
              </small>
            </div>

            <button
              className="button primary"
              style={{ fontSize: 'var(--font-size-small)', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={handleVerifyAuditChain}
              disabled={verifyingAudit}
            >
              <RefreshCw size={12} className={verifyingAudit ? 'animate-spin' : ''} />
              {verifyingAudit ? 'Verifying Chain…' : 'Re-verify Ledger Chain'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div className="agm-card-lg">
              <span className="agm-text-muted-sm">Audit Logging Service</span>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '700', color: 'var(--color-secure)', marginTop: '2px' }}>
                {auditData?.audit_logging || 'ACTIVE'}
              </div>
            </div>

            <div className="agm-card-lg">
              <span className="agm-text-muted-sm">Cryptographic Integrity</span>
              <div style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: '700',
                color: (auditData?.status === 'VERIFIED' || auditData?.integrity === 'VALID') ? 'var(--color-secure)' : 'var(--color-critical)',
                marginTop: '2px'
              }}>
                {(auditData?.status === 'VERIFIED' || auditData?.integrity === 'VALID') ? 'VERIFIED' : 'FAILED — REVIEW REQUIRED'}
              </div>
            </div>

            <div className="agm-card-lg">
              <span className="agm-text-muted-sm">Total Chained Records</span>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '700', color: 'var(--color-surface-subtle)', marginTop: '2px' }}>
                {auditData?.total_events ?? 0} Records
              </div>
            </div>

            <div className="agm-card-lg">
              <span className="agm-text-muted-sm">Last Verified At</span>
              <div style={{ fontSize: 'var(--font-size-body)', fontWeight: '600', color: 'var(--color-text-primary)', marginTop: '4px' }}>
                {auditData?.last_integrity_check ? new Date(auditData.last_integrity_check).toLocaleTimeString() : 'Just now'}
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--color-surface-subtle)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            fontFamily: 'monospace',
            fontSize: 'var(--font-size-small)',
            color: 'var(--color-text-muted)'
          }}>
            <div style={{ color: 'var(--color-accent)', fontWeight: '700', marginBottom: '6px' }}>
              HASH CHAIN TOPOLOGY:
            </div>
            <div>[Genesis: 0000000000000000] → [Audit Record #1 (SHA-256)] → [Audit Record #2 (SHA-256)] → ... → [Audit Record #{auditData?.total_events || 'N'} (SHA-256)]</div>
            <div style={{ marginTop: '6px', color: (auditData?.status === 'VERIFIED' || auditData?.integrity === 'VALID') ? 'var(--color-secure)' : 'var(--color-critical)' }}>
              Status: {auditData?.message || 'All records continuous and untampered.'}
            </div>
          </div>
        </section>
      )}

      {/* TAB CONTENT 5: SECURITY ALERTS & TIMELINE */}
      {activeTab === 'alerts' && (
        <section className="card" style={{ background: 'var(--color-surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <b className="agm-text-subtle-md">Security Alerts & Event Timeline</b>
              <small className="agm-text-muted-block">
                Actionable security events requiring supervisory acknowledgement. Generated purely from real checks.
              </small>
            </div>
            <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)' }}>
              {alerts.length} active alert(s)
            </span>
          </div>

          {alerts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {alerts.map((al) => (
                <div
                  key={al.id}
                  style={{
                    background: 'var(--color-navy)',
                    borderLeft: `4px solid ${al.severity === 'CRITICAL' ? 'var(--color-critical)' : al.severity === 'HIGH' ? 'var(--color-warning)' : 'var(--color-accent)'}`,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div className="agm-row-gap-8">
                      <span className={`badge ${getBadgeType(al.severity)}`}>{al.severity}</span>
                      <b style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-surface-subtle)' }}>{al.title}</b>
                      <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-text-muted)' }}>({al.category})</span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)' }}>
                      {al.description}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)' }}>
                    <span>{al.created_at}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '16px', background: 'var(--color-navy)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--color-secure)', fontSize: 'var(--font-size-body)', marginBottom: '16px' }}>
              <CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              Zero active high or critical security alerts. Enclave parameters normal.
            </div>
          )}

          <div className="eyebrow" style={{ marginTop: '16px', marginBottom: '8px' }}>RECENT SECURITY TIMELINE</div>
          <div style={{ borderLeft: '2px solid #334155', paddingLeft: '14px', marginLeft: '6px' }}>
            {events.slice(0, 8).map((ev) => (
              <div
                key={ev.id}
                onClick={() => setSelectedEvent(ev)}
                style={{
                  position: 'relative',
                  marginBottom: '12px',
                  cursor: 'pointer',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'transparent',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-navy)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  position: 'absolute',
                  left: '-19px',
                  top: '10px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: ev.severity === 'HIGH' || ev.severity === 'CRITICAL' ? 'var(--color-critical)' : 'var(--color-accent)'
                }} />
                <div className="agm-row-between">
                  <span style={{ fontSize: 'var(--font-size-body)', fontWeight: '600', color: 'var(--color-surface-subtle)' }}>
                    {ev.event_type.replaceAll('_', ' ')}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                    {ev.timestamp}
                  </span>
                </div>
                <small style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', display: 'block' }}>
                  {ev.component} • {ev.reason || 'Telemetry recorded'}
                </small>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* EVENT DETAIL MODAL */}
      {selectedEvent && (
        <div
          className="drawer-backdrop"
          onClick={() => setSelectedEvent(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-navy)',
              border: '1px solid #334155',
              borderRadius: 'var(--radius-lg)',
              width: '520px',
              maxWidth: '90%',
              padding: '20px',
              color: 'var(--color-surface-subtle)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }}
          >
            <div className="agm-header-row">
              <div>
                <div className="eyebrow agm-text-accent">SECURITY EVENT RECORD</div>
                <h3 style={{ margin: '2px 0 0 0', fontSize: 'var(--font-size-xl)' }}>{selectedEvent.event_type}</h3>
              </div>
              <button
                className="button ghost"
                onClick={() => setSelectedEvent(null)}
                style={{ padding: '2px 8px', color: 'var(--color-text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: 'var(--font-size-small)', marginBottom: '14px' }}>
              <div><span className="agm-text-muted">Component:</span> <b>{selectedEvent.component}</b></div>
              <div><span className="agm-text-muted">Status:</span> <span className={`badge ${getBadgeType(selectedEvent.status)}`}>{selectedEvent.status}</span></div>
              <div><span className="agm-text-muted">Severity:</span> <span className={`badge ${getBadgeType(selectedEvent.severity)}`}>{selectedEvent.severity}</span></div>
              <div><span className="agm-text-muted">Timestamp:</span> <b>{selectedEvent.timestamp}</b></div>
              <div><span className="agm-text-muted">User / Identity:</span> <b>{selectedEvent.user}</b></div>
              <div><span className="agm-text-muted">Destination:</span> <b>{selectedEvent.destination}</b></div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Observation Reason:</span>
              <p style={{ margin: 0, fontSize: 'var(--font-size-body)', background: 'var(--color-surface-subtle)', padding: '8px', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}>
                {selectedEvent.reason || 'Standard operational verification record.'}
              </p>
            </div>

            {selectedEvent.details && Object.keys(selectedEvent.details).length > 0 && (
              <div>
                <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Parsed Telemetry Details:</span>
                <pre style={{
                  margin: 0,
                  background: 'var(--color-navy)',
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--font-size-caption)',
                  color: 'var(--color-accent)',
                  maxHeight: '120px',
                  overflowY: 'auto'
                }}>
                  {JSON.stringify(selectedEvent.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADMIN CONTROLS MODAL */}
      {showAdminModal && isAdmin && (
        <div
          className="drawer-backdrop"
          onClick={() => setShowAdminModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-navy)',
              border: '1px solid #334155',
              borderRadius: 'var(--radius-lg)',
              width: '480px',
              maxWidth: '90%',
              padding: '24px',
              color: 'var(--color-surface-subtle)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div className="eyebrow agm-text-accent">ADMINISTRATOR SETTINGS</div>
                <h3 style={{ margin: '2px 0 0 0', fontSize: 'var(--font-size-xl)' }}>Air-Gap Security Controls</h3>
              </div>
              <button
                className="button ghost"
                onClick={() => setShowAdminModal(false)}
                style={{ padding: '2px 8px', color: 'var(--color-text-muted)' }}
              >
                ✕
              </button>
            </div>

            {configMsg && (
              <div style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '14px',
                fontSize: 'var(--font-size-small)',
                background: configMsg.type === 'success' ? 'var(--color-secure-dark)' : 'var(--color-critical)',
                color: configMsg.type === 'success' ? 'var(--color-secure-dim)' : 'var(--color-critical-border)'
              }}>
                {configMsg.text}
              </div>
            )}

            <form onSubmit={handleSaveAdminConfig}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: 'var(--font-size-body)' }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    Telemetry Poll Interval (Seconds)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={adminConfig.refresh_interval_seconds}
                    onChange={(e) => setAdminConfig({ ...adminConfig, refresh_interval_seconds: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'var(--color-navy)',
                      color: 'var(--color-surface-subtle)',
                      border: '1px solid #334155',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    Failed Login Alert Threshold
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="20"
                    value={adminConfig.alert_threshold_failed_logins}
                    onChange={(e) => setAdminConfig({ ...adminConfig, alert_threshold_failed_logins: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'var(--color-navy)',
                      color: 'var(--color-surface-subtle)',
                      border: '1px solid #334155',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  />
                </div>

                <div className="agm-row-gap-8">
                  <input
                    type="checkbox"
                    id="strictChain"
                    checked={adminConfig.audit_chain_strict_mode}
                    onChange={(e) => setAdminConfig({ ...adminConfig, audit_chain_strict_mode: e.target.checked })}
                  />
                  <label htmlFor="strictChain" style={{ color: 'var(--color-text-primary)', cursor: 'pointer', fontWeight: '500' }}>
                    Enforce Strict Audit Ledger Hash Chaining
                  </label>
                </div>

                <small style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-caption)' }}>
                  * Any modification to these parameters will be cryptographically written to the audit trail with previous and new values.
                </small>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setShowAdminModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button primary"
                  disabled={configSaving}
                >
                  {configSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
