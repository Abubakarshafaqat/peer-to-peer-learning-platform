/**
 * Step 9A — programmatic route isolation matrix.
 * Every Express route under /api/v1 must appear in ROUTE_MATRIX with a class
 * of public | tenant | tenant-admin | platform.
 */
import { createApp } from '../src/app.js';
import { listExpressRoutes, routeKey } from '../src/utils/walkRoutes.js';
import {
  ROUTE_MATRIX,
  ROUTE_CLASSES,
  matrixKeyForWalked,
} from '../src/config/routeMatrix.js';

describe('Step 9A — route isolation matrix', () => {
  it('classifies every walked /api/v1 route', () => {
    const app = createApp();
    const walked = listExpressRoutes(app).filter((r) => r.path.startsWith('/api/v1'));

    expect(walked.length).toBeGreaterThan(20);

    const missing = [];
    const badClass = [];
    const table = [];

    for (const { method, path } of walked) {
      const catalogKey = matrixKeyForWalked(method, path);
      if (!catalogKey) {
        missing.push(routeKey(method, path));
        continue;
      }
      const meta = ROUTE_MATRIX[catalogKey];
      if (!ROUTE_CLASSES.has(meta.class)) {
        badClass.push(`${catalogKey} → ${meta.class}`);
      }
      table.push({
        method,
        path,
        class: meta.class,
        auth: meta.auth,
        role: meta.role,
        tenant: meta.tenant,
      });
    }

    if (missing.length || badClass.length) {
      // eslint-disable-next-line no-console
      console.error('Unclassified routes:', missing);
      // eslint-disable-next-line no-console
      console.error('Bad class:', badClass);
    }

    expect(missing).toEqual([]);
    expect(badClass).toEqual([]);

    // Catalog must not contain dead entries that never appear in the app
    const walkedKeys = new Set(
      walked.map(({ method, path }) => matrixKeyForWalked(method, path)).filter(Boolean),
    );
    const orphans = Object.keys(ROUTE_MATRIX).filter((k) => !walkedKeys.has(k));
    if (orphans.length) {
      // eslint-disable-next-line no-console
      console.warn('ROUTE_MATRIX orphans (not walked — check param names):', orphans);
    }
    expect(orphans).toEqual([]);

    // Stable summary for demo / audit
    expect(table.every((r) => ROUTE_CLASSES.has(r.class))).toBe(true);
  });
});
