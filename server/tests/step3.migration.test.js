/**
 * Step 3+5: migration fixture — 2 universities, mixed legacy data, no tenantId.
 * Asserts counts, idempotency, role remap, and zero cross-tenant Material refs.
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { runMigration } from '../scripts/migrateToMultiTenant.js';
import { Tenant } from '../src/models/Tenant.js';
import { University } from '../src/models/University.js';
import { Campus } from '../src/models/Campus.js';
import { Department } from '../src/models/Department.js';
import { Course } from '../src/models/Course.js';
import { Subject } from '../src/models/Subject.js';
import { Material } from '../src/models/Material.js';
import { User } from '../src/models/User.js';
import { RefreshToken } from '../src/models/RefreshToken.js';

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/peer-learning-test';
const SKIP = { skipTenant: true };

let mongoAvailable = false;

async function wipe() {
  await Tenant.deleteMany({});
  await University.deleteMany({});
  await Campus.collection.deleteMany({});
  await Department.collection.deleteMany({});
  await Course.collection.deleteMany({});
  await Subject.collection.deleteMany({});
  await Material.collection.deleteMany({});
  await User.collection.deleteMany({});
  await RefreshToken.collection.deleteMany({});
}

/** Insert pre-migration docs via native collection (no tenantId, legacy admin roles). */
async function seedLegacyFixture() {
  await wipe();
  const passwordHash = await bcrypt.hash('ChangeMeAdmin1!', 10);
  const now = new Date();

  const uniA = await University.create({ name: 'Alpha University', slug: 'alpha-uni' });
  const uniB = await University.create({ name: 'Beta University', slug: 'beta-uni' });

  const campusA = (
    await Campus.collection.insertOne({
      name: 'Alpha Main',
      slug: 'alpha-main',
      university: uniA._id,
      city: 'A',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  ).insertedId;
  const campusB = (
    await Campus.collection.insertOne({
      name: 'Beta Main',
      slug: 'beta-main',
      university: uniB._id,
      city: 'B',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  ).insertedId;

  const deptA = (
    await Department.collection.insertOne({
      name: 'CS',
      slug: 'cs',
      campus: campusA,
      university: uniA._id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  ).insertedId;
  const deptB = (
    await Department.collection.insertOne({
      name: 'SE',
      slug: 'se',
      campus: campusB,
      university: uniB._id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  ).insertedId;

  const courseA = (
    await Course.collection.insertOne({
      name: 'BSCS',
      slug: 'bscs',
      department: deptA,
      campus: campusA,
      university: uniA._id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  ).insertedId;
  const courseB = (
    await Course.collection.insertOne({
      name: 'BESE',
      slug: 'bese',
      department: deptB,
      campus: campusB,
      university: uniB._id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  ).insertedId;

  const subjectA = (
    await Subject.collection.insertOne({
      name: 'PF',
      slug: 'pf',
      course: courseA,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  ).insertedId;
  const subjectB = (
    await Subject.collection.insertOne({
      name: 'OOP',
      slug: 'oop',
      course: courseB,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  ).insertedId;

  const platformAdmin = (
    await User.collection.insertOne({
      fullName: 'Platform Admin',
      username: 'platform_admin',
      email: 'platform@example.com',
      passwordHash,
      role: 'admin',
      adminLevel: 'platform',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  ).insertedId;

  const uniAdminA = (
    await User.collection.insertOne({
      fullName: 'Alpha Uni Admin',
      username: 'alpha_uni_admin',
      email: 'uniadmin@alpha.edu',
      passwordHash,
      role: 'admin',
      adminLevel: 'university',
      university: uniA._id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  ).insertedId;

  const campusAdminA = (
    await User.collection.insertOne({
      fullName: 'Alpha Campus Admin',
      username: 'alpha_campus_admin',
      email: 'campusadmin@alpha.edu',
      passwordHash,
      role: 'admin',
      adminLevel: 'campus',
      university: uniA._id,
      campus: campusA,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  ).insertedId;

  const deptAdminA = (
    await User.collection.insertOne({
      fullName: 'Alpha Dept Admin',
      username: 'alpha_dept_admin',
      email: 'deptadmin@alpha.edu',
      passwordHash,
      role: 'admin',
      adminLevel: 'department',
      university: uniA._id,
      campus: campusA,
      department: deptA,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  ).insertedId;

  const studentA = (
    await User.collection.insertOne({
      fullName: 'Alpha Student',
      username: 'alpha_student',
      email: 'student@alpha.edu',
      passwordHash,
      role: 'student',
      university: uniA._id,
      campus: campusA,
      department: deptA,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  ).insertedId;

  const studentB = (
    await User.collection.insertOne({
      fullName: 'Beta Student',
      username: 'beta_student',
      email: 'student@beta.edu',
      passwordHash,
      role: 'student',
      university: uniB._id,
      campus: campusB,
      department: deptB,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  ).insertedId;

  await Material.collection.insertOne({
    title: 'Alpha notes',
    type: 'notes',
    description: '',
    file: {
      publicId: 'a.pdf',
      deliveryRef: 'a.pdf',
      provider: 'local',
      mimeType: 'application/pdf',
      size: 10,
      bytes: 10,
      originalName: 'a.pdf',
    },
    uploader: studentA,
    university: uniA._id,
    campus: campusA,
    department: deptA,
    course: courseA,
    subject: subjectA,
    tags: [],
    status: 'approved',
    rejectionReason: '',
    stats: { views: 0, downloads: 0, likesCount: 0, upvotesCount: 0, ratingAvg: 0, ratingCount: 0 },
    popularityScore: 0,
    createdAt: now,
    updatedAt: now,
  });

  await Material.collection.insertOne({
    title: 'Beta notes',
    type: 'notes',
    description: '',
    file: {
      publicId: 'b.pdf',
      deliveryRef: 'b.pdf',
      provider: 'local',
      mimeType: 'application/pdf',
      size: 10,
      bytes: 10,
      originalName: 'b.pdf',
    },
    uploader: studentB,
    university: uniB._id,
    campus: campusB,
    department: deptB,
    course: courseB,
    subject: subjectB,
    tags: [],
    status: 'pending',
    rejectionReason: '',
    stats: { views: 0, downloads: 0, likesCount: 0, upvotesCount: 0, ratingAvg: 0, ratingCount: 0 },
    popularityScore: 0,
    createdAt: now,
    updatedAt: now,
  });

  await RefreshToken.collection.insertOne({
    user: studentA,
    tokenHash: 'hash-alpha-student',
    expiresAt: new Date(Date.now() + 86400000),
    userAgent: 'test',
    createdAt: now,
    updatedAt: now,
  });

  return {
    uniA,
    uniB,
    platformAdmin,
    uniAdminA,
    campusAdminA,
    deptAdminA,
    studentA,
    studentB,
  };
}

beforeAll(async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 15000 });
    }
    mongoAvailable = true;
  } catch (err) {
    console.warn(`[step3.migration] skipped: ${err.message}`);
  }
}, 30000);

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    try {
      await wipe();
    } catch {
      /* ignore */
    }
    await mongoose.disconnect();
  }
});

function itDb(name, fn, timeout = 60000) {
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

describe('Step 3+5 migrateToMultiTenant', () => {
  itDb('dry-run then apply: counts, roles, idempotency, no cross-tenant refs', async () => {
    const ids = await seedLegacyFixture();

    const dry = await runMigration({ apply: false });
    expect(dry.counts.tenantsCreated).toBe(2);
    expect(dry.counts.Campus).toBe(2);
    expect(dry.counts.Department).toBe(2);
    expect(dry.counts.Course).toBe(2);
    expect(dry.counts.Subject).toBe(2);
    expect(dry.counts.Material).toBe(2);
    expect(dry.counts.rolesRemapped).toBe(4);
    expect(await Tenant.countDocuments({})).toBe(0);
    expect(await User.countDocuments({ role: 'admin' }).setOptions(SKIP)).toBe(4);

    const first = await runMigration({ apply: true });
    expect(first.ok).toBe(true);
    expect(first.counts.tenantsCreated).toBe(2);
    expect(first.verification.crossTenantMaterials).toHaveLength(0);
    expect(first.verification.legacyAdminCount).toBe(0);
    expect(first.roleAfter.byRole.admin).toBe(0);
    expect(first.roleAfter.byRole.superadmin).toBeGreaterThanOrEqual(1);
    expect(first.roleAfter.byRole.tenantAdmin).toBeGreaterThanOrEqual(3);

    const tenants = await Tenant.find({}).lean();
    expect(tenants).toHaveLength(2);
    const legacyIds = tenants.map((t) => String(t.legacyUniversityId)).sort();
    expect(legacyIds).toEqual([String(ids.uniA._id), String(ids.uniB._id)].sort());

    const platform = await User.findById(ids.platformAdmin).setOptions(SKIP).lean();
    expect(platform.role).toBe('superadmin');
    expect(platform.tenantId).toBeNull();

    const campusAdmin = await User.findById(ids.campusAdminA).setOptions(SKIP).lean();
    expect(campusAdmin.role).toBe('tenantAdmin');
    expect(campusAdmin.adminLevel).toBe('campus');
    expect(campusAdmin.campus).toBeTruthy();
    expect(campusAdmin.tenantId).toBeTruthy();

    const deptAdmin = await User.findById(ids.deptAdminA).setOptions(SKIP).lean();
    expect(deptAdmin.role).toBe('tenantAdmin');
    expect(deptAdmin.adminLevel).toBe('department');

    const matMissing = await Material.countDocuments({
      $or: [{ tenantId: null }, { tenantId: { $exists: false } }],
    }).setOptions(SKIP);
    expect(matMissing).toBe(0);

    const alphaTenant = await Tenant.findOne({ legacyUniversityId: ids.uniA._id });
    const alphaMats = await Material.find({ tenantId: alphaTenant._id }).setOptions(SKIP).lean();
    expect(alphaMats).toHaveLength(1);
    expect(alphaMats[0].title).toBe('Alpha notes');

    const second = await runMigration({ apply: true });
    expect(second.counts.tenantsCreated).toBe(0);
    expect(second.counts.Campus).toBe(0);
    expect(second.counts.Department).toBe(0);
    expect(second.counts.Course).toBe(0);
    expect(second.counts.Subject).toBe(0);
    expect(second.counts.Material).toBe(0);
    expect(second.counts.rolesRemapped).toBe(0);
    expect(second.ok).toBe(true);
    expect(second.verification.crossTenantMaterials).toHaveLength(0);
  });
});
