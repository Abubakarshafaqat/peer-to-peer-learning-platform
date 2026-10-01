import { useEffect, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import Button from '../ui/Button.jsx';
import { fetchMaterialFileBlob, getMaterialFileUrl } from '../../api/materials.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export default function PdfPreview({ materialId, mimeType }) {
  const [source, setSource] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      try {
        if (!mimeType?.includes('pdf')) {
          setError('Preview is available for PDF files. Use Download for other types.');
          setLoading(false);
          return;
        }

        const meta = await getMaterialFileUrl(materialId);
        if (meta.data.mode === 'remote' && meta.data.url) {
          if (!cancelled) setSource(meta.data.url);
        } else {
          const blob = await fetchMaterialFileBlob(materialId, { preview: true });
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) setSource(objectUrl);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load preview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [materialId, mimeType]);

  if (loading) return <p className="text-sm text-muted">Loading preview…</p>;
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!source) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}>
          Zoom out
        </Button>
        <Button size="sm" variant="outline" onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}>
          Zoom in
        </Button>
        <span className="text-sm text-muted">{Math.round(scale * 100)}%</span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </Button>
          <span className="text-sm text-muted">
            {page} / {numPages || '—'}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={!numPages || page >= numPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-line bg-canvas p-2">
        <Document
          file={source}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={<p className="p-4 text-sm text-muted">Rendering PDF…</p>}
          error={<p className="p-4 text-sm text-danger">Failed to render PDF.</p>}
        >
          <Page pageNumber={page} scale={scale} />
        </Document>
      </div>
    </div>
  );
}
