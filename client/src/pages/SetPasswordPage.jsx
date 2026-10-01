import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { setPassword } from '../api/auth.js';
import { setTenantSlug } from '../features/tenant/tenantSlugStore.js';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Input from '../components/ui/Input.jsx';

const schema = z
  .object({
    newPassword: z
      .string()
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, '8+ chars with upper, lower, and a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/** First-admin / invite setup link: /set-password?token=&email=&tenant= */
export default function SetPasswordPage() {
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  const token = params.get('token') || '';
  const tenant = params.get('tenant') || '';
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (tenant) setTenantSlug(tenant);
  }, [tenant]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values) => {
    setFormError('');
    try {
      await setPassword({ email, token, newPassword: values.newPassword });
      setDone(true);
    } catch (err) {
      setFormError(err.message || 'Could not set password');
    }
  };

  const loginHref = tenant ? `/t/${tenant}/login` : '/login';

  if (!email || !token) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Card>
          <p className="text-sm text-danger">This setup link is missing email or token.</p>
          <Link to="/" className="mt-4 inline-block text-sm text-primary">
            Home
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Set your password</h1>
        <p className="mt-2 text-sm text-muted">Finish setup for {email}</p>
      </div>
      <Card>
        {done ? (
          <div className="space-y-3">
            <p className="text-sm text-success">Password saved. You can sign in now.</p>
            <Link to={loginHref} className="text-sm font-semibold text-primary">
              Go to sign in
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            {formError ? <p className="text-sm text-danger">{formError}</p> : null}
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              error={errors.newPassword?.message}
              {...register('newPassword')}
            />
            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save password'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
