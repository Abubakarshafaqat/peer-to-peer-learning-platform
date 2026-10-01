import { describe, expect, it } from 'vitest';
import { resolveTenantSlug, slugFromHostname } from './resolveTenantSlug.js';

describe('slugFromHostname', () => {
  it('ignores bare localhost and www-only hosts', () => {
    expect(slugFromHostname('localhost')).toBeNull();
    expect(slugFromHostname('www.example.com')).toBeNull();
  });

  it('ignores *.vercel.app', () => {
    expect(slugFromHostname('alpha.vercel.app')).toBeNull();
    expect(slugFromHostname('my-app.vercel.app')).toBeNull();
  });

  it('reads subdomain and foo.localhost', () => {
    expect(slugFromHostname('alpha.peerlearning.test')).toBe('alpha');
    expect(slugFromHostname('beta.localhost')).toBe('beta');
    expect(slugFromHostname('www.alpha.example.com')).toBe('alpha');
  });
});

describe('resolveTenantSlug order', () => {
  it('prefers subdomain over route and env', () => {
    const r = resolveTenantSlug({
      hostname: 'alpha.example.com',
      routeSlug: 'beta',
      envSlug: 'gamma',
      isDev: true,
    });
    expect(r).toEqual({ slug: 'alpha', source: 'subdomain' });
  });

  it('uses /t/:slug when no subdomain', () => {
    const r = resolveTenantSlug({
      hostname: 'localhost',
      routeSlug: 'beta',
      envSlug: 'gamma',
      isDev: true,
    });
    expect(r).toEqual({ slug: 'beta', source: 'route' });
  });

  it('uses VITE_TENANT_SLUG only in dev', () => {
    expect(
      resolveTenantSlug({
        hostname: 'localhost',
        routeSlug: null,
        envSlug: 'alpha',
        isDev: true,
      }),
    ).toEqual({ slug: 'alpha', source: 'env' });

    expect(
      resolveTenantSlug({
        hostname: 'localhost',
        routeSlug: null,
        envSlug: 'alpha',
        isDev: false,
      }),
    ).toEqual({ slug: null, source: null });
  });
});
