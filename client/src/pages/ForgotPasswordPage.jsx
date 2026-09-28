import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as authApi from '../api/auth.js';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Input from '../components/ui/Input.jsx';

const forgotSchema = z.object({ email: z.string().email() });

const resetSchema = z
  .object({
    email: z.string().email(),
    otp: z.string().length(6, 'Enter the 6-digit code'),
    newPassword: z
      .string()
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, '8+ chars with upper, lower, and a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/** // SRS-21..25 Password reset via email OTP */
export default function ForgotPasswordPage() {
  const [step, setStep] = useState('request');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const forgotForm = useForm({ resolver: zodResolver(forgotSchema) });
  const resetForm = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: '' },
  });

  const onForgot = async (values) => {
    setError('');
    setMessage('');
    try {
      await authApi.forgotPassword(values);
      setEmail(values.email);
      resetForm.setValue('email', values.email);
      setStep('reset');
      setMessage('If that email exists, a reset code was sent. Check your inbox (or server console in dev).');
    } catch (err) {
      setError(err.message);
    }
  };

  const onReset = async (values) => {
    setError('');
    setMessage('');
    try {
      const { confirmPassword: _, ...payload } = values;
      await authApi.resetPassword(payload);
      setStep('done');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Reset password</h1>
        <p className="mt-2 text-sm text-muted">We will email a one-time code that expires in 10 minutes.</p>
      </div>

      <Card>
        {step === 'request' ? (
          <form className="space-y-4" onSubmit={forgotForm.handleSubmit(onForgot)} noValidate>
            <Input
              label="Email"
              type="email"
              error={forgotForm.formState.errors.email?.message}
              {...forgotForm.register('email')}
            />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" className="w-full" variant="accent" disabled={forgotForm.formState.isSubmitting}>
              Send code
            </Button>
          </form>
        ) : null}

        {step === 'reset' ? (
          <form className="space-y-4" onSubmit={resetForm.handleSubmit(onReset)} noValidate>
            {message ? <p className="text-sm text-success">{message}</p> : null}
            <Input label="Email" type="email" defaultValue={email} error={resetForm.formState.errors.email?.message} {...resetForm.register('email')} />
            <Input label="OTP code" error={resetForm.formState.errors.otp?.message} {...resetForm.register('otp')} />
            <Input
              label="New password"
              type="password"
              error={resetForm.formState.errors.newPassword?.message}
              {...resetForm.register('newPassword')}
            />
            <Input
              label="Confirm password"
              type="password"
              error={resetForm.formState.errors.confirmPassword?.message}
              {...resetForm.register('confirmPassword')}
            />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" className="w-full" variant="accent" disabled={resetForm.formState.isSubmitting}>
              Reset password
            </Button>
          </form>
        ) : null}

        {step === 'done' ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-success">Password updated. You can sign in now.</p>
            <Link to="/login">
              <Button className="w-full" variant="accent">
                Go to sign in
              </Button>
            </Link>
          </div>
        ) : null}

        <p className="mt-4 text-center text-sm text-muted">
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
