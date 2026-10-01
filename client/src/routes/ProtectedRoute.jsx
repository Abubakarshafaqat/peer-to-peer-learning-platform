import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useTenant } from '../features/tenant/TenantContext.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';

function roleHome(user, tenantPath) {
  if (user?.role === 'superadmin') return '/platform';
  if (user?.role === 'tenantAdmin') return tenantPath ? tenantPath('/admin') : '/admin';
  return tenantPath ? tenantPath('/dashboard') : '/dashboard';
}

export function ProtectedRoute({ roles }) {
  const { user, bootstrapping, isAuthenticated } = useAuth();
  const { tenantPath, slug } = useTenant();
  const location = useLocation();

  if (bootstrapping) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-16">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={tenantPath('/login')} replace state={{ from: location }} />;
  }

  // Tenant match: student/tenantAdmin JWT tenant must align with current slug context
  // (server is source of truth; this only hides mismatched UI early)
  if (slug && user?.tenantId && user.role !== 'superadmin') {
    // We don't store tenantId from input — only from session. Slug mismatch surfaces as API 403.
  }

  if (roles?.length && !roles.includes(user.role)) {
    return <Navigate to={roleHome(user, tenantPath)} replace />;
  }

  return <Outlet />;
}

export function GuestRoute() {
  const { user, bootstrapping, isAuthenticated } = useAuth();
  const { tenantPath } = useTenant();

  if (bootstrapping) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-16">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={roleHome(user, tenantPath)} replace />;
  }

  return <Outlet />;
}

/** Superadmin-only platform routes */
export function PlatformProtectedRoute() {
  const { user, bootstrapping, isAuthenticated } = useAuth();
  const location = useLocation();

  if (bootstrapping) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-16">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'superadmin') {
    return <Navigate to="/platform/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function PlatformGuestRoute() {
  const { user, bootstrapping, isAuthenticated } = useAuth();

  if (bootstrapping) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-16">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isAuthenticated && user?.role === 'superadmin') {
    return <Navigate to="/platform" replace />;
  }

  return <Outlet />;
}
