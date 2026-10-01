/**
 * Step 3 role isolation: student, campus-scoped tenantAdmin, department-scoped
 * tenantAdmin, superadmin on /platform only.
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

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/peer-learning-test';
const PASSWORD = 'ChangeMeAdmin1!';

let app;
let mongoAvailable = false;
let tokens = {};

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
}

async function seedRolesFixture() {
  await wipe();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const tenant = await Tenant.create({
    name: 'Alpha University',
    slug: 'alpha',
    status: 'active',
    settings: { inviteCode: 'invite', moderationEnabled: true },
  });
  const uni = await University.create({ name: 'Alpha University', slug: 'alpha' });
  tenant.legacyUniversityId = uni._id;
  await tenant.save();

  return runWithTenantContext({ tenantId: tenant._id, tenant }, async () => {
    const campus1 = await Campus.create({
      name: 'Campus One',
      slug: 'c1',
      university: uni._id,
      tenantId: tenant._id,
    });
    const campus2 = await Campus.create({
      name: 'Campus Two',
      slug: 'c2',
      university: uni._id,
      tenantId: tenant._id,
    });
    const dept1 = await Department.create({
      name: 'CS',
      slug: 'cs',
      campus: campus1._id,
      university: uni._id,
      tenantId: tenant._id,
    });
    const dept2 = await Department.create({
      name: 'EE',
      slug: 'ee',
      campus: campus1._id,
      university: uni._id,
      tenantId: tenant._id,
    });
    const course1 = await Course.create({
      name: 'BSCS',
      slug: 'bscs',
      department: dept1._id,
      campus: campus1._id,
      university: uni._id,
      tenantId: tenant._id,
    });
    const subject1 = await Subject.create({
      name: 'PF',
      slug: 'pf',
      course: course1._id,
      tenantId: tenant._id,
    });

    const student = await User.create({
      fullName: 'Student',
      username: 'student1',
      email: 'student@alpha.edu',
      passwordHash,
      role: 'student',
      tenantId: tenant._id,
      university: uni._id,
      campus: campus1._id,
      department: dept1._id,
    });

    const campusAdmin = await User.create({
      fullName: 'Campus Admin',
      username: 'campus_admin',
      email: 'campus@alpha.edu',
      passwordHash,
      role: 'tenantAdmin',
      adminLevel: 'campus',
      tenantId: tenant._id,
      university: uni._id,
      campus: campus1._id,
    });

    const deptAdmin = await User.create({
      fullName: 'Dept Admin',
      username: 'dept_admin',
      email: 'dept@alpha.edu',
      passwordHash,
      role: 'tenantAdmin',
      adminLevel: 'department',
      tenantId: tenant._id,
      university: uni._id,
      campus: campus1._id,
      department: dept1._id,
    });

    // Pending in campus1/dept1 — visible to campus + dept admin
    await Material.create({
      title: 'Dept1 pending',
      type: 'notes',
      file: {
        publicId: 'd1.pdf',
        deliveryRef: 'd1.pdf',
        provider: 'local',
        mimeType: 'application/pdf',
        size: 10,
        bytes: 10,
        originalName: 'd1.pdf',
      },
      uploader: student._id,
      university: uni._id,
      campus: campus1._id,
      department: dept1._id,
      course: course1._id,
      subject: subject1._id,
      status: 'pending',
      tenantId: tenant._id,
    });

    // Pending in campus1/dept2 — campus admin sees; dept1 admin does not
    const course2 = await Course.create({
      name: 'BSEE',
      slug: 'bsee',
      department: dept2._id,
      campus: campus1._id,
      university: uni._id,
      tenantId: tenant._id,
    });
    const subject2 = await Subject.create({
      name: 'Circuits',
      slug: 'circuits',
      course: course2._id,
      tenantId: tenant._id,
    });
    await Material.create({
      title: 'Dept2 pending',
      type: 'notes',
      file: {
        publicId: 'd2.pdf',
        deliveryRef: 'd2.pdf',
        provider: 'local',
        mimeType: 'application/pdf',
        size: 10,
        bytes: 10,
        originalName: 'd2.pdf',
      },
      uploader: student._id,
      university: uni._id,
      campus: campus1._id,
      department: dept2._id,
      course: course2._id,
      subject: subject2._id,
      status: 'pending',
      tenantId: tenant._id,
    });

    // Pending on campus2 — neither campus1 nor dept1 admin should see
    const deptC2 = await Department.create({
      name: 'Math',
      slug: 'math',
      campus: campus2._id,
      university: uni._id,
      tenantId: tenant._id,
    });
    const courseC2 = await Course.create({
      name: 'BSMath',
      slug: 'bsmath',
      department: deptC2._id,
      campus: campus2._id,
      university: uni._id,
      tenantId: tenant._id,
    });
    const subjectC2 = await Subject.create({
      name: 'Calc',
      slug: 'calc',
      course: courseC2._id,
      tenantId: tenant._id,
    });
    await Material.create({
      title: 'Campus2 pending',
      type: 'notes',
      file: {
        publicId: 'c2.pdf',
        deliveryRef: 'c2.pdf',
        provider: 'local',
        mimeType: 'application/pdf',
        size: 10,
        bytes: 10,
        originalName: 'c2.pdf',
      },
      uploader: student._id,
      university: uni._id,
      campus: campus2._id,
      department: deptC2._id,
      course: courseC2._id,
      subject: subjectC2._id,
      status: 'pending',
      tenantId: tenant._id,
    });

    return { tenant };
  });
}

beforeAll(async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 15000 });
    }
    app = createApp();
    await seedRolesFixture();

    // Superadmin must be created outside tenant ALS or plugin stamps tenantId
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    await User.create({
      fullName: 'Super',
      username: 'superadmin',
      email: 'super@platform.local',
      passwordHash,
      role: 'superadmin',
      tenantId: null,
    });

    mongoAvailable = true;

    const login = async (identifier, tenant) => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('x-tenant', tenant)
        .send({ identifier, password: PASSWORD });
      return res.body.data.accessToken;
    };

    tokens.student = await login('student@alpha.edu', 'alpha');
    tokens.campusAdmin = await login('campus@alpha.edu', 'alpha');
    tokens.deptAdmin = await login('dept@alpha.edu', 'alpha');

    const plat = await request(app)
      .post('/api/v1/platform/auth/login')
      .send({ identifier: 'super@platform.local', password: PASSWORD });
    tokens.super = plat.body.data.accessToken;
  } catch (err) {
    console.warn(`[step3.roles] skipped: ${err.message}`);
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

describe('Step 3 — role permissions', () => {
  itDb('student cannot list pending materials', async () => {
    const res = await request(app)
      .get('/api/v1/materials/pending')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${tokens.student}`);
    expect(res.status).toBe(403);
  });

  itDb('campus-scoped tenantAdmin sees only their campus pending', async () => {
    const res = await request(app)
      .get('/api/v1/materials/pending')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${tokens.campusAdmin}`);
    expect(res.status).toBe(200);
    const titles = res.body.data.items.map((m) => m.title).sort();
    expect(titles).toEqual(['Dept1 pending', 'Dept2 pending']);
  });

  itDb('department-scoped tenantAdmin sees only their department pending', async () => {
    const res = await request(app)
      .get('/api/v1/materials/pending')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${tokens.deptAdmin}`);
    expect(res.status).toBe(200);
    const titles = res.body.data.items.map((m) => m.title);
    expect(titles).toEqual(['Dept1 pending']);
  });

  itDb('superadmin token on tenant route -> 403', async () => {
    const res = await request(app)
      .get('/api/v1/materials')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${tokens.super}`);
    expect(res.status).toBe(403);
  });

  itDb('superadmin on platform route -> 200', async () => {
    const res = await request(app)
      .get('/api/v1/platform/stats')
      .set('Authorization', `Bearer ${tokens.super}`);
    expect(res.status).toBe(200);
    expect(res.body.data.tenants).toBeGreaterThanOrEqual(1);
  });

  itDb('tenantAdmin cannot access platform stats', async () => {
    const res = await request(app)
      .get('/api/v1/platform/stats')
      .set('Authorization', `Bearer ${tokens.campusAdmin}`);
    expect(res.status).toBe(403);
  });

  itDb('no user retains legacy admin role', async () => {
    const n = await User.countDocuments({ role: 'admin' }).setOptions({ skipTenant: true });
    expect(n).toBe(0);
  });
});
