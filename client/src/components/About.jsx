import React from 'react';
import { Shield, Users, Target, CheckCircle } from 'lucide-react';

const teamMembers = [
  {
    name: 'S. Sengupta',
    role: 'Product Lead / Architect',
    contribution: 'System architecture, backend models, and core algorithms.'
  },
  {
    name: 'P. Varma',
    role: 'Data Science Lead',
    contribution: 'Attention scoring model and predictive analytics.'
  },
  {
    name: 'A. Sharma',
    role: 'Frontend Engineering',
    contribution: 'UI/UX design and React state management.'
  },
  {
    name: 'M. Rao',
    role: 'Backend Engineering',
    contribution: 'FastAPI implementation and database integration.'
  },
  {
    name: 'K. Iyer',
    role: 'Security Analyst',
    contribution: 'Compliance rule definitions and negative space logic.'
  },
  {
    name: 'R. Desai',
    role: 'Operations & QA',
    contribution: 'End-to-end testing and deployment automation.'
  }
];

export default function About() {
  return (
    <div style={{
      maxWidth: '1000px',
      margin: '0 auto',
      padding: '40px 20px',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <div style={{ 
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', 
          width: '64px', height: '64px', borderRadius: '16px', 
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', 
          boxShadow: '0 10px 25px rgba(37, 99, 235, 0.3)', marginBottom: '20px' 
        }}>
          <Shield size={32} color="var(--color-surface)" />
        </div>
        <h1 style={{ fontSize: '32px', fontWeight: '800', color: 'var(--color-navy)', marginBottom: '8px' }}>
          A.E.G.I.S.
        </h1>
        <p style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-text-muted)', fontWeight: '500', maxWidth: '600px', margin: '0 auto' }}>
          Analytics & Evidence-based Governance Intelligence System
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '48px' }}>
        <div style={{ background: 'var(--color-surface)', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Target size={24} color="var(--color-accent)" />
            <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '700', color: 'var(--color-navy)', margin: 0 }}>Mission & Scope</h2>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
            A.E.G.I.S. is built for the <strong>Global Innovation Hackathon 2026 – Build for a Better Future</strong> (Bharat Academix). It serves as an evidence-grounded supervisory intelligence and decision-support platform for evaluating Security Operations Center (SOC) governance and execution efficiency across critical infrastructure and enterprise entities.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {['Evidence-based scoring', 'Execution gap detection', 'Negative space analysis', 'Immutable audit trails'].map(item => (
              <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                <CheckCircle size={16} color="#10b981" /> {item}
              </li>
            ))}
          </ul>
        </div>
        
        <div style={{ background: 'var(--color-surface)', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Shield size={24} color="#8b5cf6" />
            <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '700', color: 'var(--color-navy)', margin: 0 }}>System Philosophy</h2>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
            We believe that <em>true cybersecurity governance</em> requires looking beyond raw alert counts. A.E.G.I.S. focuses on the <strong>evidence lifecycle</strong>—tracing the path from an initial signal to a finalized, manually verified conclusion.
          </p>
          <div style={{ background: 'var(--color-surface-subtle)', padding: '16px', borderRadius: 'var(--radius-lg)', borderLeft: '4px solid #3b82f6', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-md)', fontStyle: 'italic' }}>
            "The absence of evidence is not the evidence of absence. A.E.G.I.S. ensures that what isn't monitored is just as visible as what is."
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', justifyContent: 'center' }}>
          <Users size={28} color="var(--color-navy)" />
          <h2 style={{ fontSize: 'var(--font-size-h1)', fontWeight: '800', color: 'var(--color-navy)', margin: 0 }}>Team A.E.G.I.S.</h2>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {teamMembers.map((member) => (
            <div key={member.name} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                <div style={{ 
                  width: '48px', height: '48px', borderRadius: '50%', background: 'var(--color-surface-alt)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)', fontWeight: 'bold', fontSize: 'var(--font-size-xl)' 
                }}>
                  {member.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: '700', color: 'var(--color-navy)' }}>{member.name}</h3>
                  <span style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-muted)', fontWeight: '500' }}>{member.role}</span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 'var(--font-size-md)', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
                {member.contribution}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
