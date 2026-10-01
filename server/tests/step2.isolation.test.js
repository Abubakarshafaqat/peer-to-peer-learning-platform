import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { runWithTenantContext, getTenantId } from '../src/utils/tenantContext.js';
import { clearTenantCache } from '../src/utils/tenantCache.js';
import { Tenant } from '../src/models/Tenant.js';
import { University } from '../src/models/University.js';
import { Campus } from '../src/models/Campus.js';
import { Department } from '../src/models/Department.js';
import { Course } from '../src/models/Course.js';
import { Subject } from '../src/models/Subject.js';
import { User } from '../src/models/User.js';
import { Material } from '../src/models/Material.js';
import { RefreshToken } from '../src/models/RefreshToken.js';

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/peer-learning-test';

let app;
let mongoAvailable = false;
let alpha;
let beta;
let alphaStudentToken;
let alphaRefreshCookie;
let superToken;

async function seedFixture() {
  clearTenantCache();
  await Tenant.deleteMany({});
  await University.deleteMany({});
  await Campus.collection.deleteMany({});
  await Department.collection.deleteMany({});
  await Course.collection.deleteMany({});
  await Subject.collection.deleteMany({});
  await User.collection.deleteMany({});
  await Material.collection.deleteMany({});
  await RefreshToken.collection.deleteMany({});

  const passwordHash = await bcrypt.hash('ChangeMeAdmin1!', 10);

  alpha = await Tenant.create({
    name: 'Alpha University',
    slug: 'alpha',
    domainWhitelist: ['alpha.edu'],
    status: 'active',
    settings: { inviteCode: 'alpha-invite', moderationEnabled: true },
  });
  beta = await Tenant.create({
    name: 'Beta University',
    slug: 'beta',
    domainWhitelist: ['beta.edu'],
    status: 'active',
    settings: { inviteCode: 'beta-invite', moderationEnabled: true },
  });

  const uniA = await University.create({ name: 'Alpha University', slug: 'alpha' });
  const uniB = await University.create({ name: 'Beta University', slug: 'beta' });
  alpha.legacyUniversityId = uniA._id;
  await alpha.save();
  beta.legacyUniversityId = uniB._id;
  await beta.save();

  async function seedTenant(tenant, uni, emailPrefix) {
    return runWithTenantContext({ tenantId: tenant._id, tenant }, async () => {
      const campus = await Campus.create({
        name: 'Main',
        slug: 'main',
        university: uni._id,
        tenantId: tenant._id,
      });
      const department = await Department.create({
        name: 'CS',
        slug: 'cs',
        campus: campus._id,
        university: uni._id,
        tenantId: tenant._id,
      });
      const course = await Course.create({
        name: 'BSCS',
        slug: 'bscs',
        department: department._id,
        campus: campus._id,
        university: uni._id,
        tenantId: tenant._id,
      });
      const subject = await Subject.create({
        name: 'PF',
        slug: 'pf',
        course: course._id,
        tenantId: tenant._id,
      });
      const student = await User.create({
        fullName: `${emailPrefix} Student`,
        username: `${emailPrefix}_student`,
        email: `student@${emailPrefix}.edu`,
        passwordHash,
        role: 'student',
        tenantId: tenant._id,
        university: uni._id,
        campus: campus._id,
        department: department._id,
      });
      await Material.create({
        title: `${emailPrefix}-notes`,
        type: 'notes',
        file: {
          publicId: `${emailPrefix}.pdf`,
          deliveryRef: `${emailPrefix}.pdf`,
          provider: 'local',
          mimeType: 'application/pdf',
          size: 100,
          bytes: 100,
          originalName: 'n.pdf',
        },
        uploader: student._id,
        university: uni._id,
        campus: campus._id,
        department: department._id,
        course: course._id,
        subject: subject._id,
        status: 'approved',
        tenantId: tenant._id,
      });
      return { campus, department, course, subject, student };
    });
  }

  await seedTenant(alpha, uniA, 'alpha');
  await seedTenant(beta, uniB, 'beta');

  await User.create({
    fullName: 'Super',
    username: 'superadmin',
    email: 'super@platform.local',
    passwordHash,
    role: 'superadmin',
    tenantId: null,
  });
}

beforeAll(async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 15000 });
    }
    app = createApp();
    await seedFixture();
    mongoAvailable = true;

    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('x-tenant', 'alpha')
      .send({ identifier: 'student@alpha.edu', password: 'ChangeMeAdmin1!' });
    alphaStudentToken = login.body.data.accessToken;
    alphaRefreshCookie = login.headers['set-cookie'];

    const plat = await request(app)
      .post('/api/v1/platform/auth/login')
      .send({ identifier: 'super@platform.local', password: 'ChangeMeAdmin1!' });
    superToken = plat.body.data.accessToken;
  } catch (err) {
    console.warn(`[step2.isolation] skipped: ${err.message}`);
  }
}, 90000);

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

function itDb(name, fn) {
  it(name, async () => {
    if (!mongoAvailable) {
      throw new Error('MongoDB required — set MONGODB_URI in server/.env');
    }
    await fn();
  });
}

describe('Step 2 — tenant resolution + JWT binding', () => {
  itDb('missing x-tenant -> 400', async () => {
    const res = await request(app).get('/api/v1/materials');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tenant/i);
  });

  itDb('invalid slug -> 400', async () => {
    const res = await request(app).get('/api/v1/materials').set('x-tenant', 'A');
    expect(res.status).toBe(400);
  });

  itDb('unknown tenant -> 404', async () => {
    const res = await request(app).get('/api/v1/materials').set('x-tenant', 'no-such-uni');
    expect(res.status).toBe(404);
  });

  itDb('suspended tenant -> 403', async () => {
    await Tenant.updateOne({ slug: 'beta' }, { status: 'suspended' });
    clearTenantCache();
    const res = await request(app).get('/api/v1/materials').set('x-tenant', 'beta');
    expect(res.status).toBe(403);
    await Tenant.updateOne({ slug: 'beta' }, { status: 'active' });
    clearTenantCache();
  });

  itDb('public branding hides whitelist/settings', async () => {
    const res = await request(app).get('/api/v1/tenants/alpha/branding');
    expect(res.status).toBe(200);
    expect(res.body.data.tenant).toMatchObject({ slug: 'alpha', name: 'Alpha University' });
    expect(res.body.data.tenant.domainWhitelist).toBeUndefined();
    expect(res.body.data.tenant.settings).toBeUndefined();
    expect(res.body.data.tenant.signupMode).toBeDefined();
    expect(Array.isArray(res.body.data.tenant.allowedDomains)).toBe(true);
  });

  itDb('alpha token + x-tenant beta -> 403', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('x-tenant', 'beta')
      .set('Authorization', `Bearer ${alphaStudentToken}`);
    expect(res.status).toBe(403);
  });

  itDb('alpha token + x-tenant alpha -> 200 and only alpha materials', async () => {
    const res = await request(app)
      .get('/api/v1/materials')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaStudentToken}`);
    expect(res.status).toBe(200);
    const titles = (res.body.data.items || []).map((i) => i.title);
    expect(titles.every((t) => String(t).startsWith('alpha'))).toBe(true);
    expect(titles.some((t) => String(t).startsWith('beta'))).toBe(false);
  });

  itDb('superadmin token on tenant route -> 403', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(403);
  });

  itDb('superadmin token on platform route -> 200', async () => {
    const res = await request(app)
      .get('/api/v1/platform/stats')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.tenants).toBeGreaterThanOrEqual(2);
  });

  itDb('refresh token from alpha with x-tenant beta -> rejected', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('x-tenant', 'beta')
      .set('Cookie', alphaRefreshCookie);
    expect([401, 403]).toContain(res.status);
  });

  itDb('body tenantId is ignored on create metadata path', async () => {
    // Login again for fresh token after earlier tests
    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('x-tenant', 'alpha')
      .send({ identifier: 'student@alpha.edu', password: 'ChangeMeAdmin1!' });
    const token = login.body.data.accessToken;

    const before = await request(app)
      .get('/api/v1/materials')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);

    // Attempt to smuggle beta tenantId — stripped by middleware; upload still requires file
    const res = await request(app)
      .post('/api/v1/materials')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'smuggle')
      .field('type', 'notes')
      .field('tenantId', String(beta._id))
      .field('course', String(new mongoose.Types.ObjectId()))
      .field('subject', String(new mongoose.Types.ObjectId()));
    // Must not succeed as beta cross-create; expect 400 validation / no-file / taxonomy — never 201 for beta
    expect(res.status).not.toBe(201);
    if (res.body?.data?.material) {
      expect(String(res.body.data.material.university?.id || '')).not.toBe(String(beta.legacyUniversityId));
    }
  });

  itDb('ALS survives through Mongoose find', async () => {
    await runWithTenantContext({ tenantId: alpha._id }, async () => {
      expect(String(getTenantId())).toBe(String(alpha._id));
      const rows = await Material.find({}).lean();
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => String(r.tenantId) === String(alpha._id))).toBe(true);
    });
  });

  itDb('ALS survives Promise.all of Mongoose queries', async () => {
    await runWithTenantContext({ tenantId: alpha._id, tenant: alpha }, async () => {
      const [a, b, count] = await Promise.all([
        Material.find({}).lean(),
        Material.find({ status: 'approved' }).lean(),
        Material.countDocuments({}),
      ]);
      expect(String(getTenantId())).toBe(String(alpha._id));
      expect(a.every((r) => String(r.tenantId) === String(alpha._id))).toBe(true);
      expect(b.every((r) => String(r.tenantId) === String(alpha._id))).toBe(true);
      expect(count).toBe(a.length);
    });
  });

  itDb('tenant login rejects superadmin (null tenantId)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('x-tenant', 'alpha')
      .send({ identifier: 'super@platform.local', password: 'ChangeMeAdmin1!' });
    expect(res.status).toBe(403);
    expect(res.body.code || res.body.message).toBeTruthy();
  });
});
