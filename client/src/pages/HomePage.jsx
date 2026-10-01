import { Link } from 'react-router-dom';
import Button from '../components/ui/Button.jsx';
import { useTenant } from '../features/tenant/TenantContext.jsx';

const marqueeItems = [
  'Punjab University',
  'NUST',
  'Past Papers',
  'Data Structures',
  'MCQs',
  'Database Systems',
  'Short Questions',
  'OOP',
  'Notes',
  'Software Design',
  'Long Questions',
  'Programming Fundamentals',
];

const platformFeatures = [
  {
    title: 'Organized library',
    body: 'Notes, past papers, and question banks sorted by university, course, and subject.',
  },
  {
    title: 'Practice quizzes',
    body: 'Exam-style MCQs with easy, medium, and hard difficulty — scored with explanations.',
  },
  {
    title: 'Peer interaction',
    body: 'Comments, likes, ratings, and Q&A so students help each other prepare.',
  },
  {
    title: 'AI Buddy & Away Mode',
    body: 'Study help when you need it, and smart auto-replies while you stay focused.',
  },
  {
    title: 'Moderated quality',
    body: 'Uploads are reviewed before they reach the library — less spam, more signal.',
  },
  {
    title: 'Personalized dashboard',
    body: 'Your uploads, recommendations, and shortcuts in one calm workspace.',
  },
];

const reasons = [
  {
    title: 'Built for exams',
    body: 'Formats students actually face — MCQs, short questions, long questions, past papers.',
  },
  {
    title: 'Distraction-free',
    body: 'No social feed noise. Just study material, practice, and peer help.',
  },
  {
    title: 'Works for every campus',
    body: 'Add universities and courses as you grow — one library, many programs.',
  },
  {
    title: 'Ready to expand',
    body: 'Chat, notifications, quizzes, and AI modules plug into the same platform.',
  },
];

export default function HomePage() {
  const { tenantPath, tenantName } = useTenant();
  return (
    <div className="overflow-x-hidden">
      {/* Hero — brand first, one composition */}
      <section className="relative isolate min-h-[calc(100vh-4.5rem)] overflow-hidden border-b border-line">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_20%,rgba(31,111,120,0.18),transparent_55%),radial-gradient(ellipse_70%_50%_at_85%_15%,rgba(212,160,84,0.16),transparent_50%),linear-gradient(165deg,var(--color-canvas),var(--color-surface))]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl animate-float-slow"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-accent/15 blur-3xl animate-float-delayed"
          aria-hidden="true"
        />

        <div className="relative mx-auto grid min-h-[calc(100vh-4.5rem)] max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div>
            <h1 className="font-display animate-rise text-5xl font-extrabold tracking-tight text-ink sm:text-6xl lg:text-7xl">
              {tenantName || 'Peer Learning'}
            </h1>
            <p className="animate-rise delay-1 mt-5 max-w-xl text-xl font-medium text-ink/90 sm:text-2xl">
              Exam prep material, as knowledge you can share.
            </p>
            <p className="animate-rise delay-2 mt-4 max-w-lg text-base text-muted sm:text-lg">
              Notes, past papers, quizzes, and peer help — organized by university, course, and
              subject in one calm space.
            </p>
            <div className="animate-rise delay-3 mt-8 flex flex-wrap gap-3">
              <Link to={tenantPath('/register')} className="transition-transform duration-300 hover:-translate-y-0.5">
                <Button variant="accent" size="lg" className="shadow-lg shadow-accent/25">
                  Get started free
                </Button>
              </Link>
              <Link to={tenantPath('/library')} className="transition-transform duration-300 hover:-translate-y-0.5">
                <Button variant="outline" size="lg">
                  Explore library
                </Button>
              </Link>
            </div>
          </div>

          {/* Visual panel — product feel, like EarningsCall API panel */}
          <div className="animate-rise delay-2 relative">
            <div className="overflow-hidden rounded-2xl border border-line bg-ink text-canvas shadow-2xl shadow-ink/20 dark:bg-[#071014]">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-danger/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/80" />
                <span className="ml-2 text-xs text-white/50">library.peerlearning</span>
              </div>
              <div className="space-y-3 p-5 font-mono text-sm leading-relaxed">
                <p className="text-mint">
                  <span className="text-white/40">GET</span> /materials?subject=databases
                </p>
                <p className="text-success">200 OK</p>
                <pre className="overflow-x-auto rounded-xl bg-white/5 p-4 text-xs text-white/80">
{`{
  "title": "ER Diagrams — Mid Past Paper",
  "type": "past_paper",
  "university": "NUST",
  "status": "approved",
  "difficulty": "medium"
}`}
                </pre>
                <p className="text-white/45">
                  + quiz · comments · ratings · recommendations
                </p>
              </div>
            </div>
            <div
              className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-primary/10 blur-2xl"
              aria-hidden="true"
            />
          </div>
        </div>
      </section>

      {/* Marquee — like company logos on EarningsCall */}
      <section className="border-b border-line bg-surface py-8" aria-label="Topics and campuses">
        <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          Built around real courses and exam formats
        </p>
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-surface to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-surface to-transparent" />
          <div className="flex w-max animate-marquee gap-3">
            {[...marqueeItems, ...marqueeItems].map((item, i) => (
              <span
                key={`${item}-${i}`}
                className="rounded-full border border-line bg-canvas px-4 py-2 text-sm font-medium text-ink/80"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* What's in the platform */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Platform</p>
          <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            What&apos;s in Peer Learning
          </h2>
          <p className="mt-3 text-muted">
            Everything students need to prepare together — from uploads to quizzes — in one API-backed
            product experience.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {platformFeatures.map((item) => (
            <article
              key={item.title}
              className="group border-t border-line pt-5 transition duration-300 hover:border-primary/50"
            >
              <h3 className="font-display text-xl font-bold text-ink group-hover:text-primary">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Why it works */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Why students use it</p>
            <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Built for exam season
              <br className="hidden sm:block" /> speed and focus
            </h2>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            {reasons.map((item) => (
              <div key={item.title} className="flex gap-4">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                <div>
                  <h3 className="font-display text-lg font-bold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(31,111,120,0.14),transparent_65%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            Start sharing. Start practicing.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Create a free student account, upload your first notes, and find material by course —
            without the noise of generic study sites.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={tenantPath('/register')}>
              <Button variant="accent" size="lg">
                Create account
              </Button>
            </Link>
            <Link to={tenantPath('/login')}>
              <Button variant="outline" size="lg">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-8 text-center text-sm text-muted">
        Peer Learning · Peer-to-Peer Learning Platform · FYP
      </footer>
    </div>
  );
}
