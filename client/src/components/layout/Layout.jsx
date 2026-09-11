import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { AssessmentProvider } from '../../state/AssessmentContext';

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  return <AssessmentProvider><div className="app-shell"><Sidebar open={open} onClose={() => setOpen(false)} /><main className="main"><Header onMenu={() => setOpen(true)} /><div className="content">{children}</div></main></div></AssessmentProvider>;
}
