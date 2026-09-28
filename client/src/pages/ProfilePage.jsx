import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../features/auth/AuthContext.jsx';
import * as authApi from '../api/auth.js';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Input from '../components/ui/Input.jsx';

const profileSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, '8+ chars with upper, lower, and a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/** // SRS-12..20 Profile + change password */
export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    values: { fullName: user?.fullName || '', phone: user?.phone || '' },
  });

  const passwordForm = useForm({ resolver: zodResolver(passwordSchema) });

  const onProfile = async (values) => {
    setProfileErr('');
    setProfileMsg('');
    try {
      await authApi.updateMe(values);
      await refreshUser();
      setProfileMsg('Profile saved');
    } catch (err) {
      setProfileErr(err.message);
    }
  };

  const onPassword = async (values) => {
    setPwdErr('');
    setPwdMsg('');
    try {
      await authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      setPwdMsg('Password changed. Signing you out…');
      passwordForm.reset();
      setTimeout(() => logout(), 800);
    } catch (err) {
      setPwdErr(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted">
          @{user?.username} · {user?.email} · {user?.role}
        </p>
      </div>

      <Card>
        <h2 className="font-display text-lg font-bold">Account details</h2>
        <form className="mt-4 space-y-4" onSubmit={profileForm.handleSubmit(onProfile)} noValidate>
          <Input label="Full name" error={profileForm.formState.errors.fullName?.message} {...profileForm.register('fullName')} />
          <Input label="Phone" error={profileForm.formState.errors.phone?.message} {...profileForm.register('phone')} />
          {profileMsg ? <p className="text-sm text-success">{profileMsg}</p> : null}
          {profileErr ? <p className="text-sm text-danger">{profileErr}</p> : null}
          <Button type="submit" disabled={profileForm.formState.isSubmitting}>
            Save changes
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-bold">Change password</h2>
        <form className="mt-4 space-y-4" onSubmit={passwordForm.handleSubmit(onPassword)} noValidate>
          <Input
            label="Current password"
            type="password"
            error={passwordForm.formState.errors.currentPassword?.message}
            {...passwordForm.register('currentPassword')}
          />
          <Input
            label="New password"
            type="password"
            error={passwordForm.formState.errors.newPassword?.message}
            {...passwordForm.register('newPassword')}
          />
          <Input
            label="Confirm new password"
            type="password"
            error={passwordForm.formState.errors.confirmPassword?.message}
            {...passwordForm.register('confirmPassword')}
          />
          {pwdMsg ? <p className="text-sm text-success">{pwdMsg}</p> : null}
          {pwdErr ? <p className="text-sm text-danger">{pwdErr}</p> : null}
          <Button type="submit" variant="outline" disabled={passwordForm.formState.isSubmitting}>
            Update password
          </Button>
        </form>
      </Card>
    </div>
  );
}
