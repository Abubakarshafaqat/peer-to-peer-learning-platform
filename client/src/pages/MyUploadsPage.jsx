import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { deleteMaterial, listMyMaterials } from '../api/materials.js';
import { useTenant } from '../features/tenant/TenantContext.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';

const statusColor = {
  pending: 'text-warning',
  approved: 'text-success',
  rejected: 'text-danger',
};

/** // SRS-30..53 My uploads */
export default function MyUploadsPage() {
  const queryClient = useQueryClient();
  const { tenantPath } = useTenant();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['materials', 'mine'],
    queryFn: () => listMyMaterials({ limit: 50 }),
  });

  const remove = useMutation({
    mutationFn: (id) => deleteMaterial(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['materials', 'mine'] }),
  });

  const items = data?.data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">My uploads</h1>
          <p className="mt-1 text-sm text-muted">Track approval status for your materials.</p>
        </div>
        <Link to={tenantPath('/uploads/new')}>
          <Button variant="accent">Upload new</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : null}

      {isError ? <p className="text-sm text-danger">{error.message}</p> : null}

      {!isLoading && !items.length ? (
        <EmptyState
          title="No uploads yet"
          description="Share notes or past papers with your peers."
          action={
            <Link to={tenantPath('/uploads/new')}>
              <Button variant="accent">Upload material</Button>
            </Link>
          }
        />
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link to={tenantPath(`/materials/${item.id}`)} className="font-display text-lg font-bold hover:text-primary">
                {item.title}
              </Link>
              <p className="mt-1 text-sm text-muted">
                {item.type.replace('_', ' ')} ·{' '}
                <span className={statusColor[item.status] || 'text-muted'}>{item.status}</span>
                {item.rejectionReason ? ` — ${item.rejectionReason}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <Link to={tenantPath(`/materials/${item.id}`)}>
                <Button size="sm" variant="outline">
                  Open
                </Button>
              </Link>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (window.confirm('Delete this material?')) remove.mutate(item.id);
                }}
              >
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
