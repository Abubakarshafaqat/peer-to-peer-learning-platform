import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useTenant } from '../features/tenant/TenantContext.jsx';
import { getCampuses, getDepartments, getUniversities } from '../api/taxonomy.js';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Input from '../components/ui/Input.jsx';

function buildSchema(signupMode) {
  const needsInvite = signupMode === 'invite' || signupMode === 'both';
  return z
    .object({
      fullName: z.string().min(2, 'Enter your full name'),
      username: z
        .string()
        .min(3)
        .max(32)
        .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, underscores only'),
      email: z.string().email(),
      phone: z.string().optional(),
      inviteCode: needsInvite
        ? signupMode === 'invite'
          ? z.string().min(1, 'Invite code is required')
          : z.string().optional()
        : z.string().optional(),
      university: z.string().min(1, 'Select your university'),
      campus: z.string().min(1, 'Select your campus'),
      department: z.string().min(1, 'Select your department'),
      password: z
        .string()
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, '8+ chars with upper, lower, and a number'),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    });
}

/** Per-tenant register — UI follows signupMode. */
export default function RegisterPage() {
  const { register: registerUser, login } = useAuth();
  const { tenantName, logoUrl, tenantPath, signupMode, allowedDomains } = useTenant();
  const navigate = useNavigate();
  const [formError, setFormError] = useState('');
  const [universities, setUniversities] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [departments, setDepartments] = useState([]);

  const schema = useMemo(() => buildSchema(signupMode || 'domain'), [signupMode]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const universityId = watch('university');
  const campusId = watch('campus');

  useEffect(() => {
    getUniversities()
      .then((res) => setUniversities(res.data?.items || []))
      .catch(() => setUniversities([]));
  }, []);

  useEffect(() => {
    if (!universityId) {
      setCampuses([]);
      setDepartments([]);
      setValue('campus', '');
      setValue('department', '');
      return;
    }
    getCampuses(universityId)
      .then((res) => setCampuses(res.data?.items || []))
      .catch(() => setCampuses([]));
    setValue('campus', '');
    setValue('department', '');
  }, [universityId, setValue]);

  useEffect(() => {
    if (!campusId) {
      setDepartments([]);
      setValue('department', '');
      return;
    }
    getDepartments(campusId)
      .then((res) => setDepartments(res.data?.items || []))
      .catch(() => setDepartments([]));
    setValue('department', '');
  }, [campusId, setValue]);

  const onSubmit = async (values) => {
    setFormError('');
    try {
      const { confirmPassword: _, inviteCode, ...rest } = values;
      const payload = { ...rest };
      if (inviteCode?.trim()) payload.inviteCode = inviteCode.trim();
      await registerUser(payload);
      await login({ identifier: payload.email, password: payload.password });
      navigate(tenantPath('/dashboard'), { replace: true });
    } catch (err) {
      setFormError(err.message || 'Registration failed');
    }
  };

  if (signupMode === 'closed') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div className="text-center">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="mx-auto mb-3 h-12 w-12 rounded-xl object-cover" />
          ) : null}
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Registration closed</h1>
          <p className="mt-2 text-sm text-muted">
            {tenantName || 'This university'} is not accepting new signups right now.
          </p>
        </div>
        <Card>
          <p className="text-sm text-muted">Ask an admin for an invite when registration reopens, or sign in if you already have an account.</p>
          <Link to={tenantPath('/login')} className="mt-4 inline-block font-semibold text-primary">
            Sign in
          </Link>
        </Card>
      </div>
    );
  }

  const domainHint =
    (signupMode === 'domain' || signupMode === 'both') && allowedDomains.length
      ? `Use an email ending in ${allowedDomains.map((d) => `@${d}`).join(' or ')}.`
      : null;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="text-center">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="mx-auto mb-3 h-12 w-12 rounded-xl object-cover" />
        ) : null}
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {tenantName || 'Join peers'}
        </p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight">Create account</h1>
        <p className="mt-2 text-sm text-muted">
          Pick your campus and department — you stay on that campus library.
        </p>
        {domainHint ? <p className="mt-2 text-sm font-medium text-primary">{domainHint}</p> : null}
        {signupMode === 'invite' ? (
          <p className="mt-2 text-sm font-medium text-primary">An invite code is required to join.</p>
        ) : null}
        {signupMode === 'both' ? (
          <p className="mt-2 text-sm text-muted">Join with an allowed email domain or an invite code.</p>
        ) : null}
      </div>

      <Card>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input label="Full name" error={errors.fullName?.message} {...register('fullName')} />
          <Input
            label="Username"
            autoComplete="username"
            error={errors.username?.message}
            {...register('username')}
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          {signupMode === 'invite' || signupMode === 'both' ? (
            <Input
              label={signupMode === 'both' ? 'Invite code (optional if email domain allowed)' : 'Invite code'}
              error={errors.inviteCode?.message}
              {...register('inviteCode')}
            />
          ) : null}
          <Input label="Phone (optional)" error={errors.phone?.message} {...register('phone')} />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-muted" htmlFor="reg-university">
              University
            </label>
            <select
              id="reg-university"
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5"
              {...register('university')}
            >
              <option value="">Select…</option>
              {universities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            {errors.university ? (
              <p className="text-xs text-danger">{errors.university.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-muted" htmlFor="reg-campus">
              Campus
            </label>
            <select
              id="reg-campus"
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5"
              disabled={!campuses.length}
              {...register('campus')}
            >
              <option value="">Select…</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.city ? ` (${c.city})` : ''}
                </option>
              ))}
            </select>
            {errors.campus ? <p className="text-xs text-danger">{errors.campus.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-muted" htmlFor="reg-department">
              Department
            </label>
            <select
              id="reg-department"
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5"
              disabled={!departments.length}
              {...register('department')}
            >
              <option value="">Select…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {errors.department ? (
              <p className="text-xs text-danger">{errors.department.message}</p>
            ) : (
              <p className="text-xs text-muted">Your department admin reviews your uploads.</p>
            )}
          </div>

          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
          <Button type="submit" className="w-full" variant="accent" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create account'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link to={tenantPath('/login')} className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
