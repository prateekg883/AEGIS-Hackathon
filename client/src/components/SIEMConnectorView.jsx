import { useEffect, useState } from 'react';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Database, 
  Layers, 
  Network, 
  Play, 
  RefreshCw, 
  ShieldCheck, 
  Terminal, 
  Wifi, 
  WifiOff 
} from 'lucide-react';
import api from '../services/api';
import { useSOC } from '../state/SOCContext';

export default function SIEMConnectorView() {
  const { loadUploadedCSV } = useSOC();
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [error, setError] = useState(null);

  // Form states for test / override
  const [vendor, setVendor] = useState('ELASTICSEARCH');
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [index, setIndex] = useState('.alerts-security.alerts-default,logs-*');
  const [targetCSE, setTargetCSE] = useState('CSE-07');
  const [limit, setLimit] = useState(100);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await api.getSIEMStatus();
      setStatusData(res);
      if (res.connection_test?.details?.endpoint) {
        setEndpoint(res.connection_test.details.endpoint);
      }
    } catch (err) {
      console.error('Failed to fetch SIEM status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      setError(null);
      const res = await api.testSIEM({
        endpoint: endpoint || undefined,
        api_key: apiKey || undefined,
        index: index || undefined,
      });
      setTestResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSyncSIEM = async () => {
    try {
      setSyncing(true);
      setSyncResult(null);
      setError(null);
      const res = await api.syncSIEM(targetCSE, null, limit);
      setSyncResult(res);
      if (res.synced_count > 0) {
        fetchStatus();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="siem-connector-view" style={{ marginTop: '20px' }}>
      {/* Overview Notice */}
      <div style={{
        background: 'var(--color-surface-subtle)',
        border: '1px solid #cbd5e1',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: 'var(--radius-lg)',
            background: 'var(--color-info-bg)', color: 'var(--color-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Network size={22} />
          </div>
          <div>
            <strong style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-navy)' }}>Real SIEM Connector Framework</strong>
            <div style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-muted)' }}>
              Modular ingestion from Elastic Security, Splunk, Sentinel &amp; QRadar into A.E.G.I.S. local database.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid #10b98130',
            padding: '4px 10px', borderRadius: '20px', fontSize: 'var(--font-size-body)', fontWeight: '700',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <ShieldCheck size={14} /> OFFLINE-FIRST: ZERO CLOUD LEAKAGE
          </span>
          <button 
            className="button secondary"
            onClick={fetchStatus}
            disabled={loading}
            style={{ padding: '6px 12px', fontSize: 'var(--font-size-body)', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Check Health
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'var(--color-critical-bg)', border: '1px solid #f87171', color: 'var(--color-critical)',
          borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: '20px', fontSize: 'var(--font-size-md)',
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Grid: Connector Config & Sync Action */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Left: Connector Configuration */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 'var(--font-size-xl)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={17} /> SIEM Source Configuration
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
              Connector Type
              <select 
                value={vendor} 
                onChange={(e) => setVendor(e.target.value)}
                style={{ width: '100%', marginTop: '6px', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid #cbd5e1' }}
              >
                <option value="ELASTICSEARCH">Elastic Security / Elasticsearch (Production Primary)</option>
                <option value="SPLUNK">Splunk Enterprise / Cloud (Extensible Module)</option>
                <option value="SENTINEL">Microsoft Sentinel (Azure Log Analytics)</option>
                <option value="QRADAR">IBM QRadar SIEM (Offenses API)</option>
              </select>
            </label>

            <label style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
              SIEM Endpoint URL
              <input 
                type="text" 
                placeholder="https://elastic-soc.internal:9200" 
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                style={{ width: '100%', marginTop: '6px', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid #cbd5e1' }}
              />
              <small style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-small)', display: 'block', marginTop: '2px' }}>
                Defaults to server-side SIEM_ENDPOINT environment variable.
              </small>
            </label>

            <label style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
              API Key / Auth Token
              <input 
                type="password" 
                placeholder="••••••••••••••••••••" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ width: '100%', marginTop: '6px', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid #cbd5e1' }}
              />
            </label>

            <label style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
              Index Pattern / Alert Topic
              <input 
                type="text" 
                value={index}
                onChange={(e) => setIndex(e.target.value)}
                style={{ width: '100%', marginTop: '6px', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid #cbd5e1' }}
              />
            </label>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button 
                className="button secondary"
                onClick={handleTestConnection}
                disabled={testing}
                style={{ flex: 1, padding: '9px 14px', fontSize: 'var(--font-size-md)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
              >
                <Activity size={14} className={testing ? 'spin' : ''} />
                {testing ? 'Testing Endpoint...' : 'Test Connection'}
              </button>
            </div>

            {testResult && (
              <div style={{
                marginTop: '10px', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-body)',
                background: testResult.connected ? 'var(--color-success-bg)' : 'var(--color-surface-subtle)',
                border: `1px solid ${testResult.connected ? 'var(--color-success-border)' : 'var(--color-border)'}`,
                color: testResult.connected ? 'var(--color-success)' : 'var(--color-text-secondary)'
              }}>
                <div style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {testResult.connected ? <Wifi size={14} /> : <WifiOff size={14} />}
                  Status: {testResult.status}
                </div>
                <div style={{ marginTop: '4px' }}>{testResult.message}</div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Ingestion Trigger & Local Processing */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 'var(--font-size-xl)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={17} /> Local Ingestion Pipeline
          </h3>

          <p style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-muted)', marginTop: 0 }}>
            Sync security events into A.E.G.I.S. local database. Ingested events automatically feed the 
            <strong> Attention Score Engine</strong> (Execution Gaps, Negative Space, Anomalies, Peer Deviations).
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
              Target CSE Entity
              <select 
                value={targetCSE} 
                onChange={(e) => setTargetCSE(e.target.value)}
                style={{ width: '100%', marginTop: '6px', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid #cbd5e1' }}
              >
                <option value="CSE-07">CSE-07 (PowerGrid Northern Region SOC)</option>
                <option value="CSE-01">CSE-01 (NTPC Thermal Power Grid)</option>
                <option value="CSE-03">CSE-03 (National Stock Exchange SOC)</option>
                <option value="CSE-05">CSE-05 (RailTel Telecom Core Network)</option>
              </select>
            </label>

            <label style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
              Maximum Events to Ingest
              <input 
                type="number" 
                value={limit} 
                min={1} 
                max={500}
                onChange={(e) => setLimit(Number(e.target.value))}
                style={{ width: '100%', marginTop: '6px', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid #cbd5e1' }}
              />
            </label>

            <div style={{
              background: 'var(--color-surface-alt)', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '12px',
              fontSize: 'var(--font-size-body)', color: 'var(--color-text-secondary)'
            }}>
              <div style={{ fontWeight: '700', marginBottom: '4px', color: 'var(--color-navy)' }}>Local Processing Guarantee:</div>
              <div>SIEM alerts are normalized to local SQLite/PostgreSQL schema. They remain 100% on-premises. Only scores 98–100 can be escalated via the Outbound Gateway.</div>
            </div>

            <button 
              className="button primary"
              onClick={handleSyncSIEM}
              disabled={syncing}
              style={{ padding: '10px 16px', fontSize: 'var(--font-size-md)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: 'var(--color-accent)' }}
            >
              <Play size={16} className={syncing ? 'spin' : ''} />
              {syncing ? 'Ingesting from SIEM...' : 'Start SIEM Local Ingestion'}
            </button>

            {syncResult && (
              <div style={{
                marginTop: '10px', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-body)',
                background: syncResult.success ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                border: `1px solid ${syncResult.success ? 'var(--color-success-border)' : 'var(--color-warning-border)'}`,
                color: syncResult.success ? 'var(--color-success)' : 'var(--color-warning)'
              }}>
                <div style={{ fontWeight: '700' }}>
                  {syncResult.success ? '✓ Ingestion Successful' : 'ℹ Ingestion Status'}
                </div>
                <div style={{ marginTop: '4px' }}>{syncResult.message}</div>
                {syncResult.batch_code && (
                  <div style={{ marginTop: '4px', fontFamily: 'monospace' }}>
                    Batch Code: <strong>{syncResult.batch_code}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
