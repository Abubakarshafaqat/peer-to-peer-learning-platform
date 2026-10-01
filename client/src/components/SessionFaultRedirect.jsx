import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useTenant } from '../features/tenant/TenantContext.jsx';

/** Redirect to login when session was cleared due to tenant fault. */
export default function SessionFaultRedirect() {
  const { sessionMessage, isAuthenticated } = useAuth();
  const { tenantPath } = useTenant();
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionMessage && !isAuthenticated) {
      navigate(tenantPath('/login'), { replace: true });
    }
  }, [sessionMessage, isAuthenticated, navigate, tenantPath]);

  return null;
}
