import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPublicTenants } from '../api/tenants.js';
import Card from '../components/ui/Card.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';

/** Shown when no subdomain / route / env slug is resolved. */
export default function ChooseUniversityPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    listPublicTenants()
      .then((res) => {
        if (!cancelled) setItems(res.data?.items || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load universities');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center gap-8 px-4 py-12">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Peer Learning</p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Choose your university
        </h1>
        <p className="mt-2 text-sm text-muted">
          Select a campus community to continue. Superadmins use{' '}
          <Link to="/platform/login" className="font-semibold text-primary underline-offset-2 hover:underline">
            platform login
          </Link>
          .
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : null}

      {error ? <p className="text-center text-sm text-danger">{error}</p> : null}

      {!loading && !error && !items.length ? (
        <EmptyState title="No universities yet" description="Ask your platform admin to create a tenant." />
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((t) => (
          <li key={t.slug}>
            <Link to={`/t/${t.slug}/`} className="block focus-visible:outline-none">
              <Card className="flex items-center gap-3 transition hover:border-primary/40 hover:shadow-sm">
                {t.logoUrl ? (
                  <img src={t.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                    {t.name?.slice(0, 1) || '?'}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-display font-bold">{t.name}</p>
                  <p className="truncate text-xs text-muted">{t.slug}</p>
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
