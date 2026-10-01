/** Validate and normalize a CSS hex color (#RGB or #RRGGBB). */
export function normalizeHexColor(value, fallback = '#1f6f78') {
  const raw = String(value || '').trim();
  const short = /^#([0-9a-fA-F]{3})$/;
  const long = /^#([0-9a-fA-F]{6})$/;
  if (long.test(raw)) return raw.toLowerCase();
  const m = raw.match(short);
  if (m) {
    const [r, g, b] = m[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

/** Darken hex for hover state. */
export function darkenHex(hex, amount = 0.12) {
  const n = normalizeHexColor(hex);
  const num = parseInt(n.slice(1), 16);
  const r = Math.max(0, Math.round(((num >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.round(((num >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.round((num & 255) * (1 - amount)));
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

export function applyTenantTheme(primaryColor) {
  if (typeof document === 'undefined') return;
  const primary = normalizeHexColor(primaryColor);
  const root = document.documentElement;
  root.style.setProperty('--color-primary', primary);
  root.style.setProperty('--color-primary-hover', darkenHex(primary));
}

export function clearTenantTheme() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.removeProperty('--color-primary');
  root.style.removeProperty('--color-primary-hover');
}
