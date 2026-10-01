import { Link } from 'react-router-dom';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';

export default function TenantUnavailablePage({ error }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-danger">Unavailable</p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight">
          University unavailable
        </h1>
        <p className="mt-2 text-sm text-muted">
          {error?.message ||
            'This university could not be found or has been suspended. Choose another or contact support.'}
        </p>
      </div>
      <Card className="flex flex-col gap-3">
        <Link to="/">
          <Button className="w-full">Choose another university</Button>
        </Link>
        <Link to="/platform/login" className="text-center text-sm text-muted hover:text-primary">
          Platform admin login
        </Link>
      </Card>
    </div>
  );
}
