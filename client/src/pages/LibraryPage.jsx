import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { listApprovedMaterials } from '../api/materials.js';
import { getCampuses, getDepartments, getUniversities } from '../api/taxonomy.js';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useTenant } from '../features/tenant/TenantContext.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Input from '../components/ui/Input.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import { cn } from '../utils/cn.js';

const SORTS = [
  { id: 'latest', label: 'Latest' },
  { id: 'popular', label: 'Popular' },
  { id: 'top_rated', label: 'Top rated' },
];

const TYPES = [
  { value: '', label: 'All types' },
  { value: 'notes', label: 'Notes' },
  { value: 'past_paper', label: 'Past paper' },
  { value: 'mcq', label: 'MCQs' },
  { value: 'short_questions', label: 'Short questions' },
  { value: 'long_questions', label: 'Long questions' },
  { value: 'other', label: 'Other' },
];

/** Campus library — University → Campus → optional Department filter */
export default function LibraryPage() {
  const { isAuthenticated, isAdmin } = useAuth();
  const {
    universityId: lockedUni,
    campusId: lockedCampus,
    tenantLocked,
    universityName,
    campusName,
    setGuestOrg,
    universities,
    tenantPath,
  } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();

  const qParam = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || 'latest';
  const urlUniversity = searchParams.get('university') || '';
  const urlCampus = searchParams.get('campus') || '';
  const department = searchParams.get('department') || '';
  const course = searchParams.get('course') || '';
  const subject = searchParams.get('subject') || '';
  const type = searchParams.get('type') || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const university = tenantLocked
    ? lockedUni || ''
    : urlUniversity || (!isAuthenticated && !isAdmin ? lockedUni || '' : '');
  const campus = tenantLocked
    ? lockedCampus || ''
    : urlCampus || (!isAuthenticated && !isAdmin ? lockedCampus || '' : '');

  const [qInput, setQInput] = useState(qParam);
  useEffect(() => setQInput(qParam), [qParam]);

  useEffect(() => {
    if (!tenantLocked || !lockedUni || !lockedCampus) return;
    if (urlUniversity === lockedUni && urlCampus === lockedCampus) return;
    const next = new URLSearchParams(searchParams);
    next.set('university', lockedUni);
    next.set('campus', lockedCampus);
    setSearchParams(next, { replace: true });
  }, [tenantLocked, lockedUni, lockedCampus, urlUniversity, urlCampus, searchParams, setSearchParams]);

  useEffect(() => {
    if (isAuthenticated || isAdmin) return;
    if (urlUniversity || urlCampus) {
      setGuestOrg({ universityId: urlUniversity || undefined, campusId: urlCampus || undefined });
    }
  }, [isAuthenticated, isAdmin, urlUniversity, urlCampus, setGuestOrg]);

  const needsCampus = !isAdmin && !campus;

  const { data: campusesData } = useQuery({
    queryKey: ['taxonomy', 'campuses', university],
    queryFn: () => getCampuses(university),
    enabled: Boolean(university),
  });

  const { data: departmentsData } = useQuery({
    queryKey: ['taxonomy', 'departments', campus],
    queryFn: () => getDepartments(campus),
    enabled: Boolean(campus),
  });

  const queryKey = useMemo(
    () => [
      'materials',
      'search',
      { q: qParam, sort, university, campus, department, course, subject, type, page },
    ],
    [qParam, sort, university, campus, department, course, subject, type, page],
  );

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey,
    queryFn: () =>
      listApprovedMaterials({
        q: qParam || undefined,
        sort,
        university: university || undefined,
        campus: campus || undefined,
        department: department || undefined,
        course: course || undefined,
        subject: subject || undefined,
        type: type || undefined,
        page,
        limit: 12,
      }),
    enabled: !needsCampus,
    placeholderData: (prev) => prev,
  });

  const items = data?.data?.items || [];
  const meta = data?.meta || { page: 1, pages: 1, total: 0 };
  const campuses = campusesData?.data?.items || [];
  const departments = departmentsData?.data?.items || [];

  const updateParams = (patch, { resetPage = true } = {}) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    if (resetPage) next.delete('page');
    setSearchParams(next);
  };

  const onSearchSubmit = (event) => {
    event.preventDefault();
    updateParams({ q: qInput.trim() });
  };

  const label = tenantLocked
    ? [universityName, campusName].filter(Boolean).join(' · ')
    : [universities.find((u) => u.id === university)?.name, campuses.find((c) => c.id === campus)?.name]
        .filter(Boolean)
        .join(' · ');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Library</h1>
          <p className="mt-1 text-sm text-muted">
            {tenantLocked
              ? `Campus library${label ? ` — ${label}` : ''}.`
              : 'Choose university and campus, then browse approved materials.'}
          </p>
        </div>
        {isAuthenticated ? (
          <Link to={tenantPath('/uploads/new')}>
            <Button variant="accent">Upload</Button>
          </Link>
        ) : null}
      </div>

      <form onSubmit={onSearchSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input
            label="Search"
            placeholder="Search title, description, or tags…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            disabled={needsCampus}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="primary" disabled={needsCampus}>
            Search
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {SORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={needsCampus}
            onClick={() => updateParams({ sort: s.id })}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-semibold transition',
              sort === s.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-line text-muted hover:border-primary/40 hover:text-ink',
              needsCampus && 'opacity-50',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-muted">University</span>
          <select
            className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 disabled:opacity-70"
            value={university}
            disabled={tenantLocked}
            onChange={(e) => {
              const id = e.target.value;
              if (!isAuthenticated) setGuestOrg({ universityId: id, campusId: '' });
              updateParams({ university: id, campus: '', department: '', course: '', subject: '' });
            }}
          >
            {!tenantLocked ? (
              <option value="">{isAdmin ? 'All' : 'Select…'}</option>
            ) : null}
            {universities.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-muted">Campus</span>
          <select
            className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 disabled:opacity-70"
            value={campus}
            disabled={tenantLocked || !university}
            onChange={(e) => {
              const id = e.target.value;
              if (!isAuthenticated) setGuestOrg({ universityId: university, campusId: id });
              updateParams({ campus: id, department: '', course: '', subject: '' });
            }}
          >
            {!tenantLocked ? (
              <option value="">{isAdmin ? 'All campuses' : 'Select campus…'}</option>
            ) : null}
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-muted">Department</span>
          <select
            className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5"
            value={department}
            disabled={!campus}
            onChange={(e) => updateParams({ department: e.target.value, course: '', subject: '' })}
          >
            <option value="">All</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-muted">Type</span>
          <select
            className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5"
            value={type}
            disabled={needsCampus}
            onChange={(e) => updateParams({ type: e.target.value })}
          >
            {TYPES.map((t) => (
              <option key={t.value || 'all'} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {needsCampus ? (
        <EmptyState
          title="Select university and campus"
          description="Guests pick a campus library. Students are locked to their campus at signup. Department admins approve uploads for their department only."
        />
      ) : null}

      {!needsCampus ? (
        <div className="flex items-center justify-between text-sm text-muted">
          <p>
            {meta.total || 0} result{(meta.total || 0) === 1 ? '' : 's'}
            {label ? ` · ${label}` : ''}
            {isFetching && !isLoading ? ' · updating…' : ''}
          </p>
        </div>
      ) : null}

      {!needsCampus && isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : null}

      {isError ? <p className="text-sm text-danger">{error.message}</p> : null}

      {!needsCampus && !isLoading && !items.length ? (
        <EmptyState
          title="No materials found"
          description="Try another filter, or upload notes for your department to review."
        />
      ) : null}

      {!needsCampus ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card
              key={item.id}
              className="flex flex-col gap-3 transition hover:-translate-y-0.5 hover:border-primary/30"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {item.type.replace('_', ' ')}
                </p>
                <h2 className="font-display mt-1 text-lg font-bold">{item.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-muted">
                  {item.description || 'No description'}
                </p>
                <p className="mt-2 text-xs text-muted">
                  {item.campus?.name || item.university?.name} · {item.department?.name} ·{' '}
                  {item.subject?.name}
                </p>
                <p className="mt-1 text-xs text-muted">
                  ★ {(item.stats?.ratingAvg || 0).toFixed(1)} · {item.stats?.views || 0} views ·{' '}
                  {item.stats?.downloads || 0} downloads
                </p>
              </div>
              <Link to={tenantPath(`/materials/${item.id}`)} className="mt-auto">
                <Button size="sm" variant="outline">
                  View
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      ) : null}

      {!needsCampus && meta.pages > 1 ? (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => updateParams({ page: page - 1 }, { resetPage: false })}
          >
            Previous
          </Button>
          <span className="text-sm text-muted">
            Page {meta.page} of {meta.pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= meta.pages}
            onClick={() => updateParams({ page: page + 1 }, { resetPage: false })}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
