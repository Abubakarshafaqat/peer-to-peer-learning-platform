import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTenantSettings, updateTenantSettings } from '../../api/tenantAdmin.js';
import { applyTenantTheme, normalizeHexColor } from '../../features/tenant/theme.js';
import { useTenant } from '../../features/tenant/TenantContext.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import Input from '../../components/ui/Input.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';

export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const { tenantPath } = useTenant();
  const q = useQuery({ queryKey: ['tenant-admin', 'tenant'], queryFn: getTenantSettings });
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (q.data?.data?.tenant) {
      const t = q.data.data.tenant;
      setForm({
        name: t.name || '',
        logoUrl: t.logoUrl || '',
        primaryColor: t.theme?.primaryColor || '#0f766e',
        maxUploadMB: t.settings?.maxUploadMB ?? 50,
        moderationEnabled: Boolean(t.settings?.moderationEnabled),
        allowedFileTypes: (t.settings?.allowedFileTypes || []).join(', '),
      });
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      updateTenantSettings({
        name: form.name,
        logoUrl: form.logoUrl,
        theme: { primaryColor: normalizeHexColor(form.primaryColor) },
        settings: {
          maxUploadMB: Number(form.maxUploadMB),
          moderationEnabled: form.moderationEnabled,
          allowedFileTypes: form.allowedFileTypes
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: (res) => {
      setMsg('Settings saved');
      applyTenantTheme(res.data?.tenant?.theme?.primaryColor);
      qc.invalidateQueries({ queryKey: ['tenant-admin'] });
    },
    onError: (err) => setMsg(err.message),
  });

  if (q.isLoading || !form) return <Skeleton className="h-64 w-full" />;
  if (q.isError) return <p className="text-sm text-danger">{q.error.message}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">Branding and upload policy for this university.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <Input label="Display name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Logo URL" value={form.logoUrl} onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))} />
          <Input
            label="Primary color"
            value={form.primaryColor}
            onChange={(e) => {
              const v = e.target.value;
              setForm((f) => ({ ...f, primaryColor: v }));
              if (/^#[0-9a-fA-F]{6}$/.test(v)) applyTenantTheme(v);
            }}
          />
          <Input
            label="Max upload (MB)"
            type="number"
            value={form.maxUploadMB}
            onChange={(e) => setForm((f) => ({ ...f, maxUploadMB: e.target.value }))}
          />
          <Input
            label="Allowed MIME types (comma-separated)"
            value={form.allowedFileTypes}
            onChange={(e) => setForm((f) => ({ ...f, allowedFileTypes: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.moderationEnabled}
              onChange={(e) => setForm((f) => ({ ...f, moderationEnabled: e.target.checked }))}
            />
            Moderation enabled
          </label>
          {msg ? <p className="text-sm text-muted">{msg}</p> : null}
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save settings'}
          </Button>
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Live preview</p>
          <div className="mt-4 flex items-center gap-3">
            {form.logoUrl ? (
              <img src={form.logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 font-bold text-primary">
                {form.name?.slice(0, 1) || '?'}
              </span>
            )}
            <div>
              <p className="font-display text-xl font-bold">{form.name || 'University'}</p>
              <button
                type="button"
                className="mt-2 rounded-xl bg-primary px-3 py-1.5 text-sm font-semibold text-white"
              >
                Primary button
              </button>
            </div>
          </div>
          <a href={tenantPath('/admin')} className="mt-6 inline-block text-sm text-primary">
            ← Back to admin
          </a>
        </Card>
      </div>
    </div>
  );
}
