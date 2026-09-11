import { useEffect, useState } from 'react';
import { useSOC } from '../state/SOCContext';
import { ShieldAlert, Crosshair, HelpCircle, Activity, FileText } from 'lucide-react';

const Badge = ({ children, type = 'neutral' }) => {
  const tone = (value = '') => String(value).toLowerCase().replaceAll(' ', '-');
  return <span className={`badge ${tone(type)}`}>{children}</span>;
};

export default function AlertInvestigationDrawer({ alertId, onClose }) {
  const { alerts, updateAlertStatus, escalateAlert, isDemoMode } = useSOC();
  const alert = alerts.find(a => a.id === alertId);

  if (!alert) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      <div 
        className="drawer" 
        onClick={(e) => e.stopPropagation()} 
        style={{ width: '500px', overflowY: 'auto' }}
      >
        <button className="drawer-close" onClick={onClose}>X</button>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <div className="eyebrow" style={{ color: alert.severity === 'Critical' ? '#dc2626' : '#d97706' }}>
              <span className={`signal ${alert.severity.toLowerCase()}`}></span>
              ALERT INVESTIGATION
            </div>
            <h2 style={{ fontSize: '22px', marginBottom: '8px' }}>{alert.type}</h2>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge type={alert.severity}>{alert.severity}</Badge>
              <Badge type={alert.status}>{alert.status}</Badge>
              <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)', fontFamily: 'inherit' }}>{alert.id}</span>
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
             <div className="trace" style={{ marginTop: '0', paddingTop: '0', borderTop: 'none', gap: '16px' }}>
                <div><span style={{ minWidth: '100px' }}>Timestamp</span><b style={{ textAlign: 'left', flex: 1, color: 'var(--ink, #1e293b)' }}>{alert.created}</b></div>
                <div><span style={{ minWidth: '100px' }}>Source Entity</span><b style={{ textAlign: 'left', flex: 1, color: 'var(--ink, #1e293b)' }}>{alert.cse}</b></div>
                <div><span style={{ minWidth: '100px' }}>Target Asset</span><b style={{ textAlign: 'left', flex: 1, color: 'var(--ink, #1e293b)' }}>{alert.asset}</b></div>
                <div><span style={{ minWidth: '100px' }}>MITRE ATT&CK</span><b style={{ textAlign: 'left', flex: 1, color: 'var(--blue, #2563eb)' }}>{alert.type.includes('access') ? 'T1078 - Valid Accounts' : 'T1048 - Exfiltration'}</b></div>
             </div>
          </div>

          <div className="prose-block" style={{ borderTop: 'none', padding: '16px', background: 'var(--bg-subtle, #f8fafc)', borderRadius: '8px', border: '1px solid var(--line, #e2e8f0)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ink, #1e293b)' }}><Activity size={12} /> EVIDENCE LOG</h3>
            <p style={{ fontSize: '11px', color: 'var(--muted, #64748b)', lineHeight: '1.6' }}>
              Log anomaly detected at {alert.created}. Traffic from unauthorized subnet targeting {alert.asset}. System classified as {alert.severity} due to matching baseline deviation rule.
            </p>
          </div>

          <div className="callout" style={{ marginTop: 'auto', background: 'var(--paper, #fff)', border: '1px solid var(--line, #e2e8f0)', flexDirection: 'column', alignItems: 'flex-start', padding: '20px' }}>
            <b style={{ color: 'var(--ink, #1e293b)', fontSize: '12px', marginBottom: '12px' }}>Incident Actions</b>
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button 
                className="button primary" 
                style={{ flex: 1, fontSize: '11px', justifyContent: 'center' }}
                onClick={() => { updateAlertStatus(alert.id, 'Acknowledged'); onClose(); }}
                disabled={alert.status === 'Acknowledged' || alert.status === 'Closed' || alert.status === 'Resolved'}
              >
                Acknowledge
              </button>
              <button 
                className="button ghost" 
                style={{ flex: 1, fontSize: '11px', color: '#dc2626', borderColor: '#dc2626', justifyContent: 'center' }}
                onClick={() => { escalateAlert(alert.id); onClose(); }}
                disabled={alert.status === 'Escalated' || alert.status === 'Closed' || alert.status === 'Resolved'}
              >
                Escalate
              </button>
            </div>
            <button 
                className="button ghost" 
                style={{ width: '100%', marginTop: '10px', fontSize: '11px', justifyContent: 'center' }}
                onClick={() => { updateAlertStatus(alert.id, 'Closed'); onClose(); }}
                disabled={alert.status === 'Closed' || alert.status === 'Resolved'}
              >
                Mark Resolved / False Positive
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
