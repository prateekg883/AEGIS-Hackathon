import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { AssessmentProvider } from '../../state/AssessmentContext';
import ParticleField from '../three/ParticleField';

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <AssessmentProvider>
      <div className="app-shell" style={{ position: 'relative', overflowX: 'hidden' }}>
        <ParticleField count={35} color="#00d4ff" opacity={0.15} />
        <Sidebar open={open} onClose={() => setOpen(false)} />
        <main className="main" style={{ position: 'relative', zIndex: 1 }}>
          <Header onMenu={() => setOpen(true)} />
          <div className="content">{children}</div>
        </main>
      </div>
    </AssessmentProvider>
  );
}
