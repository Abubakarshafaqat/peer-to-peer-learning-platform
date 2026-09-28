import { Link } from 'react-router-dom';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';

/** Auth UI shell — full register/login forms in Phase 1 (SRS-01..29). */
export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Welcome</p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight">Peer Learning</h1>
        <p className="mt-2 text-sm text-muted">Sign in arrives in Phase 1. Scaffold only for now.</p>
      </div>
      <Card className="space-y-4">
        <p className="text-sm text-muted">
          Registration always creates a <strong>student</strong> account. Admins are seeded or
          promoted — never self-selected.
        </p>
        <Link to="/">
          <Button variant="outline" className="w-full">
            Back to home
          </Button>
        </Link>
      </Card>
    </div>
  );
}
