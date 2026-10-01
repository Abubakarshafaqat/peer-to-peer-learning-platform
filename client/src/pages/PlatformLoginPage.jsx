import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../features/auth/AuthContext.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Input from '../components/ui/Input.jsx';

const schema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

/** Superadmin login — no x-tenant, no tenant branding. */
export default function PlatformLoginPage() {
  const { platformLogin, sessionMessage, clearSessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values) => {
    setFormError('');
    clearSessionMessage();
    try {
      await platformLogin(values);
      navigate(location.state?.from?.pathname || '/platform', { replace: true });
    } catch (err) {
      setFormError(err.message || 'Login failed');
    }
  };

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center gap-6 px-4">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Platform</p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight">Superadmin sign in</h1>
        <p className="mt-2 text-sm text-muted">Manage universities across the Peer Learning platform.</p>
      </div>
      <Card>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          {sessionMessage ? <p className="text-sm text-warning">{sessionMessage}</p> : null}
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
          <Input
            label="Email or username"
            autoComplete="username"
            error={errors.identifier?.message}
            {...register('identifier')}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>
      <p className="text-center text-sm text-muted">
        University user?{' '}
        <Link to="/" className="font-semibold text-primary">
          Choose your campus
        </Link>
      </p>
    </div>
  );
}
