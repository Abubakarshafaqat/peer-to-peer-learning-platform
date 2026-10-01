/**
 * Step 4: tenant-scoped signup, invites, email verification.
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
import { emailDomainAllowed } from '../src/modules/auth/signupPolicy.js';
import * as inviteService from '../src/modules/invites/invite.service.js';
import { issueEmailVerification, verifyEmailWithToken } from '../src/modules/auth/emailVerification.js';

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/peer-learning-test';
const PASSWORD = 'ChangeMeAdmin1!';

let app;
let mongoAvailable = false;
let alpha;
let beta;
let uniA;
let campusA;
let deptA;
let courseA;
let subjectA;
let campusB;
let deptB;
let adminToken;
let superToken;

async function wipe() {
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
  await Invite.collection.deleteMany({});
}

async function seed() {
  await wipe();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  alpha = await Tenant.create({
    name: 'Alpha University',
    slug: 'alpha',
    domainWhitelist: ['alpha.edu', 'mail.alpha.edu'],
    signupMode: 'domain',
    status: 'active',
  });
  beta = await Tenant.create({
    name: 'Beta University',
    slug: 'beta',
    domainWhitelist: ['beta.edu'],
    signupMode: 'invite',
    status: 'active',
  });

  uniA = await University.create({ name: 'Alpha University', slug: 'alpha' });
  const uniB = await University.create({ name: 'Beta University', slug: 'beta' });
  alpha.legacyUniversityId = uniA._id;
  await alpha.save();
  beta.legacyUniversityId = uniB._id;
  await beta.save();

  await runWithTenantContext({ tenantId: alpha._id, tenant: alpha }, async () => {
    campusA = await Campus.create({
      name: 'Main',
      slug: 'main',
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

function regBody(overrides = {}) {
  return {
    fullName: 'Test Student',
    username: `u_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    email: `stu_${Date.now()}@alpha.edu`,
    password: PASSWORD,
    campus: String(campusA._id),
    department: String(deptA._id),
    ...overrides,
  };
}

beforeAll(async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 15000 });
    }
    app = createApp();
    await seed();
    mongoAvailable = true;

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('x-tenant', 'alpha')
      .send({ identifier: 'admin@alpha.edu', password: PASSWORD });
    adminToken = adminLogin.body.data.accessToken;

    const plat = await request(app)
      .post('/api/v1/platform/auth/login')
      .send({ identifier: 'super@platform.local', password: PASSWORD });
    superToken = plat.body.data.accessToken;
  } catch (err) {
    console.warn(`[step4.signup] skipped: ${err.message}`);
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

describe('Step 4 — domain matching helpers', () => {
  it('exact match, case, lookalike, subdomain', () => {
    const list = ['fuuast.edu.pk', 'mail.fuuast.edu.pk'];
    expect(emailDomainAllowed('a@fuuast.edu.pk', list)).toBe(true);
    expect(emailDomainAllowed('A@FUUAST.EDU.PK', list)).toBe(true);
    expect(emailDomainAllowed('a@evil-fuuast.edu.pk', list)).toBe(false);
    expect(emailDomainAllowed('a@fuuast.edu.pk.evil.com', list)).toBe(false);
    expect(emailDomainAllowed('a@sub.fuuast.edu.pk', list)).toBe(false);
    expect(emailDomainAllowed('a@mail.fuuast.edu.pk', list)).toBe(true);
  });
});

describe('Step 4 — signup', () => {
  itDb('domain mode accepts whitelisted email', async () => {
    const body = regBody({ email: `ok_${Date.now()}@alpha.edu` });
    const res = await request(app).post('/api/v1/auth/register').set('x-tenant', 'alpha').send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('student');
    expect(res.body.data.user.emailVerified).toBe(false);
  });

  itDb('lookalike domain rejected', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('x-tenant', 'alpha')
      .send(regBody({ email: `x_${Date.now()}@evil-alpha.edu` }));
    expect(res.status).toBe(403);
    expect(res.body.code || res.body.message).toBeTruthy();
  });

  itDb('explicit subdomain allowed when listed', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('x-tenant', 'alpha')
      .send(regBody({ email: `x_${Date.now()}@mail.alpha.edu`, username: `mail_${Date.now()}` }));
    expect(res.status).toBe(201);
  });

  itDb('body role and tenantId ignored', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('x-tenant', 'alpha')
      .send(
        regBody({
          email: `role_${Date.now()}@alpha.edu`,
          username: `role_${Date.now()}`,
          role: 'tenantAdmin',
          tenantId: String(beta._id),
        }),
      );
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('student');
    expect(res.body.data.user.tenantId).toBe(String(alpha._id));
  });

  itDb('closed tenant rejects signup', async () => {
    await Tenant.updateOne({ slug: 'alpha' }, { signupMode: 'closed' });
    clearTenantCache();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('x-tenant', 'alpha')
      .send(regBody({ email: `closed_${Date.now()}@alpha.edu`, username: `closed_${Date.now()}` }));
    expect(res.status).toBe(403);
    await Tenant.updateOne({ slug: 'alpha' }, { signupMode: 'domain' });
    clearTenantCache();
  });

  itDb('same email may register in two tenants', async () => {
    const email = `shared_${Date.now()}@shared.test`;
    // Alpha domain mode won't allow shared.test — switch both to invite
    await Tenant.updateOne({ slug: 'alpha' }, { signupMode: 'invite', domainWhitelist: [] });
    clearTenantCache();

    const invA = await runWithTenantContext({ tenantId: alpha._id, tenant: alpha }, async () => {
      const admin = await User.findOne({ email: 'admin@alpha.edu' });
      return inviteService.createInvite(admin, { maxUses: 2 });
    });
    const invB = await runWithTenantContext({ tenantId: beta._id, tenant: beta }, async () => {
      // use superadmin via platform-style create inside beta ALS
      const superUser = await User.findOne({ email: 'super@platform.local' }).setOptions({
        skipTenant: true,
      });
      return inviteService.createInvite(superUser, { maxUses: 2 });
    });

    const r1 = await request(app)
      .post('/api/v1/auth/register')
      .set('x-tenant', 'alpha')
      .send(
        regBody({
          email,
          username: `sha_${Date.now()}`,
          inviteCode: invA.plainCode,
          campus: String(campusA._id),
          department: String(deptA._id),
        }),
      );
    const r2 = await request(app)
      .post('/api/v1/auth/register')
      .set('x-tenant', 'beta')
      .send({
        fullName: 'Shared',
        username: `shb_${Date.now()}`,
        email,
        password: PASSWORD,
        campus: String(campusB._id),
        department: String(deptB._id),
        inviteCode: invB.plainCode,
      });

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r1.body.data.user.tenantId).not.toBe(r2.body.data.user.tenantId);

    await Tenant.updateOne(
      { slug: 'alpha' },
      { signupMode: 'domain', domainWhitelist: ['alpha.edu', 'mail.alpha.edu'] },
    );
    clearTenantCache();
  });
});

describe('Step 4 — invites', () => {
  itDb('valid invite on invite-mode tenant', async () => {
    const { plainCode } = await runWithTenantContext(
      { tenantId: beta._id, tenant: beta },
      async () => {
        const superUser = await User.findOne({ email: 'super@platform.local' }).setOptions({
          skipTenant: true,
        });
        return inviteService.createInvite(superUser, { maxUses: 1 });
      },
    );

    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('x-tenant', 'beta')
      .send({
        fullName: 'Invited',
        username: `inv_${Date.now()}`,
        email: `inv_${Date.now()}@anywhere.com`,
        password: PASSWORD,
        campus: String(campusB._id),
        department: String(deptB._id),
        inviteCode: plainCode,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.user.emailVerified).toBe(true);
  });

  itDb('expired invite rejected', async () => {
    const { invite, plainCode } = await runWithTenantContext(
      { tenantId: beta._id, tenant: beta },
      async () => {
        const superUser = await User.findOne({ email: 'super@platform.local' }).setOptions({
          skipTenant: true,
        });
        return inviteService.createInvite(superUser, {
          maxUses: 1,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        });
      },
    );
    await Invite.updateOne({ _id: invite._id }, { expiresAt: new Date(Date.now() - 1000) }).setOptions({
      skipTenant: true,
    });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('x-tenant', 'beta')
      .send({
        fullName: 'Expired User',
        username: `exp_${Date.now()}`,
        email: `exp_${Date.now()}@x.com`,
        password: PASSWORD,
        campus: String(campusB._id),
        department: String(deptB._id),
        inviteCode: plainCode,
      });
    expect(res.status).toBe(403);
  });

  itDb('revoked invite rejected', async () => {
    const created = await runWithTenantContext({ tenantId: beta._id, tenant: beta }, async () => {
      const superUser = await User.findOne({ email: 'super@platform.local' }).setOptions({
        skipTenant: true,
      });
      return inviteService.createInvite(superUser, { maxUses: 5 });
    });
    await runWithTenantContext({ tenantId: beta._id, tenant: beta }, async () => {
      const superUser = await User.findOne({ email: 'super@platform.local' }).setOptions({
        skipTenant: true,
      });
      await inviteService.revokeInvite(superUser, created.invite._id);
    });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('x-tenant', 'beta')
      .send({
        fullName: 'Revoked User',
        username: `rev_${Date.now()}`,
        email: `rev_${Date.now()}@x.com`,
        password: PASSWORD,
        campus: String(campusB._id),
        department: String(deptB._id),
        inviteCode: created.plainCode,
      });
    expect(res.status).toBe(403);
  });

  itDb('exhausted invite rejected', async () => {
    const created = await runWithTenantContext({ tenantId: beta._id, tenant: beta }, async () => {
      const superUser = await User.findOne({ email: 'super@platform.local' }).setOptions({
        skipTenant: true,
      });
      return inviteService.createInvite(superUser, { maxUses: 1 });
    });

    const ok = await request(app)
      .post('/api/v1/auth/register')
      .set('x-tenant', 'beta')
      .send({
        fullName: 'One',
        username: `exh1_${Date.now()}`,
        email: `exh1_${Date.now()}@x.com`,
        password: PASSWORD,
        campus: String(campusB._id),
        department: String(deptB._id),
        inviteCode: created.plainCode,
      });
    expect(ok.status).toBe(201);

    const fail = await request(app)
      .post('/api/v1/auth/register')
      .set('x-tenant', 'beta')
      .send({
        fullName: 'Two',
        username: `exh2_${Date.now()}`,
        email: `exh2_${Date.now()}@x.com`,
        password: PASSWORD,
        campus: String(campusB._id),
        department: String(deptB._id),
        inviteCode: created.plainCode,
      });
    expect(fail.status).toBe(403);
  });

  itDb('concurrent redemption maxUses 1 — only one succeeds', async () => {
    const created = await runWithTenantContext({ tenantId: beta._id, tenant: beta }, async () => {
      const superUser = await User.findOne({ email: 'super@platform.local' }).setOptions({
        skipTenant: true,
      });
      return inviteService.createInvite(superUser, { maxUses: 1 });
    });

    const ts = Date.now();
    const mk = (n) =>
      request(app)
        .post('/api/v1/auth/register')
        .set('x-tenant', 'beta')
        .send({
          fullName: `C${n}`,
          username: `conc_${ts}_${n}`,
          email: `conc_${ts}_${n}@x.com`,
          password: PASSWORD,
          campus: String(campusB._id),
          department: String(deptB._id),
          inviteCode: created.plainCode,
        });

    const [a, b] = await Promise.all([mk(1), mk(2)]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 403]);
  }, 45000);

  itDb('alpha invite used with x-tenant beta fails', async () => {
    await Tenant.updateOne({ slug: 'alpha' }, { signupMode: 'invite', domainWhitelist: [] });
    clearTenantCache();

    const created = await runWithTenantContext({ tenantId: alpha._id, tenant: alpha }, async () => {
      const admin = await User.findOne({ email: 'admin@alpha.edu' });
      return inviteService.createInvite(admin, { maxUses: 3 });
    });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('x-tenant', 'beta')
      .send({
        fullName: 'Cross',
        username: `cross_${Date.now()}`,
        email: `cross_${Date.now()}@x.com`,
        password: PASSWORD,
        campus: String(campusB._id),
        department: String(deptB._id),
        inviteCode: created.plainCode,
      });
    expect(res.status).toBe(403);

    await Tenant.updateOne(
      { slug: 'alpha' },
      { signupMode: 'domain', domainWhitelist: ['alpha.edu', 'mail.alpha.edu'] },
    );
    clearTenantCache();
  });

  itDb('tenantAdmin can create invite via API', async () => {
    const res = await request(app)
      .post('/api/v1/invites')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ maxUses: 3, expiresInDays: 7 });
    expect(res.status).toBe(201);
    expect(res.body.data.code).toBeTruthy();
    expect(res.body.data.invite.maxUses).toBe(3);
  });
});

describe('Step 4 — email verification gate', () => {
  itDb('unverified user blocked from upload; verified allowed', async () => {
    await Tenant.updateOne(
      { slug: 'alpha' },
      { signupMode: 'domain', domainWhitelist: ['alpha.edu', 'mail.alpha.edu'] },
    );
    clearTenantCache();

    const email = `unver_${Date.now()}@alpha.edu`;
    const username = `unver_${Date.now()}`;
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('x-tenant', 'alpha')
      .send(regBody({ email, username }));
    expect(reg.status).toBe(201);
    expect(reg.body.data.user.emailVerified).toBe(false);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('x-tenant', 'alpha')
      .send({ identifier: email, password: PASSWORD });
    expect(login.status).toBe(200);
    const token = login.body.data.accessToken;

    const blocked = await request(app)
      .post('/api/v1/materials')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Notes')
      .field('type', 'notes')
      .field('course', String(courseA._id))
      .field('subject', String(subjectA._id))
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 't.pdf', contentType: 'application/pdf' });
    expect(blocked.status).toBe(403);

    const user = await User.findOne({ email }).select('+emailVerification.hash');
    const { token: verifyToken } = await issueEmailVerification(user);
    await verifyEmailWithToken({ email, token: verifyToken });

    const login2 = await request(app)
      .post('/api/v1/auth/login')
      .set('x-tenant', 'alpha')
      .send({ identifier: email, password: PASSWORD });
    const token2 = login2.body.data.accessToken;

    const ok = await request(app)
      .post('/api/v1/materials')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${token2}`)
      .field('title', 'Notes')
      .field('type', 'notes')
      .field('course', String(courseA._id))
      .field('subject', String(subjectA._id))
      .attach('file', Buffer.from('%PDF-1.4 test'), {
        filename: 't.pdf',
        contentType: 'application/pdf',
      });
    expect(ok.status).toBe(201);
  }, 60000);
});
