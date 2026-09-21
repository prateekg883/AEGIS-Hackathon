import { useSOC } from '../state/SOCContext';
import { ShieldAlert, Activity } from 'lucide-react';
import Badge from './common/Badge';

export default function AlertInvestigationDrawer({ alertId, onClose }) {
  const { alerts, updateAlertStatus, escalateAlert } = useSOC();
  const alert = alerts.find(a => a.id === alertId);

  if (!alert) return null;

  const sevIsCritical = alert.severity === 'Critical';

  return (
    <div className="drawer-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="drawer" onClick={(e) => e.stopPropagation()} style={{ width: 500, overflowY: 'auto' }}>
        <button className="drawer-close" onClick={onClose}>×</button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Header */}
          <div>
            <div className="eyebrow" style={{ color: sevIsCritical ? 'var(--color-critical)' : 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span className={`signal ${alert.severity.toLowerCase()}`} />
              ALERT INVESTIGATION
            </div>
            <h2 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 8 }}>{alert.type}</h2>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge variant={alert.severity.toLowerCase()}>{alert.severity}</Badge>
              <Badge variant={String(alert.status).toLowerCase().replace(/\s+/g, '-')}>{alert.status}</Badge>
              <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)' }}>{alert.id}</span>
            </div>
          </div>

          {/* Telemetry details */}
          <div className="card" style={{ padding: 20 }}>
            <div className="trace" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none', gap: 16 }}>
              <div>
                <span style={{ minWidth: 100, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-small)' }}>Timestamp</span>
                <b style={{ textAlign: 'left', flex: 1, color: 'var(--color-text-primary)', fontWeight: 600 }}>{alert.created}</b>
              </div>
              <div>
                <span style={{ minWidth: 100, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-small)' }}>Source Entity</span>
                <b style={{ textAlign: 'left', flex: 1, color: 'var(--color-text-primary)', fontWeight: 600 }}>{alert.cse}</b>
              </div>
              <div>
                <span style={{ minWidth: 100, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-small)' }}>Target Asset</span>
                <b style={{ textAlign: 'left', flex: 1, color: 'var(--color-text-primary)', fontWeight: 600 }}>{alert.asset}</b>
              </div>
              <div>
                <span style={{ minWidth: 100, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-small)' }}>MITRE ATT&amp;CK</span>
                <b style={{ textAlign: 'left', flex: 1, color: 'var(--color-accent)', fontWeight: 600 }}>
                  {alert.type.includes('access') ? 'T1078 - Valid Accounts' : 'T1048 - Exfiltration'}
                </b>
              </div>
            </div>
          </div>

          {/* Evidence log */}
          <div style={{ padding: 16, background: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-primary)', fontSize: 'var(--font-size-small)', margin: '0 0 8px' }}>
              <Activity size={12} style={{ color: 'var(--color-accent)' }} /> EVIDENCE LOG
            </h3>
            <p style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', lineHeight: 'var(--line-height-loose)', margin: 0 }}>
              Log anomaly detected at {alert.created}. Traffic from unauthorized subnet targeting {alert.asset}. System classified as {alert.severity} due to matching baseline deviation rule.
            </p>
          </div>

          {/* Incident actions */}
          <div className="callout" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 20 }}>
            <b style={{ color: 'var(--color-text-heading)', fontSize: 'var(--font-size-body)', marginBottom: 12, display: 'block' }}>Incident Actions</b>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button
                className="button primary"
                style={{ flex: 1, fontSize: 'var(--font-size-small)', justifyContent: 'center' }}
                onClick={() => { updateAlertStatus(alert.id, 'Acknowledged'); onClose(); }}
                disabled={['Acknowledged', 'Closed', 'Resolved'].includes(alert.status)}
              >
                Acknowledge
              </button>
              <button
                className="cap-btn cap-btn--escalate"
                style={{ flex: 1, fontSize: 'var(--font-size-small)', justifyContent: 'center' }}
                onClick={() => { escalateAlert(alert.id); onClose(); }}
                disabled={['Escalated', 'Closed', 'Resolved'].includes(alert.status)}
              >
                Escalate
              </button>
            </div>
            <button
              className="button ghost"
              style={{ width: '100%', marginTop: 10, fontSize: 'var(--font-size-small)', justifyContent: 'center' }}
              onClick={() => { updateAlertStatus(alert.id, 'Closed'); onClose(); }}
              disabled={['Closed', 'Resolved'].includes(alert.status)}
            >
              Mark Resolved / False Positive
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
