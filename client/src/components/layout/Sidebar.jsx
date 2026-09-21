import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSOC } from '../../state/SOCContext';
import {
  LayoutDashboard,
  ShieldCheck,
  FileSearch,
  Zap,
  BookOpen,
  UploadCloud,
  Lock,
  X,
  Settings2,
  Table2,
  BarChart3,
} from 'lucide-react';

const NAV_GROUPS = [
  {
    id: 'overview',
    label: 'OVERVIEW',
    items: [
      { label: 'Supervisory Dashboard',   href: '/',                  icon: LayoutDashboard },
      { label: 'Critical Entities (CSEs)', href: '/cse',               icon: ShieldCheck,
        getBadge: (soc) => soc?.cseEntities?.length || null },
      { label: 'Supervisory Findings',    href: '/findings',           icon: FileSearch,
        getBadge: (soc) => soc?.findings?.length || null, badgeVariant: 'warning' },
    ],
  },
  {
    id: 'investigation',
    label: 'INVESTIGATION & ANALYSIS',
    items: [
      { label: 'Evidence Explorer',              href: '/evidence',     icon: Table2,
        getBadge: (soc) => soc?.evidence?.length || null },
      { label: 'Supervisory Escalation',         href: '/escalation',   icon: Zap,
        getBadge: (soc) => soc?.escalations?.length || null, badgeVariant: 'critical' },
      { label: 'Entity Deep Dive & Benchmarking', href: '/benchmarking', icon: BarChart3 },
    ],
  },
  {
    id: 'operations',
    label: 'OPERATIONS & GOVERNANCE',
    items: [
      { label: 'Assessment Reports',       href: '/reports',              icon: BookOpen },
      { label: 'Data Ingestion',           href: '/ingestion',            icon: UploadCloud },
      { label: 'Air-Gap Enclave Security', href: '/security-monitoring',  icon: Lock },
    ],
  },
];

export default function Sidebar({ open, onClose }) {
  const { pathname } = useLocation();

  let soc = null;
  try { soc = useSOC(); } catch { soc = null; }

  const isActive = (href) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.7)',
              zIndex: 19, backdropFilter: 'blur(4px)', display: 'none',
            }}
            className="sidebar-backdrop-mobile"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        {/* ── Brand ─────────────────────────────────────────── */}
        <div className="sidebar-brand">
          <motion.div
            className="sidebar-brand-mark"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
          >
            <img
              src="/aegis-logo.png"
              alt="A.E.G.I.S"
              className="brand-logo-img"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </motion.div>

          <div className="sidebar-brand-text">
            <h2 className="sidebar-brand-title">A.E.G.I.S</h2>
            <span className="sidebar-brand-subtitle">SUPERVISOR CONSOLE</span>
          </div>

          <button className="mobile-close" onClick={onClose} aria-label="Close menu">
            <X size={16} />
          </button>
        </div>

        {/* ── Navigation ────────────────────────────────────── */}
        <div className="sidebar-nav-container">
          {NAV_GROUPS.map((group, gi) => (
            <motion.div
              key={group.id}
              className="sidebar-group"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.05 + 0.1, duration: 0.3 }}
            >
              <div className="sidebar-group-label">{group.label}</div>

              <nav className="sidebar-nav-list">
                {group.items.map(({ label, href, icon: Icon, getBadge, badgeVariant }, idx) => {
                  const active = isActive(href);
                  const badgeCount = getBadge && soc ? getBadge(soc) : null;

                  return (
                    <motion.div
                      key={href}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: gi * 0.05 + idx * 0.04 + 0.15, duration: 0.25 }}
                    >
                      <Link
                        to={href}
                        onClick={onClose}
                        className={`sidebar-nav-link ${active ? 'active' : ''}`}
                      >
                        <span className="sidebar-icon">
                          <Icon size={15} />
                        </span>
                        <span className="sidebar-label">{label}</span>

                        {badgeCount !== null && badgeCount !== undefined && badgeCount > 0 && (
                          <motion.span
                            className={`sidebar-badge ${badgeVariant ? `sidebar-badge--${badgeVariant}` : ''}`}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                          >
                            {badgeCount}
                          </motion.span>
                        )}
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>
            </motion.div>
          ))}
        </div>

        {/* ── Bottom Status ──────────────────────────────────── */}
        <div className="sidebar-bottom">
          <div className="sidebar-status-card">
            <div className="sidebar-pulse-dot" />
            <div className="sidebar-status-info">
              <div className="sidebar-status-title">LIVE SECURE ENCLAVE</div>
              <div className="sidebar-status-subtitle">Continuous National Surveillance</div>
            </div>
          </div>

          <div className="sidebar-footer">
            <div className="sidebar-footer-supervisor">
              <Settings2 size={11} />
              <span>NCIIPC Supervisor</span>
            </div>
            <span className="sidebar-version">v2.0.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}
