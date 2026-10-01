import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import {
  createPlatformTenant,
  deletePlatformTenant,
  getPlatformTenantAudit,
  getPlatformTenantStats,
  listPlatformTenants,
  platformStats,
  setPlatformTenantStatus,
} from '../../api/platform.js';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Input from '../../components/ui/Input.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';

function formatBytes(n) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
}

export default function PlatformDashboardPage() {
  const { logout, user } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    adminEmail: '',
    adminName: '',
  });
  const [createResult, setCreateResult] = useState(null);
  const [formError, setFormError] = useState('');

  const statsQ = useQuery({ queryKey: ['platform', 'stats'], queryFn: platformStats });
  const tenantsQ = useQuery({
    queryKey: ['platform', 'tenants'],
    queryFn: () => listPlatformTenants({ includeDeleted: 'true' }),
  });
  const detailStatsQ = useQuery({
    queryKey: ['platform', 'tenant-stats', selectedId],
    queryFn: () => getPlatformTenantStats(selectedId),
    enabled: Boolean(selectedId),
  });
  const auditQ = useQuery({
    queryKey: ['platform', 'tenant-audit', selectedId],
    queryFn: () => getPlatformTenantAudit(selectedId, { limit: 20 }),
    enabled: Boolean(selectedId),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createPlatformTenant({
        name: form.name,
        slug: form.slug,
        firstAdmin: form.adminEmail
          ? { email: form.adminEmail, fullName: form.adminName || form.adminEmail.split('@')[0] }
          : undefined,
      }),
    onSuccess: (res) => {
      setCreateResult(res.data);
      setCreateOpen(false);
      setForm({ name: '', slug: '', adminEmail: '', adminName: '' });
      qc.invalidateQueries({ queryKey: ['platform'] });
    },
    onError: (err) => setFormError(err.message),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }) => setPlatformTenantStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => deletePlatformTenant(id),
    onSuccess: () => {
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ['platform'] });
    },
  });

  const tenants = tenantsQ.data?.data?.items || [];
  const stats = statsQ.data?.data;
  const storageByTenant = Object.fromEntries(
    (stats?.byTenant || []).map((r) => [r.tenantId, r]),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Platform</p>
          <h1 className="font-display mt-1 text-3xl font-extrabold tracking-tight">Tenants</h1>
          <p className="mt-1 text-sm text-muted">{user?.email}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="accent" onClick={() => setCreateOpen((v) => !v)}>
            Create tenant
          </Button>
          <Button size="sm" variant="outline" onClick={() => logout()}>
            Sign out
          </Button>
        </div>
      </div>

      {statsQ.isLoading ? <Skeleton className="h-20 w-full" /> : null}
      {stats ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <p className="text-xs text-muted">Tenants</p>
            <p className="font-display text-2xl font-bold">{stats.tenants}</p>
          </Card>
          <Card>
            <p className="text-xs text-muted">Users</p>
            <p className="font-display text-2xl font-bold">{stats.users}</p>
          </Card>
          <Card>
            <p className="text-xs text-muted">Materials</p>
            <p className="font-display text-2xl font-bold">{stats.materials}</p>
          </Card>
        </div>
      ) : null}

      {createResult?.firstAdmin?.setupUrl ? (
        <Card className="border-primary/30 bg-primary/5">
          <p className="text-sm font-semibold">First admin created</p>
          <p className="mt-1 text-sm text-muted">
            Share this one-time setup link with {createResult.firstAdmin.email} (shown once):
          </p>
          <p className="mt-2 break-all rounded-lg bg-surface p-2 text-xs">{createResult.firstAdmin.setupUrl}</p>
          <Button size="sm" className="mt-3" variant="outline" onClick={() => setCreateResult(null)}>
            Dismiss
          </Button>
        </Card>
      ) : null}

      {createOpen ? (
        <Card className="space-y-3">
          <h2 className="font-display text-lg font-bold">New university</h2>
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
          <Input label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
          <Input
            label="First admin email (optional)"
            value={form.adminEmail}
            onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
          />
          <Input
            label="First admin name"
            value={form.adminName}
            onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))}
          />
          <Button
            disabled={createMut.isPending || !form.name || !form.slug}
            onClick={() => {
              setFormError('');
              createMut.mutate();
            }}
          >
            {createMut.isPending ? 'Creating…' : 'Create'}
          </Button>
        </Card>
      ) : null}

      {tenantsQ.isLoading ? <Skeleton className="h-40 w-full" /> : null}
      {tenantsQ.isError ? <p className="text-sm text-danger">{tenantsQ.error.message}</p> : null}
      {!tenantsQ.isLoading && !tenants.length ? (
        <EmptyState title="No tenants" description="Create the first university above." />
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Storage</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => {
              const st = storageByTenant[t.id];
              return (
                <tr key={t.id} className="border-t border-line">
                  <td className="px-3 py-2 font-medium">
                    <button type="button" className="text-left hover:text-primary" onClick={() => setSelectedId(t.id)}>
                      {t.name}
                    </button>
                    {t.deletedAt ? <span className="ml-2 text-xs text-danger">deleted</span> : null}
                  </td>
                  <td className="px-3 py-2 text-muted">{t.slug}</td>
                  <td className="px-3 py-2">{t.status}</td>
                  <td className="px-3 py-2 text-muted">
                    {formatBytes(st?.storageUsedBytes)} · {st?.materialCount ?? '—'} mats
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Link to={`/t/${t.slug}/`} className="text-xs font-semibold text-primary">
                        Open
                      </Link>
                      {!t.deletedAt ? (
                        <>
                          <button
                            type="button"
                            className="text-xs font-semibold text-muted hover:text-ink"
                            onClick={() =>
                              statusMut.mutate({
                                id: t.id,
                                status: t.status === 'active' ? 'suspended' : 'active',
                              })
                            }
                          >
                            {t.status === 'active' ? 'Suspend' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            className="text-xs font-semibold text-danger"
                            onClick={() => {
                              if (window.confirm(`Soft-delete tenant “${t.name}”?`)) {
                                deleteMut.mutate(t.id);
                              }
                            }}
                          >
                            Delete
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedId ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="font-display text-lg font-bold">Tenant stats</h2>
            {detailStatsQ.isLoading ? <Skeleton className="mt-3 h-24 w-full" /> : null}
            {detailStatsQ.data?.data?.stats ? (
              <ul className="mt-3 space-y-1 text-sm text-muted">
                <li>Slug: {detailStatsQ.data.data.stats.slug}</li>
                <li>Users: {detailStatsQ.data.data.stats.userCount}</li>
                <li>Materials: {detailStatsQ.data.data.stats.materialCount}</li>
                <li>Storage: {formatBytes(detailStatsQ.data.data.stats.storageUsedBytes)}</li>
                <li>Signups (30d): {detailStatsQ.data.data.stats.signupsLast30Days}</li>
              </ul>
            ) : null}
          </Card>
          <Card>
            <h2 className="font-display text-lg font-bold">Audit log</h2>
            {auditQ.isLoading ? <Skeleton className="mt-3 h-24 w-full" /> : null}
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
              {(auditQ.data?.data?.items || []).map((a) => (
                <li key={a.id} className="border-b border-line pb-2">
                  <span className="font-medium">{a.action}</span>
                  <span className="text-muted"> · {a.role}</span>
                  <p className="text-xs text-muted">{a.createdAt}</p>
                </li>
              ))}
              {!auditQ.isLoading && !(auditQ.data?.data?.items || []).length ? (
                <li className="text-muted">No audit events.</li>
              ) : null}
            </ul>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
