import { useEffect, useState } from 'react';
import { 
  AlertTriangle, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  Eye, 
  KeyRound, 
  Lock, 
  RefreshCw, 
  Send, 
  ShieldAlert, 
  ShieldCheck, 
  X,
  Building,
  FileText,
  AlertOctagon
} from 'lucide-react';
import api from '../services/api';
import { useSOC } from '../state/SOCContext';
import { useAuth } from '../state/AuthContext';
import HigherAuthorityEscalationModal from './HigherAuthorityEscalationModal';

export default function EscalationPanel() {
  const { user } = useAuth();
  const { findings, cseEntities, updateFindingStatus } = useSOC();
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState(null);
  const [selectedPayload, setSelectedPayload] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);
  const [escalatingFinding, setEscalatingFinding] = useState(null);
  const [isEscalating, setIsEscalating] = useState(false);

  const fetchGatewayData = async () => {
    try {
      setLoading(true);
      const [statsRes, queueRes] = await Promise.all([
        api.getGatewayStats(),
        api.getGatewayQueue(),
      ]);
      setStats(statsRes);
      setQueue(queueRes);
    } catch (err) {
      console.error('Failed to load gateway data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGatewayData();
  }, []);

  // Filter high findings (Scores 71-97 or High severity) requiring human review
  const highFindings = (findings || []).filter((f) => {
    const sev = String(f.severity || '').toUpperCase();
    const score = Number(f.score_contribution || f.attention_score || 75);
    return (sev === 'HIGH' || (score >= 71 && score <= 97)) && f.status !== 'RESOLVED' && f.status !== 'ESCALATED';
  });

  // Filter critical findings (Scores 98-100 or Critical severity)
  const criticalFindings = (findings || []).filter((f) => {
    const sev = String(f.severity || '').toUpperCase();
    const score = Number(f.score_contribution || f.attention_score || 98);
    return sev === 'CRITICAL' || score >= 98;
  });

  const handleOpenEscalateModal = (finding) => {
    setEscalatingFinding(finding);
  };

  const handleConfirmEscalate = async (modalData) => {
    const { findingCode, score, title, category, cse, bottleneck, analyst_notes, target_authority, action_requested, urgency } = modalData;
    setIsEscalating(true);
    try {
      setActionNotice({ type: 'info', message: `Submitting formal escalation for ${findingCode} to ${target_authority}...` });
      const res = await api.processCriticalEscalation(findingCode, score, {
        title,
        category,
        cse,
        bottleneck,
        analyst_notes,
        target_authority,
        action_requested,
        urgency
      });
      
      if (updateFindingStatus) {
        updateFindingStatus(findingCode, 'ESCALATED');
      }
      
      setActionNotice({ 
        type: 'success', 
        message: `Escalation Dossier for ${findingCode} successfully dispatched to ${target_authority}. Ground review recorded.` 
      });
      setEscalatingFinding(null);
      fetchGatewayData();
    } catch (err) {
      setActionNotice({ type: 'error', message: err.message });
    } finally {
      setIsEscalating(false);
    }
  };

  const handleRetry = async (queueId) => {
    try {
      setRetryingId(queueId);
      const res = await api.retryEscalation(queueId);
      setActionNotice({ type: 'info', message: res.message });
      fetchGatewayData();
    } catch (err) {
      setActionNotice({ type: 'error', message: err.message });
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="escalation-panel" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        color: '#fff',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid #334155',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ 
              background: '#ef444420', color: '#ef4444', border: '1px solid #ef444450',
              fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase'
            }}>
              Outbound Boundary Security
            </span>
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>A.E.G.I.S. · SAT-SA</span>
          </div>
          <h1 style={{ margin: '0 0 6px 0', fontSize: '24px', fontWeight: '700' }}>
            Supervisory Escalation & Critical Alert Gateway
          </h1>
          <p style={{ margin: 0, color: '#cbd5e1', fontSize: '13px', maxWidth: '800px' }}>
            Offline-first supervisory analytics platform with controlled, secure escalation of critical findings (Attention Score 98–100) to authorised external endpoints or protected local queue.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid #475569',
            borderRadius: '8px',
            padding: '10px 16px',
            textAlign: 'right'
          }}>
            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gateway Status</div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: stats?.is_configured ? '#22c55e' : '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stats?.is_configured ? '#22c55e' : '#f59e0b' }}/>
              {stats?.destination_status === 'ENABLED_CONFIGURED' ? 'AUTHORISED ENDPOINT CONNECTED' : 'PROTECTED LOCAL QUEUE (OFFLINE-FIRST)'}
            </div>
          </div>
          <button 
            className="button secondary" 
            onClick={fetchGatewayData} 
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {actionNotice && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          background: actionNotice.type === 'error' ? '#fee2e2' : actionNotice.type === 'success' ? '#dcfce7' : '#e0f2fe',
          color: actionNotice.type === 'error' ? '#991b1b' : actionNotice.type === 'success' ? '#166534' : '#075985',
          border: `1px solid ${actionNotice.type === 'error' ? '#f87171' : actionNotice.type === 'success' ? '#86efac' : '#7dd3fc'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{actionNotice.message}</span>
          <button onClick={() => setActionNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16}/></button>
        </div>
      )}

      {/* Attention Score Policy Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#10b981', background: '#10b98115', padding: '2px 8px', borderRadius: '4px' }}>SCORE 0–30</span>
            <small style={{ color: '#64748b' }}>Local Only</small>
          </div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>NORMAL</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Status: <strong>LOCAL — NORMAL</strong></div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Stored locally. No external transmission.</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#3b82f6', background: '#3b82f615', padding: '2px 8px', borderRadius: '4px' }}>SCORE 31–70</span>
            <small style={{ color: '#64748b' }}>Local Only</small>
          </div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>MEDIUM</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Status: <strong>LOCAL — MEDIUM</strong></div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Trend tracking. No external transmission.</div>
        </div>

        <div style={{ background: '#fff', border: '2px solid #f59e0b', borderRadius: '10px', padding: '16px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#d97706', background: '#f59e0b15', padding: '2px 8px', borderRadius: '4px' }}>SCORE 71–97</span>
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#d97706' }}>HUMAN REVIEW</span>
          </div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>HIGH</div>
          <div style={{ fontSize: '12px', color: '#b45309', marginTop: '4px' }}>Status: <strong>HUMAN SUPERVISORY REVIEW REQUIRED</strong></div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Supervisory task created. Manual action only.</div>
        </div>

        <div style={{ background: '#fff', border: '2px solid #ef4444', borderRadius: '10px', padding: '16px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#dc2626', background: '#ef444415', padding: '2px 8px', borderRadius: '4px' }}>SCORE 98–100</span>
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#dc2626' }}>GATEWAY ELIGIBLE</span>
          </div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>CRITICAL</div>
          <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>Status: <strong>CRITICAL — ESCALATION REQUIRED</strong></div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Encrypted minimised package to authorised endpoint.</div>
        </div>
      </div>

      {/* Gateway Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="card stat" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="stat-icon" style={{ background: '#ef444415', color: '#ef4444' }}><ShieldAlert size={20} /></div>
          <div>
            <span>Critical Alerts (98-100)</span>
            <strong>{criticalFindings.length}</strong>
            <small>Eligible for gateway</small>
          </div>
        </div>

        <div className="card stat" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon" style={{ background: '#f59e0b15', color: '#d97706' }}><Clock size={20} /></div>
          <div>
            <span>Human Reviews Pending</span>
            <strong>{highFindings.length}</strong>
            <small>Score 71–97 awaiting review</small>
          </div>
        </div>

        <div className="card stat" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-icon" style={{ background: '#3b82f615', color: '#2563eb' }}><Lock size={20} /></div>
          <div>
            <span>Queued Critical Alerts</span>
            <strong>{stats?.stats?.total_queued || queue.length || 0}</strong>
            <small>Encrypted local storage</small>
          </div>
        </div>

        <div className="card stat" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-icon" style={{ background: '#10b98115', color: '#059669' }}><CheckCircle2 size={20} /></div>
          <div>
            <span>Delivered Transmissions</span>
            <strong>{stats?.stats?.delivered || 0}</strong>
            <small>To authorised endpoint</small>
          </div>
        </div>
      </div>

      {/* Section 1: Protected Critical Escalation Queue */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700' }}>Protected Critical Escalation Queue</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Minimum necessary alert packages encrypted with HMAC-SHA256 signatures and SHA-256 payload hashes.
            </p>
          </div>
          <span style={{ fontSize: '12px', color: '#64748b', background: '#f1f5f9', padding: '4px 10px', borderRadius: '20px' }}>
            {queue.length} alerts queued
          </span>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Alert ID</th>
                <th>Finding / CSE</th>
                <th>Attention Score</th>
                <th>Destination</th>
                <th>Delivery Status</th>
                <th>Payload Hash</th>
                <th>Last Attempt</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    <strong>No critical alerts currently queued.</strong>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      Only findings with Attention Score 98–100 enter this secure boundary.
                    </div>
                  </td>
                </tr>
              ) : (
                queue.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong style={{ fontFamily: 'monospace', fontSize: '12px', color: '#0f172a' }}>{item.alert_id}</strong>
                    </td>
                    <td>
                      <div><strong>{item.finding_id || 'Direct Ingestion'}</strong></div>
                      <small style={{ color: '#64748b' }}>{item.cse_code}</small>
                    </td>
                    <td>
                      <span style={{ 
                        background: '#ef444415', color: '#dc2626', border: '1px solid #ef444440',
                        padding: '2px 8px', borderRadius: '4px', fontWeight: '700', fontSize: '12px' 
                      }}>
                        {item.attention_score} CRITICAL
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', fontWeight: '500' }}>{item.destination_type}</span>
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
                        background: item.delivery_status === 'DELIVERED' ? '#dcfce7' : item.delivery_status === 'AWAITING_AUTH_ENDPOINT' ? '#fef3c7' : '#fee2e2',
                        color: item.delivery_status === 'DELIVERED' ? '#15803d' : item.delivery_status === 'AWAITING_AUTH_ENDPOINT' ? '#b45309' : '#b91c1c',
                      }}>
                        {item.delivery_status}
                      </span>
                    </td>
                    <td>
                      <code style={{ fontSize: '11px', color: '#475569' }} title={item.payload_hash}>
                        {item.payload_hash ? `${item.payload_hash.slice(0, 12)}...` : 'N/A'}
                      </code>
                    </td>
                    <td>
                      <small style={{ color: '#64748b' }}>{item.last_attempt_at ? new Date(item.last_attempt_at).toLocaleTimeString() : 'Pending'}</small>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          className="button secondary" 
                          style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => setSelectedPayload(item.minimised_package)}
                          title="Inspect Minimised Alert Package"
                        >
                          <Eye size={12} /> Inspect
                        </button>
                        {item.delivery_status !== 'DELIVERED' && (
                          <button 
                            className="button primary" 
                            style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => handleRetry(item.id)}
                            disabled={retryingId === item.id}
                          >
                            <Send size={12} /> Retry
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Human Supervisory Review Required (Scores 71–97) */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700' }}>
              Pending Human Supervisory Reviews (Scores 71–97)
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Under A.E.G.I.S. policy, HIGH threats do NOT automatically transmit externally. They require supervisor assessment, verification, and manual escalation if authorized.
            </p>
          </div>
          <span style={{ fontSize: '12px', color: '#d97706', background: '#fef3c7', padding: '4px 10px', borderRadius: '20px', fontWeight: '700' }}>
            {highFindings.length} Pending Actions
          </span>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Finding Code</th>
                <th>Title / Summary</th>
                <th>Category</th>
                <th>Attention Policy</th>
                <th>Status</th>
                <th>Supervisor Actions</th>
              </tr>
            </thead>
            <tbody>
              {highFindings.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    <strong>No high-risk findings currently awaiting supervisory review.</strong>
                  </td>
                </tr>
              ) : (
                highFindings.map((finding) => (
                  <tr key={finding.id}>
                    <td>
                      <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{finding.finding_code || finding.id}</strong>
                    </td>
                    <td>
                      <div><strong>{finding.title}</strong></div>
                      <small style={{ color: '#64748b' }}>
                        {finding.explanation || finding.description || finding.observed || 'Supervisory attention required under NCIIPC guidelines.'}
                      </small>
                    </td>
                    <td>
                      <span className="badge amber">{finding.category}</span>
                    </td>
                    <td>
                      <span style={{ 
                        background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a',
                        padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' 
                      }}>
                        HUMAN SUPERVISORY REVIEW REQUIRED
                      </span>
                    </td>
                    <td>
                      <span className="badge">{finding.status || 'OPEN'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          className="button primary" 
                          style={{ padding: '5px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', background: '#2563eb' }}
                          onClick={() => handleOpenEscalateModal(finding)}
                          title="Submit to Higher Authority with Ground-Level Review Dossier"
                        >
                          <ArrowUpRight size={13} /> Escalate to Higher Authority
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Higher Authority Escalation Review Modal */}
      {escalatingFinding && (
        <HigherAuthorityEscalationModal
          finding={escalatingFinding}
          isSubmitting={isEscalating}
          onEscalate={handleConfirmEscalate}
          onClose={() => setEscalatingFinding(null)}
        />
      )}

      {/* Minimised Payload & Ground Review Inspector Modal */}
      {selectedPayload && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '780px',
            maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)', border: '1px solid #cbd5e1'
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', color: '#fff'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '700', textTransform: 'uppercase' }}>
                  A.E.G.I.S. Outbound Boundary Inspection
                </div>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '16px', fontWeight: '700', color: '#fff' }}>
                  Higher Authority Escalation Dossier & Payload Verification
                </h3>
              </div>
              <button onClick={() => setSelectedPayload(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20}/></button>
            </div>
            
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Ground-Level Obstacles Review Card */}
              {selectedPayload.ground_level_review && (
                <div style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '10px',
                  padding: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#b45309' }}>
                    <AlertTriangle size={18} />
                    <strong style={{ fontSize: '13px', textTransform: 'uppercase' }}>
                      Ground Team Operational Bottleneck (Neeche Wale Ko Kya Dikkat Aayi):
                    </strong>
                  </div>
                  <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '10px', fontWeight: '700' }}>
                    Barrier: <span style={{ color: '#78350f' }}>{selectedPayload.ground_level_review.bottleneck_category}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#78350f', background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #fef3c7', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                    {selectedPayload.ground_level_review.ground_analyst_issues}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginTop: '12px' }}>
                    <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #fef3c7' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', display: 'block' }}>TARGET AUTHORITY:</span>
                      <strong style={{ fontSize: '12px', color: '#0f172a' }}>{selectedPayload.ground_level_review.target_higher_authority}</strong>
                    </div>
                    <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #fef3c7' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', display: 'block' }}>ACTION REQUESTED:</span>
                      <strong style={{ fontSize: '12px', color: '#047857' }}>{selectedPayload.ground_level_review.recommended_executive_action}</strong>
                    </div>
                    <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #fef3c7' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', display: 'block' }}>URGENCY LEVEL:</span>
                      <strong style={{ fontSize: '12px', color: '#dc2626' }}>{selectedPayload.ground_level_review.urgency_level}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Data Minimisation JSON Package */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Canonical Minimised JSON (14 Encrypted Fields):
                </div>
                <pre style={{
                  background: '#0f172a', color: '#38bdf8', padding: '16px', borderRadius: '8px',
                  fontSize: '11px', fontFamily: 'monospace', overflowX: 'auto', lineHeight: '1.5', margin: 0
                }}>
                  {JSON.stringify(selectedPayload, null, 2)}
                </pre>
              </div>
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'right' }}>
              <button className="button primary" onClick={() => setSelectedPayload(null)}>Close Inspection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
