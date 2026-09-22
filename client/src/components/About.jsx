import React from 'react';
import { Shield, Users, Target, CheckCircle, Award, Cpu, Lock, Terminal, Sparkles, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import ParticleField from './three/ParticleField';

const TEAM_INFO = {
  teamName: 'CODER RISE',
  institution: 'Galgotias University',
  hackathon: 'Global Innovation Hackathon 2026',
  organizer: 'Bharat Academix',
  theme: 'Cybersecurity, Digital Trust & AI Governance',
  tagline: 'Build for a Better Future'
};

const TEAM_MEMBERS = [
  {
    name: 'Prateek Gupta',
    role: 'Team Leader & Lead System Architect',
    focus: 'FastAPI Backend, Deterministic Attention Scoring Engine & Security Enclave Gateway',
    color: 'var(--neon-cyan)',
    glow: 'rgba(0, 212, 255, 0.25)',
  },
  {
    name: 'CODER RISE Engineering',
    role: 'Cyber Intelligence & UI/UX Core',
    focus: 'Universal Log Normalization (8+ Formats), Negative-Space Reasoning & 3D WebGL Interface',
    color: 'var(--neon-purple)',
    glow: 'rgba(168, 85, 247, 0.25)',
  }
];

const ARCHITECTURE_PILLARS = [
  {
    title: 'Zero Hallucination Engine',
    desc: '100% deterministic rule-based algorithms with bounded Attention Scores (0–100) — zero synthetic LLM guesswork in critical forensics.',
    icon: Cpu,
    color: 'var(--neon-cyan)'
  },
  {
    title: 'Negative-Space Intelligence',
    desc: 'Mathematical reasoning over absent sensors, skipped investigation stages, and unmonitored critical infrastructure segments.',
    icon: Target,
    color: 'var(--neon-amber)'
  },
  {
    title: 'Cryptographic Audit Chaining',
    desc: 'Sequential SHA-256 hash chaining over all supervisory actions to provide tamper-evident, court-admissible governance records.',
    icon: Lock,
    color: 'var(--neon-green)'
  },
  {
    title: 'Critical Outbound Gateway',
    desc: 'Strict score policy gatekeeper (>= 98.0), HMAC-SHA256 integrity signatures, and strict data minimisation for secure external escalations.',
    icon: Shield,
    color: 'var(--neon-red)'
  }
];

export default function About() {
  return (
    <div style={{ position: 'relative', minHeight: '100%', padding: '30px 10px', overflow: 'hidden' }}>
      <ParticleField count={40} color="#00d4ff" opacity={0.18} />

      <div style={{ maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
        
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{
            textAlign: 'center',
            marginBottom: '40px',
            padding: '36px 24px',
            background: 'linear-gradient(135deg, rgba(6, 13, 31, 0.85) 0%, rgba(13, 27, 62, 0.7) 100%)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(12px)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
            background: 'linear-gradient(90deg, #00d4ff, #a855f7, #3b82f6)'
          }} />

          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '68px', height: '68px', borderRadius: '18px',
            background: 'rgba(0, 212, 255, 0.12)',
            border: '1px solid rgba(0, 212, 255, 0.35)',
            boxShadow: '0 0 30px rgba(0, 212, 255, 0.3)',
            marginBottom: '18px'
          }}>
            <Shield size={34} color="var(--neon-cyan)" />
          </div>

          <div style={{
            fontFamily: "var(--font-display, 'Orbitron')",
            fontSize: '11px',
            letterSpacing: '0.25em',
            color: 'var(--neon-cyan)',
            marginBottom: '8px',
            textTransform: 'uppercase'
          }}>
            {TEAM_INFO.hackathon} · {TEAM_INFO.organizer}
          </div>

          <h1 style={{
            fontFamily: "var(--font-display, 'Orbitron')",
            fontSize: '32px',
            fontWeight: '900',
            letterSpacing: '0.04em',
            color: '#f8fafc',
            margin: '0 0 10px 0',
            textShadow: '0 0 20px rgba(0, 212, 255, 0.3)'
          }}>
            A.E.G.I.S.
          </h1>

          <p style={{
            fontSize: '15px',
            color: '#94a3b8',
            maxWidth: '720px',
            margin: '0 auto 16px auto',
            lineHeight: 1.6
          }}>
            Analytics & Evidence-based Governance Intelligence System for Critical Infrastructure SOC Supervisory Governance
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className="badge info" style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 600 }}>
              TEAM: {TEAM_INFO.teamName}
            </span>
            <span className="badge success" style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 600 }}>
              INSTITUTION: {TEAM_INFO.institution}
            </span>
            <span className="badge purple" style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 600 }}>
              THEME: {TEAM_INFO.theme}
            </span>
          </div>
        </motion.div>

        {/* 4 Core Pillars Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '18px',
          marginBottom: '36px'
        }}>
          {ARCHITECTURE_PILLARS.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1, duration: 0.4 }}
                whileHover={{ y: -4, borderColor: pillar.color, transition: { duration: 0.2 } }}
                style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  borderRadius: '12px',
                  padding: '22px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: `rgba(${pillar.color === 'var(--neon-cyan)' ? '0,212,255' : pillar.color === 'var(--neon-red)' ? '255,71,87' : pillar.color === 'var(--neon-green)' ? '16,185,129' : '245,158,11'}, 0.12)`,
                  border: `1px solid ${pillar.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: pillar.color,
                  boxShadow: `0 0 12px ${pillar.color}`
                }}>
                  <Icon size={20} />
                </div>
                <h3 style={{
                  fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: 0,
                  fontFamily: "var(--font-display, 'Orbitron')"
                }}>
                  {pillar.title}
                </h3>
                <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.55, margin: 0 }}>
                  {pillar.desc}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Team Leadership Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(6, 13, 31, 0.9) 100%)',
            borderRadius: '16px',
            padding: '28px',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            marginBottom: '30px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Users size={22} color="var(--neon-cyan)" />
            <h2 style={{
              fontFamily: "var(--font-display, 'Orbitron')",
              fontSize: '16px', fontWeight: 800, color: '#f8fafc', margin: 0,
              letterSpacing: '0.04em'
            }}>
              PROJECT LEADERSHIP & CREDITS
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '18px' }}>
            {TEAM_MEMBERS.map((m) => (
              <div
                key={m.name}
                style={{
                  background: 'rgba(30, 41, 59, 0.5)',
                  border: `1px solid ${m.color}`,
                  borderRadius: '12px',
                  padding: '18px',
                  boxShadow: `0 0 16px ${m.glow}`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '50%',
                    background: m.color, color: '#020617',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, fontSize: '15px'
                  }}>
                    {m.name.charAt(0)}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px', color: '#f8fafc', fontWeight: 700 }}>
                      {m.name}
                    </h4>
                    <span style={{ fontSize: '11px', color: m.color, fontWeight: 600 }}>
                      {m.role}
                    </span>
                  </div>
                </div>
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
                  {m.focus}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
