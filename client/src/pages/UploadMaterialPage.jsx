import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getCourses, getSubjects } from '../api/taxonomy.js';
import { uploadMaterial } from '../api/materials.js';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useTenant } from '../features/tenant/TenantContext.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Input from '../components/ui/Input.jsx';

const schema = z.object({
  title: z.string().min(3, 'Title is required'),
  description: z.string().optional(),
  type: z.enum(['notes', 'past_paper', 'mcq', 'short_questions', 'long_questions', 'other']),
  course: z.string().min(1, 'Select course'),
  subject: z.string().min(1, 'Select subject'),
  tags: z.string().optional(),
});

const TYPES = [
  { value: 'notes', label: 'Notes' },
  { value: 'past_paper', label: 'Past paper' },
  { value: 'mcq', label: 'MCQs' },
  { value: 'short_questions', label: 'Short questions' },
  { value: 'long_questions', label: 'Long questions' },
  { value: 'other', label: 'Other' },
];

/** Upload locked to student university / campus / department */
export default function UploadMaterialPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenantPath } = useTenant();
  const departmentId = user?.department?.id || '';
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { type: 'notes', description: '', tags: '' },
  });

  const courseId = watch('course');

  useEffect(() => {
    if (!departmentId) {
      setCourses([]);
      return;
    }
    getCourses(departmentId)
      .then((res) => setCourses(res.data.items || []))
      .catch((err) => setError(err.message));
  }, [departmentId]);

  useEffect(() => {
    if (!courseId) {
      setSubjects([]);
      setValue('subject', '');
      return;
    }
    getSubjects(courseId)
      .then((res) => setSubjects(res.data.items || []))
      .catch((err) => setError(err.message));
    setValue('subject', '');
  }, [courseId, setValue]);

  const onSubmit = async (values) => {
    setError('');
    if (!file) {
      setError('Please choose a file (PDF, DOC, DOCX, or image)');
      return;
    }
    if (!user?.university?.id || !user?.campus?.id || !user?.department?.id) {
      setError('Your account needs university, campus, and department before uploading');
      return;
    }

    const formData = new FormData();
    formData.append('title', values.title);
    formData.append('description', values.description || '');
    formData.append('type', values.type);
    formData.append('course', values.course);
    formData.append('subject', values.subject);
    if (values.tags) formData.append('tags', values.tags);
    formData.append('file', file);

    try {
      await uploadMaterial(formData);
      navigate(tenantPath('/uploads'));
    } catch (err) {
    setError(
        err.status === 413
          ? err.message || 'File is too large for this university'
          : err.code === 'FILE_TYPE_NOT_ALLOWED' ||
              err.code === 'INVALID_FILE_TYPE' ||
              err.code === 'EXTENSION_MISMATCH' ||
              err.code === 'CONTENT_TYPE_MISMATCH'
            ? err.message || 'This file type is not allowed'
            : err.code === 'STORAGE_QUOTA_EXCEEDED'
              ? err.message || 'Storage quota exceeded'
              : err.message || 'Upload failed',
      );
    }
  };

  const orgLabel = [user?.university?.name, user?.campus?.name, user?.department?.name]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Upload material</h1>
        <p className="mt-1 text-sm text-muted">
          Uploads go to <strong>{orgLabel || 'your department'}</strong> and stay{' '}
          <strong>pending</strong> until that department (or campus/university) admin approves them.
        </p>
      </div>

      <Card>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input label="Title" error={errors.title?.message} {...register('title')} />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-muted" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              rows={3}
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-ink outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              {...register('description')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-muted" htmlFor="type">
              Material type
            </label>
            <select
              id="type"
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5"
              {...register('type')}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-muted">Course</label>
              <select
                className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5"
                {...register('course')}
                disabled={!courses.length}
              >
                <option value="">Select…</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.course ? <p className="text-xs text-danger">{errors.course.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-muted">Subject</label>
              <select
                className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5"
                {...register('subject')}
                disabled={!subjects.length}
              >
                <option value="">Select…</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {errors.subject ? (
                <p className="text-xs text-danger">{errors.subject.message}</p>
              ) : null}
            </div>
          </div>

          <Input label="Tags (comma separated)" {...register('tags')} />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-muted" htmlFor="file">
              File (PDF, DOC, DOCX, images)
            </label>
            <input
              id="file"
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:font-semibold file:text-primary"
            />
          </div>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <Button type="submit" variant="accent" disabled={isSubmitting}>
            {isSubmitting ? 'Uploading…' : 'Upload'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
