import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createInvite, listInvites, revokeInvite } from '../../api/invites.js';
import { useTenant } from '../../features/tenant/TenantContext.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Input from '../../components/ui/Input.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';

export default function AdminInvitesPage() {
  const qc = useQueryClient();
  const { tenantPath } = useTenant();
  const [maxUses, setMaxUses] = useState(1);
  const [plainCode, setPlainCode] = useState('');

  const listQ = useQuery({
    queryKey: ['invites'],
    queryFn: () => listInvites({ includeRevoked: 'true' }),
  });

  const createMut = useMutation({
    mutationFn: () => createInvite({ maxUses: Number(maxUses) || 1 }),
    onSuccess: (res) => {
      setPlainCode(res.data?.code || '');
      qc.invalidateQueries({ queryKey: ['invites'] });
    },
  });

  const revokeMut = useMutation({
    mutationFn: (id) => revokeInvite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  });

  const items = listQ.data?.data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Invites</h1>
          <p className="mt-1 text-sm text-muted">Create codes, copy once, revoke when needed.</p>
        </div>
        <a href={tenantPath('/admin')} className="text-sm text-primary">
          ← Admin home
        </a>
      </div>

      <Card className="space-y-3">
        <Input
          label="Max uses"
          type="number"
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
        />
        <Button disabled={createMut.isPending} onClick={() => createMut.mutate()}>
          {createMut.isPending ? 'Creating…' : 'Create invite'}
        </Button>
        {createMut.isError ? <p className="text-sm text-danger">{createMut.error.message}</p> : null}
        {plainCode ? (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-semibold text-muted">Copy this code now — it won’t be shown again</p>
            <p className="mt-1 font-mono text-lg font-bold">{plainCode}</p>
            <Button
              size="sm"
              className="mt-2"
              variant="outline"
              onClick={() => navigator.clipboard?.writeText(plainCode)}
            >
              Copy
            </Button>
          </div>
        ) : null}
      </Card>

      {listQ.isLoading ? <Skeleton className="h-32 w-full" /> : null}
      {!listQ.isLoading && !items.length ? (
        <EmptyState title="No invites yet" description="Create one above." />
      ) : null}

      <ul className="space-y-2">
        {items.map((inv) => (
          <Card key={inv.id} className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <p>
                Uses {inv.usedCount}/{inv.maxUses}
                {inv.revokedAt ? ' · revoked' : ''}
              </p>
              <p className="text-xs text-muted">
                {inv.expiresAt ? `Expires ${inv.expiresAt}` : 'No expiry'} · {inv.createdAt}
              </p>
            </div>
            {!inv.revokedAt ? (
              <Button size="sm" variant="outline" onClick={() => revokeMut.mutate(inv.id)}>
                Revoke
              </Button>
            ) : null}
          </Card>
        ))}
      </ul>
    </div>
  );
}
