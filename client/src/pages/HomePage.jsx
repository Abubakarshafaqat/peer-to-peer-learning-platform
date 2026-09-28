import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getHealth } from '../api/health.js';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';

export default function HomePage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
  });

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-surface px-6 py-12 sm:px-10 sm:py-16">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-accent/15 blur-3xl"
          aria-hidden="true"
        />

        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Distraction-free exam prep
        </p>
        <h1 className="font-display mt-3 max-w-2xl text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          Peer Learning
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted sm:text-lg">
          Share notes, past papers, and practice quizzes with peers — organized by university,
          course, and subject.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/login">
            <Button variant="accent" size="lg">
              Create account
            </Button>
          </Link>
          <Link to="/library">
            <Button variant="outline" size="lg">
              Browse library
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { title: 'Study materials', body: 'Notes, past papers, MCQs, and more — moderated for quality.' },
          { title: 'Practice quizzes', body: 'Pick difficulty, subject, and get scored with explanations.' },
          { title: 'Peer help', body: 'Comments, Q&A, chat, and an AI Buddy when you need a nudge.' },
        ].map((item) => (
          <Card key={item.title}>
            <h2 className="font-display text-lg font-bold">{item.title}</h2>
            <p className="mt-2 text-sm text-muted">{item.body}</p>
          </Card>
        ))}
      </section>

      <Card>
        <h2 className="font-display text-lg font-bold">API status</h2>
        <p className="mt-1 text-sm text-muted">Phase 0 health check against the Express server.</p>
        <div className="mt-4">
          {isLoading ? <Skeleton className="h-10 w-full max-w-md" /> : null}
          {isError ? (
            <p className="text-sm text-danger">
              Cannot reach API — is the server running? ({error.message})
            </p>
          ) : null}
          {data?.success ? (
            <p className="text-sm text-success">
              {data.message}: {data.data?.database} · uptime{' '}
              {Math.round(data.data?.uptime ?? 0)}s
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
