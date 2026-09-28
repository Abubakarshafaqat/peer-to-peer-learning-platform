import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';

/** // SRS-114..123 Student dashboard shell */
export default function StudentDashboardPage() {
  const { user } = useAuth();

  const links = [
    { to: '/library', title: 'Library', body: 'Browse approved notes and past papers.' },
    { to: '/quizzes', title: 'Quizzes', body: 'Practice with difficulty levels.' },
    { to: '/profile', title: 'Profile', body: 'Update your details and password.' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Student</p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight">
          Welcome, {user?.fullName?.split(' ')[0] || user?.username}
        </h1>
        <p className="mt-2 text-muted">Your personalized dashboard will grow in later phases.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {links.map((item) => (
          <Card key={item.to} className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-bold">{item.title}</h2>
            <p className="flex-1 text-sm text-muted">{item.body}</p>
            <Link to={item.to}>
              <Button variant="outline" size="sm">
                Open
              </Button>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
