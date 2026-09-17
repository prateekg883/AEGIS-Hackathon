import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Lock, User, Eye, EyeOff,
  AlertCircle, WifiOff, Wifi, CheckCircle2, X, Sparkles,
  Mail, ShieldCheck, ArrowLeft, RefreshCw, KeyRound, ChevronRight,
  UserPlus, Key, Building2
} from 'lucide-react';
import { useAuth, DEMO_PROFILES } from '../state/AuthContext';
import api from '../services/api';

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
      background: 'radial-gradient(circle at 50% 20%, #0f172a 0%, #020617 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: '#f8fafc',
      position: 'relative',
      overflow: 'hidden',
      opacity: mounted ? 1 : 0,
      transition: 'opacity 0.5s ease-out',
    }}>

      {/* Grid Background */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: `
          linear-gradient(rgba(30,41,59,0.4) 1px, transparent 1px),
          linear-gradient(90deg, rgba(30,41,59,0.4) 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
        opacity: 0.7, pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Amber horizon line — replaces glow blob */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '1px',
        background: 'linear-gradient(90deg, transparent 0%, rgba(240,180,41,0.55) 50%, transparent 100%)',
        pointerEvents: 'none', zIndex: 1,
      }} />

      {/* Main container */}
      <div style={{
        width: '100%',
        maxWidth: view === VIEW.MODE_SELECT ? '920px' : '680px',
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        transition: 'max-width 0.35s ease',
      }}>

        {/* ── Logo ────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px', textAlign: 'center' }}>

          {/* Reticle mark — sharp corners, amber bracket accents */}
          <div style={{
            position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '76px', height: '76px',
            background: 'linear-gradient(145deg, #0f172a 0%, #020617 100%)',
            border: '1px solid rgba(240,180,41,0.25)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6), 0 0 20px rgba(240,180,41,0.12)',
            marginBottom: '18px',
          }}>
            {/* top-left bracket */}
            <span style={{
              position: 'absolute', top: '-1px', left: '-1px',
              width: '16px', height: '16px',
              borderTop: '2.5px solid #f0b429', borderLeft: '2.5px solid #f0b429',
            }} />
            {/* top-right bracket */}
            <span style={{
              position: 'absolute', top: '-1px', right: '-1px',
              width: '16px', height: '16px',
              borderTop: '2.5px solid #f0b429', borderRight: '2.5px solid #f0b429',
            }} />
            {/* bottom-left bracket */}
            <span style={{
              position: 'absolute', bottom: '-1px', left: '-1px',
              width: '16px', height: '16px',
              borderBottom: '2.5px solid #f0b429', borderLeft: '2.5px solid #f0b429',
            }} />
            {/* bottom-right bracket */}
            <span style={{
              position: 'absolute', bottom: '-1px', right: '-1px',
              width: '16px', height: '16px',
              borderBottom: '2.5px solid #f0b429', borderRight: '2.5px solid #f0b429',
            }} />
            <img
              src="/aegis-logo.png"
              alt="A.E.G.I.S."
              style={{ width: '48px', height: '48px', objectFit: 'contain', position: 'relative', zIndex: 1 }}
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
            />
            <Shield size={40} color="#f0b429" style={{ display: 'none', position: 'relative', zIndex: 1 }} />
          </div>

          <h1 style={{ margin: 0, fontSize: '42px', fontWeight: '900', letterSpacing: '8px', color: '#f8fafc', textShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
            A.E.G.I.S.
          </h1>
          <div style={{ fontSize: '14px', fontWeight: '700', letterSpacing: '3.5px', color: '#64748b', marginTop: '8px', textTransform: 'uppercase' }}>
            National Critical Infrastructure Defence Enclave
          </div>

          {/* Auth mode badge — only after mode is selected */}
          {loginMode && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '12px',
              padding: '6px 16px', borderRadius: '20px',
              background: isAirGapped ? 'rgba(15,23,42,0.9)' : 'rgba(15,23,42,0.9)',
              border: isAirGapped ? '1px solid rgba(16,185,129,0.45)' : '1px solid rgba(56,189,248,0.45)',
              boxShadow: isAirGapped ? '0 2px 14px rgba(16,185,129,0.2)' : '0 2px 14px rgba(56,189,248,0.25)',
            }}>
              {isAirGapped
                ? <><WifiOff size={14} color="#10b981" /><span style={{ fontSize: '12px', fontWeight: '700', color: '#34d399', letterSpacing: '0.8px' }}>OFFLINE / AIR-GAPPED ENCLAVE</span></>
                : <><Wifi size={14} color="#38bdf8" /><span style={{ fontSize: '12px', fontWeight: '700', color: '#38bdf8', letterSpacing: '0.8px' }}>ONLINE / SECURE GMAIL OTP</span></>
              }
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            VIEW 0: MODE SELECTOR
        ══════════════════════════════════════════════════════════════════ */}
        {view === VIEW.MODE_SELECT && (
          <div style={{ width: '100%' }}>
            {/* Single unified console panel */}
            <div style={{
              position: 'relative',
              background: 'linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(8,14,26,0.98) 100%)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(240,180,41,0.28)',
              borderRadius: '12px',
              boxShadow: '0 30px 70px rgba(0,0,0,0.85), 0 0 35px rgba(240,180,41,0.06)',
              overflow: 'hidden',
            }}>
              {/* Corner bracket accents */}
              <span style={{ position: 'absolute', top: '10px', left: '10px', width: '14px', height: '14px', borderTop: '2px solid #f0b429', borderLeft: '2px solid #f0b429', pointerEvents: 'none' }} />
              <span style={{ position: 'absolute', top: '10px', right: '10px', width: '14px', height: '14px', borderTop: '2px solid #f0b429', borderRight: '2px solid #f0b429', pointerEvents: 'none' }} />
              <span style={{ position: 'absolute', bottom: '10px', left: '10px', width: '14px', height: '14px', borderBottom: '2px solid #f0b429', borderLeft: '2px solid #f0b429', pointerEvents: 'none' }} />
              <span style={{ position: 'absolute', bottom: '10px', right: '10px', width: '14px', height: '14px', borderBottom: '2px solid #f0b429', borderRight: '2px solid #f0b429', pointerEvents: 'none' }} />

              {/* Panel heading */}
              <div style={{ padding: '26px 32px 20px 32px', borderBottom: '1px solid rgba(148,163,184,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h2 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '700', color: '#f8fafc', letterSpacing: '0.02em' }}>
                    Choose Connection Mode
                  </h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                    Select your operational gateway to access the A.E.G.I.S. supervisory enclave.
                  </p>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontFamily: 'ui-monospace, monospace', fontSize: '11px', color: '#10b981',
                  background: 'rgba(16,185,129,0.1)', padding: '4px 10px', borderRadius: '6px',
                  border: '1px solid rgba(16,185,129,0.25)',
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
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
                    color: '#f8fafc',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                  }}
                >
                  {/* Icon + label row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px',
                      background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <WifiOff size={20} color="#34d399" strokeWidth={2} />
                    </div>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#f8fafc', letterSpacing: '0.02em' }}>Offline Enclave</div>
                      <div style={{ fontSize: '11px', color: '#34d399', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Air-Gapped Isolation</div>
                    </div>
                  </div>

                  {/* Description */}
                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6' }}>
                    Air-gapped security enclave. Zero external network access. Direct local authentication.
                  </p>

                  {/* Monospace status readout */}
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px',
                    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                    fontSize: '12px', color: '#94a3b8',
                    background: 'rgba(2,6,23,0.5)', padding: '10px 12px', borderRadius: '6px',
                    border: '1px solid rgba(148,163,184,0.1)',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
                      <span style={{ color: '#e2e8f0' }}>link:</span> isolated (airgap)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#64748b', flexShrink: 0 }} />
                      <span style={{ color: '#e2e8f0' }}>auth:</span> local pbkdf2 credential
                    </span>
                  </div>

                  {/* CTA */}
                  <span className="aegis-mode-cta" style={{
                    position: 'absolute', bottom: '18px', left: '30px',
                    fontSize: '12px', color: '#34d399', fontWeight: '600',
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
                    color: '#f8fafc',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                  }}
                >
                  {/* Icon + label row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px',
                      background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.35)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Wifi size={20} color="#38bdf8" strokeWidth={2} />
                    </div>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#f8fafc', letterSpacing: '0.02em' }}>Online Gateway</div>
                      <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gmail OTP 2FA</div>
                    </div>
                  </div>

                  {/* Description */}
                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6' }}>
                    Internet-connected supervisory gateway with 6-digit Gmail OTP two-factor verification.
                  </p>

                  {/* Monospace status readout */}
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px',
                    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                    fontSize: '12px', color: '#94a3b8',
                    background: 'rgba(2,6,23,0.5)', padding: '10px 12px', borderRadius: '6px',
                    border: '1px solid rgba(148,163,184,0.1)',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', flexShrink: 0 }} />
                      <span style={{ color: '#e2e8f0' }}>link:</span> active (TLS 1.3 WAN)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#64748b', flexShrink: 0 }} />
                      <span style={{ color: '#e2e8f0' }}>auth:</span> verified gmail OTP
                    </span>
                  </div>

                  {/* CTA */}
                  <span className="aegis-mode-cta" style={{
                    position: 'absolute', bottom: '18px', left: '30px',
                    fontSize: '12px', color: '#38bdf8', fontWeight: '600',
                    opacity: 0, transform: 'translateX(-4px)',
                    transition: 'opacity 0.2s ease, transform 0.2s ease',
                    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                    pointerEvents: 'none',
                  }}>Proceed with Gmail OTP →</span>
                </button>
              </div>

              {/* Bottom note */}
              <div style={{
                margin: 0, padding: '12px 32px 14px', fontSize: '12px', color: '#64748b',
                borderTop: '1px solid rgba(148,163,184,0.1)', letterSpacing: '0.01em',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>This selection determines authorized authentication methods.</span>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '11px', color: '#475569' }}>SEC-LEVEL: RESTRICTED</span>
              </div>
            </div>
          </div>
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
                background: 'none', border: 'none', color: '#64748b',
                fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px',
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
                borderRadius: '10px', padding: '12px 14px', marginBottom: '20px',
                color: '#fca5a5', fontSize: '13px',
              }}>
                <AlertCircle size={17} style={{ flexShrink: 0 }} />
                <span style={{ lineHeight: '1.4' }}>{error}</span>
              </div>
            )}
            {successMsg && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)',
                borderRadius: '10px', padding: '12px 14px', marginBottom: '20px',
                color: '#6ee7b7', fontSize: '13px',
              }}>
                <CheckCircle2 size={17} style={{ flexShrink: 0 }} />
                <span style={{ lineHeight: '1.4' }}>{successMsg}</span>
              </div>
            )}

            {/* Heading */}
            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
              <h2 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: '700', color: '#f1f5f9' }}>
                {loginMode === 'online' ? 'Online Secure Login' : 'Secure Enclave Login'}
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.4' }}>
                {loginMode === 'online' ? 'Two-Factor Gmail Authentication' : 'Air-Gapped Local Credential Authentication'}
              </p>
            </div>

            {/* Supervisor Badge */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', marginBottom: '20px',
              background: 'rgba(21,128,61,0.1)', border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={16} color="#4ade80" />
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#4ade80', letterSpacing: '0.5px' }}>
                  NCIIPC SUPERVISORY AUTHORITY
                </span>
              </div>
              <span style={{
                fontSize: '11px', color: '#86efac',
                background: 'rgba(21,128,61,0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: '600',
              }}>
                ROLE: SUPERVISOR
              </span>
            </div>

            {/* ── ONLINE MODE: DEDICATED GMAIL OTP SIGN-IN ───────────────── */}
            {loginMode === 'online' ? (
              <div style={{
                background: 'rgba(56,189,248,0.06)',
                border: '1px solid rgba(56,189,248,0.25)',
                borderRadius: '14px', padding: '20px',
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
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#7dd3fc' }}>Sign in via Gmail OTP</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Universal email authentication</div>
                  </div>
                  <span style={{
                    marginLeft: 'auto', fontSize: '10px', fontWeight: '700', color: '#38bdf8',
                    background: 'rgba(56,189,248,0.15)', padding: '2px 8px', borderRadius: '10px',
                  }}>DIRECT OTP</span>
                </div>

                {googleOtpError && (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: '8px', padding: '10px 12px', marginBottom: '14px',
                    color: '#fca5a5', fontSize: '12px', lineHeight: '1.4',
                  }}>
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>{googleOtpError}</span>
                  </div>
                )}

                <form onSubmit={handleGoogleOtpSend} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label htmlFor="google-email-input" style={{
                      display: 'block', fontSize: '12px', fontWeight: '600', color: '#cbd5e1',
                      marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.6px',
                    }}>Enter Your Gmail / Email Address</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={16} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
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
                          borderRadius: '10px', background: '#0b1329',
                          border: '1px solid rgba(56,189,248,0.25)',
                          color: '#f8fafc', fontSize: '14px', outline: 'none',
                          boxSizing: 'border-box', transition: 'border-color 0.2s',
                        }}
                        onFocus={e => e.target.style.borderColor = '#38bdf8'}
                        onBlur={e => e.target.style.borderColor = 'rgba(56,189,248,0.25)'}
                      />
                    </div>
                  </div>

                  <button
                    id="google-otp-send-btn"
                    type="submit"
                    disabled={googleOtpLoading}
                    style={{
                      width: '100%', padding: '13px 18px', borderRadius: '10px',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff', fontSize: '14px', fontWeight: '600',
                      cursor: googleOtpLoading ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      boxShadow: '0 4px 14px rgba(2,132,199,0.35)',
                      transition: 'all 0.2s', opacity: googleOtpLoading ? 0.7 : 1,
                    }}
                  >
                    {googleOtpLoading ? (
                      <>
                        <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
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

                <p style={{ margin: '14px 0 0', fontSize: '11px', color: '#64748b', textAlign: 'center', lineHeight: '1.4' }}>
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
                      display: 'block', fontSize: '14px', fontWeight: '600', color: '#cbd5e1',
                      marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.8px',
                    }}>Username</label>
                    <div style={{ position: 'relative' }}>
                      <User size={20} color="#64748b" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
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
                          borderRadius: '12px', background: '#0b1329',
                          border: error && !username ? '1px solid #ef4444' : '1px solid rgba(148,163,184,0.25)',
                          color: '#f8fafc', fontSize: '16px', outline: 'none',
                          transition: 'border-color 0.2s', boxSizing: 'border-box',
                        }}
                        onFocus={e => e.target.style.borderColor = '#3b82f6'}
                        onBlur={e => e.target.style.borderColor = error && !username ? '#ef4444' : 'rgba(148,163,184,0.25)'}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="password-input" style={{
                      display: 'block', fontSize: '12px', fontWeight: '600', color: '#cbd5e1',
                      marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.6px',
                    }}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={17} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        id="password-input"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                        placeholder="Enter secure password"
                        autoComplete="current-password"
                        style={{
                          width: '100%', height: '48px', padding: '0 42px 0 42px',
                          borderRadius: '10px', background: '#0b1329',
                          border: error && !password ? '1px solid #ef4444' : '1px solid rgba(148,163,184,0.25)',
                          color: '#f8fafc', fontSize: '14px', outline: 'none',
                          letterSpacing: showPassword ? 'normal' : '1.5px',
                          transition: 'border-color 0.2s', boxSizing: 'border-box',
                        }}
                        onFocus={e => e.target.style.borderColor = '#3b82f6'}
                        onBlur={e => e.target.style.borderColor = error && !password ? '#ef4444' : 'rgba(148,163,184,0.25)'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? 'Hide password' : 'Show password'}
                        style={{
                          position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
                          padding: '4px', display: 'flex', alignItems: 'center',
                        }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me | Forgot Username | Forgot Password */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: '#94a3b8', marginTop: '2px', flexWrap: 'wrap', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        style={{ cursor: 'pointer', accentColor: '#2563eb', width: '15px', height: '15px' }}
                      />
                      <span>Remember Me</span>
                    </label>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {role.toLowerCase() !== 'supervisor' && (
                        <>
                          <button
                            type="button"
                            id="forgot-username-btn"
                            onClick={() => setShowForgotUsernameModal(true)}
                            style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: '13px', cursor: 'pointer', padding: '2px 0' }}
                          >
                            Forgot Username?
                          </button>
                          <span style={{ color: '#334155' }}>|</span>
                        </>
                      )}
                      <button
                        type="button"
                        id="forgot-password-btn"
                        onClick={() => setShowForgotPasswordModal(true)}
                        style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '13px', cursor: 'pointer', padding: '2px 0' }}
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
                      marginTop: '10px', width: '100%', padding: '13px 20px', borderRadius: '10px',
                      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                      border: '1px solid rgba(255,255,255,0.1)', color: '#ffffff',
                      fontSize: '15px', fontWeight: '600', cursor: loading ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                      transition: 'all 0.2s ease', opacity: loading ? 0.75 : 1,
                    }}
                  >
                    {loading ? (
                      <>
                        <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
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
                      border: '1px solid rgba(56,189,248,0.25)', color: '#38bdf8',
                      padding: '11px 16px', borderRadius: '10px',
                      fontSize: '13px', fontWeight: '600', cursor: 'pointer',
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
                borderRadius: '10px', padding: '12px 14px', marginBottom: '20px',
                color: '#fca5a5', fontSize: '13px',
              }}>
                <AlertCircle size={17} style={{ flexShrink: 0 }} />
                <span style={{ lineHeight: '1.4' }}>{error}</span>
              </div>
            )}
            {successMsg && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)',
                borderRadius: '10px', padding: '12px 14px', marginBottom: '20px',
                color: '#6ee7b7', fontSize: '13px',
              }}>
                <CheckCircle2 size={17} style={{ flexShrink: 0 }} />
                <span style={{ lineHeight: '1.4' }}>{successMsg}</span>
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
                background: 'none', border: 'none', color: '#94a3b8',
                fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px',
                cursor: 'pointer', marginBottom: '14px', padding: 0,
              }}
            >
              <ArrowLeft size={14} />
              <span>Back to login credentials</span>
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '14px',
                background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
              }}>
                <KeyRound size={26} color="#38bdf8" />
              </div>

              <h2 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: '700', color: '#f1f5f9', textAlign: 'center' }}>
                Verify Your Identity
              </h2>
              <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#94a3b8', textAlign: 'center', lineHeight: '1.4' }}>
                {otpSession?.source === 'google_otp'
                  ? 'A verification code was sent to your registered Gmail address.'
                  : 'We sent a verification code to your registered email address.'}
              </p>

              {/* Masked email badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(56,189,248,0.3)',
                borderRadius: '8px', padding: '6px 14px',
                fontSize: '13px', fontWeight: '600', color: '#7dd3fc',
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
                      fontSize: '22px', fontWeight: '700', borderRadius: '10px',
                      background: '#0b1329',
                      border: error ? '1px solid #ef4444' : digit ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.25)',
                      color: '#f8fafc', outline: 'none',
                      boxShadow: digit ? '0 0 12px rgba(56,189,248,0.25)' : 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                      boxSizing: 'border-box',
                    }}
                  />
                ))}
              </div>

              {/* Countdown */}
              <div style={{
                textAlign: 'center', fontSize: '13px',
                color: expiresIn <= 30 ? '#f87171' : '#94a3b8',
                marginBottom: '22px', fontWeight: '500',
              }}>
                OTP expires in:{' '}
                <span style={{ fontFamily: 'monospace', fontWeight: '700', color: expiresIn <= 30 ? '#f87171' : '#f8fafc' }}>
                  {formatTimer(expiresIn)}
                </span>
              </div>

              {/* Verify Button */}
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={loading || expiresIn <= 0}
                style={{
                  width: '100%', padding: '13px 20px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: '1px solid rgba(255,255,255,0.1)', color: '#fff',
                  fontSize: '15px', fontWeight: '600',
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
                    <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
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
                  width: '100%', padding: '14px 18px', borderRadius: '12px',
                  background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(148,163,184,0.2)',
                  color: '#38bdf8',
                  fontSize: '15px', fontWeight: '600',
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
        <div style={{ marginTop: '24px', textAlign: 'center', color: '#475569', fontSize: '11px', lineHeight: '1.5' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginBottom: '4px', color: '#64748b' }}>
            <Lock size={11} color="#475569" />
            <span>Authorized personnel only</span>
          </div>
          <div>Restricted government &amp; critical sector system under IT Act Sec 70.</div>
        </div>
      </div>

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
            maxWidth: '440px', width: '100%', background: '#0f172a',
            border: '1px solid rgba(148,163,184,0.25)', borderRadius: '16px',
            padding: '26px', boxShadow: '0 20px 40px rgba(0,0,0,0.7)', position: 'relative',
          }}>
            <button
              onClick={() => setShowForgotPasswordModal(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <KeyRound size={18} color="#38bdf8" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>
                  Reset Enclave Password
                </h3>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Update local air-gapped credentials</div>
              </div>
            </div>

            {resetError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px', padding: '10px 12px', marginBottom: '14px',
                color: '#fca5a5', fontSize: '12px',
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{resetError}</span>
              </div>
            )}

            {resetSuccess && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: '8px', padding: '10px 12px', marginBottom: '14px',
                color: '#86efac', fontSize: '12px',
              }}>
                <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                <span>{resetSuccess}</span>
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                  Username / Enclave Identifier
                </label>
                <input
                  type="text"
                  value={resetUsername || username}
                  onChange={e => setResetUsername(e.target.value)}
                  placeholder="e.g. supervisor01"
                  required
                  style={{
                    width: '100%', height: '42px', padding: '0 12px', borderRadius: '8px',
                    background: '#0b1329', border: '1px solid rgba(148,163,184,0.25)',
                    color: '#f8fafc', fontSize: '13px', boxSizing: 'border-box', outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={resetShowPassword ? 'text' : 'password'}
                    value={resetNewPassword}
                    onChange={e => setResetNewPassword(e.target.value)}
                    placeholder="Enter new password (min. 6 characters)"
                    required
                    style={{
                      width: '100%', height: '42px', padding: '0 36px 0 12px', borderRadius: '8px',
                      background: '#0b1329', border: '1px solid rgba(148,163,184,0.25)',
                      color: '#f8fafc', fontSize: '13px', boxSizing: 'border-box', outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setResetShowPassword(!resetShowPassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                  >
                    {resetShowPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                  Confirm New Password
                </label>
                <input
                  type={resetShowPassword ? 'text' : 'password'}
                  value={resetConfirmPassword}
                  onChange={e => setResetConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  style={{
                    width: '100%', height: '42px', padding: '0 12px', borderRadius: '8px',
                    background: '#0b1329', border: '1px solid rgba(148,163,184,0.25)',
                    color: '#f8fafc', fontSize: '13px', boxSizing: 'border-box', outline: 'none',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                style={{
                  marginTop: '8px', width: '100%', padding: '11px', borderRadius: '8px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: '1px solid rgba(255,255,255,0.1)', color: '#fff',
                  fontSize: '14px', fontWeight: '600', cursor: resetLoading ? 'wait' : 'pointer',
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
            maxWidth: '460px', width: '100%', background: '#0f172a',
            border: '1px solid rgba(56,189,248,0.25)', borderRadius: '18px',
            padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8), 0 0 30px rgba(56,189,248,0.08)', position: 'relative',
          }}>
            <button
              onClick={() => setShowRegisterModal(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <UserPlus size={20} color="#38bdf8" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '700', color: '#f8fafc' }}>
                  Create New Account
                </h3>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Set up your security platform access</div>
              </div>
            </div>

            {regError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px', padding: '10px 12px', marginBottom: '14px',
                color: '#fca5a5', fontSize: '12px',
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{regError}</span>
              </div>
            )}

            {regSuccess && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: '8px', padding: '10px 12px', marginBottom: '14px',
                color: '#86efac', fontSize: '12px',
              }}>
                <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                <span>{regSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                  Username / Identifier
                </label>
                <input
                  type="text"
                  value={regUsername}
                  onChange={e => setRegUsername(e.target.value)}
                  placeholder="e.g. prateek_admin"
                  required
                  style={{
                    width: '100%', height: '42px', padding: '0 12px', borderRadius: '8px',
                    background: '#0b1329', border: '1px solid rgba(148,163,184,0.25)',
                    color: '#f8fafc', fontSize: '13px', boxSizing: 'border-box', outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  placeholder="e.g. prateek@cyberdefense.in"
                  required
                  style={{
                    width: '100%', height: '42px', padding: '0 12px', borderRadius: '8px',
                    background: '#0b1329', border: '1px solid rgba(148,163,184,0.25)',
                    color: '#f8fafc', fontSize: '13px', boxSizing: 'border-box', outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                    Assigned Role
                  </label>
                  <select
                    value={regRole}
                    onChange={e => setRegRole(e.target.value)}
                    style={{
                      width: '100%', height: '42px', padding: '0 10px', borderRadius: '8px',
                      background: '#0b1329', border: '1px solid rgba(148,163,184,0.25)',
                      color: '#f8fafc', fontSize: '13px', boxSizing: 'border-box', outline: 'none',
                    }}
                  >
                    <option value="SUPERVISOR">Supervisor / Lead</option>
                    <option value="ANALYST">Security Analyst</option>
                    <option value="ADMINISTRATOR">Administrator</option>
                    <option value="AUDITOR">Auditor</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                    Organization / Unit
                  </label>
                  <input
                    type="text"
                    value={regOrg}
                    onChange={e => setRegOrg(e.target.value)}
                    placeholder="CyberSec Command"
                    style={{
                      width: '100%', height: '42px', padding: '0 10px', borderRadius: '8px',
                      background: '#0b1329', border: '1px solid rgba(148,163,184,0.25)',
                      color: '#f8fafc', fontSize: '13px', boxSizing: 'border-box', outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={regShowPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      placeholder="Min. 4 chars"
                      required
                      style={{
                        width: '100%', height: '42px', padding: '0 32px 0 10px', borderRadius: '8px',
                        background: '#0b1329', border: '1px solid rgba(148,163,184,0.25)',
                        color: '#f8fafc', fontSize: '13px', boxSizing: 'border-box', outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setRegShowPassword(!regShowPassword)}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                    >
                      {regShowPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                    Confirm Password
                  </label>
                  <input
                    type={regShowPassword ? 'text' : 'password'}
                    value={regConfirmPassword}
                    onChange={e => setRegConfirmPassword(e.target.value)}
                    placeholder="Re-enter"
                    required
                    style={{
                      width: '100%', height: '42px', padding: '0 10px', borderRadius: '8px',
                      background: '#0b1329', border: '1px solid rgba(148,163,184,0.25)',
                      color: '#f8fafc', fontSize: '13px', boxSizing: 'border-box', outline: 'none',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={regLoading}
                style={{
                  marginTop: '10px', width: '100%', padding: '13px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: '1px solid rgba(255,255,255,0.15)', color: '#fff',
                  fontSize: '14px', fontWeight: '700', cursor: regLoading ? 'wait' : 'pointer',
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
            maxWidth: '440px', width: '100%', background: '#0f172a',
            border: '1px solid rgba(148,163,184,0.25)', borderRadius: '16px',
            padding: '28px', boxShadow: '0 20px 40px rgba(0,0,0,0.7)', position: 'relative',
          }}>
            <button
              onClick={() => setShowForgotUsernameModal(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <User size={18} color="#a78bfa" />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>
                Forgot Username
              </h3>
            </div>

            <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '16px' }}>
              Usernames in A.E.G.I.S. are assigned by your <strong>System Administrator</strong> during onboarding and cannot be self-retrieved through this interface.
            </p>

            <div style={{
              background: 'rgba(2,6,23,0.6)', border: '1px solid rgba(148,163,184,0.15)',
              borderRadius: '8px', padding: '12px 14px',
              fontSize: '12px', color: '#94a3b8', lineHeight: '1.5', marginBottom: '16px',
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
              borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
              fontSize: '12px', color: '#c4b5fd',
            }}>
              <strong>Demo credentials hint:</strong>{' '}
              <span style={{ fontFamily: 'monospace', color: '#e9d5ff' }}>supervisor01</span>,{' '}
              <span style={{ fontFamily: 'monospace', color: '#e9d5ff' }}>analyst01</span>,{' '}
              <span style={{ fontFamily: 'monospace', color: '#e9d5ff' }}>admin01</span>
            </div>

            <button
              onClick={() => { handleQuickFill('SUPERVISOR'); setShowForgotUsernameModal(false); }}
              style={{
                width: '100%', padding: '10px', borderRadius: '8px',
                background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)',
                color: '#c4b5fd', fontSize: '13px', fontWeight: '600', cursor: 'pointer', marginBottom: '10px',
              }}
            >
              Auto-Fill Default Supervisor Credentials
            </button>

            <button
              onClick={() => setShowForgotUsernameModal(false)}
              style={{
                width: '100%', padding: '10px', borderRadius: '8px',
                background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)',
                color: '#f8fafc', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
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
        #username-input, #password-input, #google-email-input {
          height: 48px !important;
          min-height: 44px !important;
          box-sizing: border-box !important;
          font-size: 14px !important;
          color: #f8fafc !important;
          background-color: #0b1329 !important;
        }
        #google-email-input {
          height: 44px !important;
        }

        /* Mode-select split panel hover effects */
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

        /* Responsive: stack vertically on small screens */
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
