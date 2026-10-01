import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';
import { getCampuses, getUniversities } from '../../api/taxonomy.js';
import { getTenantBranding } from '../../api/tenants.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { resolveTenantSlug } from './resolveTenantSlug.js';
import { setPlatformMode, setTenantSlug } from './tenantSlugStore.js';
import { applyTenantTheme, clearTenantTheme } from './theme.js';

const GUEST_KEY = 'pl_guest_org';

const SaaSTenantContext = createContext(null);
const TenantContext = createContext(null);

function readGuestOrg() {
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY) || '{}');
  } catch {
    return {};
  }
}

/**
 * Resolves SaaS slug + branding. No auth dependency.
 * Sets module slug synchronously so AuthProvider refresh sends x-tenant.
 */
export function SaaSTenantProvider({ children, platform = false }) {
  const { tenantSlug: routeSlug } = useParams();

  const resolved = useMemo(() => {
    if (platform) return { slug: null, source: null };
    return resolveTenantSlug({
      hostname: typeof window !== 'undefined' ? window.location.hostname : '',
      routeSlug: routeSlug || null,
      envSlug: import.meta.env.VITE_TENANT_SLUG || null,
      isDev: Boolean(import.meta.env.DEV),
    });
  }, [platform, routeSlug]);

  const slug = resolved.slug;

  // Sync store during render so child Auth bootstrap sees the correct slug
  setPlatformMode(platform);
  setTenantSlug(platform ? null : slug);

  const prevSlugRef = useRef(slug);
  const [slugEpoch, setSlugEpoch] = useState(0);

  useEffect(() => {
    if (prevSlugRef.current !== slug) {
      prevSlugRef.current = slug;
      setSlugEpoch((n) => n + 1);
    }
  }, [slug]);

  const [branding, setBranding] = useState(null);
  const [brandingStatus, setBrandingStatus] = useState(platform ? 'ready' : slug ? 'loading' : 'need_picker');
  const [brandingError, setBrandingError] = useState(null);

  useEffect(() => {
    if (platform) {
      setBranding(null);
      setBrandingStatus('ready');
      setBrandingError(null);
      clearTenantTheme();
      return undefined;
    }
    if (!slug) {
      setBranding(null);
      setBrandingStatus('need_picker');
      setBrandingError(null);
      clearTenantTheme();
      return undefined;
    }

    let cancelled = false;
    setBrandingStatus('loading');
    setBrandingError(null);

    getTenantBranding(slug)
      .then((res) => {
        if (cancelled) return;
        const t = res.data?.tenant;
        setBranding(t || null);
        applyTenantTheme(t?.theme?.primaryColor);
        setBrandingStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setBranding(null);
        clearTenantTheme();
        setBrandingError({
          code: err.code || 'TENANT_UNAVAILABLE',
          message: err.message || 'University unavailable',
        });
        setBrandingStatus('unavailable');
      });

    return () => {
      cancelled = true;
    };
  }, [platform, slug]);

  const tenantPath = useCallback(
    (path = '/') => {
      const clean = path.startsWith('/') ? path : `/${path}`;
      if (resolved.source === 'route' && slug) {
        return `/t/${slug}${clean === '/' ? '' : clean}`;
      }
      return clean;
    },
    [resolved.source, slug],
  );

  const value = useMemo(
    () => ({
      platform,
      slug,
      slugSource: resolved.source,
      slugEpoch,
      branding,
      brandingStatus,
      brandingError,
      signupMode: branding?.signupMode || null,
      allowedDomains: branding?.allowedDomains || [],
      logoUrl: branding?.logoUrl || '',
      tenantName: branding?.name || null,
      tenantPath,
    }),
    [
      platform,
      slug,
      resolved.source,
      slugEpoch,
      branding,
      brandingStatus,
      brandingError,
      tenantPath,
    ],
  );

  return <SaaSTenantContext.Provider value={value}>{children}</SaaSTenantContext.Provider>;
}

export function useSaaSTenant() {
  const ctx = useContext(SaaSTenantContext);
  if (!ctx) throw new Error('useSaaSTenant must be used within SaaSTenantProvider');
  return ctx;
}

/**
 * Org hierarchy + merges SaaS tenant fields into useTenant().
 * Must sit inside AuthProvider + SaaSTenantProvider.
 */
export function TenantProvider({ children }) {
  const saas = useSaaSTenant();
  const { user, isAuthenticated, isAdmin, onTenantSlugChange } = useAuth();
  const prevEpoch = useRef(saas.slugEpoch);

  useEffect(() => {
    if (prevEpoch.current !== saas.slugEpoch) {
      prevEpoch.current = saas.slugEpoch;
      onTenantSlugChange?.();
    }
  }, [saas.slugEpoch, onTenantSlugChange]);

  const [guestOrg, setGuestOrgState] = useState(readGuestOrg);
  const [universities, setUniversities] = useState([]);
  const [campuses, setCampuses] = useState([]);

  useEffect(() => {
    if (saas.brandingStatus !== 'ready' || !saas.slug || saas.platform) {
      setUniversities([]);
      return;
    }
    getUniversities()
      .then((res) => setUniversities(res.data?.items || []))
      .catch(() => setUniversities([]));
  }, [saas.brandingStatus, saas.slug, saas.platform]);

  const universityId = isAdmin
    ? null
    : isAuthenticated
      ? user?.university?.id || null
      : guestOrg.universityId || null;

  const campusId = isAdmin
    ? null
    : isAuthenticated
      ? user?.campus?.id || null
      : guestOrg.campusId || null;

  const departmentId = isAuthenticated && !isAdmin ? user?.department?.id || null : null;

  useEffect(() => {
    if (!universityId || saas.brandingStatus !== 'ready') {
      setCampuses([]);
      return;
    }
    getCampuses(universityId)
      .then((res) => setCampuses(res.data?.items || []))
      .catch(() => setCampuses([]));
  }, [universityId, saas.brandingStatus]);

  const setGuestOrg = useCallback((patch) => {
    setGuestOrgState((prev) => {
      const next = { ...prev, ...patch };
      if (!next.universityId) {
        delete next.universityId;
        delete next.campusId;
      }
      if (!next.campusId) delete next.campusId;
      localStorage.setItem(GUEST_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const tenantLocked = Boolean(isAuthenticated && !isAdmin && campusId);

  const campusName =
    user?.campus?.name || campuses.find((c) => c.id === campusId)?.name || null;
  const universityName =
    saas.tenantName ||
    user?.university?.name ||
    universities.find((u) => u.id === universityId)?.name ||
    null;
  const departmentName = user?.department?.name || null;

  const adminScopeLabel = useMemo(() => {
    if (!isAdmin) return null;
    const level = user?.adminLevel || 'platform';
    if (level === 'platform') return 'University admin';
    if (level === 'university') return user?.university?.name || 'University admin';
    if (level === 'campus') return user?.campus?.name || 'Campus admin';
    if (level === 'department') return user?.department?.name || 'Department admin';
    return 'Admin';
  }, [isAdmin, user]);

  const value = useMemo(
    () => ({
      ...saas,
      universityId,
      campusId,
      departmentId,
      universityName,
      campusName,
      departmentName,
      tenantLocked,
      isPlatformAdmin: isAdmin && (user?.adminLevel || 'platform') === 'platform',
      adminLevel: user?.adminLevel || (isAdmin ? 'platform' : null),
      adminScopeLabel,
      guestOrg,
      setGuestOrg,
      universities,
      campuses,
    }),
    [
      saas,
      universityId,
      campusId,
      departmentId,
      universityName,
      campusName,
      departmentName,
      tenantLocked,
      isAdmin,
      user,
      adminScopeLabel,
      guestOrg,
      setGuestOrg,
      universities,
      campuses,
    ],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
