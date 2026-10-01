import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../api/auth.js';
import { useTenant } from '../features/tenant/TenantContext.jsx';
import Card from '../components/ui/Card.jsx';

/** Completes domain-signup verification from the emailed link. */
export default function VerifyEmailPage() {
  const { tenantPath } = useTenant();
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  const token = params.get('token') || '';
  const [status, setStatus] = useState(email && token ? 'loading' : 'missing');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!email || !token) return;
    let cancelled = false;
    verifyEmail({ email, token })
      .then(() => {
        if (!cancelled) {
          setStatus('ok');
          setMessage('Email verified — you can upload materials now.');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus('error');
          setMessage(err.message || 'Verification failed');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [email, token]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Account</p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight">Verify email</h1>
      </div>
      <Card>
        {status === 'loading' ? <p className="text-sm text-muted">Confirming your email…</p> : null}
        {status === 'missing' ? (
          <p className="text-sm text-danger">
            This link is missing email or token. Check your inbox (or the API console in development).
          </p>
        ) : null}
        {status === 'ok' ? <p className="text-sm text-success">{message}</p> : null}
        {status === 'error' ? <p className="text-sm text-danger">{message}</p> : null}
        <div className="mt-4">
          <Link
            to={tenantPath('/login')}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Continue to sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
