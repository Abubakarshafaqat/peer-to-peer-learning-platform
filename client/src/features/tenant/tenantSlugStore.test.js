import { beforeEach, describe, expect, it } from 'vitest';
import { clearAppCaches, queryClient } from '../../lib/queryClient.js';
import {
  clearTenantSlug,
  getTenantSlug,
  isPlatformMode,
  setPlatformMode,
  setTenantSlug,
} from './tenantSlugStore.js';

describe('tenantSlugStore + axios header source', () => {
  beforeEach(() => {
    clearTenantSlug();
    setPlatformMode(false);
  });

  it('stores slug in module state (not localStorage)', () => {
    setTenantSlug('Alpha');
    expect(getTenantSlug()).toBe('alpha');
    expect(localStorage.getItem('pl_tenant_slug')).toBeNull();
  });

  it('platform mode skips tenant context', () => {
    setPlatformMode(true);
    setTenantSlug('alpha');
    expect(isPlatformMode()).toBe(true);
  });

  it('getTenantSlug is what the axios interceptor uses', () => {
    setTenantSlug('beta');
    expect(getTenantSlug()).toBe('beta');
  });
});

describe('cache clear on logout / tenant switch', () => {
  it('clearAppCaches empties react-query cache', () => {
    queryClient.setQueryData(['materials'], { items: [1] });
    expect(queryClient.getQueryData(['materials'])).toEqual({ items: [1] });
    clearAppCaches();
    expect(queryClient.getQueryData(['materials'])).toBeUndefined();
  });
});
