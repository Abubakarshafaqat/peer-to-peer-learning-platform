import { Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useSaaSTenant } from '../features/tenant/TenantContext.jsx';
import ChooseUniversityPage from '../pages/ChooseUniversityPage.jsx';
import TenantUnavailablePage from '../pages/TenantUnavailablePage.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import EmailVerifyBanner from '../components/EmailVerifyBanner.jsx';
import SessionFaultRedirect from '../components/SessionFaultRedirect.jsx';

/** Gates tenant app: picker ’ unavailable ’ ready. */
export default function TenantGate() {
  const { brandingStatus, brandingError } = useSaaSTenant();
  const { bootstrapping } = useAuth();

  if (brandingStatus === 'need_picker') {
    return <ChooseUniversityPage />;
  }

  if (brandingStatus === 'loading' || bootstrapping) {
    return (
      <div className="mx-auto max-w-md space-y-3 px-4 py-16">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (brandingStatus === 'unavailable') {
    return <TenantUnavailablePage error={brandingError} />;
  }

  return (
    <>
      <SessionFaultRedirect />
      <EmailVerifyBanner />
      <Outlet />
    </>
  );
}
