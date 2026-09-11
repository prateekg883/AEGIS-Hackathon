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
          <Shield size={32} color="#fff" />
        </div>
        <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>
          A.E.G.I.S.
        </h1>
        <p style={{ fontSize: '16px', color: '#64748b', fontWeight: '500', maxWidth: '600px', margin: '0 auto' }}>
          Analytics & Evidence-based Governance Intelligence System
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '48px' }}>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Target size={24} color="#2563eb" />
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Mission & Scope</h2>
          </div>
          <p style={{ color: '#475569', lineHeight: '1.6', marginBottom: '16px' }}>
            A.E.G.I.S. is developed for <strong>SIH 2026 Problem Statement SIH26157</strong>. It serves as a supervisory intelligence and decision-support platform for evaluating Security Operations Center (SOC) efficiency across critical infrastructure entities.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {['Evidence-based scoring', 'Execution gap detection', 'Negative space analysis', 'Immutable audit trails'].map(item => (
              <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155', marginBottom: '8px' }}>
                <CheckCircle size={16} color="#10b981" /> {item}
              </li>
            ))}
          </ul>
        </div>
        
        <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Shield size={24} color="#8b5cf6" />
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: 0 }}>System Philosophy</h2>
          </div>
          <p style={{ color: '#475569', lineHeight: '1.6', marginBottom: '16px' }}>
            We believe that <em>true cybersecurity governance</em> requires looking beyond raw alert counts. A.E.G.I.S. focuses on the <strong>evidence lifecycle</strong>—tracing the path from an initial signal to a finalized, manually verified conclusion.
          </p>
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #3b82f6', color: '#334155', fontSize: '14px', fontStyle: 'italic' }}>
            "The absence of evidence is not the evidence of absence. A.E.G.I.S. ensures that what isn't monitored is just as visible as what is."
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', justifyContent: 'center' }}>
          <Users size={28} color="#0f172a" />
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Team A.E.G.I.S.</h2>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {teamMembers.map((member) => (
            <div key={member.name} style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                <div style={{ 
                  width: '48px', height: '48px', borderRadius: '50%', background: '#f1f5f9', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontWeight: 'bold', fontSize: '18px' 
                }}>
                  {member.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>{member.name}</h3>
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>{member.role}</span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: '1.5' }}>
                {member.contribution}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
