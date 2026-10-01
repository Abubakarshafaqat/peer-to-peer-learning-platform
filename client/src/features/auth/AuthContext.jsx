import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as authApi from '../../api/auth.js';
import * as platformApi from '../../api/platform.js';
import {
  clearAccessToken,
  setAccessToken,
  setAuthClearedHandler,
  setTenantFaultHandler,
} from '../../api/client.js';
import { clearAppCaches } from '../../lib/queryClient.js';
import { getTenantSlug, isPlatformMode } from '../tenant/tenantSlugStore.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [sessionMessage, setSessionMessage] = useState('');
  const userRef = useRef(null);
  userRef.current = user;

  const applySession = useCallback((payload) => {
    if (payload?.accessToken) setAccessToken(payload.accessToken);
    if (payload?.user) setUser(payload.user);
  }, []);

  const clearSession = useCallback(({ message } = {}) => {
    clearAccessToken();
    setUser(null);
    clearAppCaches();
    if (message) setSessionMessage(message);
  }, []);

  useEffect(() => {
    setAuthClearedHandler(() => clearSession());
    setTenantFaultHandler(({ message }) => {
      clearSession({ message: message || 'This university session is no longer valid. Please sign in again.' });
    });
    return () => {
      setAuthClearedHandler(null);
      setTenantFaultHandler(null);
    };
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isPlatformMode()) {
          const res = await platformApi.platformRefresh();
          if (!cancelled) applySession(res.data);
        } else if (getTenantSlug()) {
          const res = await authApi.refresh();
          if (!cancelled) applySession(res.data);
        } else if (!cancelled) {
          clearAccessToken();
          setUser(null);
        }
      } catch {
        if (!cancelled) {
          clearAccessToken();
          setUser(null);
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const login = useCallback(
    async (credentials) => {
      const res = await authApi.login(credentials);
      applySession(res.data);
      setSessionMessage('');
      return res.data.user;
    },
    [applySession],
  );

  const platformLogin = useCallback(
    async (credentials) => {
      const res = await platformApi.platformLogin(credentials);
      applySession(res.data);
      setSessionMessage('');
      return res.data.user;
    },
    [applySession],
  );

  const register = useCallback(async (payload) => {
    await authApi.register(payload);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (isPlatformMode()) await platformApi.platformLogout();
      else await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    const res = isPlatformMode() ? await platformApi.platformMe() : await authApi.getMe();
    setUser(res.data.user);
    return res.data.user;
  }, []);

  /** Call when SaaS tenant slug changes — wipe session so data never leaks across tenants. */
  const onTenantSlugChange = useCallback(() => {
    if (userRef.current) {
      clearSession({ message: 'Signed out because the university changed.' });
    } else {
      clearAppCaches();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      bootstrapping,
      sessionMessage,
      clearSessionMessage: () => setSessionMessage(''),
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'tenantAdmin',
      isSuperadmin: user?.role === 'superadmin',
      adminLevel: user?.role === 'tenantAdmin' ? user?.adminLevel || null : null,
      tenantId: user?.tenantId || null,
      login,
      platformLogin,
      register,
      logout,
      refreshUser,
      setUser,
      clearSession,
      onTenantSlugChange,
    }),
    [
      user,
      bootstrapping,
      sessionMessage,
      login,
      platformLogin,
      register,
      logout,
      refreshUser,
      clearSession,
      onTenantSlugChange,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
