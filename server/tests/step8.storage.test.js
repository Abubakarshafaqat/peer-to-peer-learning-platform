/**
 * Step 8: tenant-aware storage — upload enforcement + signed URL access.
 */
import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
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
import { tenantFolderPath } from '../src/utils/fileValidation.js';

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/peer-learning-test';
const PASSWORD = 'ChangeMeAdmin1!';

/** Minimal PDF that file-type detects as application/pdf */
const PDF_BUFFER = Buffer.from(
  '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
  'utf8',
);
/** MZ header (not a PDF) */
const EXE_BUFFER = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00]);

const uploadCalls = [];

jest.unstable_mockModule('../src/services/storage.service.js', () => {
  const SIGNED_URL_TTL_SEC = 300;
  return {
    SIGNED_URL_TTL_SEC,
    storageService: {
      signedUrlTtlSeconds: SIGNED_URL_TTL_SEC,
      async upload(file, ctx) {
        uploadCalls.push({ ctx, size: file.size, name: file.originalname });
        const folder = tenantFolderPath(ctx.tenantId, ctx.materialId);
        const publicId = `${folder}/asset`;
        return {
          publicId,
          deliveryRef: publicId,
          provider: 'cloudinary',
          resourceType: ctx.resourceType || 'raw',
          mimeType: ctx.mimeType || file.mimetype,
          size: file.size,
          bytes: file.size,
          originalName: ctx.originalName || file.originalname,
        };
      },
      async delete() {},
      async deleteWithRetry() {},
      async getSignedUrl(fileMeta, ttl = SIGNED_URL_TTL_SEC) {
        return `https://signed.example/${encodeURIComponent(fileMeta.publicId)}?exp=${ttl}`;
      },
      openLocalStream() {
        throw new Error('local not used in mock');
      },
      isTenantLayoutPublicId(id) {
        return /^tenants\//.test(id);
      },
    },
  };
});

const { createApp } = await import('../src/app.js');

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
let courseB;
let subjectB;
let studentAToken;
let studentBToken;
let otherAToken;
let materialPendingId;
let materialApprovedId;

async function wipe() {
  clearTenantCache();
  uploadCalls.length = 0;
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

async function login(slug, identifier) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('x-tenant', slug)
    .send({ identifier, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.body.data.accessToken;
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
    settings: {
      maxUploadMB: 2,
      allowedFileTypes: ['application/pdf', 'image/png'],
      storageQuotaMB: 1,
      moderationEnabled: true,
    },
  });
  beta = await Tenant.create({
    name: 'Beta University',
    slug: 'beta',
    domainWhitelist: ['beta.edu'],
    signupMode: 'domain',
    status: 'active',
    settings: { maxUploadMB: 50, allowedFileTypes: ['application/pdf'] },
  });

  uniA = await University.create({ name: 'Alpha University', slug: 'alpha' });
  const uniB = await University.create({ name: 'Beta University', slug: 'beta' });
  alpha.legacyUniversityId = uniA._id;
  beta.legacyUniversityId = uniB._id;
  await alpha.save();
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
    await User.create({
      fullName: 'Other Alpha',
      username: 'other_alpha',
      email: 'other@alpha.edu',
      passwordHash,
      role: 'student',
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
    courseB = await Course.create({
      name: 'BESE',
      slug: 'bese',
      department: deptB._id,
      campus: campusB._id,
      university: uniB._id,
      tenantId: beta._id,
    });
    subjectB = await Subject.create({
      name: 'OOP',
      slug: 'oop',
      course: courseB._id,
      tenantId: beta._id,
    });
    await User.create({
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
  });
}

const itDb = (name, fn) =>
  it(name, async () => {
    if (!mongoAvailable) return;
    await fn();
  });

beforeAll(async () => {
  try {
    await mongoose.connect(TEST_URI);
    mongoAvailable = true;
    app = createApp();
    await seed();
    studentAToken = await login('alpha', 'student@alpha.edu');
    otherAToken = await login('alpha', 'other@alpha.edu');
    studentBToken = await login('beta', 'student@beta.edu');
  } catch (err) {
    console.warn('step8: Mongo unavailable', err.message);
  }
}, 120000);

afterAll(async () => {
  if (mongoAvailable) {
    await wipe();
    await mongoose.disconnect();
  }
});

describe('Step 8 file validation helpers', () => {
  it('tenantFolderPath uses ids not slugs', async () => {
    const { tenantFolderPath: pathFn } = await import('../src/utils/fileValidation.js');
    const tid = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const mid = 'bbbbbbbbbbbbbbbbbbbbbbbb';
    expect(pathFn(tid, mid)).toBe(`tenants/${tid}/materials/${mid}`);
  });
});

describe('Step 8 upload enforcement', () => {
  itDb('rejects oversize vs tenant maxUploadMB with 413', async () => {
    clearTenantCache();
    const big = Buffer.concat([PDF_BUFFER, Buffer.alloc(3 * 1024 * 1024)]);
    const res = await request(app)
      .post('/api/v1/materials')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${studentAToken}`)
      .field('title', 'Big PDF')
      .field('type', 'notes')
      .field('course', String(courseA._id))
      .field('subject', String(subjectA._id))
      .attach('file', big, { filename: 'big.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('FILE_TOO_LARGE');
  });

  itDb('rejects spoofed content (exe bytes named .pdf)', async () => {
    const res = await request(app)
      .post('/api/v1/materials')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${studentAToken}`)
      .field('title', 'Spoof')
      .field('type', 'notes')
      .field('course', String(courseA._id))
      .field('subject', String(subjectA._id))
      .attach('file', EXE_BUFFER, { filename: 'notes.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(['UNKNOWN_FILE_TYPE', 'INVALID_FILE_TYPE', 'EXTENSION_MISMATCH', 'CONTENT_TYPE_MISMATCH']).toContain(
      res.body.code,
    );
  });

  itDb('rejects disallowed type per tenant setting (jpeg not in alpha allowlist)', async () => {
    // JPEG magic
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const res = await request(app)
      .post('/api/v1/materials')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${studentAToken}`)
      .field('title', 'Photo')
      .field('type', 'notes')
      .field('course', String(courseA._id))
      .field('subject', String(subjectA._id))
      .attach('file', jpeg, { filename: 'pic.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(['FILE_TYPE_NOT_ALLOWED', 'INVALID_FILE_TYPE', 'EXTENSION_MISMATCH']).toContain(res.body.code);
  });

  itDb('rejects zero-byte file', async () => {
    const res = await request(app)
      .post('/api/v1/materials')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${studentAToken}`)
      .field('title', 'Empty')
      .field('type', 'notes')
      .field('course', String(courseA._id))
      .field('subject', String(subjectA._id))
      .attach('file', Buffer.alloc(0), { filename: 'empty.pdf', contentType: 'application/pdf' });
    expect([400, 413]).toContain(res.status);
  });

  itDb('rejects double extension', async () => {
    const res = await request(app)
      .post('/api/v1/materials')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${studentAToken}`)
      .field('title', 'Double')
      .field('type', 'notes')
      .field('course', String(courseA._id))
      .field('subject', String(subjectA._id))
      .attach('file', PDF_BUFFER, {
        filename: 'notes.pdf.exe',
        contentType: 'application/pdf',
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DANGEROUS_FILENAME');
  });

  itDb('upload path always contains tenant id from context (ignores body tenantId)', async () => {
    uploadCalls.length = 0;
    const res = await request(app)
      .post('/api/v1/materials')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${studentAToken}`)
      .field('title', 'Good notes')
      .field('type', 'notes')
      .field('course', String(courseA._id))
      .field('subject', String(subjectA._id))
      .field('tenantId', String(beta._id))
      .field('folder', 'evil/folder')
      .attach('file', PDF_BUFFER, { filename: 'good.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    materialPendingId = res.body.data.material.id;
    expect(uploadCalls.length).toBe(1);
    expect(String(uploadCalls[0].ctx.tenantId)).toBe(String(alpha._id));
    expect(String(uploadCalls[0].ctx.tenantId)).not.toBe(String(beta._id));
    const mat = await Material.findById(materialPendingId).setOptions({ skipTenant: true });
    expect(mat.file.publicId.startsWith(`tenants/${alpha._id}/materials/${mat._id}`)).toBe(true);
    expect(mat.file.bytes).toBeGreaterThan(0);
    expect(mat.file.resourceType).toBe('raw');
  });

  itDb('quota exceeded returns 413', async () => {
    await Tenant.updateOne({ _id: alpha._id }, { $set: { 'settings.storageQuotaMB': 0.000001 } });
    clearTenantCache();
    // Force used bytes via existing material size — set huge bytes on pending
    await Material.updateOne(
      { _id: materialPendingId },
      { $set: { 'file.bytes': 10_000_000, 'file.size': 10_000_000 } },
    ).setOptions({ skipTenant: true });

    const res = await request(app)
      .post('/api/v1/materials')
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${studentAToken}`)
      .field('title', 'Quota')
      .field('type', 'notes')
      .field('course', String(courseA._id))
      .field('subject', String(subjectA._id))
      .attach('file', PDF_BUFFER, { filename: 'q.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('STORAGE_QUOTA_EXCEEDED');

    await Tenant.updateOne({ _id: alpha._id }, { $set: { 'settings.storageQuotaMB': 1 } });
    clearTenantCache();
  });
});

describe('Step 8 download / signed URL access', () => {
  itDb('pending material not downloadable by other students', async () => {
    const res = await request(app)
      .get(`/api/v1/materials/${materialPendingId}/file-url`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${otherAToken}`);
    expect(res.status).toBe(404);
  });

  itDb('uploader can get signed URL for pending', async () => {
    const res = await request(app)
      .get(`/api/v1/materials/${materialPendingId}/file-url`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.url).toContain('signed.example');
    expect(res.body.data.expiresIn).toBe(300);
  });

  itDb('alpha user cannot fetch beta material file (404)', async () => {
    let betaMatId;
    await runWithTenantContext({ tenantId: beta._id, tenant: beta }, async () => {
      const m = await Material.create({
        title: 'Beta only',
        type: 'notes',
        file: {
          publicId: `tenants/${beta._id}/materials/cccccccccccccccccccccccc/asset`,
          deliveryRef: `tenants/${beta._id}/materials/cccccccccccccccccccccccc/asset`,
          provider: 'cloudinary',
          resourceType: 'raw',
          mimeType: 'application/pdf',
          size: 10,
          bytes: 10,
          originalName: 'b.pdf',
        },
        uploader: (
          await User.findOne({ email: 'student@beta.edu' }).setOptions({ skipTenant: true })
        )._id,
        university: uniA._id,
        campus: campusB._id,
        department: deptB._id,
        course: courseB._id,
        subject: subjectB._id,
        status: 'approved',
        tenantId: beta._id,
      });
      // fix university to uniB
      m.university = beta.legacyUniversityId;
      await m.save();
      betaMatId = String(m._id);
      materialApprovedId = betaMatId;
    });

    const res = await request(app)
      .get(`/api/v1/materials/${betaMatId}/file-url`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(res.status).toBe(404);
  });

  itDb('signed URL only for in-tenant approved peers', async () => {
    await Material.updateOne(
      { _id: materialPendingId },
      { $set: { status: 'approved' } },
    ).setOptions({ skipTenant: true });

    const ok = await request(app)
      .get(`/api/v1/materials/${materialPendingId}/file-url`)
      .set('x-tenant', 'alpha')
      .set('Authorization', `Bearer ${otherAToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.expiresIn).toBe(300);

    const cross = await request(app)
      .get(`/api/v1/materials/${materialPendingId}/file-url`)
      .set('x-tenant', 'beta')
      .set('Authorization', `Bearer ${studentBToken}`);
    expect(cross.status).toBe(404);
  });
});
