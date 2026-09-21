import { Bell, ChevronRight, Menu, Moon, Sun, X, RefreshCw, UploadCloud, LogOut, Shield } from 'lucide-react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { prioritisedSamples } from '../../data/mockDataV2';
import { useAssessment } from '../../state/AssessmentContext';
import { useSOC } from '../../state/SOCContext';
import { useAuth } from '../../state/AuthContext';

const PAGE_LABELS = {
  '/':                  'Dashboard',
  '/escalation':        'Supervisory Escalation',
  '/ingestion':         'Data Ingestion',
  '/cse':               'Critical Entities',
  '/findings':          'Findings',
  '/evidence':          'Evidence Explorer',
  '/records':           'Alert & Case Explorer',
  '/negative-space':    'Negative Space',
  '/benchmarking':      'Peer Benchmarking',
  '/prioritised-samples': 'Prioritised Samples',
  '/reports':           'Assessment Reports',
  '/workspace':         'Analyst Workspace',
  '/security-monitoring': 'Air-Gap Enclave Security',
};

export default function Header({ onMenu }) {
  const { period, periods, setPeriod, theme, setTheme } = useAssessment();
  const { resetDemoScenario, isDemoMode, activeFileName, findings = [], cseEntities = [] } = useSOC();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { pathname } = useLocation();

  const label =
    PAGE_LABELS[pathname] ||
    (pathname.startsWith('/cse/')      ? 'Critical Entities' :
     pathname.startsWith('/findings/') ? 'Findings'          : 'Dashboard');

  const notifications = [
    ...findings.filter((f) => ['Critical', 'High'].includes(f.severity)),
    ...cseEntities.filter((c) => c.level === 'HIGH' || c.level === 'CRITICAL'),
    ...(prioritisedSamples || []).filter((s) => s.priority >= 85),
  ].slice(0, 6);

  const roleBadgeStyle = {
    '--role-bg':     user?.badgeBg     || 'rgba(0, 212, 255, 0.08)',
    '--role-color':  user?.badgeColor  || 'var(--neon-cyan)',
    '--role-border': user?.badgeBorder || 'rgba(0, 212, 255, 0.25)',
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <header className="topbar">
      {/* Menu button (mobile) */}
      <button className="menu-button icon-button" onClick={onMenu} aria-label="Open menu">
        <Menu size={20} />
      </button>

      {/* Breadcrumb */}
      <div className="crumb">
        <Shield size={13} style={{ opacity: 0.5 }} />
        <span>Supervisory Command</span>
        <ChevronRight size={12} />
        <b>{label}</b>
      </div>

      {/* Actions */}
      <div className="top-actions">
        {/* Ingest button */}
        <Link
          to="/ingestion"
          className="button ghost"
          style={{ fontSize: 10, padding: '5px 10px', gap: 4, textDecoration: 'none' }}
        >
          <UploadCloud size={11} />
          Ingest Evidence
        </Link>

        {/* Reset button (demo mode) */}
        {!isDemoMode && (
          <button
            className="button ghost"
            style={{ fontSize: 10, padding: '5px 10px' }}
            onClick={resetDemoScenario}
            title="Reset live data to demo dataset"
          >
            <RefreshCw size={11} />
            Reset Demo
          </button>
        )}

        {/* Live / Demo status pill */}
        {isDemoMode ? (
          <div className="header-status">
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--neon-amber)',
              boxShadow: '0 0 8px var(--neon-amber)',
              display: 'inline-block',
            }} />
            DEMO MODE
          </div>
        ) : (
          <div className="header-live-status">
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--neon-green)',
              boxShadow: '0 0 8px var(--neon-green)',
              display: 'inline-block',
              animation: 'pulse-ring 2s infinite',
            }} />
            {activeFileName ? `CSV: ${activeFileName}` : 'LIVE INGESTED'}
          </div>
        )}

        {/* Notifications */}
        <div style={{ position: 'relative' }}>
          <motion.button
            className="icon-button"
            aria-label="Supervisory notifications"
            onClick={() => setNotificationsOpen((o) => !o)}
            whileTap={{ scale: 0.92 }}
          >
            <Bell size={17} />
            <AnimatePresence>
              {notifications.length > 0 && (
                <motion.em
                  key="badge"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                >
                  {notifications.length}
                </motion.em>
              )}
            </AnimatePresence>
          </motion.button>

          <AnimatePresence>
            {notificationsOpen && (
              <motion.div
                className="notification-panel"
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.18 }}
              >
                <div className="notification-head">
                  <b>⚡ Supervisory Alerts</b>
                  <button onClick={() => setNotificationsOpen(false)} aria-label="Close">
                    <X size={13} />
                  </button>
                </div>
                <div style={{ padding: '6px 16px 4px', fontSize: 10, color: 'var(--color-text-muted)' }}>
                  Derived from submitted assessment records.
                </div>

                {notifications.length ? notifications.map((item, i) => (
                  <div className="notification-item" key={`${item.id}-${i}`}>
                    <strong>{item.id}</strong>
                    <span>{item.title || item.name || item.reason}</span>
                  </div>
                )) : (
                  <div className="empty-state" style={{ padding: '24px 20px' }}>
                    <strong>No alerts</strong>
                    <span>No high-attention records in this assessment.</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Theme toggle */}
        <motion.button
          className="icon-button"
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          whileTap={{ scale: 0.9, rotate: 20 }}
          transition={{ type: 'spring', stiffness: 400 }}
        >
          <AnimatePresence mode="wait">
            {theme === 'light' ? (
              <motion.span key="moon" initial={{ rotate: -30, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 30, opacity: 0 }}>
                <Moon size={16} />
              </motion.span>
            ) : (
              <motion.span key="sun" initial={{ rotate: 30, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -30, opacity: 0 }}>
                <Sun size={16} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* User info + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
          <div className="header-user-info">
            <span className="header-user-name">
              {user?.name || user?.email?.split('@')[0] || 'Authorized User'}
            </span>
            <span
              className="header-role-badge"
              style={{
                background: 'var(--role-bg)',
                color: 'var(--role-color)',
                border: '1px solid var(--role-border)',
                ...roleBadgeStyle,
              }}
            >
              {user?.roleLabel || user?.role || 'SUPERVISOR'}
            </span>
          </div>

          <motion.div
            className="avatar"
            title={`${user?.name || 'User'} (${user?.roleLabel || user?.role})`}
            whileHover={{ scale: 1.08 }}
          >
            {user?.avatar || 'SS'}
          </motion.div>
        </div>

        {/* Logout */}
        <motion.button
          className="icon-button"
          aria-label="Log out"
          onClick={handleLogout}
          title="Sign Out"
          whileTap={{ scale: 0.9 }}
        >
          <LogOut size={16} />
        </motion.button>
      </div>
    </header>
  );
}
