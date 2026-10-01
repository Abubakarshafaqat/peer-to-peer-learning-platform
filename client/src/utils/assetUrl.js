export function resolveAssetUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  // Local uploads are served from API host (/uploads/...)
  const api = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
  const origin = api.replace(/\/api\/v1\/?$/, '');
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
}
