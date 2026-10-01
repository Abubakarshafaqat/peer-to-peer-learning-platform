/**
 * Walk an Express app/router stack and list METHOD + path pairs.
 * Used by Step 9 route-isolation matrix tests.
 */

function mountPathFromLayer(layer) {
  if (layer.route) return '';
  if (layer.name !== 'router' || !layer.regexp) return '';
  if (layer.regexp.fast_slash) return '';
  const src = layer.regexp.source;
  // /^\/auth\/?(?=\/|$)/i  →  /auth
  const m = src.match(/^\^\\\/((?:\\\/|[^?])+?)\\\/\?\(\?=\\\/\|\$\)/);
  if (!m) return '';
  return `/${m[1].replace(/\\\//g, '/')}`;
}

function joinPaths(prefix, routePath) {
  const a = String(prefix || '').replace(/\/$/, '');
  const b = String(routePath || '');
  if (!b || b === '/') return a || '/';
  if (b.startsWith('/')) return `${a}${b}` || '/';
  return `${a}/${b}`;
}

/**
 * @param {import('express').Application | import('express').Router} appOrRouter
 * @param {string} [prefix]
 * @returns {{ method: string, path: string }[]}
 */
export function listExpressRoutes(appOrRouter, prefix = '') {
  const routes = [];
  // Prefer _router — touching app.router throws a deprecation Error in Express 4
  let stack = [];
  if (appOrRouter?._router?.stack) {
    stack = appOrRouter._router.stack;
  } else if (Array.isArray(appOrRouter?.stack)) {
    stack = appOrRouter.stack;
  }

  for (const layer of stack) {
    if (layer.route) {
      const fullPath = joinPaths(prefix, layer.route.path);
      const methods = Object.keys(layer.route.methods || {}).filter(
        (m) => layer.route.methods[m] && m !== '_all',
      );
      for (const method of methods) {
        routes.push({ method: method.toUpperCase(), path: fullPath });
      }
      continue;
    }

    if (layer.name === 'router' && layer.handle?.stack) {
      const mount = mountPathFromLayer(layer);
      const nextPrefix = joinPaths(prefix, mount);
      routes.push(...listExpressRoutes(layer.handle, nextPrefix));
    }
  }

  return routes;
}

/** Normalize `/api/v1/foo/:id` style paths for matrix lookup */
export function routeKey(method, path) {
  return `${String(method).toUpperCase()} ${path}`;
}
