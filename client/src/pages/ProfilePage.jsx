import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../features/auth/AuthContext.jsx';
import * as authApi from '../api/auth.js';
import Avatar from '../components/ui/Avatar.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Input from '../components/ui/Input.jsx';

const profileSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().optional(),
  bio: z.string().max(500).optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  program: z.string().optional(),
  semester: z.string().optional(),
  gender: z.enum(['', 'male', 'female', 'other', 'prefer_not_to_say']).optional(),
  dateOfBirth: z.string().optional(),
  linkedinUrl: z.string().optional(),
  websiteUrl: z.string().optional(),
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

function toDateInput(value) {
  if (!value) return '';
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

/** // SRS-12..20 Profile + avatar + change password */
export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [avatarMsg, setAvatarMsg] = useState('');
  const [avatarErr, setAvatarErr] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    values: {
      fullName: user?.fullName || '',
      phone: user?.phone || '',
      bio: user?.bio || '',
      city: user?.city || '',
      country: user?.country || '',
      program: user?.program || '',
      semester: user?.semester || '',
      gender: user?.gender || '',
      dateOfBirth: toDateInput(user?.dateOfBirth),
      linkedinUrl: user?.linkedinUrl || '',
      websiteUrl: user?.websiteUrl || '',
    },
  });

  const passwordForm = useForm({ resolver: zodResolver(passwordSchema) });

  const onProfile = async (values) => {
    setProfileErr('');
    setProfileMsg('');
    try {
      const payload = {
        ...values,
        linkedinUrl: values.linkedinUrl || '',
        websiteUrl: values.websiteUrl || '',
        dateOfBirth: values.dateOfBirth || '',
      };
      await authApi.updateMe(payload);
      await refreshUser();
      setProfileMsg('Profile saved');
    } catch (err) {
      setProfileErr(err.message);
    }
  };

  const onAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarErr('');
    setAvatarMsg('');
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      await authApi.uploadAvatar(formData);
      await refreshUser();
      setAvatarMsg('Profile picture updated');
    } catch (err) {
      setAvatarErr(err.message);
    } finally {
      setUploadingAvatar(false);
      event.target.value = '';
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
        <h2 className="font-display text-lg font-bold">Profile picture</h2>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Avatar user={user} size="lg" />
          <div>
            <label className="inline-flex cursor-pointer">
              <span className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold hover:border-primary/40">
                {uploadingAvatar ? 'Uploading…' : 'Upload photo'}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={onAvatar}
                disabled={uploadingAvatar}
              />
            </label>
            <p className="mt-2 text-xs text-muted">JPG, PNG, WEBP, or GIF · max 5 MB</p>
            {avatarMsg ? <p className="mt-1 text-sm text-success">{avatarMsg}</p> : null}
            {avatarErr ? <p className="mt-1 text-sm text-danger">{avatarErr}</p> : null}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-bold">Account details</h2>
        <form className="mt-4 space-y-4" onSubmit={profileForm.handleSubmit(onProfile)} noValidate>
          <Input
            label="Full name"
            error={profileForm.formState.errors.fullName?.message}
            {...profileForm.register('fullName')}
          />
          <Input label="Phone" {...profileForm.register('phone')} />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-muted" htmlFor="bio">
              Bio
            </label>
            <textarea
              id="bio"
              rows={3}
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-ink outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              placeholder="A short intro about you"
              {...profileForm.register('bio')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="City" {...profileForm.register('city')} />
            <Input label="Country" {...profileForm.register('country')} />
            <Input label="Program / Department" {...profileForm.register('program')} />
            <Input label="Semester / Year" {...profileForm.register('semester')} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-muted">Gender</label>
              <select
                className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5"
                {...profileForm.register('gender')}
              >
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
            <Input label="Date of birth" type="date" {...profileForm.register('dateOfBirth')} />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-muted">Organization</label>
            <div className="rounded-xl border border-line bg-canvas/60 px-3 py-2.5 text-sm text-ink">
              {[user?.university?.name, user?.campus?.name, user?.department?.name]
                .filter(Boolean)
                .join(' · ') || 'Not assigned'}
            </div>
            <p className="text-xs text-muted">
              University, campus, and department are fixed at signup. Contact a platform admin to
              transfer.
            </p>
          </div>

          <Input label="LinkedIn URL" placeholder="https://linkedin.com/in/..." {...profileForm.register('linkedinUrl')} />
          <Input label="Website URL" placeholder="https://..." {...profileForm.register('websiteUrl')} />

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
