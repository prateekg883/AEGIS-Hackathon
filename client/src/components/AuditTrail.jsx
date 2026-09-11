import { useState, useEffect } from 'react';
import { useAuth } from '../state/AuthContext';
import api from '../services/api';
import { ShieldAlert, Terminal, Lock } from 'lucide-react';

const tone = (value = '') => String(value).toLowerCase().replaceAll(' ', '-');
const Badge = ({ children, type = 'neutral' }) => <span className={`badge ${tone(type)}`}>{children}</span>;

export default function AuditTrail() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  if (user?.roleLabel !== 'AUDITOR' && user?.roleLabel !== 'SUPERVISOR') {
    return (
      <div className="page-head">
        <div>
          <div className="eyebrow">ACCESS DENIED</div>
          <h1>System Audit Trail</h1>
          <p>Your current identity ({user?.roleLabel}) is not authorized to access the Audit Trail. This area is restricted to Auditors and Supervisors.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await api.requestJson('/api/audit', { method: 'GET' });
        setLogs(data);
      } catch (err) {
        setError(err.message || 'Failed to fetch audit logs');
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">A.E.G.I.S · IMMUTABLE LEDGER</div>
          <h1>System Audit Trail</h1>
          <p>Cryptographically secure append-only ledger of all supervisory decisions and system transitions.</p>
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <section className="card table-card">
          <div className="section-title">
            <div>
              <div className="eyebrow">SYSTEM LOGS</div>
              <h2>Recent Actions</h2>
            </div>
            <Badge type="neutral">{logs.length} RECORDS</Badge>
          </div>
          
          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', padding: '12px', margin: '16px', borderRadius: '8px', fontSize: '13px' }}>
              <ShieldAlert size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
              {error}
            </div>
          )}

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Actor (Email)</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5">
                      <div className="empty-state">
                        <strong>Loading logs...</strong>
                        <span>Decrypting ledger entries from the secure vault.</span>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      <div className="empty-state">
                        <Lock size={32} color="#94a3b8" style={{ marginBottom: '16px' }} />
                        <strong>No audit records found</strong>
                        <span>The system ledger is currently empty.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td><strong>{log.action}</strong></td>
                      <td>{log.user_email || 'SYSTEM'}</td>
                      <td>{log.entity_type} {log.entity_id ? `(${log.entity_id})` : ''}</td>
                      <td>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px', color: '#a3e635', maxHeight: '60px', overflowY: 'auto' }}>
                          {JSON.stringify(log.details)}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
