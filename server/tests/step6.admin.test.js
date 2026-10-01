/**
 * Step 6: Super Admin + Tenant Admin APIs.
 */
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { runWithTenantContext } from '../src/utils/tenantContext.js';
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
import { Invite } from '../src/models/Invite.js';
import { AuditLog } from '../src/models/AuditLog.js';

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/peer-learning-test';
const PASSWORD = 'ChangeMeAdmin1!';

let app;
let mongoAvailable = false;
let alpha;
let beta;
let campusA;
let campusA2;
let deptA;
let courseA;
let subjectA;
let campusB;
let deptB;
let alphaAdminToken;
let alphaCampusAdminToken;
let betaAdminToken;
let superToken;
let alphaStudentId;
let betaStudentId;
let betaPendingId;
let campus2PendingId;

async function wipe() {
  clearTenantCache();
  await Promise.all([
    Tenant.deleteMany({}),
    University.deleteMany({}),
    Campus.collection.deleteMany({}),
    Department.collection.deleteMany({}),
    Course.collection.deleteMany({}),
    Subject.collection.deleteMany({}),
    User.collection.deleteMany({}),
    Material.collection.deleteMany({}),
    RefreshToken.collection.deleteMany({}),
    Invite.collection.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
}

async function seed() {
  await wipe();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  alpha = await Tenant.create({
    name: 'Alpha University',
    slug: 'alpha',
    domainWhitelist: ['alpha.edu'],
    signupMode: 'domain',
    status: 'active',
    theme: { primaryColor: '#0f766e' },
  });
  beta = await Tenant.create({
    name: 'Beta University',
    slug: 'beta',
    domainWhitelist: ['beta.edu'],
    signupMode: 'domain',
    status: 'active',
  });

  const uniA = await University.create({ name: 'Alpha', slug: 'alpha-u' });
  const uniB = await University.create({ name: 'Beta', slug: 'beta-u' });

  await runWithTenantContext({ tenantId: alpha._id, tenant: alpha }, async () => {
    campusA = await Campus.create({
      name: 'C1',
      slug: 'c1',
      university: uniA._id,
      tenantId: alpha._id,
    });
    campusA2 = await Campus.create({
      name: 'C2',
      slug: 'c2',
      university: uniA._id,
      tenantId: alpha._id,
    });
    deptA = await Department.create({
      name: 'CS',
      slug: 'cs',
      campus: campusA._id,
      university: uniA._id,
      tenantId: alpha._id,
    });
    const deptA2 = await Department.create({
      name: 'Math',
      slug: 'math',
      campus: campusA2._id,
      university: uniA._id,
      tenantId: alpha._id,
    });
    courseA = await Course.create({
      name: 'BSCS',
      slug: 'bscs',
      department: deptA._id,
      campus: campusA._id,
      university: uniA._id,
      tenantId: alpha._id,
    });
    subjectA = await Subject.create({
      name: 'PF',
      slug: 'pf',
      course: courseA._id,
      tenantId: alpha._id,
    });
    const courseA2 = await Course.create({
      name: 'BSMath',
      slug: 'bsmath',
      department: deptA2._id,
      campus: campusA2._id,
      university: uniA._id,
      tenantId: alpha._id,
    });
    const subjectA2 = await Subject.create({
      name: 'Calc',
      slug: 'calc',
      course: courseA2._id,
      tenantId: alpha._id,
    });

    await User.create({
      fullName: 'Alpha Admin',
      username: 'alpha_admin',
      email: 'admin@alpha.edu',
      passwordHash,
      role: 'tenantAdmin',
      adminLevel: 'university',
      tenantId: alpha._id,
      university: uniA._id,
      campus: campusA._id,
      department: deptA._id,
      emailVerified: true,
    });
    await User.create({
      fullName: 'Campus Admin',
      username: 'campus_admin',
      email: 'campus@alpha.edu',
      passwordHash,
      role: 'tenantAdmin',
      adminLevel: 'campus',
      tenantId: alpha._id,
      university: uniA._id,
      campus: campusA._id,
      emailVerified: true,
    });
    const student = await User.create({
      fullName: 'Alpha Student',
      username: 'alpha_student',
      email: 'student@alpha.edu',
      passwordHash,
      role: 'student',
      tenantId: alpha._id,
      university: uniA._id,
      campus: campusA._id,
      department: deptA._id,
      emailVerified: true,
    });
    alphaStudentId = student._id;

    const m2 = await Material.create({
      title: 'Campus2 pending',
      type: 'notes',
      file: {
        publicId: 'c2.pdf',
        deliveryRef: 'c2.pdf',
        provider: 'local',
        mimeType: 'application/pdf',
        size: 50,
        bytes: 50,
        originalName: 'c2.pdf',
      },
      uploader: student._id,
      university: uniA._id,
      campus: campusA2._id,
      department: deptA2._id,
      course: courseA2._id,
      subject: subjectA2._id,
      status: 'pending',
      tenantId: alpha._id,
    });
    campus2PendingId = m2._id;
  });

  await runWithTenantContext({ tenantId: beta._id, tenant: beta }, async () => {
    campusB = await Campus.create({
      name: 'Main',
      slug: 'main',
      university: uniB._id,
      tenantId: beta._id,
    });
    deptB = await Department.create({
      name: 'SE',
      slug: 'se',
      campus: campusB._id,
      university: uniB._id,
      tenantId: beta._id,
    });
    const courseB = await Course.create({
      name: 'BESE',
      slug: 'bese',
      department: deptB._id,
      campus: campusB._id,
      university: uniB._id,
      tenantId: beta._id,
    });
    const subjectB = await Subject.create({
      name: 'OOP',
      slug: 'oop',
      course: courseB._id,
      tenantId: beta._id,
    });
    await User.create({
      fullName: 'Beta Admin',
      username: 'beta_admin',
      email: 'admin@beta.edu',
      passwordHash,
      role: 'tenantAdmin',
      adminLevel: 'university',
      tenantId: beta._id,
      university: uniB._id,
      campus: campusB._id,
      department: deptB._id,
      emailVerified: true,
    });
    const studentB = await User.create({
      fullName: 'Beta Student',
      username: 'beta_student',
      email: 'student@beta.edu',
      passwordHash,
      role: 'student',
      tenantId: beta._id,
      university: uniB._id,
      campus: campusB._id,
      department: deptB._id,
      emailVerified: true,
    });
    betaStudentId = studentB._id;
    const mat = await Material.create({
      title: 'Beta pending',
      type: 'notes',
      file: {
        publicId: 'b.pdf',
        deliveryRef: 'b.pdf',
        provider: 'local',
        mimeType: 'application/pdf',
        size: 100,
        bytes: 100,
        originalName: 'b.pdf',
      },
      uploader: studentB._id,
      university: uniB._id,
      campus: campusB._id,
      department: deptB._id,
      course: courseB._id,
      subject: subjectB._id,
      status: 'pending',
      tenantId: beta._id,
    });
    betaPendingId = mat._id;
  });

  await User.create({
    fullName: 'Super',
    username: 'superadmin',
    email: 'super@platform.local',
    passwordHash,
    role: 'superadmin',
    tenantId: null,
    emailVerified: true,
  });
}

beforeAll(async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 15000 });
    }
    app = createApp();
    await seed();
    mongoAvailable = true;

    const login = async (id, tenant) => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('x-tenant', tenant)
        .send({ identifier: id, password: PASSWORD });
      return res.body.data.accessToken;
    };
    alphaAdminToken = await login('admin@alpha.edu', 'alpha');
    alphaCampusAdminToken = await login('campus@alpha.edu', 'alpha');
    betaAdminToken = await login('admin@beta.edu', 'beta');
    const plat = await request(app)
      .post('/api/v1/platform/auth/login')
      .send({ identifier: 'super@platform.local', password: PASSWORD });
    superToken = plat.body.data.accessToken;
  } catch (err) {
    console.warn(`[step6] skipped: ${err.message}`);
  }
}, 90000);

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

function itDb(name, fn, timeout = 30000) {
  it(
    name,
    async () => {
      if (!mongoAvailable) throw new Error('MongoDB required');
      await fn();
    },
    timeout,
  );
}

describe('Step 6 — platform tenants', () => {
  itDb('rejects reserved slug', async () => {
    const res = await request(app)
      .post('/api/v1/platform/tenants')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ name: 'WWW Org', slug: 'www' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TENANT_SLUG_RESERVED');
  });

  itDb('create / suspend / reactivate tenant; refresh fails when suspended', async () => {
    const created = await request(app)
      .post('/api/v1/platform/tenants')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        name: 'Gamma U',
        slug: 'gamma',
        domainWhitelist: ['gamma.edu'],
        signupMode: 'domain',
        firstAdmin: {
          email: 'admin@gamma.edu',
          username: 'gamma_admin',
          fullName: 'Gamma Admin',
        },
      });
    expect(created.status).toBe(201);
    expect(created.body.data.tenant.slug).toBe('gamma');
    expect(created.body.data.firstAdmin.setupUrl).toMatch(/set-password/);
    expect(JSON.stringify(created.body)).not.toMatch(/passwordHash|ChangeMe/);

    const audits = await AuditLog.find({ action: 'tenant.create', 'target.label': 'gamma' });
    expect(audits.length).toBeGreaterThanOrEqual(1);

    // slug immutable
    const patchSlug = await request(app)
      .patch(`/api/v1/platform/tenants/${created.body.data.tenant.id}`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ slug: 'gamma2' });
    expect(patchSlug.status).toBe(400);

    // login gamma admin after set-password is separate; suspend alpha instead for refresh test
    const studentLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('x-tenant', 'alpha')
      .send({ identifier: 'student@alpha.edu', password: PASSWORD });
    expect(studentLogin.status).toBe(200);
    const cookies = studentLogin.headers['set-cookie'];

    const sus = await request(app)
      .patch(`/api/v1/platform/tenants/${alpha._id}/status`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: 'suspended' });
    expect(sus.status).toBe(200);

    clearTenantCache();
    const blocked = await request(app)
      .get('/api/v1/materials')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${studentLogin.body.data.accessToken}`);
    expect(blocked.status).toBe(403);

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('x-tenant', 'alpha')
      .set('Cookie', cookies);
    expect([401, 403]).toContain(refresh.status);

    const act = await request(app)
      .patch(`/api/v1/platform/tenants/${alpha._id}/status`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: 'active' });
    expect(act.status).toBe(200);
    clearTenantCache();

    // re-login after reactivate
    alphaAdminToken = (
      await request(app)
        .post('/api/v1/auth/login')
        .set('x-tenant', 'alpha')
        .send({ identifier: 'admin@alpha.edu', password: PASSWORD })
    ).body.data.accessToken;
    alphaCampusAdminToken = (
      await request(app)
        .post('/api/v1/auth/login')
        .set('x-tenant', 'alpha')
        .send({ identifier: 'campus@alpha.edu', password: PASSWORD })
    ).body.data.accessToken;
  }, 60000);

  itDb('per-tenant stats aggregation', async () => {
    const res = await request(app)
      .get(`/api/v1/platform/tenants/${beta._id}/stats`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.stats.userCount).toBeGreaterThanOrEqual(2);
    expect(res.body.data.stats.materialCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.stats.storageUsedBytes).toBeGreaterThanOrEqual(100);
  });
});

describe('Step 6 — tenant admin isolation', () => {
  itDb('alpha admin cannot touch beta users/settings/moderation', async () => {
    const users = await request(app)
      .get('/api/v1/tenant-admin/users')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdminToken}`);
    expect(users.status).toBe(200);
    expect(users.body.data.items.every((u) => u.tenantId === String(alpha._id))).toBe(true);

    const role = await request(app)
      .patch(`/api/v1/tenant-admin/users/${betaStudentId}/role`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdminToken}`)
      .send({ role: 'tenantAdmin', adminLevel: 'department' });
    expect([403, 404]).toContain(role.status);

    const mod = await request(app)
      .patch(`/api/v1/tenant-admin/moderation/${betaPendingId}`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdminToken}`)
      .send({ status: 'approved' });
    expect([403, 404]).toContain(mod.status);

    // Cannot set domainWhitelist / slug / status
    const settings = await request(app)
      .patch('/api/v1/tenant-admin/tenant')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdminToken}`)
      .send({ domainWhitelist: ['evil.com'], slug: 'hacked', status: 'suspended' });
    expect(settings.status).toBe(403);
  });

  itDb('cannot grant superadmin; cannot demote last admin', async () => {
    const grant = await request(app)
      .patch(`/api/v1/tenant-admin/users/${alphaStudentId}/role`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdminToken}`)
      .send({ role: 'superadmin' });
    expect(grant.status).toBe(400);

    // Promote student then try demoting both admins leaving one — demote campus + university until last
    await request(app)
      .patch(`/api/v1/tenant-admin/users/${alphaStudentId}/role`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdminToken}`)
      .send({ role: 'tenantAdmin', adminLevel: 'department' });

    // Count tenantAdmins — demote campus admin and student-admin, leave university admin
    const campusUser = await User.findOne({ email: 'campus@alpha.edu' }).setOptions({
      skipTenant: true,
    });
    await request(app)
      .patch(`/api/v1/tenant-admin/users/${campusUser._id}/role`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdminToken}`)
      .send({ role: 'student' });

    await request(app)
      .patch(`/api/v1/tenant-admin/users/${alphaStudentId}/role`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdminToken}`)
      .send({ role: 'student' });

    const last = await User.findOne({ email: 'admin@alpha.edu' }).setOptions({ skipTenant: true });
    const demoteLast = await request(app)
      .patch(`/api/v1/tenant-admin/users/${last._id}/role`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdminToken}`)
      .send({ role: 'student' });
    expect(demoteLast.status).toBe(403);
    expect(demoteLast.body.code).toBe('LAST_ADMIN');
  });

  itDb('campus admin cannot moderate outside campus', async () => {
    // restore campus admin role if demoted
    await User.updateOne(
      { email: 'campus@alpha.edu' },
      { $set: { role: 'tenantAdmin', adminLevel: 'campus' } },
    ).setOptions({ skipTenant: true, overwriteImmutable: true });
    alphaCampusAdminToken = (
      await request(app)
        .post('/api/v1/auth/login')
        .set('x-tenant', 'alpha')
        .send({ identifier: 'campus@alpha.edu', password: PASSWORD })
    ).body.data.accessToken;

    const res = await request(app)
      .patch(`/api/v1/tenant-admin/moderation/${campus2PendingId}`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaCampusAdminToken}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(403);
  });

  itDb('settings validation: bad hex, oversize, bad mime', async () => {
    const badHex = await request(app)
      .patch('/api/v1/tenant-admin/tenant')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdminToken}`)
      .send({ theme: { primaryColor: 'green' } });
    expect(badHex.status).toBe(400);

    const oversize = await request(app)
      .patch('/api/v1/tenant-admin/tenant')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdminToken}`)
      .send({ settings: { maxUploadMB: 9999 } });
    expect(oversize.status).toBe(400);

    const badMime = await request(app)
      .patch('/api/v1/tenant-admin/tenant')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdminToken}`)
      .send({ settings: { allowedFileTypes: ['application/x-msdownload'] } });
    expect(badMime.status).toBe(400);

    const ok = await request(app)
      .patch('/api/v1/tenant-admin/tenant')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdminToken}`)
      .send({
        theme: { primaryColor: '#112233' },
        settings: { maxUploadMB: 25, moderationEnabled: true },
      });
    expect(ok.status).toBe(200);
    expect(ok.body.data.tenant.theme.primaryColor).toBe('#112233');
  });

  itDb('tenant admin audit log is scoped to own tenant', async () => {
    await request(app)
      .patch('/api/v1/tenant-admin/tenant')
      .set('x-tenant', 'beta')
      .set('Authorization', `Bearer ${betaAdminToken}`)
      .send({ name: 'Beta University Renamed' });

    const alphaLogs = await request(app)
      .get('/api/v1/tenant-admin/audit')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${alphaAdminToken}`);
    expect(alphaLogs.status).toBe(200);
    expect(
      alphaLogs.body.data.items.every(
        (a) => !a.target?.label || a.target.label !== 'beta' || a.action.startsWith('tenant'),
      ),
    ).toBe(true);
    // no beta-only action ids leaking — all for alpha tenantId in DB
    const alphaTenantActions = await AuditLog.find({ tenantId: alpha._id }).lean();
    const betaOnly = alphaTenantActions.filter((a) => a.action === 'tenant.settings_update' && a.target?.label === 'beta');
    expect(betaOnly).toHaveLength(0);

    const betaLogs = await request(app)
      .get('/api/v1/tenant-admin/audit')
      .set('x-tenant', 'beta')
      .set('Authorization', `Bearer ${betaAdminToken}`);
    expect(betaLogs.body.data.items.some((a) => a.action === 'tenant.settings_update')).toBe(true);
  });
});
