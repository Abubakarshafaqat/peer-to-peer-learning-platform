import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listTenantUsers, setUserActive, setUserRole } from '../../api/tenantAdmin.js';
import { useTenant } from '../../features/tenant/TenantContext.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Input from '../../components/ui/Input.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { tenantPath } = useTenant();
  const [q, setQ] = useState('');
  const usersQ = useQuery({
    queryKey: ['tenant-admin', 'users', q],
    queryFn: () => listTenantUsers({ q: q || undefined, limit: 50 }),
  });

  const activeMut = useMutation({
    mutationFn: ({ id, isActive }) => setUserActive(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-admin', 'users'] }),
  });

  const roleMut = useMutation({
    mutationFn: ({ id, role, adminLevel }) => setUserRole(id, { role, adminLevel }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-admin', 'users'] }),
  });

  const items = usersQ.data?.data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted">Search, deactivate, and change roles in your scope.</p>
        </div>
        <a href={tenantPath('/admin')} className="text-sm text-primary">
          ← Admin home
        </a>
      </div>

      <Input
        label="Search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Name, email, username"
      />

      {usersQ.isLoading ? <Skeleton className="h-40 w-full" /> : null}
      {usersQ.isError ? <p className="text-sm text-danger">{usersQ.error.message}</p> : null}
      {!usersQ.isLoading && !items.length ? (
        <EmptyState title="No users" description="Try another search." />
      ) : null}

      <div className="space-y-2">
        {items.map((u) => (
          <Card key={u.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{u.fullName}</p>
              <p className="text-sm text-muted">
                {u.email} · {u.role}
                {u.adminLevel ? ` (${u.adminLevel})` : ''}
                {!u.isActive ? ' · inactive' : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={activeMut.isPending}
                onClick={() => activeMut.mutate({ id: u.id, isActive: !u.isActive })}
              >
                {u.isActive ? 'Deactivate' : 'Activate'}
              </Button>
              {u.role === 'student' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={roleMut.isPending}
                  onClick={() =>
                    roleMut.mutate({ id: u.id, role: 'tenantAdmin', adminLevel: 'department' })
                  }
                >
                  Make dept admin
                </Button>
              ) : u.role === 'tenantAdmin' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={roleMut.isPending}
                  onClick={() => roleMut.mutate({ id: u.id, role: 'student' })}
                >
                  Make student
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
