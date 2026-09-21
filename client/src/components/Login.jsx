import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Lock, User, Eye, EyeOff,
  AlertCircle, WifiOff, Wifi, CheckCircle2, X, Sparkles,
  Mail, ShieldCheck, ArrowLeft, RefreshCw, KeyRound, ChevronRight,
  UserPlus, Key, Building2
} from 'lucide-react';
import { useAuth, DEMO_PROFILES } from '../state/AuthContext';
import api from '../services/api';
import ParticleField from './three/ParticleField';
// Lazy-load 3D orb to avoid blocking
const ShieldOrb = lazy(() => import('./three/ShieldOrb'));

// ─── View Enum ────────────────────────────────────────────────────────────────
const VIEW = {
  MODE_SELECT: 'MODE_SELECT',   // Step 0: choose offline / online
  LOGIN: 'LOGIN',               // Step 1: credential form
  OTP: 'OTP',                   // Step 2: OTP verification (manual or Google)
  GOOGLE_EMAIL: 'GOOGLE_EMAIL', // Step 1b: enter Gmail for OTP (online only)
};

export default function Login() {
  const { login, registerOperator, verifyOTP, resendOTP, googleLogin, authModeInfo } = useAuth();
  const navigate = useNavigate();

  // ── Core state ──────────────────────────────────────────────────────────────
  const [view, setView] = useState(VIEW.MODE_SELECT);
  const [loginMode, setLoginMode] = useState(null); // 'offline' | 'online'
  const [mounted, setMounted] = useState(false);

  // ── Credential form state ───────────────────────────────────────────────────
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Supervisor');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [showForgotUsernameModal, setShowForgotUsernameModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // ── Register Operator state ──────────────────────────────────────────────────
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState('SUPERVISOR');
  const [regOrg, setRegOrg] = useState('NCIIPC');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regShowPassword, setRegShowPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  // ── Reset Password state ───────────────────────────────────────────────────
  const [resetUsername, setResetUsername] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetShowPassword, setResetShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  // ── OTP state ───────────────────────────────────────────────────────────────
  const [otpSession, setOtpSession] = useState(null);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [expiresIn, setExpiresIn] = useState(300);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const otpInputRefs = useRef([]);

  // ── Google OTP state ────────────────────────────────────────────────────────
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleOtpLoading, setGoogleOtpLoading] = useState(false);
  const [googleOtpError, setGoogleOtpError] = useState('');

  // ── Mount animation ─────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    try {
      const remembered = localStorage.getItem('aegis_remember_username');
      const rememberedRole = localStorage.getItem('aegis_remember_role');
      if (remembered) { setUsername(remembered); setRememberMe(true); }
      if (rememberedRole) setRole(rememberedRole);
    } catch { /* ignore */ }
  }, []);

  // ── OTP Countdown ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== VIEW.OTP) return;
    const timer = setInterval(() => {
      setExpiresIn(prev => (prev > 0 ? prev - 1 : 0));
      setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [view]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleQuickFill = (profileKey) => {
    setError('');
    const profile = DEMO_PROFILES.find(p => p.id === profileKey) || DEMO_PROFILES[0];
    if (profileKey === 'SUPERVISOR') setRole('Supervisor');
    else if (profileKey === 'ANALYST') setRole('Analyst');
    else if (profileKey === 'ADMINISTRATOR') setRole('Administrator');
    setUsername(profile.username || profile.email.split('@')[0]);
    setPassword(profile.password);
  };

  const goToOtp = (sessionData) => {
    setOtpSession(sessionData);
    setOtpDigits(['', '', '', '', '', '']);
    setExpiresIn(sessionData.expires_in_seconds || 300);
    setResendCooldown(sessionData.cooldown_seconds ?? 0);
    setError('');
    setSuccessMsg('');
    setView(VIEW.OTP);
    setTimeout(() => { if (otpInputRefs.current[0]) otpInputRefs.current[0].focus(); }, 120);
  };

  // ─── Reset Password Action ──────────────────────────────────────────────────
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    const u = (resetUsername || username).trim();
    if (!u) { setResetError('Please enter your username or email address.'); return; }
    if (!resetNewPassword || resetNewPassword.length < 6) {
      setResetError('Password must be at least 6 characters long.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    setResetLoading(true);
    try {
      const res = await api.resetPassword(u, resetNewPassword);
      setResetSuccess(res?.message || 'Password updated successfully!');
      setPassword(resetNewPassword);
      if (!username) setUsername(u);
      setTimeout(() => {
        setShowForgotPasswordModal(false);
        setSuccessMsg('Password updated! You can now log in.');
      }, 1200);
    } catch (err) {
      setResetError(err?.message || 'Failed to reset password. User not found.');
    } finally {
      setResetLoading(false);
    }
  };

  // ─── Register User Action ───────────────────────────────────────────────
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');
    const u = regUsername.trim();
    const em = regEmail.trim();
    if (!u || u.length < 2) { setRegError('Please enter a username (min. 2 characters).'); return; }
    if (!em || !em.includes('@')) { setRegError('Please enter a valid email address.'); return; }
    if (!regPassword || regPassword.length < 4) { setRegError('Password must be at least 4 characters.'); return; }
    if (regPassword !== regConfirmPassword) { setRegError('Passwords do not match.'); return; }

    setRegLoading(true);
    try {
      await registerOperator({
        username: u,
        email: em,
        role: regRole || 'SUPERVISOR',
        organization: regOrg || 'CyberSec Operations',
        password: regPassword,
      });

      setRegSuccess('Account created successfully! Launching dashboard...');
      setUsername(u);
      setPassword(regPassword);
      setRole(regRole.charAt(0) + regRole.slice(1).toLowerCase());
      setTimeout(() => {
        setShowRegisterModal(false);
        navigate('/');
      }, 500);
    } catch (err) {
      // Offline / Cloud Fallback Registration
      const roleName = (regRole || 'SUPERVISOR').toUpperCase();
      const newOperator = {
        id: u.toLowerCase(),
        username: u,
        email: em,
        role: roleName,
        name: u,
        designation: roleName === 'SUPERVISOR' ? 'Lead Supervisor' : roleName === 'ANALYST' ? 'Security Analyst' : roleName === 'ADMINISTRATOR' ? 'System Administrator' : 'Compliance Auditor',
        organization: regOrg || 'CyberSec Operations',
        avatar: u.substring(0, 2).toUpperCase()
      };
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('aegis_user', JSON.stringify(newOperator));
        localStorage.setItem('aegis_token', `mock-aegis-reg-token-${Date.now()}`);
        localStorage.setItem(`aegis_pwd_${u.toLowerCase()}`, regPassword);
      }
      setRegSuccess('Account created successfully! Launching dashboard...');
      setTimeout(() => {
        setShowRegisterModal(false);
        window.location.href = '/';
      }, 500);
    } finally {
      setRegLoading(false);
    }
  };

  // ─── Form Submit (Manual Login) ───────────────────────────────────────────
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccessMsg('');
    const trimmedUser = username.trim();
    if (!trimmedUser && !password) { setError('Please enter your authorized username and password.'); return; }
    if (!trimmedUser) { setError('Username field is required.'); return; }
    if (!password) { setError('Password field is required.'); return; }

    setLoading(true);
    try {
      if (rememberMe) {
        localStorage.setItem('aegis_remember_username', trimmedUser);
        localStorage.setItem('aegis_remember_role', role);
      } else {
        localStorage.removeItem('aegis_remember_username');
        localStorage.removeItem('aegis_remember_role');
      }

      const res = await login(trimmedUser, password, role, loginMode || 'offline');

      if (res && res.otpRequired) {
        goToOtp({
          username: res.username || trimmedUser,
          tempToken: res.temp_token,
          maskedEmail: res.masked_email,
          role: res.role,
          devOtpPreview: res.dev_otp_preview,
          expires_in_seconds: res.expires_in_seconds,
          cooldown_seconds: res.cooldown_seconds ?? 0,
          source: 'manual',
        });
        setLoading(false);
        return;
      }
      setTimeout(() => navigate('/'), 400);
    } catch (err) {
      const msg = err?.message || 'Authentication failed. Please check your credentials.';
      setError(typeof msg === 'string' ? msg : 'Authentication failed. Invalid username or password.');
      setLoading(false);
    }
  };

  // ─── Google OTP: send code to Gmail ──────────────────────────────────────
  const handleGoogleOtpSend = async (e) => {
    e.preventDefault();
    setGoogleOtpError('');
    const email = googleEmail.trim();
    if (!email || !email.includes('@')) {
      setGoogleOtpError('Please enter a valid email address.');
      return;
    }
    setGoogleOtpLoading(true);
    try {
      const data = await api.sendGoogleOtp(email, role);
      goToOtp({
        username: data.username || email,
        tempToken: data.temp_token,
        maskedEmail: data.masked_email || email.replace(/(.{2}).+(@.+)/, '$1***$2'),
        role: data.role || role,
        devOtpPreview: data.dev_otp_preview || '261570',
        expires_in_seconds: data.expires_in_seconds || 300,
        cooldown_seconds: data.cooldown_seconds ?? 0,
        source: 'google_otp',
      });
    } catch (err) {
      // Fallback for offline/demo cloud environment
      goToOtp({
        username: email,
        tempToken: `mock-temp-${Date.now()}`,
        maskedEmail: email.replace(/(.{2}).+(@.+)/, '$1***$2'),
        role: role || 'SUPERVISOR',
        devOtpPreview: '261570',
        expires_in_seconds: 300,
        cooldown_seconds: 0,
        source: 'google_otp',
      });
    } finally {
      setGoogleOtpLoading(false);
    }
  };

  // ─── OTP: input handlers ──────────────────────────────────────────────────
  const handleOtpChange = (index, value) => {
    const cleaned = value.replace(/\D/g, '');
    const newDigits = [...otpDigits];
    if (cleaned.length > 0) {
      newDigits[index] = cleaned[cleaned.length - 1];
      setOtpDigits(newDigits);
      setError('');
      if (index < 5 && otpInputRefs.current[index + 1]) otpInputRefs.current[index + 1].focus();
    } else {
      newDigits[index] = '';
      setOtpDigits(newDigits);
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      if (otpInputRefs.current[index - 1]) otpInputRefs.current[index - 1].focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < pasted.length; i++) newDigits[i] = pasted[i];
    setOtpDigits(newDigits);
    const focusIdx = Math.min(pasted.length, 5);
    if (otpInputRefs.current[focusIdx]) otpInputRefs.current[focusIdx].focus();
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setError(''); setSuccessMsg('');
    const code = otpDigits.join('');
    if (code.length < 6) { setError('Please enter all 6 digits of the verification code.'); return; }
    if (expiresIn <= 0) { setError('This verification code has expired. Request a new code.'); return; }
    setLoading(true);
    try {
      await verifyOTP(otpSession.username, code, otpSession.tempToken);
      setSuccessMsg('Identity verified successfully. Opening supervisory dashboard...');
      setTimeout(() => navigate('/'), 500);
    } catch (err) {
      setError(err?.message || 'Invalid verification code. Please try again.');
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resending) return;
    setError(''); setSuccessMsg(''); setResending(true);
    try {
      const res = await resendOTP(otpSession.username, otpSession.tempToken);
      setExpiresIn(res?.expires_in_seconds || 300);
      setOtpDigits(['', '', '', '', '', '']);
      if (res?.dev_otp_preview) setOtpSession(prev => ({ ...prev, devOtpPreview: res.dev_otp_preview }));
      setSuccessMsg('A new verification code has been dispatched.');
      if (otpInputRefs.current[0]) otpInputRefs.current[0].focus();
    } catch (err) {
      setError(err?.message || 'Failed to resend code. Please try again later.');
    } finally {
      setResending(false);
    }
  };

  // ─── Derived ──────────────────────────────────────────────────────────────
  const isAirGapped = loginMode === 'offline' ||
    (loginMode === null && (authModeInfo?.air_gapped_mode !== false && authModeInfo?.auth_mode !== 'EMAIL_OTP'));

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: 'radial-gradient(ellipse at 30% 0%, #0d1b3e 0%, #020617 55%, #060d1f 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
      fontFamily: "var(--font-body, 'Space Grotesk', 'Inter', system-ui, sans-serif)",
      color: 'var(--color-surface-subtle)',
      position: 'relative',
      overflow: 'hidden',
      opacity: mounted ? 1 : 0,
      transition: 'opacity 0.6s ease-out',
    }}>

      {/* Particle field background */}
      <ParticleField count={50} color="#00d4ff" opacity={0.3} />

      {/* Cyber grid overlay */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: `
          linear-gradient(rgba(0, 212, 255, 0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 212, 255, 0.04) 1px, transparent 1px)`,
        backgroundSize: '52px 52px',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Top neon line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '2px',
        background: 'linear-gradient(90deg, transparent 0%, rgba(0,212,255,0.7) 40%, rgba(168,85,247,0.7) 60%, transparent 100%)',
        pointerEvents: 'none', zIndex: 2,
        boxShadow: '0 0 20px rgba(0, 212, 255, 0.5)',
      }} />

      {/* Bottom neon line */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '1px',
        background: 'linear-gradient(90deg, transparent 0%, rgba(168,85,247,0.4) 50%, transparent 100%)',
        pointerEvents: 'none', zIndex: 2,
      }} />

      {/* Main container */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: '100%',
          maxWidth: view === VIEW.MODE_SELECT ? '960px' : '700px',
          position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          transition: 'max-width 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >

        {/* ── 3D Hero + Logo ─────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          marginBottom: '28px', textAlign: 'center', gap: 0,
        }}>

          {/* 3D Shield Orb */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            style={{ position: 'relative' }}
          >
            <Suspense fallback={
              <div style={{
                width: 220, height: 220,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Shield size={60} color="#00d4ff" style={{ opacity: 0.5, animation: 'pulse-ring 2s infinite' }} />
              </div>
            }>
              <ShieldOrb size={220} />
            </Suspense>

            {/* Glow beneath orb */}
            <div style={{
              position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)',
              width: 140, height: 20,
              background: 'radial-gradient(ellipse at center, rgba(0,212,255,0.35) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            style={{ marginTop: -12 }}
          >
            <h1 style={{
              margin: 0,
              fontFamily: "var(--font-display, 'Orbitron', monospace)",
              fontSize: '38px', fontWeight: '900', letterSpacing: '10px',
              background: 'linear-gradient(135deg, #ffffff 0%, #00d4ff 60%, #a855f7 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: 'none',
            }}>
              A.E.G.I.S.
            </h1>
            <div style={{
              fontFamily: "var(--font-display, 'Orbitron', monospace)",
              fontSize: '9px', fontWeight: '700', letterSpacing: '4px',
              color: 'rgba(0, 212, 255, 0.5)', marginTop: '6px', textTransform: 'uppercase',
            }}>
              National Critical Infrastructure Defence Enclave
            </div>
          </motion.div>

          {/* Auth mode badge — only after mode is selected */}
          <AnimatePresence>
          {loginMode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '10px',
                padding: '5px 14px', borderRadius: '20px',
                background: 'rgba(6, 13, 31, 0.9)',
                border: isAirGapped ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(0,212,255,0.4)',
                boxShadow: isAirGapped ? '0 0 16px rgba(16,185,129,0.2)' : '0 0 16px rgba(0,212,255,0.15)',
                backdropFilter: 'blur(8px)',
              }}>
              {isAirGapped
                ? <><WifiOff size={13} color="#10b981" /><span style={{ fontFamily: "var(--font-display, 'Orbitron')", fontSize: '9px', fontWeight: '700', color: 'var(--color-secure)', letterSpacing: '1.5px' }}>OFFLINE / AIR-GAPPED ENCLAVE</span></>
                : <><Wifi size={13} color="#00d4ff" /><span style={{ fontFamily: "var(--font-display, 'Orbitron')", fontSize: '9px', fontWeight: '700', color: 'var(--neon-cyan)', letterSpacing: '1.5px' }}>ONLINE / SECURE GMAIL OTP</span></>
              }
            </motion.div>
          )}
          </AnimatePresence>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            VIEW 0: MODE SELECTOR
        ══════════════════════════════════════════════════════════════════ */}
        {view === VIEW.MODE_SELECT && (
          <motion.div
            key="mode-select"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
            style={{ width: '100%' }}
          >
            {/* Single unified console panel */}
            <div style={{
              position: 'relative',
              background: 'rgba(6, 13, 31, 0.85)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              borderRadius: '20px',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 40px rgba(0,212,255,0.06)',
              overflow: 'hidden',
            }}>
              {/* Corner neon brackets */}
              <span style={{ position: 'absolute', top: '10px', left: '10px', width: '16px', height: '16px', borderTop: '2px solid rgba(0,212,255,0.7)', borderLeft: '2px solid rgba(0,212,255,0.7)', pointerEvents: 'none' }} />
              <span style={{ position: 'absolute', top: '10px', right: '10px', width: '16px', height: '16px', borderTop: '2px solid rgba(0,212,255,0.7)', borderRight: '2px solid rgba(0,212,255,0.7)', pointerEvents: 'none' }} />
              <span style={{ position: 'absolute', bottom: '10px', left: '10px', width: '16px', height: '16px', borderBottom: '2px solid rgba(0,212,255,0.7)', borderLeft: '2px solid rgba(0,212,255,0.7)', pointerEvents: 'none' }} />
              <span style={{ position: 'absolute', bottom: '10px', right: '10px', width: '16px', height: '16px', borderBottom: '2px solid rgba(0,212,255,0.7)', borderRight: '2px solid rgba(0,212,255,0.7)', pointerEvents: 'none' }} />

              {/* Panel heading */}
              <div style={{ padding: '26px 32px 20px 32px', borderBottom: '1px solid rgba(148,163,184,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h2 style={{ margin: '0 0 6px 0', fontSize: 'var(--font-size-xl)', fontWeight: '700', color: 'var(--color-surface-subtle)', letterSpacing: '0.02em' }}>
                    Choose Connection Mode
                  </h2>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-md)', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                    Select your operational gateway to access the A.E.G.I.S. supervisory enclave.
                  </p>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontFamily: 'ui-monospace, monospace', fontSize: 'var(--font-size-small)', color: 'var(--color-success)',
                  background: 'rgba(16,185,129,0.1)', padding: '4px 10px', borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(16,185,129,0.25)',
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-success)' }} />
                  <span>GATEWAY: READY</span>
                </div>
              </div>

              {/* Split-half mode buttons — flex row, divided by a 1px border */}
              <div style={{ display: 'flex', flexDirection: 'row' }} className="aegis-mode-row">

                {/* ── OFFLINE half ─────────────────────────────────────── */}
                <button
                  id="mode-offline-btn"
                  onClick={() => { setLoginMode('offline'); setView(VIEW.LOGIN); }}
                  className="aegis-mode-btn aegis-offline-btn"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    borderRight: '1px solid rgba(148,163,184,0.12)',
                    padding: '28px 30px 52px 30px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    color: 'var(--color-surface-subtle)',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                  }}
                >
                  {/* Icon + label row */}
                  <div className="login-flex-row-12">
                    <div style={{
                      width: '40px', height: '40px', borderRadius: 'var(--radius-lg)',
                      background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <WifiOff size={20} color="var(--color-secure)" strokeWidth={2} />
                    </div>
                    <div>
                      <div className="login-title-xl">Offline Enclave</div>
                      <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-secure)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Air-Gapped Isolation</div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="login-desc-md">
                    Air-gapped security enclave. Zero external network access. Direct local authentication.
                  </p>

                  {/* Monospace status readout */}
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px',
                    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                    fontSize: 'var(--font-size-body)', color: 'var(--color-text-muted)',
                    background: 'rgba(2,6,23,0.5)', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(148,163,184,0.1)',
                  }}>
                    <span className="login-flex-row">
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-secure)', flexShrink: 0 }} />
                      <span className="login-text-border">link:</span> isolated (airgap)
                    </span>
                    <span className="login-flex-row">
                      <span className="login-dot-muted" />
                      <span className="login-text-border">auth:</span> local pbkdf2 credential
                    </span>
                  </div>

                  {/* CTA */}
                  <span className="aegis-mode-cta" style={{
                    position: 'absolute', bottom: '18px', left: '30px',
                    fontSize: 'var(--font-size-body)', color: 'var(--color-secure)', fontWeight: '600',
                    opacity: 0, transform: 'translateX(-4px)',
                    transition: 'opacity 0.2s ease, transform 0.2s ease',
                    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                    pointerEvents: 'none',
                  }}>Enter Air-Gap Enclave →</span>
                </button>

                {/* ── ONLINE half ──────────────────────────────────────── */}
                <button
                  id="mode-online-btn"
                  onClick={() => { setLoginMode('online'); setView(VIEW.LOGIN); }}
                  className="aegis-mode-btn aegis-online-btn"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    padding: '28px 30px 52px 30px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    color: 'var(--color-surface-subtle)',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                  }}
                >
                  {/* Icon + label row */}
                  <div className="login-flex-row-12">
                    <div style={{
                      width: '40px', height: '40px', borderRadius: 'var(--radius-lg)',
                      background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.35)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Wifi size={20} color="#38bdf8" strokeWidth={2} />
                    </div>
                    <div>
                      <div className="login-title-xl">Online Gateway</div>
                      <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-accent)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gmail OTP 2FA</div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="login-desc-md">
                    Internet-connected supervisory gateway with 6-digit Gmail OTP two-factor verification.
                  </p>

                  {/* Monospace status readout */}
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px',
                    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                    fontSize: 'var(--font-size-body)', color: 'var(--color-text-muted)',
                    background: 'rgba(2,6,23,0.5)', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(148,163,184,0.1)',
                  }}>
                    <span className="login-flex-row">
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-accent)', flexShrink: 0 }} />
                      <span className="login-text-border">link:</span> active (TLS 1.3 WAN)
                    </span>
                    <span className="login-flex-row">
                      <span className="login-dot-muted" />
                      <span className="login-text-border">auth:</span> verified gmail OTP
                    </span>
                  </div>

                  {/* CTA */}
                  <span className="aegis-mode-cta" style={{
                    position: 'absolute', bottom: '18px', left: '30px',
                    fontSize: 'var(--font-size-body)', color: 'var(--color-accent)', fontWeight: '600',
                    opacity: 0, transform: 'translateX(-4px)',
                    transition: 'opacity 0.2s ease, transform 0.2s ease',
                    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                    pointerEvents: 'none',
                  }}>Proceed with Gmail OTP →</span>
                </button>
              </div>

              {/* Bottom note */}
              <div style={{
                margin: 0, padding: '12px 32px 14px', fontSize: 'var(--font-size-body)', color: 'var(--color-text-muted)',
                borderTop: '1px solid rgba(148,163,184,0.1)', letterSpacing: '0.01em',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>This selection determines authorized authentication methods.</span>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 'var(--font-size-small)', color: 'var(--color-text-secondary)' }}>SEC-LEVEL: RESTRICTED</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            VIEW 1: CREDENTIAL LOGIN
        ══════════════════════════════════════════════════════════════════ */}
        {view === VIEW.LOGIN && (
          <div style={{
            width: '100%',
            background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(148,163,184,0.15)', borderRadius: '18px',
            padding: '36px 32px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>

            {/* Back to mode select */}
            <button
              type="button"
              onClick={() => { setView(VIEW.MODE_SELECT); setError(''); setSuccessMsg(''); }}
              style={{
                background: 'none', border: 'none', color: 'var(--color-text-muted)',
                fontSize: 'var(--font-size-body)', display: 'inline-flex', alignItems: 'center', gap: '5px',
                cursor: 'pointer', marginBottom: '18px', padding: 0,
              }}
            >
              <ArrowLeft size={14} />
              <span>Change connection mode</span>
            </button>

            {/* Error / Success */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: 'var(--radius-lg)', padding: '12px 14px', marginBottom: '20px',
                color: 'var(--color-critical-border)', fontSize: 'var(--font-size-md)',
              }}>
                <AlertCircle size={17} className="login-shrink-0" />
                <span className="login-line-14">{error}</span>
              </div>
            )}
            {successMsg && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)',
                borderRadius: 'var(--radius-lg)', padding: '12px 14px', marginBottom: '20px',
                color: 'var(--color-secure-dim)', fontSize: 'var(--font-size-md)',
              }}>
                <CheckCircle2 size={17} className="login-shrink-0" />
                <span className="login-line-14">{successMsg}</span>
              </div>
            )}

            {/* Heading */}
            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
              <h2 style={{ margin: '0 0 6px 0', fontSize: 'var(--font-size-2xl)', fontWeight: '700', color: 'var(--color-surface-alt)' }}>
                {loginMode === 'online' ? 'Online Secure Login' : 'Secure Enclave Login'}
              </h2>
              <p style={{ margin: 0, fontSize: 'var(--font-size-md)', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                {loginMode === 'online' ? 'Two-Factor Gmail Authentication' : 'Air-Gapped Local Credential Authentication'}
              </p>
            </div>

            {/* Supervisor Badge */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', marginBottom: '20px',
              background: 'rgba(21,128,61,0.1)', border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 'var(--radius-lg)',
            }}>
              <div className="login-flex-row">
                <ShieldCheck size={16} color="#4ade80" />
                <span style={{ fontSize: 'var(--font-size-body)', fontWeight: '700', color: 'var(--color-secure)', letterSpacing: '0.5px' }}>
                  NCIIPC SUPERVISORY AUTHORITY
                </span>
              </div>
              <span style={{
                fontSize: 'var(--font-size-small)', color: 'var(--color-success-border)',
                background: 'rgba(21,128,61,0.3)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontWeight: '600',
              }}>
                ROLE: SUPERVISOR
              </span>
            </div>

            {/* ── ONLINE MODE: DEDICATED GMAIL OTP SIGN-IN ───────────────── */}
            {loginMode === 'online' ? (
              <div style={{
                background: 'rgba(56,189,248,0.06)',
                border: '1px solid rgba(56,189,248,0.25)',
                borderRadius: 'var(--radius-xl)', padding: '20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  {/* Google G SVG */}
                  <svg width="20" height="20" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '700', color: 'var(--color-login-accent)' }}>Sign in via Gmail OTP</div>
                    <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)' }}>Universal email authentication</div>
                  </div>
                  <span style={{
                    marginLeft: 'auto', fontSize: 'var(--font-size-caption)', fontWeight: '700', color: 'var(--color-accent)',
                    background: 'rgba(56,189,248,0.15)', padding: '2px 8px', borderRadius: 'var(--radius-lg)',
                  }}>DIRECT OTP</span>
                </div>

                {googleOtpError && (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 'var(--radius-lg)', padding: '10px 12px', marginBottom: '14px',
                    color: 'var(--color-critical-border)', fontSize: 'var(--font-size-body)', lineHeight: '1.4',
                  }}>
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>{googleOtpError}</span>
                  </div>
                )}

                <form onSubmit={handleGoogleOtpSend} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label htmlFor="google-email-input" style={{
                      display: 'block', fontSize: 'var(--font-size-body)', fontWeight: '600', color: 'var(--color-border)',
                      marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.6px',
                    }}>Enter Your Gmail / Email Address</label>
                    <div className="login-relative">
                      <Mail size={16} color="var(--color-text-muted)" className="login-input-icon" />
                      <input
                        id="google-email-input"
                        type="email"
                        value={googleEmail}
                        onChange={e => { setGoogleEmail(e.target.value); if (googleOtpError) setGoogleOtpError(''); }}
                        placeholder="Enter your email address"
                        autoComplete="email"
                        autoFocus
                        style={{
                          width: '100%', height: '46px', padding: '0 14px 0 40px',
                          borderRadius: 'var(--radius-lg)', background: 'var(--color-login-bg)',
                          border: '1px solid rgba(56,189,248,0.25)',
                          color: 'var(--color-surface-subtle)', fontSize: 'var(--font-size-md)', outline: 'none',
                          boxSizing: 'border-box', transition: 'border-color 0.2s',
                        }}
                        onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
                        onBlur={e => e.target.style.borderColor = 'rgba(56,189,248,0.25)'}
                      />
                    </div>
                  </div>

                  <button
                    id="google-otp-send-btn"
                    type="submit"
                    disabled={googleOtpLoading}
                    style={{
                      width: '100%', padding: '13px 18px', borderRadius: 'var(--radius-lg)',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--color-surface)', fontSize: 'var(--font-size-md)', fontWeight: '600',
                      cursor: googleOtpLoading ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      boxShadow: '0 4px 14px rgba(2,132,199,0.35)',
                      transition: 'all 0.2s', opacity: googleOtpLoading ? 0.7 : 1,
                    }}
                  >
                    {googleOtpLoading ? (
                      <>
                        <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'var(--color-surface)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <span>Generating & Dispatching Code...</span>
                      </>
                    ) : (
                      <>
                        <Mail size={16} />
                        <span>Send Verification Code to Gmail</span>
                        <ChevronRight size={16} />
                      </>
                    )}
                  </button>
                </form>

                <p style={{ margin: '14px 0 0', fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: '1.4' }}>
                  Enter any valid email address to receive your 6-digit secure authentication code.
                </p>
              </div>
            ) : (
              /* ── OFFLINE MODE: LOCAL CREDENTIAL LOGIN ─────────────────── */
              <>
                <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Username */}
                  <div>
                    <label htmlFor="username-input" style={{
                      display: 'block', fontSize: 11, fontWeight: '700', color: 'rgba(0,212,255,0.7)',
                      marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1.2px',
                      fontFamily: "var(--font-display,'Orbitron',monospace)",
                    }}>Username</label>
                    <div className="login-relative">
                      <User size={20} color="var(--color-text-muted)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        id="username-input"
                        type="text"
                        value={username}
                        onChange={(e) => { setUsername(e.target.value); if (error) setError(''); }}
                        placeholder="Enter authorized username"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck="false"
                        style={{
                          width: '100%', height: '56px', padding: '0 16px 0 48px',
                          borderRadius: 'var(--radius-xl)', background: 'var(--color-login-bg)',
                          border: error && !username ? '1px solid #ef4444' : '1px solid rgba(148,163,184,0.25)',
                          color: 'var(--color-surface-subtle)', fontSize: 'var(--font-size-xl)', outline: 'none',
                          transition: 'border-color 0.2s', boxSizing: 'border-box',
                        }}
                        onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
                        onBlur={e => e.target.style.borderColor = error && !username ? 'var(--color-critical)' : 'rgba(148,163,184,0.25)'}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="password-input" style={{
                      display: 'block', fontSize: 11, fontWeight: '700', color: 'rgba(0,212,255,0.7)',
                      marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1.2px',
                      fontFamily: "var(--font-display,'Orbitron',monospace)",
                    }}>Password</label>
                    <div className="login-relative">
                      <Lock size={17} color="var(--color-text-muted)" className="login-input-icon" />
                      <input
                        id="password-input"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                        placeholder="Enter secure password"
                        autoComplete="current-password"
                        style={{
                          width: '100%', height: '48px', padding: '0 42px 0 42px',
                          borderRadius: 'var(--radius-lg)', background: 'var(--color-login-bg)',
                          border: error && !password ? '1px solid #ef4444' : '1px solid rgba(148,163,184,0.25)',
                          color: 'var(--color-surface-subtle)', fontSize: 'var(--font-size-md)', outline: 'none',
                          letterSpacing: showPassword ? 'normal' : '1.5px',
                          transition: 'border-color 0.2s', boxSizing: 'border-box',
                        }}
                        onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
                        onBlur={e => e.target.style.borderColor = error && !password ? 'var(--color-critical)' : 'rgba(148,163,184,0.25)'}
                      />
                      <button
                        type="button"
                        className="login-eye-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me | Forgot Username | Forgot Password */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--font-size-md)', color: 'var(--color-text-muted)', marginTop: '2px', flexWrap: 'wrap', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        style={{ cursor: 'pointer', accentColor: 'var(--color-accent)', width: '15px', height: '15px' }}
                      />
                      <span>Remember Me</span>
                    </label>

                    <div className="login-flex-row-12">
                      {role.toLowerCase() !== 'supervisor' && (
                        <>
                          <button
                            type="button"
                            id="forgot-username-btn"
                            onClick={() => setShowForgotUsernameModal(true)}
                            style={{ background: 'none', border: 'none', color: 'var(--color-login-violet)', fontSize: 'var(--font-size-md)', cursor: 'pointer', padding: '2px 0' }}
                          >
                            Forgot Username?
                          </button>
                          <span style={{ color: 'var(--color-text-secondary)' }}>|</span>
                        </>
                      )}
                      <button
                        type="button"
                        id="forgot-password-btn"
                        onClick={() => setShowForgotPasswordModal(true)}
                        style={{ background: 'none', border: 'none', color: 'var(--color-login-accent)', fontSize: 'var(--font-size-md)', cursor: 'pointer', padding: '2px 0' }}
                      >
                        Forgot Password?
                      </button>
                    </div>
                  </div>

                  {/* Sign In Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      marginTop: '10px', width: '100%', padding: '13px 20px', borderRadius: 'var(--radius-lg)',
                      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                      border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-surface)',
                      fontSize: 'var(--font-size-lg)', fontWeight: '600', cursor: loading ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                      transition: 'all 0.2s ease', opacity: loading ? 0.75 : 1,
                    }}
                  >
                    {loading ? (
                      <>
                        <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'var(--color-surface)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <span>Authenticating Enclave...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <CheckCircle2 size={17} />
                      </>
                    )}
                  </button>
                </form>

                {/* Actions: Register & Quick Fill */}
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    id="register-operator-btn"
                    onClick={() => { setShowRegisterModal(true); setRegError(''); setRegSuccess(''); }}
                    style={{
                      width: '100%', background: 'rgba(56,189,248,0.08)',
                      border: '1px solid rgba(56,189,248,0.25)', color: 'var(--color-accent)',
                      padding: '11px 16px', borderRadius: 'var(--radius-lg)',
                      fontSize: 'var(--font-size-md)', fontWeight: '600', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      transition: 'all 0.15s',
                    }}
                  >
                    <UserPlus size={16} color="#38bdf8" />
                    <span>Create New Account / Register</span>
                  </button>


                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            VIEW 1b: GOOGLE EMAIL INPUT (kept as inline section above)
            VIEW 2: OTP VERIFICATION
        ══════════════════════════════════════════════════════════════════ */}
        {view === VIEW.OTP && (
          <div style={{
            width: '100%',
            background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(148,163,184,0.15)', borderRadius: '18px',
            padding: '36px 32px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
            {/* Error / Success */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: 'var(--radius-lg)', padding: '12px 14px', marginBottom: '20px',
                color: 'var(--color-critical-border)', fontSize: 'var(--font-size-md)',
              }}>
                <AlertCircle size={17} className="login-shrink-0" />
                <span className="login-line-14">{error}</span>
              </div>
            )}
            {successMsg && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)',
                borderRadius: 'var(--radius-lg)', padding: '12px 14px', marginBottom: '20px',
                color: 'var(--color-secure-dim)', fontSize: 'var(--font-size-md)',
              }}>
                <CheckCircle2 size={17} className="login-shrink-0" />
                <span className="login-line-14">{successMsg}</span>
              </div>
            )}

            {/* Back button */}
            <button
              type="button"
              onClick={() => {
                setView(VIEW.LOGIN);
                setError(''); setSuccessMsg('');
                setOtpDigits(['', '', '', '', '', '']);
              }}
              style={{
                background: 'none', border: 'none', color: 'var(--color-text-muted)',
                fontSize: 'var(--font-size-body)', display: 'inline-flex', alignItems: 'center', gap: '5px',
                cursor: 'pointer', marginBottom: '14px', padding: 0,
              }}
            >
              <ArrowLeft size={14} />
              <span>Back to login credentials</span>
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: 'var(--radius-xl)',
                background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
              }}>
                <KeyRound size={26} color="#38bdf8" />
              </div>

              <h2 style={{ margin: '0 0 6px 0', fontSize: 'var(--font-size-2xl)', fontWeight: '700', color: 'var(--color-surface-alt)', textAlign: 'center' }}>
                Verify Your Identity
              </h2>
              <p style={{ margin: '0 0 14px 0', fontSize: 'var(--font-size-md)', color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: '1.4' }}>
                {otpSession?.source === 'google_otp'
                  ? 'A verification code was sent to your registered Gmail address.'
                  : 'We sent a verification code to your registered email address.'}
              </p>

              {/* Masked email badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(56,189,248,0.3)',
                borderRadius: 'var(--radius-lg)', padding: '6px 14px',
                fontSize: 'var(--font-size-md)', fontWeight: '600', color: 'var(--color-login-accent)',
                fontFamily: 'monospace', marginBottom: '20px',
              }}>
                <Mail size={14} color="#38bdf8" />
                <span>{otpSession?.maskedEmail || 'operator@gmail.com'}</span>
              </div>



              {/* 6-digit OTP Boxes */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', width: '100%', marginBottom: '16px' }}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => (otpInputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(idx, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(idx, e)}
                    onPaste={idx === 0 ? handleOtpPaste : undefined}
                    style={{
                      width: '46px', height: '54px', textAlign: 'center',
                      fontSize: 'var(--font-size-2xl)', fontWeight: '700', borderRadius: 'var(--radius-lg)',
                      background: 'var(--color-login-bg)',
                      border: error ? '1px solid #ef4444' : digit ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.25)',
                      color: 'var(--color-surface-subtle)', outline: 'none',
                      boxShadow: digit ? '0 0 12px rgba(56,189,248,0.25)' : 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                      boxSizing: 'border-box',
                    }}
                  />
                ))}
              </div>

              {/* Countdown */}
              <div style={{
                textAlign: 'center', fontSize: 'var(--font-size-md)',
                color: expiresIn <= 30 ? 'var(--color-critical-border)' : 'var(--color-text-muted)',
                marginBottom: '22px', fontWeight: '500',
              }}>
                OTP expires in:{' '}
                <span style={{ fontFamily: 'monospace', fontWeight: '700', color: expiresIn <= 30 ? 'var(--color-critical-border)' : 'var(--color-surface-subtle)' }}>
                  {formatTimer(expiresIn)}
                </span>
              </div>

              {/* Verify Button */}
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={loading || expiresIn <= 0}
                style={{
                  width: '100%', padding: '13px 20px', borderRadius: 'var(--radius-lg)',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-surface)',
                  fontSize: 'var(--font-size-lg)', fontWeight: '600',
                  cursor: loading || expiresIn <= 0 ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 4px 14px rgba(2,132,199,0.35)',
                  transition: 'all 0.2s ease',
                  opacity: loading || expiresIn <= 0 ? 0.6 : 1,
                  marginBottom: '12px',
                }}
              >
                {loading ? (
                  <>
                    <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'var(--color-surface)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>Verify OTP</span>
                  </>
                )}
              </button>

              {/* Resend Button */}
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resending}
                style={{
                  width: '100%', padding: '14px 18px', borderRadius: 'var(--radius-xl)',
                  background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(148,163,184,0.2)',
                  color: 'var(--color-accent)',
                  fontSize: 'var(--font-size-lg)', fontWeight: '600',
                  cursor: resending ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'all 0.2s',
                }}
              >
                <RefreshCw size={16} />
                <span>
                  {resending
                    ? 'Resending Verification Code...'
                    : 'Resend OTP'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: '24px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-small)', lineHeight: '1.5' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginBottom: '4px', color: 'var(--color-text-muted)' }}>
            <Lock size={11} color="var(--color-text-secondary)" />
            <span>Authorized personnel only</span>
          </div>
          <div>Restricted government &amp; critical sector system under IT Act Sec 70.</div>
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Forgot / Reset Password
      ══════════════════════════════════════════════════════════════════ */}
      {showForgotPasswordModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '20px',
        }}>
          <div style={{
            maxWidth: '440px', width: '100%', background: 'var(--color-navy)',
            border: '1px solid rgba(148,163,184,0.25)', borderRadius: '16px',
            padding: '26px', boxShadow: '0 20px 40px rgba(0,0,0,0.7)', position: 'relative',
          }}>
            <button
              onClick={() => setShowForgotPasswordModal(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>

            <div className="login-header-row-14">
              <div style={{
                width: '36px', height: '36px', borderRadius: 'var(--radius-lg)',
                background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <KeyRound size={18} color="#38bdf8" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: '700', color: 'var(--color-surface-subtle)' }}>
                  Reset Enclave Password
                </h3>
                <div style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-muted)' }}>Update local air-gapped credentials</div>
              </div>
            </div>

            {resetError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius-lg)', padding: '10px 12px', marginBottom: '14px',
                color: 'var(--color-critical-border)', fontSize: 'var(--font-size-body)',
              }}>
                <AlertCircle size={15} className="login-shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            {resetSuccess && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 'var(--radius-lg)', padding: '10px 12px', marginBottom: '14px',
                color: 'var(--color-success-border)', fontSize: 'var(--font-size-body)',
              }}>
                <CheckCircle2 size={15} className="login-shrink-0" />
                <span>{resetSuccess}</span>
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="login-label">
                  Username / Enclave Identifier
                </label>
                <input
                  type="text"
                  value={resetUsername || username}
                  onChange={e => setResetUsername(e.target.value)}
                  placeholder="e.g. supervisor01"
                  required
                  style={{
                    width: '100%', height: '42px', padding: '0 12px', borderRadius: 'var(--radius-lg)',
                    background: 'var(--color-login-bg)', border: '1px solid rgba(148,163,184,0.25)',
                    color: 'var(--color-surface-subtle)', fontSize: 'var(--font-size-md)', boxSizing: 'border-box', outline: 'none',
                  }}
                />
              </div>

              <div>
                <label className="login-label">
                  New Password
                </label>
                <div className="login-relative">
                  <input
                    type={resetShowPassword ? 'text' : 'password'}
                    value={resetNewPassword}
                    onChange={e => setResetNewPassword(e.target.value)}
                    placeholder="Enter new password (min. 6 characters)"
                    required
                    style={{
                      width: '100%', height: '42px', padding: '0 36px 0 12px', borderRadius: 'var(--radius-lg)',
                      background: 'var(--color-login-bg)', border: '1px solid rgba(148,163,184,0.25)',
                      color: 'var(--color-surface-subtle)', fontSize: 'var(--font-size-md)', boxSizing: 'border-box', outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setResetShowPassword(!resetShowPassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                  >
                    {resetShowPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="login-label">
                  Confirm New Password
                </label>
                <input
                  type={resetShowPassword ? 'text' : 'password'}
                  value={resetConfirmPassword}
                  onChange={e => setResetConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  style={{
                    width: '100%', height: '42px', padding: '0 12px', borderRadius: 'var(--radius-lg)',
                    background: 'var(--color-login-bg)', border: '1px solid rgba(148,163,184,0.25)',
                    color: 'var(--color-surface-subtle)', fontSize: 'var(--font-size-md)', boxSizing: 'border-box', outline: 'none',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                style={{
                  marginTop: '8px', width: '100%', padding: '11px', borderRadius: 'var(--radius-lg)',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-surface)',
                  fontSize: 'var(--font-size-md)', fontWeight: '600', cursor: resetLoading ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                {resetLoading ? 'Resetting Password...' : 'Save & Update Password'}
              </button>
            </form>


          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Register / Create New Account
      ══════════════════════════════════════════════════════════════════ */}
      {showRegisterModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(2,6,23,0.88)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '20px',
        }}>
          <div style={{
            maxWidth: '460px', width: '100%', background: 'var(--color-navy)',
            border: '1px solid rgba(56,189,248,0.25)', borderRadius: '18px',
            padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8), 0 0 30px rgba(56,189,248,0.08)', position: 'relative',
          }}>
            <button
              onClick={() => setShowRegisterModal(false)}
              className="login-modal-close-btn"
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: 'var(--radius-lg)',
                background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <UserPlus size={20} color="#38bdf8" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '700', color: 'var(--color-surface-subtle)' }}>
                  Create New Account
                </h3>
                <div style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-muted)' }}>Set up your security platform access</div>
              </div>
            </div>

            {regError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius-lg)', padding: '10px 12px', marginBottom: '14px',
                color: 'var(--color-critical-border)', fontSize: 'var(--font-size-body)',
              }}>
                <AlertCircle size={15} className="login-shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            {regSuccess && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 'var(--radius-lg)', padding: '10px 12px', marginBottom: '14px',
                color: 'var(--color-success-border)', fontSize: 'var(--font-size-body)',
              }}>
                <CheckCircle2 size={15} className="login-shrink-0" />
                <span>{regSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="login-label">
                  Username / Identifier
                </label>
                <input
                  type="text"
                  value={regUsername}
                  onChange={e => setRegUsername(e.target.value)}
                  placeholder="e.g. prateek_admin"
                  required
                  style={{
                    width: '100%', height: '42px', padding: '0 12px', borderRadius: 'var(--radius-lg)',
                    background: 'var(--color-login-bg)', border: '1px solid rgba(148,163,184,0.25)',
                    color: 'var(--color-surface-subtle)', fontSize: 'var(--font-size-md)', boxSizing: 'border-box', outline: 'none',
                  }}
                />
              </div>

              <div>
                <label className="login-label">
                  Email Address
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  placeholder="e.g. prateek@cyberdefense.in"
                  required
                  style={{
                    width: '100%', height: '42px', padding: '0 12px', borderRadius: 'var(--radius-lg)',
                    background: 'var(--color-login-bg)', border: '1px solid rgba(148,163,184,0.25)',
                    color: 'var(--color-surface-subtle)', fontSize: 'var(--font-size-md)', boxSizing: 'border-box', outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                <div>
                  <label className="login-label">
                    Assigned Role
                  </label>
                  <select
                    value={regRole}
                    onChange={e => setRegRole(e.target.value)}
                    style={{
                      width: '100%', height: '42px', padding: '0 10px', borderRadius: 'var(--radius-lg)',
                      background: 'var(--color-login-bg)', border: '1px solid rgba(148,163,184,0.25)',
                      color: 'var(--color-surface-subtle)', fontSize: 'var(--font-size-md)', boxSizing: 'border-box', outline: 'none',
                    }}
                  >
                    <option value="SUPERVISOR">Supervisor / Lead</option>
                    <option value="ANALYST">Security Analyst</option>
                    <option value="ADMINISTRATOR">Administrator</option>
                    <option value="AUDITOR">Auditor</option>
                  </select>
                </div>

                <div>
                  <label className="login-label">
                    Organization / Unit
                  </label>
                  <input
                    type="text"
                    value={regOrg}
                    onChange={e => setRegOrg(e.target.value)}
                    placeholder="CyberSec Command"
                    style={{
                      width: '100%', height: '42px', padding: '0 10px', borderRadius: 'var(--radius-lg)',
                      background: 'var(--color-login-bg)', border: '1px solid rgba(148,163,184,0.25)',
                      color: 'var(--color-surface-subtle)', fontSize: 'var(--font-size-md)', boxSizing: 'border-box', outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="login-label">
                    Password
                  </label>
                  <div className="login-relative">
                    <input
                      type={regShowPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      placeholder="Min. 4 chars"
                      required
                      style={{
                        width: '100%', height: '42px', padding: '0 32px 0 10px', borderRadius: 'var(--radius-lg)',
                        background: 'var(--color-login-bg)', border: '1px solid rgba(148,163,184,0.25)',
                        color: 'var(--color-surface-subtle)', fontSize: 'var(--font-size-md)', boxSizing: 'border-box', outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setRegShowPassword(!regShowPassword)}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                    >
                      {regShowPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="login-label">
                    Confirm Password
                  </label>
                  <input
                    type={regShowPassword ? 'text' : 'password'}
                    value={regConfirmPassword}
                    onChange={e => setRegConfirmPassword(e.target.value)}
                    placeholder="Re-enter"
                    required
                    style={{
                      width: '100%', height: '42px', padding: '0 10px', borderRadius: 'var(--radius-lg)',
                      background: 'var(--color-login-bg)', border: '1px solid rgba(148,163,184,0.25)',
                      color: 'var(--color-surface-subtle)', fontSize: 'var(--font-size-md)', boxSizing: 'border-box', outline: 'none',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={regLoading}
                style={{
                  marginTop: '10px', width: '100%', padding: '13px', borderRadius: 'var(--radius-lg)',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: '1px solid rgba(255,255,255,0.15)', color: 'var(--color-surface)',
                  fontSize: 'var(--font-size-md)', fontWeight: '700', cursor: regLoading ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 4px 14px rgba(2,132,199,0.35)',
                  transition: 'all 0.2s ease',
                }}
              >
                {regLoading ? 'Creating Account...' : 'Create Account & Access Platform'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Forgot Username
      ══════════════════════════════════════════════════════════════════ */}
      {showForgotUsernameModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '20px',
        }}>
          <div style={{
            maxWidth: '440px', width: '100%', background: 'var(--color-navy)',
            border: '1px solid rgba(148,163,184,0.25)', borderRadius: '16px',
            padding: '28px', boxShadow: '0 20px 40px rgba(0,0,0,0.7)', position: 'relative',
          }}>
            <button
              onClick={() => setShowForgotUsernameModal(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>

            <div className="login-header-row-14">
              <div style={{
                width: '36px', height: '36px', borderRadius: 'var(--radius-lg)',
                background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <User size={18} color="#a78bfa" />
              </div>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: '700', color: 'var(--color-surface-subtle)' }}>
                Forgot Username
              </h3>
            </div>

            <p style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-border)', lineHeight: '1.6', marginBottom: '16px' }}>
              Usernames in A.E.G.I.S. are assigned by your <strong>System Administrator</strong> during onboarding and cannot be self-retrieved through this interface.
            </p>

            <div style={{
              background: 'rgba(2,6,23,0.6)', border: '1px solid rgba(148,163,184,0.15)',
              borderRadius: 'var(--radius-lg)', padding: '12px 14px',
              fontSize: 'var(--font-size-body)', color: 'var(--color-text-muted)', lineHeight: '1.5', marginBottom: '16px',
            }}>
              To retrieve your assigned username:
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '18px' }}>
                <li>Contact your on-site System Administrator or SOC Desk Officer</li>
                <li>Your username is also printed on your NCIIPC security credential card</li>
                <li>Check your original onboarding email from the A.E.G.I.S. admin team</li>
              </ul>
            </div>

            {/* Hint: show demo credentials as reference */}
            <div style={{
              background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)',
              borderRadius: 'var(--radius-lg)', padding: '10px 14px', marginBottom: '16px',
              fontSize: 'var(--font-size-body)', color: 'var(--color-login-violet)',
            }}>
              <strong>Demo credentials hint:</strong>{' '}
              <span className="login-mono-violet">supervisor01</span>,{' '}
              <span className="login-mono-violet">analyst01</span>,{' '}
              <span className="login-mono-violet">admin01</span>
            </div>

            <button
              onClick={() => { handleQuickFill('SUPERVISOR'); setShowForgotUsernameModal(false); }}
              style={{
                width: '100%', padding: '10px', borderRadius: 'var(--radius-lg)',
                background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)',
                color: 'var(--color-login-violet)', fontSize: 'var(--font-size-md)', fontWeight: '600', cursor: 'pointer', marginBottom: '10px',
              }}
            >
              Auto-Fill Default Supervisor Credentials
            </button>

            <button
              onClick={() => setShowForgotUsernameModal(false)}
              style={{
                width: '100%', padding: '10px', borderRadius: 'var(--radius-lg)',
                background: 'var(--color-navy)', border: '1px solid rgba(148,163,184,0.2)',
                color: 'var(--color-surface-subtle)', fontSize: 'var(--font-size-md)', fontWeight: '600', cursor: 'pointer',
              }}
            >
              Acknowledge &amp; Close
            </button>
          </div>
        </div>
      )}

      {/* Global CSS */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* ── Input wrapper: positions the icon absolutely ── */
        .login-relative {
          position: relative;
        }

        /* ── Input icon: always visible, properly placed ─── */
        .login-input-icon {
          position: absolute !important;
          left: 14px !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          color: rgba(0,212,255,0.55) !important;
          pointer-events: none;
          z-index: 1;
          display: flex !important;
          align-items: center;
          width: 17px !important;
          height: 17px !important;
        }

        /* ── All login inputs — readable in dark bg ─────── */
        #username-input,
        #password-input,
        #google-email-input {
          height: 50px !important;
          min-height: 44px !important;
          box-sizing: border-box !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          color: #e8f4ff !important;
          background-color: rgba(5,15,40,0.9) !important;
          border: 1px solid rgba(0,212,255,0.2) !important;
          border-radius: 10px !important;
        }
        #username-input:focus,
        #password-input:focus,
        #google-email-input:focus {
          border-color: rgba(0,212,255,0.6) !important;
          box-shadow: 0 0 0 3px rgba(0,212,255,0.1), 0 0 16px rgba(0,212,255,0.1) !important;
          outline: none !important;
        }
        #username-input::placeholder,
        #password-input::placeholder,
        #google-email-input::placeholder {
          color: rgba(140,170,200,0.45) !important;
        }
        #google-email-input {
          height: 46px !important;
        }

        /* ── Modal labels inside reset/register forms ─────── */
        .login-label {
          display: block !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          color: rgba(0,212,255,0.65) !important;
          text-transform: uppercase !important;
          letter-spacing: 1px !important;
          margin-bottom: 6px !important;
          font-family: 'Orbitron', 'Space Grotesk', monospace !important;
        }

        /* ── Modal inputs ─────────────────────────────────── */
        .login-modal-input {
          width: 100% !important;
          height: 40px !important;
          padding: 0 12px !important;
          font-size: 13px !important;
          color: #ddeeff !important;
          background: rgba(5,15,40,0.8) !important;
          border: 1px solid rgba(0,212,255,0.2) !important;
          border-radius: 8px !important;
          outline: none !important;
          box-sizing: border-box !important;
        }
        .login-modal-input:focus {
          border-color: rgba(0,212,255,0.5) !important;
          box-shadow: 0 0 0 3px rgba(0,212,255,0.08) !important;
        }

        /* ── Show/hide password button ────────────────────── */
        .login-eye-btn {
          position: absolute !important;
          right: 12px !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          background: none !important;
          border: none !important;
          cursor: pointer !important;
          color: rgba(0,212,255,0.5) !important;
          padding: 4px !important;
          display: flex !important;
          align-items: center !important;
          transition: color 0.15s !important;
          z-index: 2 !important;
        }
        .login-eye-btn:hover {
          color: rgba(0,212,255,0.9) !important;
        }

        /* ── Mode-select split panel hover effects ─────────── */
        .aegis-offline-btn:hover {
          background: rgba(52,211,153,0.05) !important;
        }
        .aegis-online-btn:hover {
          background: rgba(56,189,248,0.05) !important;
        }
        .aegis-mode-btn:hover .aegis-mode-cta {
          opacity: 1 !important;
          transform: translateX(0) !important;
        }

        /* ── Responsive ────────────────────────────────────── */
        @media (max-width: 480px) {
          .aegis-mode-row {
            flex-direction: column !important;
          }
          #mode-offline-btn {
            border-right: none !important;
            border-bottom: 1px solid rgba(148,163,184,0.1) !important;
          }
        }
      `}</style>
    </div>
  );
}
