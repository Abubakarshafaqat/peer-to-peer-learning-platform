import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  deleteMaterial,
  fetchMaterialFileBlob,
  getMaterial,
  getMaterialFileUrl,
} from '../api/materials.js';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useTenant } from '../features/tenant/TenantContext.jsx';
import PdfPreview from '../components/materials/PdfPreview.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';

export default function MaterialDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { tenantPath } = useTenant();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['materials', id],
    queryFn: () => getMaterial(id),
  });

  const remove = useMutation({
    mutationFn: () => deleteMaterial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      navigate(tenantPath('/uploads'));
    },
  });

  const material = data?.data?.material;
  const isOwner =
    user && material?.uploader?.id && String(user.id) === String(material.uploader.id);
  const canManage = isOwner || user?.role === 'tenantAdmin';

  const onDownload = async () => {
    try {
      const meta = await getMaterialFileUrl(id);
      if (meta.data.mode === 'remote' && meta.data.url) {
        window.open(meta.data.url, '_blank', 'noopener,noreferrer');
        return;
      }
      const blob = await fetchMaterialFileBlob(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = material?.file?.originalName || 'download';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !material) {
    return <p className="text-sm text-danger">{error?.message || 'Material not found'}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {material.type.replace('_', ' ')} · {material.status}
          </p>
          <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight">{material.title}</h1>
          <p className="mt-2 text-sm text-muted">
            {material.university?.name} · {material.campus?.name} · {material.department?.name} ·{' '}
            {material.course?.name} · {material.subject?.name}
          </p>
          <p className="mt-1 text-sm text-muted">
            By {material.uploader?.fullName || material.uploader?.username || 'Unknown'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAuthenticated ? (
            <Button variant="accent" onClick={onDownload}>
              Download
            </Button>
          ) : (
            <Link to={tenantPath('/login')}>
              <Button variant="accent">Sign in to download</Button>
            </Link>
          )}
          {canManage ? (
            <Button
              variant="outline"
              onClick={() => {
                if (window.confirm('Delete this material permanently?')) remove.mutate();
              }}
            >
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <h2 className="font-display text-lg font-bold">Description</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
          {material.description || 'No description provided.'}
        </p>
        {material.tags?.length ? (
          <p className="mt-3 text-xs text-muted">Tags: {material.tags.join(', ')}</p>
        ) : null}
      </Card>

      {isAuthenticated ? (
        <Card>
          <h2 className="font-display mb-3 text-lg font-bold">Preview</h2>
          <PdfPreview materialId={material.id} mimeType={material.file?.mimeType} />
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-muted">Sign in to preview and download files.</p>
        </Card>
      )}
    </div>
  );
}
