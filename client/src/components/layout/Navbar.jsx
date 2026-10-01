import { Link, NavLink } from 'react-router-dom';
import { cn } from '../../utils/cn.js';
import Button from '../ui/Button.jsx';
import Avatar from '../ui/Avatar.jsx';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { useTenant } from '../../features/tenant/TenantContext.jsx';
import { useTheme } from '../../features/theme/ThemeContext.jsx';

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const {
    campusName,
    universityName,
    adminScopeLabel,
    tenantName,
    logoUrl,
    tenantPath,
  } = useTenant();
  const { isDark, toggleTheme } = useTheme();

  const brand = tenantName || 'Peer Learning';
  const scopeBadge = isAdmin
    ? adminScopeLabel
    : [universityName, campusName].filter(Boolean).join(' · ') || null;

  const publicLinks = [
    { to: tenantPath('/'), label: 'Home' },
    { to: tenantPath('/library'), label: 'Library' },
    { to: tenantPath('/quizzes'), label: 'Quizzes' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to={tenantPath('/')} className="flex items-center gap-2 text-ink transition hover:text-primary">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-9 w-9 rounded-xl object-cover" />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none" aria-hidden="true">
                <path
                  d="M16 3L28 10.5V21.5L16 29L4 21.5V10.5L16 3Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path d="M16 11L22 14.5V21.5L16 25L10 21.5V14.5L16 11Z" fill="currentColor" />
              </svg>
            </span>
          )}
          <span className="font-display text-lg font-extrabold tracking-tight">{brand}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {publicLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:text-ink',
                  isActive && 'bg-primary/10 text-primary',
                )
              }
              end={link.label === 'Home'}
            >
              {link.label}
            </NavLink>
          ))}
          {isAuthenticated ? (
            <>
              <NavLink
                to={tenantPath('/uploads')}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:text-ink',
                    isActive && 'bg-primary/10 text-primary',
                  )
                }
              >
                My uploads
              </NavLink>
              <NavLink
                to={isAdmin ? tenantPath('/admin') : tenantPath('/dashboard')}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:text-ink',
                    isActive && 'bg-primary/10 text-primary',
                  )
                }
              >
                Dashboard
              </NavLink>
            </>
          ) : null}
        </nav>

        <div className="flex items-center gap-2">
          {scopeBadge ? (
            <span
              className="hidden max-w-[12rem] truncate rounded-lg border border-line px-2 py-1 text-xs font-semibold text-muted sm:inline"
              title={scopeBadge}
            >
              {scopeBadge}
            </span>
          ) : null}

          <Button
            size="sm"
            variant="ghost"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
            title={isDark ? 'Light mode' : 'Dark mode'}
            className="!px-2.5"
          >
            {isDark ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <path
                  d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </Button>

          {isAuthenticated ? (
            <>
              <Link to={tenantPath('/profile')} className="flex items-center gap-2">
                <Avatar user={user} size="sm" />
                <span className="hidden text-sm font-medium text-muted hover:text-ink sm:inline">
                  {user?.username}
                </span>
              </Link>
              <Button size="sm" variant="outline" onClick={() => logout()}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link to={tenantPath('/login')} className="hidden sm:inline-flex">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link to={tenantPath('/register')}>
                <Button size="sm" variant="accent">
                  Get started
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
