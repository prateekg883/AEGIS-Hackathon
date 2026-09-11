import { useState } from 'react';
import { useSOC } from '../state/SOCContext';
import { ArrowRight, CheckCircle2, MessageSquare, Briefcase } from 'lucide-react';

const Badge = ({ children, type = 'neutral' }) => {
  const tone = (value = '') => String(value).toLowerCase().replaceAll(' ', '-');
  return <span className={`badge ${tone(type)}`}>{children}</span>;
};

export default function CaseManagementDrawer({ caseId, onClose }) {
  const { cases, updateCaseStatus, addCaseNote } = useSOC();
  const [note, setNote] = useState('');
  
  const caseRec = cases.find(c => c.id === caseId);
  if (!caseRec) return null;

  const handleAddNote = () => {
    if (note.trim()) {
      addCaseNote(caseRec.id, note.trim());
      setNote('');
    }
  };

  const renderStage = (label, isActive, isPast) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div style={{ height: '14px', width: '14px', borderRadius: '50%', background: isActive ? '#2563eb' : (isPast ? '#16a34a' : 'var(--line, #e2e8f0)'), border: isActive ? '3px solid #dbeafe' : 'none' }}></div>
      <span style={{ fontSize: '10px', color: isActive || isPast ? 'var(--ink, #1e293b)' : 'var(--muted, #94a3b8)', fontWeight: isActive ? '600' : 'normal' }}>{label}</span>
    </div>
  );

  return (
    <div className="drawer-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      <div 
        className="drawer" 
        onClick={(e) => e.stopPropagation()} 
        style={{ width: '550px', overflowY: 'auto' }}
      >
        <button className="drawer-close" onClick={onClose}>X</button>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <div className="eyebrow"><Briefcase size={10} style={{ display: 'inline', marginRight: '4px' }}/> CASE MANAGEMENT</div>
            <h2 style={{ fontSize: '22px', marginBottom: '8px' }}>{caseRec.id}</h2>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge type={caseRec.severity}>{caseRec.severity}</Badge>
              <Badge type={caseRec.status}>{caseRec.status}</Badge>
              <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)', fontFamily: 'inherit' }}>Entity: {caseRec.cse}</span>
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
             <div className="eyebrow" style={{ marginBottom: '15px' }}>WORKFLOW STATUS</div>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '7px', left: '10%', right: '10%', height: '2px', background: 'var(--line, #e2e8f0)', zIndex: 0 }}></div>
                <div style={{ zIndex: 1 }}>{renderStage('Detected', caseRec.status === 'Open', caseRec.status !== 'Open')}</div>
                <div style={{ zIndex: 1 }}>{renderStage('Investigating', caseRec.status === 'Investigating', ['Escalated', 'Closed', 'Resolved'].includes(caseRec.status))}</div>
                <div style={{ zIndex: 1 }}>{renderStage('Escalated', caseRec.status === 'Escalated', ['Closed', 'Resolved'].includes(caseRec.status))}</div>
                <div style={{ zIndex: 1 }}>{renderStage('Resolved', ['Closed', 'Resolved'].includes(caseRec.status), false)}</div>
             </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div className="eyebrow" style={{ marginBottom: '15px' }}>INVESTIGATION NOTES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
              {caseRec.notes && caseRec.notes.length > 0 ? caseRec.notes.map((n, i) => (
                <div key={i} style={{ fontSize: '11px', padding: '10px', background: 'var(--bg-subtle, #f8fafc)', borderRadius: '6px', color: 'var(--ink, #1e293b)', border: '1px solid var(--line, #e2e8f0)' }}>
                  <MessageSquare size={10} style={{ display: 'inline', marginRight: '6px', color: 'var(--muted, #64748b)' }}/>
                  {n}
                </div>
              )) : <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)' }}>No notes added yet.</span>}
            </div>
            
            {caseRec.status !== 'Closed' && caseRec.status !== 'Resolved' && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  value={note} 
                  onChange={e => setNote(e.target.value)} 
                  placeholder="Add a finding or hypothesis..." 
                  style={{ flex: 1, padding: '8px 12px', fontSize: '11px', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', background: 'var(--paper, #fff)', color: 'var(--ink, #1e293b)' }}
                />
                <button className="button primary" style={{ fontSize: '11px' }} onClick={handleAddNote}>Add</button>
              </div>
            )}
          </div>

          <div className="callout" style={{ marginTop: 'auto', background: 'var(--paper, #fff)', border: '1px solid var(--line, #e2e8f0)', flexDirection: 'column', alignItems: 'flex-start', padding: '20px' }}>
            <b style={{ color: 'var(--ink, #1e293b)', fontSize: '12px', marginBottom: '12px' }}>Case Resolution</b>
            <div style={{ display: 'flex', gap: '10px', width: '100%', flexWrap: 'wrap' }}>
              <button 
                className="button ghost" 
                style={{ flex: 1, fontSize: '11px', justifyContent: 'center' }}
                onClick={() => updateCaseStatus(caseRec.id, 'Investigating')}
                disabled={['Investigating', 'Closed', 'Resolved'].includes(caseRec.status)}
              >
                Mark Investigating
              </button>
              <button 
                className="button primary" 
                style={{ flex: 1, fontSize: '11px', justifyContent: 'center', background: '#16a34a', borderColor: '#16a34a' }}
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
