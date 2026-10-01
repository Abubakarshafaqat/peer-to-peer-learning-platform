import { AuditLog } from '../models/AuditLog.js';

/**
 * Fire-and-forget safe audit writer. Never throws to callers.
 * Do not pass secrets, passwords, tokens, or invite plain codes in meta.
 */
export async function writeAudit({
  actor = null,
  role = '',
  tenantId = null,
  action,
  target = {},
  meta,
  ip = '',
} = {}) {
  try {
    if (!action) return null;
    const doc = await AuditLog.create({
      actor: actor?._id || actor || null,
      role: role || actor?.role || '',
      tenantId: tenantId?._id || tenantId || null,
      action,
      target: {
        type: target.type || '',
        id: target.id != null ? String(target.id) : '',
        label: target.label || '',
      },
      meta: meta && typeof meta === 'object' ? scrubMeta(meta) : undefined,
      ip: ip || '',
    });
    return doc;
  } catch (err) {
    console.error('[audit] write failed:', err.message);
    return null;
  }
}

function scrubMeta(meta) {
  const blocked = new Set([
    'password',
    'passwordHash',
    'token',
    'accessToken',
    'refreshToken',
    'inviteCode',
    'code',
    'plainCode',
    'otp',
    'secret',
  ]);
  const out = {};
  for (const [k, v] of Object.entries(meta)) {
    if (blocked.has(k)) continue;
    if (v != null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      out[k] = scrubMeta(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function clientIp(req) {
  return (
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    ''
  );
}
