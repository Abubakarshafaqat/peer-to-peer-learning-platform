import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listModerationPending, moderateMaterial } from '../../api/tenantAdmin.js';
import { useTenant } from '../../features/tenant/TenantContext.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Input from '../../components/ui/Input.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';

export default function AdminModerationPage() {
  const qc = useQueryClient();
  const { adminScopeLabel, adminLevel, tenantPath } = useTenant();
  const [reason, setReason] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['tenant-admin', 'moderation'],
    queryFn: () => listModerationPending({ limit: 50 }),
  });

  const moderate = useMutation({
    mutationFn: ({ id, status }) =>
      moderateMaterial(id, {
        status,
        rejectionReason: status === 'rejected' ? reason || 'Does not meet guidelines' : undefined,
      }),
    onSuccess: () => {
      setReason('');
      qc.invalidateQueries({ queryKey: ['tenant-admin', 'moderation'] });
    },
  });

  const items = data?.data?.items || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Moderation queue</h1>
        <p className="mt-1 text-sm text-muted">
          {adminScopeLabel
            ? `Queue for ${adminScopeLabel} (${adminLevel || 'admin'}).`
            : 'Approve or reject uploads in your scope.'}
        </p>
        <a href={tenantPath('/admin')} className="mt-2 inline-block text-sm text-primary">
          ← Admin home
        </a>
      </div>

      <Input
        label="Rejection reason (used when rejecting)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />

      {isLoading ? <Skeleton className="h-24 w-full" /> : null}
      {isError ? <p className="text-sm text-danger">{error.message}</p> : null}
      {!isLoading && !items.length ? (
        <EmptyState title="Queue is empty" description="No materials waiting in your scope." />
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <Card
            key={item.id}
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <Link
                to={tenantPath(`/materials/${item.id}`)}
                className="font-display text-lg font-bold hover:text-primary"
              >
                {item.title}
              </Link>
              <p className="mt-1 text-sm text-muted">
                {item.uploader?.fullName || item.uploader?.username} · {item.type}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="accent"
                disabled={moderate.isPending}
                onClick={() => moderate.mutate({ id: item.id, status: 'approved' })}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={moderate.isPending}
                onClick={() => moderate.mutate({ id: item.id, status: 'rejected' })}
              >
                Reject
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
