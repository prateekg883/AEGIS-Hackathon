import { useState, useEffect } from 'react';
import { useAuth } from '../state/AuthContext';
import { useSOC } from '../state/SOCContext';
import api from '../services/api';
import { ShieldAlert, CheckCircle, Clock, AlertTriangle, ArrowRight } from 'lucide-react';

const tone = (value = '') => String(value).toLowerCase().replaceAll(' ', '-');
const Badge = ({ children, type = 'neutral' }) => <span className={`badge ${tone(type)}`}>{children}</span>;

export default function DecisionRoom() {
  const { user } = useAuth();
  const { findings } = useSOC();
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');

  // Decision room is for SUPERVISOR
  if (user?.roleLabel !== 'SUPERVISOR') {
    return (
      <div className="page-head">
        <div>
          <div className="eyebrow">ACCESS DENIED</div>
          <h1>Supervisory Decision Room</h1>
          <p>Your current identity ({user?.roleLabel}) is not authorized to access the Decision Room. This area is strictly for Executive Supervisors to validate findings and authorize actions.</p>
        </div>
      </div>
    );
  }

  const reviewableFindings = findings.filter(f => f.status === 'Open' || f.status === 'UNDER REVIEW' || f.status === 'OPEN');

  const handleTransition = async (status) => {
    if (!selectedFinding) return;
    setLoading(true);
    setError('');
    try {
      await api.transitionFinding(selectedFinding.id, status, notes);
      // In a real app, we'd refetch or update state here.
      // For now, optimistic update:
      selectedFinding.status = status;
      setSelectedFinding(null);
      setNotes('');
    } catch (err) {
      setError(err.message || 'Failed to transition finding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">A.E.G.I.S · SUPERVISORY WORKSPACE</div>
          <h1>Decision Room</h1>
          <p>Authorize finding transitions, validate evidence, and assign remediation actions.</p>
        </div>
      </div>

      <div className="grid-2-1" style={{ marginTop: '24px' }}>
        <section className="card table-card">
          <div className="section-title">
            <div>
              <div className="eyebrow">PENDING AUTHORIZATION</div>
              <h2>Actionable Findings</h2>
            </div>
            <Badge type="amber">{reviewableFindings.length} PENDING</Badge>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Finding ID</th>
                  <th>Entity</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reviewableFindings.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      <div className="empty-state">
                        <strong>No pending findings</strong>
                        <span>All findings have been processed by the supervisor.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  reviewableFindings.map(f => (
                    <tr key={f.id} className={selectedFinding?.id === f.id ? 'active-row' : ''}>
                      <td><strong>{f.id}</strong></td>
                      <td>{f.cse}</td>
                      <td><Badge type={f.severity}>{f.severity}</Badge></td>
                      <td><Badge type={f.status}>{f.status}</Badge></td>
                      <td>
                        <button className="button ghost" onClick={() => setSelectedFinding(f)}>
                          Review <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="section-title">
            <div>
              <div className="eyebrow">DECISION CONTEXT</div>
              <h2>Supervisory Review</h2>
            </div>
          </div>
          
          {!selectedFinding ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <ShieldAlert size={32} color="#94a3b8" style={{ marginBottom: '16px' }} />
              <strong>Select a finding</strong>
              <span>Choose a pending finding from the queue to review evidence and authorize state transitions.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#f8fafc' }}>{selectedFinding.title}</h3>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>{selectedFinding.explanation}</p>
              </div>
              
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <strong style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>Supervisory Impact</strong>
                <span style={{ fontSize: '13px', color: '#cbd5e1' }}>{selectedFinding.impact || 'Requires immediate verification of operational records.'}</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 'bold' }}>Decision Notes (Immutable Log)</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter justification for decision..."
                  style={{ width: '100%', minHeight: '80px', padding: '12px', background: 'rgba(2, 6, 23, 0.6)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f8fafc', fontSize: '13px', resize: 'vertical' }}
                />
              </div>

              {error && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', padding: '12px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={16} /> {error}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button 
                  disabled={loading}
                  onClick={() => handleTransition('VALIDATED')}
                  className="button" 
                  style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: loading ? 'wait' : 'pointer' }}
                >
                  <CheckCircle size={16} /> Validate Finding
                </button>
                <button 
                  disabled={loading}
                  onClick={() => handleTransition('UNDER REVIEW')}
                  className="button" 
                  style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '12px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: loading ? 'wait' : 'pointer' }}
                >
                  <Clock size={16} /> Mark as Under Review
                </button>
                <button 
                  disabled={loading}
                  onClick={() => handleTransition('RESOLVED')}
                  className="button" 
                  style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.2)', padding: '12px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: loading ? 'wait' : 'pointer' }}
                >
                  Close / Resolve
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
