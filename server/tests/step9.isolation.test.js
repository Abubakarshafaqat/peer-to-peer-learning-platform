/**
 * Step 9 — final isolation: cross-tenant IDs, list/search, uniqueness,
 * ALS/context safety, session/token hardening, cache invalidation.
 */
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { runWithTenantContext, getTenantId } from '../src/utils/tenantContext.js';
import { Material } from '../src/models/Material.js';
import { User } from '../src/models/User.js';
import { Course } from '../src/models/Course.js';
import { Invite } from '../src/models/Invite.js';
import { clearTenantCache, getCachedTenant } from '../src/utils/tenantCache.js';
import {
  seedIsolationPair,
  login,
  platformLogin,
  PASSWORD,
  SHARED_EMAIL,
  SHARED_USERNAME,
  SHARED_COURSE_SLUG,
  SHARED_MATERIAL_TITLE,
  expectDenied,
} from './helpers/step9Fixture.js';

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/peer-learning-test';

let app;
let mongoAvailable = false;
let alpha;
let beta;
let alphaStudent;
let alphaAdmin;
let betaStudent;
let betaAdmin;
let platform;

beforeAll(async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 20000 });
    }
    app = createApp();
    const seeded = await seedIsolationPair();
    alpha = seeded.alpha;
    beta = seeded.beta;
    alphaStudent = await login(app, 'alpha', 'student@alpha.edu');
    alphaAdmin = await login(app, 'alpha', 'admin@alpha.edu');
    betaStudent = await login(app, 'beta', 'student@beta.edu');
    betaAdmin = await login(app, 'beta', 'admin@beta.edu');
    platform = await platformLogin(app);
    mongoAvailable = true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[step9.isolation] skipped: ${err.message}`);
  }
}, 120000);

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

function itDb(name, fn, timeout = 30000) {
  it(
    name,
    async () => {
      if (!mongoAvailable) {
        throw new Error('MongoDB required — set MONGODB_URI in server/.env');
      }
      await fn();
    },
    timeout,
  );
}

describe('Step 9A — cross-tenant id operations (Alpha token + Beta ids)', () => {
  itDb('materials GET/PATCH/DELETE with Beta id → 403/404', async () => {
    const id = String(beta.approved._id);
    const get = await request(app)
      .get(`/api/v1/materials/${id}`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaStudent.token}`);
    expectDenied(get);

    const patch = await request(app)
      .patch(`/api/v1/materials/${id}`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaStudent.token}`)
      .send({ title: 'hacked' });
    expectDenied(patch);

    const del = await request(app)
      .delete(`/api/v1/materials/${id}`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaStudent.token}`);
    expectDenied(del);

    const fileUrl = await request(app)
      .get(`/api/v1/materials/${id}/file-url`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaStudent.token}`);
    expectDenied(fileUrl);
  });

  itDb('tenant-admin users active/role with Beta user id → 403/404', async () => {
    const id = String(beta.student._id);
    const active = await request(app)
      .patch(`/api/v1/tenant-admin/users/${id}/active`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdmin.token}`)
      .send({ isActive: false });
    expectDenied(active);

    const role = await request(app)
      .patch(`/api/v1/tenant-admin/users/${id}/role`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdmin.token}`)
      .send({ role: 'student' });
    expectDenied(role);
  });

  itDb('invite revoke with Beta invite id → 403/404', async () => {
    const id = String(beta.invite._id);
    const res = await request(app)
      .post(`/api/v1/invites/${id}/revoke`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdmin.token}`);
    expectDenied(res);
  });

  itDb('moderation with Beta material id → 403/404', async () => {
    const id = String(beta.pending._id);
    const res = await request(app)
      .patch(`/api/v1/tenant-admin/moderation/${id}`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdmin.token}`)
      .send({ status: 'approved' });
    expectDenied(res);

    const matMod = await request(app)
      .patch(`/api/v1/materials/${id}/moderation`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdmin.token}`)
      .send({ status: 'rejected', rejectionReason: 'x' });
    expectDenied(matMod);
  });

  itDb('taxonomy lists with Beta campus/department/course ids return no foreign rows', async () => {
    const campuses = await request(app)
      .get(`/api/v1/taxonomy/universities/${beta.uni._id}/campuses`)
      .set('x-tenant', 'alpha');
    expect(campuses.status).toBe(200);
    expect(campuses.body.data.items).toHaveLength(0);

    const depts = await request(app)
      .get(`/api/v1/taxonomy/campuses/${beta.campus._id}/departments`)
      .set('x-tenant', 'alpha');
    expect(depts.status).toBe(200);
    expect(depts.body.data.items).toHaveLength(0);

    const courses = await request(app)
      .get(`/api/v1/taxonomy/departments/${beta.department._id}/courses`)
      .set('x-tenant', 'alpha');
    expect(courses.status).toBe(200);
    expect(courses.body.data.items).toHaveLength(0);

    const subjects = await request(app)
      .get(`/api/v1/taxonomy/courses/${beta.course._id}/subjects`)
      .set('x-tenant', 'alpha');
    expect(subjects.status).toBe(200);
    expect(subjects.body.data.items).toHaveLength(0);
  });

  // Comments / audit-by-id routes are not implemented — audit is list-only and tenant-pinned.
  itDb('tenant audit list never includes other tenant actions', async () => {
    const a = await request(app)
      .get('/api/v1/tenant-admin/audit')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdmin.token}`);
    const b = await request(app)
      .get('/api/v1/tenant-admin/audit')
      .set('x-tenant', 'beta')
      .set('Authorization', `Bearer ${betaAdmin.token}`);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    // Create an alpha-only audit via settings touch
    await request(app)
      .patch('/api/v1/tenant-admin/tenant')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdmin.token}`)
      .send({ name: 'Alpha University' });
    const a2 = await request(app)
      .get('/api/v1/tenant-admin/audit')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdmin.token}`);
    const b2 = await request(app)
      .get('/api/v1/tenant-admin/audit')
      .set('x-tenant', 'beta')
      .set('Authorization', `Bearer ${betaAdmin.token}`);
    expect(a2.body.data.items.length).toBeGreaterThanOrEqual(a.body.data.items.length);
    expect(b2.body.data.items.length).toBe(b.body.data.items.length);
  });
});

describe('Step 9A — list/search/sort isolation + shared identities', () => {
  itDb('list/search/sort/filter only return current tenant (same titles)', async () => {
    for (const sort of ['latest', 'popular', 'top_rated']) {
      const res = await request(app)
        .get('/api/v1/materials')
        .query({ sort, q: 'Shared' })
        .set('x-tenant', 'alpha')
        .set('Authorization', `Bearer ${alphaStudent.token}`);
      expect(res.status).toBe(200);
      const items = res.body.data.items;
      expect(items.some((m) => m.title === SHARED_MATERIAL_TITLE)).toBe(true);
      expect(items.every((m) => !String(m.id || m._id).includes(String(beta.approved._id)))).toBe(
        true,
      );
      // No beta-only pending title leaked
      expect(items.every((m) => m.title !== 'beta-pending')).toBe(true);
    }

    const betaList = await request(app)
      .get('/api/v1/materials')
      .query({ sort: 'popular' })
      .set('x-tenant', 'beta')
      .set('Authorization', `Bearer ${betaStudent.token}`);
    expect(betaList.status).toBe(200);
    expect(betaList.body.data.items.every((m) => m.title !== 'alpha-pending')).toBe(true);
    expect(betaList.body.data.items.some((m) => m.title === SHARED_MATERIAL_TITLE)).toBe(true);
  });

  itDb('platform tenant stats are per-tenant', async () => {
    const a = await request(app)
      .get(`/api/v1/platform/tenants/${alpha.tenant._id}/stats`)
      .set('Authorization', `Bearer ${platform.token}`);
    const b = await request(app)
      .get(`/api/v1/platform/tenants/${beta.tenant._id}/stats`)
      .set('Authorization', `Bearer ${platform.token}`);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.data.stats).toBeTruthy();
    expect(b.body.data.stats).toBeTruthy();
  });

  itDb('same email, username, course slug exist in both tenants', async () => {
    const users = await User.find({ email: SHARED_EMAIL }).setOptions({ skipTenant: true }).lean();
    expect(users).toHaveLength(2);
    expect(new Set(users.map((u) => String(u.tenantId))).size).toBe(2);

    const byUsername = await User.find({ username: SHARED_USERNAME })
      .setOptions({ skipTenant: true })
      .lean();
    expect(byUsername).toHaveLength(2);

    const courses = await Course.find({ slug: SHARED_COURSE_SLUG })
      .setOptions({ skipTenant: true })
      .lean();
    expect(courses).toHaveLength(2);

    // Login works in each tenant with shared identity
    const la = await login(app, 'alpha', SHARED_EMAIL);
    const lb = await login(app, 'beta', SHARED_EMAIL);
    expect(la.token).toBeTruthy();
    expect(lb.token).toBeTruthy();
    expect(la.token).not.toBe(lb.token);
  });
});

describe('Step 9B — context safety', () => {
  itDb('ALS survives await, Promise.all, setImmediate, nested Mongoose', async () => {
    await runWithTenantContext({ tenantId: alpha.tenant._id, tenant: alpha.tenant }, async () => {
      expect(String(getTenantId())).toBe(String(alpha.tenant._id));

      await Material.findOne({ title: SHARED_MATERIAL_TITLE });
      expect(String(getTenantId())).toBe(String(alpha.tenant._id));

      const [a, b] = await Promise.all([
        Material.find({}).lean(),
        Material.countDocuments({}),
      ]);
      expect(a.every((r) => String(r.tenantId) === String(alpha.tenant._id))).toBe(true);
      expect(b).toBe(a.length);

      await new Promise((resolve, reject) => {
        setImmediate(() => {
          Material.find({})
            .lean()
            .then((rows) => {
              expect(String(getTenantId())).toBe(String(alpha.tenant._id));
              expect(rows.every((r) => String(r.tenantId) === String(alpha.tenant._id))).toBe(true);
              resolve();
            })
            .catch(reject);
        });
      });

      // nested async
      await (async () => {
        const inner = await Material.find({ status: 'approved' }).lean();
        expect(inner.every((r) => String(r.tenantId) === String(alpha.tenant._id))).toBe(true);
      })();
    });
  });

  itDb(
    '50 concurrent Alpha/Beta requests never leak',
    async () => {
    const jobs = [];
    for (let i = 0; i < 50; i += 1) {
      const slug = i % 2 === 0 ? 'alpha' : 'beta';
      const token = slug === 'alpha' ? alphaStudent.token : betaStudent.token;
      const foreignPending = slug === 'alpha' ? 'beta-pending' : 'alpha-pending';
      jobs.push(
        request(app)
          .get('/api/v1/materials')
          .query({ sort: 'latest' })
          .set('x-tenant', slug)
          .set('Authorization', `Bearer ${token}`)
          .then((res) => {
            expect(res.status).toBe(200);
            const titles = (res.body.data.items || []).map((m) => m.title);
            expect(titles).not.toContain(foreignPending);
            expect(titles.filter((t) => t === SHARED_MATERIAL_TITLE).length).toBeLessThanOrEqual(1);
          }),
      );
    }
    await Promise.all(jobs);
  },
    90000,
  );

  itDb('tenant-owned model query outside context throws', async () => {
    await expect(Material.find({}).lean()).rejects.toThrow(/tenantId missing/);
    await expect(Course.find({}).lean()).rejects.toThrow(/tenantId missing/);
    await expect(Invite.find({}).lean()).rejects.toThrow(/tenantId missing/);
  });
});

describe('Step 9C — session / token / cache', () => {
  itDb('deactivated user access token rejected; reactivation restores', async () => {
    const target = await User.findById(alpha.shared._id);
    const session = await login(app, 'alpha', SHARED_EMAIL);
    const ok = await request(app)
      .get('/api/v1/auth/me')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${session.token}`);
    expect(ok.status).toBe(200);

    await request(app)
      .patch(`/api/v1/tenant-admin/users/${target._id}/active`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdmin.token}`)
      .send({ isActive: false });

    const denied = await request(app)
      .get('/api/v1/auth/me')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${session.token}`);
    expect(denied.status).toBe(401);

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('x-tenant', 'alpha')
      .set('Cookie', session.cookie);
    expect([401, 403]).toContain(refresh.status);

    await request(app)
      .patch(`/api/v1/tenant-admin/users/${target._id}/active`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdmin.token}`)
      .send({ isActive: true });

    const again = await login(app, 'alpha', SHARED_EMAIL);
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${again.token}`);
    expect(me.status).toBe(200);
  });

  itDb('demoted tenantAdmin loses admin access immediately (TOKEN_STALE)', async () => {
    // Create a disposable admin
    const passwordHash = (await import('bcryptjs')).default.hashSync(PASSWORD, 8);
    const disposable = await runWithTenantContext(
      { tenantId: alpha.tenant._id, tenant: alpha.tenant },
      async () =>
        User.create({
          fullName: 'Temp Admin',
          username: 'temp_admin_s9',
          email: 'tempadmin@alpha.edu',
          passwordHash,
          role: 'tenantAdmin',
          adminLevel: 'department',
          tenantId: alpha.tenant._id,
          university: alpha.uni._id,
          campus: alpha.campus._id,
          department: alpha.department._id,
          emailVerified: true,
        }),
    );
    const sess = await login(app, 'alpha', 'tempadmin@alpha.edu');
    const pendingOk = await request(app)
      .get('/api/v1/materials/pending')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${sess.token}`);
    expect(pendingOk.status).toBe(200);

    await request(app)
      .patch(`/api/v1/tenant-admin/users/${disposable._id}/role`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdmin.token}`)
      .send({ role: 'student' });

    const stale = await request(app)
      .get('/api/v1/materials/pending')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${sess.token}`);
    expect(stale.status).toBe(401);
    expect(stale.body.code).toBe('TOKEN_STALE');
  });

  itDb('suspended tenant blocks users; refresh fails; reactivate restores', async () => {
    const before = await login(app, 'beta', 'student@beta.edu');
    const suspend = await request(app)
      .patch(`/api/v1/platform/tenants/${beta.tenant._id}/status`)
      .set('Authorization', `Bearer ${platform.token}`)
      .send({ status: 'suspended' });
    expect(suspend.status).toBe(200);

    const blocked = await request(app)
      .get('/api/v1/materials')
      .set('x-tenant', 'beta')
      .set('Authorization', `Bearer ${before.token}`);
    expect(blocked.status).toBe(403);

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('x-tenant', 'beta')
      .set('Cookie', before.cookie);
    expect([401, 403]).toContain(refresh.status);

    await request(app)
      .patch(`/api/v1/platform/tenants/${beta.tenant._id}/status`)
      .set('Authorization', `Bearer ${platform.token}`)
      .send({ status: 'active' });

    const restored = await login(app, 'beta', 'student@beta.edu');
    expect(restored.token).toBeTruthy();
    betaStudent = restored;
    betaAdmin = await login(app, 'beta', 'admin@beta.edu');
  });

  itDb('password change revokes refresh; access token policy documented as short-lived', async () => {
    /**
     * Policy: access JWTs are short-lived (ACCESS_TOKEN_TTL). Password change and
     * role change revoke all refresh tokens immediately. Role mismatch also yields
     * TOKEN_STALE on the next authenticated request. Password change does NOT embed
     * a password version in the access JWT — residual access window ≤ TTL.
     */
    const sess = await login(app, 'alpha', 'student@alpha.edu');
    const change = await request(app)
      .post('/api/v1/auth/change-password')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${sess.token}`)
      .send({ currentPassword: PASSWORD, newPassword: 'NewPass123!' });
    expect(change.status).toBe(200);

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('x-tenant', 'alpha')
      .set('Cookie', sess.cookie);
    expect([401, 403]).toContain(refresh.status);

    // Access may still work until TTL — restore password for other tests
    const u = await User.findById(alpha.student._id).select('+passwordHash').setOptions({
      skipTenant: true,
    });
    u.passwordHash = (await import('bcryptjs')).default.hashSync(PASSWORD, 8);
    await u.save();
    alphaStudent = await login(app, 'alpha', 'student@alpha.edu');
  });

  itDb('cache invalidation: settings / signup-mode / suspend reflect without TTL wait', async () => {
    clearTenantCache();
    // Warm resolveTenant cache (branding does not use the slug cache)
    const warm = await request(app)
      .get('/api/v1/materials')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaStudent.token}`);
    expect(warm.status).toBe(200);
    expect(getCachedTenant('alpha')).toBeTruthy();

    // Platform signup-mode change must invalidate
    const mode = await request(app)
      .patch(`/api/v1/platform/tenants/${alpha.tenant._id}/signup-mode`)
      .set('Authorization', `Bearer ${platform.token}`)
      .send({ signupMode: 'invite' });
    expect(mode.status).toBe(200);
    expect(getCachedTenant('alpha')).toBeNull();

    const branding = await request(app).get('/api/v1/tenants/alpha/branding');
    expect(branding.status).toBe(200);
    expect(branding.body.data.tenant.signupMode).toBe('invite');

    // settings via tenant admin
    await request(app)
      .patch('/api/v1/tenant-admin/tenant')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdmin.token}`)
      .send({ theme: { primaryColor: '#112233' } });
    expect(getCachedTenant('alpha')).toBeNull();
    const branding2 = await request(app).get('/api/v1/tenants/alpha/branding');
    expect(branding2.body.data.tenant.theme.primaryColor.toLowerCase()).toBe('#112233');

    // suspend → immediate 403 (not stale cached active)
    await request(app)
      .get('/api/v1/materials')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaStudent.token}`);
    expect(getCachedTenant('alpha')).toBeTruthy();

    await request(app)
      .patch(`/api/v1/platform/tenants/${alpha.tenant._id}/status`)
      .set('Authorization', `Bearer ${platform.token}`)
      .send({ status: 'suspended' });
    expect(getCachedTenant('alpha')).toBeNull();

    const susp = await request(app).get('/api/v1/tenants/alpha/branding');
    expect(susp.status).toBe(403);
    const blocked = await request(app)
      .get('/api/v1/materials')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaStudent.token}`);
    expect(blocked.status).toBe(403);

    await request(app)
      .patch(`/api/v1/platform/tenants/${alpha.tenant._id}/status`)
      .set('Authorization', `Bearer ${platform.token}`)
      .send({ status: 'active' });
    await request(app)
      .patch(`/api/v1/platform/tenants/${alpha.tenant._id}/signup-mode`)
      .set('Authorization', `Bearer ${platform.token}`)
      .send({ signupMode: 'both' });
  });
});
