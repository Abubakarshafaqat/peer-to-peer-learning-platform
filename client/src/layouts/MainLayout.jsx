import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/layout/Navbar.jsx';
import { useTenant } from '../features/tenant/TenantContext.jsx';

export default function MainLayout() {
  const { pathname } = useLocation();
  const { tenantName, tenantPath } = useTenant();
  const homePath = tenantPath('/');
  const isLanding =
    pathname === homePath ||
    pathname === '/' ||
    /^\/t\/[^/]+\/?$/.test(pathname);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Navbar />
      <main
        className={
          isLanding
            ? 'flex-1'
            : 'mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6'
        }
      >
        <Outlet />
      </main>
      {!isLanding ? (
        <footer className="border-t border-line py-6 text-center text-sm text-muted">
          {tenantName || 'Peer-to-Peer Learning Platform'} · FYP
        </footer>
      ) : null}
    </div>
  );
}
