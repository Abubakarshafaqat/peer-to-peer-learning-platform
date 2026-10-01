import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useTenant } from '../features/tenant/TenantContext.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';

const LEVEL_COPY = {
  platform: 'You can manage this university and approve materials across campuses.',
  university: 'You can approve materials for your whole university.',
  campus: 'You can approve materials for your campus only.',
  department: 'You can approve materials uploaded by your department students.',
};

const LINKS = [
  { to: '/admin/pending', title: 'Moderation queue', desc: 'Approve or reject uploads.' },
  { to: '/admin/users', title: 'Users', desc: 'Search, deactivate, change roles.' },
  { to: '/admin/invites', title: 'Invites', desc: 'Create and revoke invite codes.' },
  { to: '/admin/settings', title: 'Settings', desc: 'Branding, uploads, moderation.' },
  { to: '/admin/audit', title: 'Audit log', desc: 'Review recent admin actions.' },
];

/** Tenant admin hub */
export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { adminScopeLabel, adminLevel, tenantPath } = useTenant();
  const level = adminLevel || 'platform';

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-deep">
          {level} admin
        </p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight">Admin console</h1>
        <p className="mt-2 text-muted">
          {adminScopeLabel ? `${adminScopeLabel} · ` : ''}
          {user?.email}
        </p>
        <p className="mt-1 text-sm text-muted">{LEVEL_COPY[level] || LEVEL_COPY.platform}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((link) => (
          <Card key={link.to} className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-bold">{link.title}</h2>
            <p className="flex-1 text-sm text-muted">{link.desc}</p>
            <Link to={tenantPath(link.to)}>
              <Button size="sm" variant="accent">
                Open
              </Button>
            </Link>
          </Card>
        ))}
      </div>

      <Link to={tenantPath('/profile')}>
        <Button variant="outline">Edit profile</Button>
      </Link>
    </div>
  );
}
