import { useState } from 'react';
import { useSOC } from '../state/SOCContext';
import { ArrowRight, CheckCircle2, MessageSquare, Briefcase } from 'lucide-react';
import Badge from './common/Badge';

export default function CaseManagementDrawer({ caseId, onClose }) {
  const { cases, updateCaseStatus, addCaseNote } = useSOC();
  const [note, setNote] = useState('');

  const caseRec = cases.find(c => c.id === caseId);
  if (!caseRec) return null;

  const handleAddNote = () => {
    if (note.trim()) { addCaseNote(caseRec.id, note.trim()); setNote(''); }
  };

  const STAGES = ['Detected', 'Investigating', 'Escalated', 'Resolved'];
  const ORDER   = ['Open', 'Investigating', 'Escalated', 'Closed', 'Resolved'];
  const stageIdx = ORDER.indexOf(caseRec.status);

  const renderStage = (label, idx) => {
    const isActive = ORDER[stageIdx] === label || (label === 'Detected' && caseRec.status === 'Open');
    const isPast   = stageIdx > ORDER.indexOf(label === 'Detected' ? 'Open' : label);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{
          height: 14, width: 14, borderRadius: '50%',
          background: isActive ? 'var(--color-accent)' : isPast ? 'var(--color-success)' : 'var(--color-border)',
          border: isActive ? '3px solid var(--color-info-dim)' : 'none',
        }} />
        <span style={{
          fontSize: 'var(--font-size-caption)',
          color: (isActive || isPast) ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          fontWeight: isActive ? 600 : 400,
        }}>
          {label}
        </span>
      </div>
    );
  };

  return (
    <div className="drawer-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="drawer" onClick={(e) => e.stopPropagation()} style={{ width: 550, overflowY: 'auto' }}>
        <button className="drawer-close" onClick={onClose}>×</button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Header */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              <Briefcase size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> CASE MANAGEMENT
            </div>
            <h2 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 8 }}>{caseRec.id}</h2>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge variant={caseRec.severity?.toLowerCase() || 'neutral'}>{caseRec.severity}</Badge>
              <Badge variant={String(caseRec.status).toLowerCase().replace(/\s+/g, '-')}>{caseRec.status}</Badge>
              <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)' }}>Entity: {caseRec.cse}</span>
            </div>
          </div>

          {/* Workflow status */}
          <div className="card" style={{ padding: 20 }}>
            <div className="eyebrow" style={{ marginBottom: 15 }}>WORKFLOW STATUS</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 7, left: '10%', right: '10%', height: 2, background: 'var(--color-border)', zIndex: 0 }} />
              {STAGES.map((label, idx) => (
                <div key={label} style={{ zIndex: 1 }}>{renderStage(label, idx)}</div>
              ))}
            </div>
          </div>

          {/* Investigation notes */}
          <div className="card" style={{ padding: 20 }}>
            <div className="eyebrow" style={{ marginBottom: 15 }}>INVESTIGATION NOTES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 15 }}>
              {caseRec.notes && caseRec.notes.length > 0 ? (
                caseRec.notes.map((n, i) => (
                  <div key={i} style={{ fontSize: 'var(--font-size-small)', padding: 10, background: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}>
                    <MessageSquare size={10} style={{ display: 'inline', marginRight: 6, color: 'var(--color-text-muted)', verticalAlign: 'middle' }} />
                    {n}
                  </div>
                ))
              ) : (
                <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)' }}>No notes added yet.</span>
              )}
            </div>
            {!['Closed', 'Resolved'].includes(caseRec.status) && (
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add a finding or hypothesis…"
                  style={{ flex: 1, padding: '8px 12px', fontSize: 'var(--font-size-small)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
                />
                <button className="button primary" style={{ fontSize: 'var(--font-size-small)' }} onClick={handleAddNote}>Add</button>
              </div>
            )}
          </div>

          {/* Case resolution */}
          <div className="callout" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 20 }}>
            <b style={{ color: 'var(--color-text-heading)', fontSize: 'var(--font-size-body)', marginBottom: 12, display: 'block' }}>Case Resolution</b>
            <div style={{ display: 'flex', gap: 10, width: '100%', flexWrap: 'wrap' }}>
              <button
                className="button ghost"
                style={{ flex: 1, fontSize: 'var(--font-size-small)', justifyContent: 'center' }}
                onClick={() => updateCaseStatus(caseRec.id, 'Investigating')}
                disabled={['Investigating', 'Closed', 'Resolved'].includes(caseRec.status)}
              >
                Mark Investigating
              </button>
              <button
                className="cap-btn cap-btn--resolve"
                style={{ flex: 1, fontSize: 'var(--font-size-small)', justifyContent: 'center', padding: '8px 14px' }}
                onClick={() => { updateCaseStatus(caseRec.id, 'Resolved', 'Resolved by analyst'); onClose(); }}
                disabled={['Closed', 'Resolved'].includes(caseRec.status)}
              >
                Resolve Case
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
