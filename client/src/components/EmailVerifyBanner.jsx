import { useState } from 'react';
import { resendVerification } from '../api/auth.js';
import { useAuth } from '../features/auth/AuthContext.jsx';

/** Banner for logged-in students who have not verified email. */
export default function EmailVerifyBanner() {
  const { user, isAuthenticated, isAdmin, isSuperadmin, refreshUser } = useAuth();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isAuthenticated || isAdmin || isSuperadmin || user?.emailVerified) return null;

  const onResend = async () => {
    setBusy(true);
    setMsg('');
    try {
      await resendVerification();
      setMsg('Verification email sent (check inbox or API console in development).');
      await refreshUser().catch(() => {});
    } catch (err) {
      setMsg(err.message || 'Could not resend');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-ink" role="status">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p>
          Verify your email (<strong>{user.email}</strong>) to upload materials.
          {msg ? <span className="ml-2 text-muted">{msg}</span> : null}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={onResend}
          className="rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-primary shadow-sm hover:bg-canvas disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Resend verification'}
        </button>
      </div>
    </div>
  );
}
