import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listPendingMaterials, moderateMaterial } from '../api/materials.js';
import { useTenant } from '../features/tenant/TenantContext.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';

/** Scoped moderation queue — only materials in this admin's org */
export default function PendingMaterialsPage() {
  const queryClient = useQueryClient();
  const { adminScopeLabel, adminLevel } = useTenant();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['materials', 'pending'],
    queryFn: () => listPendingMaterials({ limit: 50 }),
  });

  const moderate = useMutation({
    mutationFn: ({ id, status }) =>
      moderateMaterial(id, {
        status,
        rejectionReason: status === 'rejected' ? 'Does not meet platform guidelines' : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
  });

  const items = data?.data?.items || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Pending approvals</h1>
        <p className="mt-1 text-sm text-muted">
          {adminScopeLabel
            ? `Queue for ${adminScopeLabel} (${adminLevel || 'admin'}).`
            : 'Approve or reject student uploads in your scope.'}
        </p>
      </div>

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
                to={`/materials/${item.id}`}
                className="font-display text-lg font-bold hover:text-primary"
              >
                {item.title}
              </Link>
              <p className="mt-1 text-sm text-muted">
                {item.uploader?.fullName || item.uploader?.username} · {item.type}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {[item.university?.name, item.campus?.name, item.department?.name]
                  .filter(Boolean)
                  .join(' · ')}
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
