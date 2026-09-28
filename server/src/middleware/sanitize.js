/**
 * Strip keys that start with `$` or contain `.` to mitigate NoSQL injection.
 */
export function sanitizeObject(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitizeObject);
  if (typeof value !== 'object') return value;

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.')) continue;
    out[key] = sanitizeObject(val);
  }
  return out;
}

export function sanitizeRequest(req, _res, next) {
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.params) req.params = sanitizeObject(req.params);
  // req.query is often a getter-only object in Express 4; mutate carefully
  if (req.query && typeof req.query === 'object') {
    const cleaned = sanitizeObject(req.query);
    for (const key of Object.keys(req.query)) {
      delete req.query[key];
    }
    Object.assign(req.query, cleaned);
  }
  next();
}
