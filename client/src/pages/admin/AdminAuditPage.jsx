import { useQuery } from '@tanstack/react-query';
import { listTenantAudit } from '../../api/tenantAdmin.js';
import { useTenant } from '../../features/tenant/TenantContext.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';

export default function AdminAuditPage() {
  const { tenantPath } = useTenant();
  const q = useQuery({
    queryKey: ['tenant-admin', 'audit'],
    queryFn: () => listTenantAudit({ limit: 50 }),
  });
  const items = q.data?.data?.items || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-muted">Recent admin actions in this university.</p>
        <a href={tenantPath('/admin')} className="mt-2 inline-block text-sm text-primary">
          ← Admin home
        </a>
      </div>

      {q.isLoading ? <Skeleton className="h-40 w-full" /> : null}
      {q.isError ? <p className="text-sm text-danger">{q.error.message}</p> : null}
      {!q.isLoading && !items.length ? (
        <EmptyState title="No events" description="Actions will appear here." />
      ) : null}

      <ul className="space-y-2">
        {items.map((a) => (
          <Card key={a.id}>
            <p className="font-medium">
              {a.action} <span className="text-muted">· {a.role}</span>
            </p>
            <p className="text-xs text-muted">{a.createdAt}</p>
            {a.target ? (
              <p className="mt-1 text-xs text-muted">Target: {JSON.stringify(a.target)}</p>
            ) : null}
          </Card>
        ))}
      </ul>
    </div>
  );
}
