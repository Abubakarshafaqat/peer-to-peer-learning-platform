/**
 * Consistent API response helpers.
 * Shape: { success, data, message, meta? }
 */

export function sendSuccess(res, { data = null, message = 'OK', meta, status = 200 } = {}) {
  const body = { success: true, data, message };
  if (meta !== undefined) body.meta = meta;
  return res.status(status).json(body);
}

export function sendError(res, { message = 'Something went wrong', status = 500, code, details } = {}) {
  const body = { success: false, data: null, message };
  if (code) body.code = code;
  if (details !== undefined) body.details = details;
  return res.status(status).json(body);
}
