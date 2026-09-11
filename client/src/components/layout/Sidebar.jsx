import { Link, useLocation } from 'react-router-dom';
import { useAssessment } from '../../state/AssessmentContext';
import { 
  LayoutDashboard, 
  ShieldCheck, 
  FileSearch, 
  ClipboardCheck, 
  Zap, 
  BookOpen, 
  UploadCloud, 
  Lock, 
  X, 
  Settings2,
  Table2,
  BarChart3
} from 'lucide-react';

const supervisorNav = [
  { label: 'Supervisory Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Critical Entities (CSEs)', href: '/cse', icon: ShieldCheck },
  { label: 'Supervisory Findings', href: '/findings', icon: FileSearch },
  { label: 'Evidence Explorer', href: '/evidence', icon: Table2 },
  { label: 'Supervisory Escalation', href: '/escalation', icon: Zap },
  { label: 'Entity Deep Dive & Benchmarking', href: '/benchmarking', icon: BarChart3 },
  { label: 'Assessment Reports', href: '/reports', icon: BookOpen },
  { label: 'Data Ingestion', href: '/ingestion', icon: UploadCloud },
  { label: 'Air-Gap Enclave Security', href: '/security-monitoring', icon: Lock },
];


export default function Sidebar({ open, onClose }) {
  const { period, hasData } = useAssessment();
  const { pathname } = useLocation();

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <div className="brand-mark">
          <img src="/aegis-logo.png" alt="A.E.G.I.S" width="38" height="38" className="brand-logo-img" />
        </div>
        <div className="brand-text">
          <strong>A.E.G.I.S</strong>
          <small style={{ color: '#4ade80', fontWeight: '600' }}>SUPERVISOR CONSOLE</small>
        </div>
        <button className="mobile-close" onClick={onClose}><X size={18}/></button>
      </div>

      <div className="side-label">Supervisory Workspace</div>

      <nav>
        {supervisorNav.map(({ label, href, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link 
              key={href} 
              to={href} 
              onClick={onClose} 
              className={active ? 'active' : ''}
            >
              <Icon size={17}/>
              <span>{label}</span>
              {active && <span className="nav-arrow">›</span>}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="offline" style={{ marginBottom: '10px' }}>
          <i/> 
          <span>LIVE SECURE ENCLAVE</span>
          <small>Continuous National Surveillance</small>
        </div>
        <div className="side-foot">
          <span><Settings2 size={14}/> NCIIPC Supervisor</span>
          <span className="version">v1.0.0</span>
        </div>
      </div>
    </aside>
  );
}
