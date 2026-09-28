import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';

/** // SRS-105..113 Admin dashboard shell */
export default function AdminDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-deep">Admin</p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight">Moderation hub</h1>
        <p className="mt-2 text-muted">Signed in as {user?.email}. Full moderation tools arrive in Phase 5.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { title: 'Pending approvals', body: 'Review uploaded materials.' },
          { title: 'Open reports', body: 'Handle content reports.' },
          { title: 'Users', body: 'Search and manage accounts.' },
        ].map((item) => (
          <Card key={item.title}>
            <h2 className="font-display text-lg font-bold">{item.title}</h2>
            <p className="mt-2 text-sm text-muted">{item.body}</p>
            <p className="mt-4 text-xs font-medium text-muted">Coming in Phase 5</p>
          </Card>
        ))}
      </div>

      <Link to="/profile">
        <Button variant="outline">Edit profile</Button>
      </Link>
    </div>
  );
}
