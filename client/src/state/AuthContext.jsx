import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

// Pre-configured demo profiles for 1-click hackathon mentor demos
export const DEMO_PROFILES = [
  {
    id: 'SUPERVISOR',
    username: 'supervisor01',
    email: 'supervisor@nciipc.gov.in',
    registeredEmail: 'supervisor.aegis@gmail.com',
    password: 'Admin@2026',
    name: 'S. Sengupta',
    role: 'SUPERVISOR',
    roleLabel: 'NCIIPC Chief Supervisor',
    designation: 'National Supervisory Authority',
    organization: 'NCIIPC',
    avatar: 'SS',
    badgeColor: '#15803d',
    badgeBg: '#dcfce7',
    badgeBorder: '#86efac'
  },
  {
    id: 'ANALYST',
    username: 'analyst01',
    email: 'analyst@powergrid.in',
    registeredEmail: 'analyst.aegis@gmail.com',
    password: 'Analyst@2026',
    name: 'A. Sharma',
    role: 'ANALYST',
    roleLabel: 'PowerGrid SOC Lead (CSE-07)',
    designation: 'Operational Duty Lead',
    organization: 'National Energy Systems',
    avatar: 'AS',
    badgeColor: '#b45309',
    badgeBg: '#fef3c7',
    badgeBorder: '#fde68a'
  },
  {
    id: 'ADMINISTRATOR',
    username: 'admin01',
    email: 'admin@aegis.gov.in',
    registeredEmail: 'admin.aegis@gmail.com',
    password: 'Admin@2026',
    name: 'National Admin',
    role: 'ADMINISTRATOR',
    roleLabel: 'National System Administrator',
    designation: 'Security Enclave Lead',
    organization: 'A.E.G.I.S. Command',
    avatar: 'AD',
    badgeColor: '#4f46e5',
    badgeBg: '#e0e7ff',
    badgeBorder: '#a5b4fc'
  },
  {
    id: 'AUDITOR',
    username: 'auditor01',
    email: 'auditor@cert-in.gov.in',
    registeredEmail: 'auditor.aegis@gmail.com',
    password: 'Audit@2026',
    name: 'P. Varma',
    role: 'AUDITOR',
    roleLabel: 'CERT-In Regulatory Auditor',
    designation: 'Senior Compliance Auditor',
    organization: 'CERT-In',
    avatar: 'PV',
    badgeColor: '#1d4ed8',
    badgeBg: '#dbeafe',
    badgeBorder: '#93c5fd'
  }
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('aegis_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('aegis_token') || null;
  });

  const [authModeInfo, setAuthModeInfo] = useState({
    auth_mode: 'AIR_GAPPED',
    air_gapped_mode: true,
    mail_provider: 'gmail',
    label: 'Offline / Air-Gapped Environment'
  });

  const refreshAuthMode = async () => {
    try {
      const modeData = await api.getAuthMode();
      if (modeData) {
        setAuthModeInfo(modeData);
      }
    } catch (_) {
      // Keep default
    }
  };

  useEffect(() => {
    refreshAuthMode();
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('aegis_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('aegis_user');
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('aegis_token', token);
    } else {
      localStorage.removeItem('aegis_token');
    }
  }, [token]);

  const login = async (usernameOrEmail, password, role, mode = 'offline') => {
    const data = await api.login(usernameOrEmail, password, role, mode);

    // Case 1: OTP required (Connected Email OTP Mode)
    if (data && data.status === 'OTP_REQUIRED') {
      return {
        otpRequired: true,
        masked_email: data.masked_email,
        temp_token: data.temp_token,
        cooldown_seconds: data.cooldown !== undefined ? data.cooldown : (data.cooldown_seconds !== undefined ? data.cooldown_seconds : 0),
        expires_in_seconds: data.expires_in || data.expires_in_seconds || 300,
        username: data.user_hint || usernameOrEmail,
        role: data.role,
        dev_otp_preview: data.dev_otp_preview,
        smtp_delivered: data.smtp_delivered,
      };
    }

    // Case 2: Direct session granted (Air-Gapped Mode)
    if (data && data.access_token) {
      setToken(data.access_token);
      const loggedUser = {
        ...data.user,
        avatar: (data.user.name || data.user.email).split('@')[0].substring(0, 2).toUpperCase()
      };
      setUser(loggedUser);
      return { success: true, user: loggedUser };
    }

    throw new Error('Invalid username or password');
  };

  const verifyOTP = async (username, otp, tempToken) => {
    const data = await api.verifyOTP(username, otp, tempToken);
    if (data && data.access_token) {
      setToken(data.access_token);
      const loggedUser = {
        ...data.user,
        avatar: (data.user.name || data.user.email).split('@')[0].substring(0, 2).toUpperCase()
      };
      setUser(loggedUser);
      return { success: true, user: loggedUser };
    }
    throw new Error(data?.message || 'OTP verification failed');
  };

  const resendOTP = async (username, tempToken) => {
    return await api.resendOTP(username, tempToken);
  };

  const googleLogin = async (idToken, role = null) => {
    const data = await api.googleCallback(idToken, role);
    if (data && data.access_token) {
      setToken(data.access_token);
      const loggedUser = {
        ...data.user,
        avatar: (data.user.username || data.user.email).substring(0, 2).toUpperCase(),
        authMode: 'GOOGLE_OAUTH'
      };
      setUser(loggedUser);
      return { success: true, user: loggedUser };
    }
    throw new Error('Google authentication failed. Please try again.');
  };

  const loginWithDemoAccount = async (profileId) => {
    const profile = DEMO_PROFILES.find(p => p.id === profileId) || DEMO_PROFILES[0];
    return await login(profile.username, profile.password, profile.role);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (_) {}
    setUser(null);
    setToken('');
    localStorage.removeItem('aegis_user');
    localStorage.removeItem('aegis_token');
  };

  const registerOperator = async (payload) => {
    const data = await api.register(payload);
    if (data && data.access_token) {
      setToken(data.access_token);
      const loggedUser = {
        ...data.user,
        avatar: (data.user.username || data.user.name || data.user.email).split('@')[0].substring(0, 2).toUpperCase()
      };
      setUser(loggedUser);
      return { success: true, user: loggedUser };
    }
    return { success: true, message: data?.message };
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.role === 'SUPERVISOR') return true;
    if (Array.isArray(user.permissions) && user.permissions.includes(permission)) return true;
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role || 'ANALYST',
        isAuthenticated: !!user,
        authModeInfo,
        refreshAuthMode,
        login,
        registerOperator,
        verifyOTP,
        resendOTP,
        googleLogin,
        loginWithDemoAccount,
        logout,
        hasPermission
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
