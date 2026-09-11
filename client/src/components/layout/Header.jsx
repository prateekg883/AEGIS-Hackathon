import { Bell, ChevronRight, Menu, Moon, Sun, X, RefreshCw, UploadCloud, LogOut } from 'lucide-react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { prioritisedSamples } from '../../data/mockDataV2';
import { useAssessment } from '../../state/AssessmentContext';
import { useSOC } from '../../state/SOCContext';
import { useAuth } from '../../state/AuthContext';

export default function Header({ onMenu }) {
  const { period, periods, setPeriod, theme, setTheme } = useAssessment();
  const { resetDemoScenario, isDemoMode, activeFileName, findings = [], cseEntities = [] } = useSOC();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { pathname } = useLocation();
  const labels = { '/': 'Dashboard', '/escalation': 'Supervisory Escalation & Gateway', '/ingestion': 'Data Ingestion & Evidence Upload', '/cse': 'CSEs', '/findings': 'Findings', '/evidence': 'Evidence Explorer', '/records': 'Alert & Case Explorer', '/negative-space': 'Negative Space', '/benchmarking': 'Peer Benchmarking', '/prioritised-samples': 'Prioritised Samples', '/reports': 'Assessment Reports', '/workspace': 'Analyst Workspace' };
  const label = labels[pathname] || (pathname.startsWith('/cse/') ? 'CSEs' : pathname.startsWith('/findings/') ? 'Findings' : 'Dashboard');
  const notifications = [...findings.filter((item) => ['Critical', 'High'].includes(item.severity)), ...cseEntities.filter((item) => item.level === 'HIGH' || item.level === 'CRITICAL'), ...(prioritisedSamples || []).filter((item) => item.priority >= 85)].slice(0, 6);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="topbar">
      <button className="menu-button" onClick={onMenu}><Menu size={20}/></button>
      <div className="crumb"><span>Supervisory Command</span><ChevronRight size={14}/><b>{label}</b></div>
      <div className="top-actions">
        <Link to="/ingestion" className="button ghost" style={{borderColor: '#2563eb', color: '#2563eb', fontSize: '10px', padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none'}}>
          <UploadCloud size={12}/> Ingest Evidence
        </Link>
        {!isDemoMode && (
          <button className="button ghost" style={{borderColor: '#dc2626', color: '#dc2626', fontSize: '10px', padding: '6px 10px'}} onClick={resetDemoScenario} title="Reset live uploaded data back to default demo dataset">
            <RefreshCw size={12}/> Reset to Demo
          </button>
        )}
        {isDemoMode ? (
          <div className="header-status"><i/> DEMO MODE</div>
        ) : (
          <div className="header-status" style={{ background: '#dcfce7', color: '#15803d', borderColor: '#86efac' }}>
            <i style={{ background: '#22c55e' }}/> LIVE CSV: {activeFileName || 'INGESTED'}
          </div>
        )}
        <button className="icon-button" aria-label="Supervisory notifications" onClick={() => setNotificationsOpen((open) => !open)}>
          <Bell size={18}/>{notifications.length > 0 && <em>{notifications.length}</em>}
        </button>
        <button className="icon-button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
          {theme === 'light' ? <Moon size={17}/> : <Sun size={17}/>}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '6px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '1.2' }}>
            <span style={{ fontSize: '12px', fontWeight: '700' }}>
              {user?.name || user?.email?.split('@')[0] || 'Authorized User'}
            </span>
            <span style={{
              fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '4px',
              background: user?.badgeBg || 'rgba(37, 99, 235, 0.1)',
              color: user?.badgeColor || '#2563eb',
              border: `1px solid ${user?.badgeBorder || 'rgba(37, 99, 235, 0.2)'}`,
              textTransform: 'uppercase'
            }}>
              {user?.roleLabel || user?.role || 'SUPERVISOR'}
            </span>
          </div>
          <div className="avatar" title={`${user?.name || 'User'} (${user?.roleLabel || user?.role})`} style={{ background: user?.badgeColor || '#2563eb' }}>
            {user?.avatar || 'SS'}
          </div>
        </div>
        <button className="icon-button" aria-label="Log out" onClick={handleLogout} title="Sign Out">
          <LogOut size={17}/>
        </button>
        {notificationsOpen && (
          <div className="notification-panel">
            <div className="notification-head">
              <b>Supervisory Notifications</b>
              <button onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><X size={14}/></button>
            </div>
            <small>Derived from submitted assessment records, not live SOC alerts.</small>
            {notifications.length ? notifications.map((item, index) => (
              <div className="notification-item" key={`${item.id}-${index}`}>
                <strong>{item.id}</strong>
                <span>{item.title || item.name || item.reason}</span>
              </div>
            )) : (
              <div className="empty-state">
                <strong>No notifications</strong>
                <span>No high-attention records in this assessment.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}



