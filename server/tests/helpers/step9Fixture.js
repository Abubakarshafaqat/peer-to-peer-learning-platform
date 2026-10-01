/**
 * Shared Step 9 fixture: Alpha + Beta with identical titles/course codes,
 * invites, materials, and users for cross-tenant isolation tests.
 */
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { clearTenantCache } from '../../src/utils/tenantCache.js';
import { runWithTenantContext } from '../../src/utils/tenantContext.js';
import { Tenant } from '../../src/models/Tenant.js';
import { University } from '../../src/models/University.js';
import { Campus } from '../../src/models/Campus.js';
import { Department } from '../../src/models/Department.js';
import { Course } from '../../src/models/Course.js';
import { Subject } from '../../src/models/Subject.js';
import { User } from '../../src/models/User.js';
import { Material } from '../../src/models/Material.js';
import { Invite } from '../../src/models/Invite.js';
import { RefreshToken } from '../../src/models/RefreshToken.js';
import { AuditLog } from '../../src/models/AuditLog.js';
import { createInvite } from '../../src/modules/invites/invite.service.js';

export const PASSWORD = 'ChangeMeAdmin1!';
export const SHARED_EMAIL = 'shared.user@uni.edu';
export const SHARED_USERNAME = 'shared_user';
export const SHARED_COURSE_SLUG = 'bscs';
export const SHARED_MATERIAL_TITLE = 'Shared Notes Title';

export async function wipeAll() {
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
    Invite.collection.deleteMany({}),
    RefreshToken.collection.deleteMany({}),
    AuditLog.collection.deleteMany({}),
  ]);
}

async function seedTenantSide({ slug, name, domain, uniSlug }) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const tenant = await Tenant.create({
    name,
    slug,
    domainWhitelist: [domain],
    status: 'active',
    signupMode: 'both',
    theme: { primaryColor: '#0f766e' },
    settings: {
      maxUploadMB: 50,
      moderationEnabled: true,
      inviteCode: `${slug}-invite`,
      allowedFileTypes: ['application/pdf', 'image/png'],
    },
  });

  const uni = await University.create({ name, slug: uniSlug });
  tenant.legacyUniversityId = uni._id;
  await tenant.save();

  return runWithTenantContext({ tenantId: tenant._id, tenant }, async () => {
    const campus = await Campus.create({
      name: 'Main Campus',
      slug: 'main',
      city: `${name} City`,
      university: uni._id,
      tenantId: tenant._id,
    });
    const department = await Department.create({
      name: 'Computer Science',
      slug: 'cs',
      campus: campus._id,
      university: uni._id,
      tenantId: tenant._id,
    });
    const course = await Course.create({
      name: 'BS Computer Science',
      slug: SHARED_COURSE_SLUG,
      department: department._id,
      campus: campus._id,
      university: uni._id,
      tenantId: tenant._id,
    });
    const subject = await Subject.create({
      name: 'Programming Fundamentals',
      slug: 'pf',
      course: course._id,
      tenantId: tenant._id,
    });

    const admin = await User.create({
      fullName: `${name} Admin`,
      username: `${slug}_admin`,
      email: `admin@${domain}`,
      passwordHash,
      role: 'tenantAdmin',
      adminLevel: 'university',
      tenantId: tenant._id,
      university: uni._id,
      campus: campus._id,
      department: department._id,
      emailVerified: true,
      isActive: true,
    });

    const student = await User.create({
      fullName: `${name} Student`,
      username: `${slug}_student`,
      email: `student@${domain}`,
      passwordHash,
      role: 'student',
      tenantId: tenant._id,
      university: uni._id,
      campus: campus._id,
      department: department._id,
      emailVerified: true,
      isActive: true,
    });

    // Same email + username across tenants (unique per tenantId)
    const shared = await User.create({
      fullName: 'Shared Identity',
      username: SHARED_USERNAME,
      email: SHARED_EMAIL,
      passwordHash,
      role: 'student',
      tenantId: tenant._id,
      university: uni._id,
      campus: campus._id,
      department: department._id,
      emailVerified: true,
      isActive: true,
    });

    const approved = await Material.create({
      title: SHARED_MATERIAL_TITLE,
      type: 'notes',
      description: `${slug} copy`,
      file: {
        publicId: `tenants/${tenant._id}/materials/aaaaaaaaaaaaaaaaaaaaaaaa/asset`,
        deliveryRef: `tenants/${tenant._id}/materials/aaaaaaaaaaaaaaaaaaaaaaaa/asset`,
        provider: 'local',
        mimeType: 'application/pdf',
        size: 120,
        bytes: 120,
        originalName: 'notes.pdf',
      },
      uploader: student._id,
      university: uni._id,
      campus: campus._id,
      department: department._id,
      course: course._id,
      subject: subject._id,
      status: 'approved',
      tenantId: tenant._id,
      popularityScore: slug === 'alpha' ? 10 : 5,
      stats: {
        views: slug === 'alpha' ? 100 : 20,
        downloads: 5,
        likesCount: 2,
        ratingAvg: slug === 'alpha' ? 4.5 : 3.0,
        ratingCount: 4,
      },
    });

    const pending = await Material.create({
      title: `${slug}-pending`,
      type: 'notes',
      file: {
        publicId: `tenants/${tenant._id}/materials/bbbbbbbbbbbbbbbbbbbbbbbb/asset`,
        deliveryRef: `tenants/${tenant._id}/materials/bbbbbbbbbbbbbbbbbbbbbbbb/asset`,
        provider: 'local',
        mimeType: 'application/pdf',
        size: 50,
        bytes: 50,
        originalName: 'p.pdf',
      },
      uploader: student._id,
      university: uni._id,
      campus: campus._id,
      department: department._id,
      course: course._id,
      subject: subject._id,
      status: 'pending',
      tenantId: tenant._id,
    });

    const { invite, plainCode } = await createInvite(admin, {
      maxUses: 5,
      expiresInDays: 30,
    });

    return {
      tenant,
      uni,
      campus,
      department,
      course,
      subject,
      admin,
      student,
      shared,
      approved,
      pending,
      invite,
      inviteCode: plainCode,
    };
  });
}

export async function seedIsolationPair() {
  await wipeAll();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await User.create({
    fullName: 'Platform Super',
    username: 'superadmin',
    email: 'super@platform.local',
    passwordHash,
    role: 'superadmin',
    tenantId: null,
  });

  const alpha = await seedTenantSide({
    slug: 'alpha',
    name: 'Alpha University',
    domain: 'alpha.edu',
    uniSlug: 'alpha',
  });
  const beta = await seedTenantSide({
    slug: 'beta',
    name: 'Beta University',
    domain: 'beta.edu',
    uniSlug: 'beta',
  });

  return { alpha, beta };
}

export async function login(app, slug, identifier) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('x-tenant', slug)
    .send({ identifier, password: PASSWORD });
  if (res.status !== 200) {
    throw new Error(`login failed ${slug}/${identifier}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    token: res.body.data.accessToken,
    cookie: res.headers['set-cookie'],
    user: res.body.data.user,
  };
}

export async function platformLogin(app) {
  const res = await request(app)
    .post('/api/v1/platform/auth/login')
    .send({ identifier: 'super@platform.local', password: PASSWORD });
  if (res.status !== 200) {
    throw new Error(`platform login failed: ${res.status}`);
  }
  return { token: res.body.data.accessToken, cookie: res.headers['set-cookie'] };
}

export function expectDenied(res) {
  expect([403, 404]).toContain(res.status);
  expect(res.status).not.toBe(200);
}
