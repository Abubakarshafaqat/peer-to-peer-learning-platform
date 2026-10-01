import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useTenant } from '../features/tenant/TenantContext.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Input from '../components/ui/Input.jsx';

const schema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

/** Per-tenant login */
export default function LoginPage() {
  const { login, sessionMessage, clearSessionMessage } = useAuth();
  const { tenantName, logoUrl, tenantPath } = useTenant();
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
      const user = await login(values);
      const fallback =
        user.role === 'tenantAdmin'
          ? tenantPath('/admin')
          : user.role === 'superadmin'
            ? '/platform'
            : tenantPath('/dashboard');
      navigate(location.state?.from?.pathname || fallback, { replace: true });
    } catch (err) {
      setFormError(err.message || 'Login failed');
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="text-center">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="mx-auto mb-3 h-12 w-12 rounded-xl object-cover" />
        ) : null}
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {tenantName || 'Peer Learning'}
        </p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-muted">Sign in to your campus library.</p>
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
          <div className="flex justify-end">
            <Link to={tenantPath('/forgot-password')} className="text-xs font-medium text-primary">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-muted">
        New here?{' '}
        <Link to={tenantPath('/register')} className="font-semibold text-primary">
          Create an account
        </Link>
      </p>
    </div>
  );
}
