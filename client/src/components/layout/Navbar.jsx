import { Link, NavLink } from 'react-router-dom';
import { cn } from '../../utils/cn.js';
import Button from '../ui/Button.jsx';
import { useAuth } from '../../features/auth/AuthContext.jsx';

const publicLinks = [
  { to: '/', label: 'Home' },
  { to: '/library', label: 'Library' },
  { to: '/quizzes', label: 'Quizzes' },
];

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-ink transition hover:text-primary">
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
          <span className="font-display text-lg font-extrabold tracking-tight">Peer Learning</span>
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
              end={link.to === '/'}
            >
              {link.label}
            </NavLink>
          ))}
          {isAuthenticated ? (
            <NavLink
              to={isAdmin ? '/admin' : '/dashboard'}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:text-ink',
                  isActive && 'bg-primary/10 text-primary',
                )
              }
            >
              Dashboard
            </NavLink>
          ) : null}
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <Link to="/profile" className="hidden text-sm font-medium text-muted hover:text-ink sm:inline">
                {user?.username}
              </Link>
              <Button size="sm" variant="outline" onClick={() => logout()}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden sm:inline-flex">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link to="/register">
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
