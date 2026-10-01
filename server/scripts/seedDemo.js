/**
 * Demo seed for Step 9 / DEMO.md.
 * Idempotent. Pass --reset to wipe demo tenants (alpha, beta, gamma) and recreate.
 *
 * Usage:
 *   node scripts/seedDemo.js
 *   node scripts/seedDemo.js --reset
 *
 * Refuses production unless ADMIN_SEED_PASSWORD is set.
 */
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const RESET = process.argv.includes('--reset');
const PASSWORD = process.env.ADMIN_SEED_PASSWORD || 'ChangeMeAdmin1!';

const DEMO_SLUGS = ['alpha', 'beta', 'gamma'];

const TENANT_DEFS = [
  {
    name: 'Alpha University',
    slug: 'alpha',
    domain: 'alpha.edu',
    color: '#0f766e',
    signupMode: 'both',
  },
  {
    name: 'Beta University',
    slug: 'beta',
    domain: 'beta.edu',
    color: '#1d4ed8',
    signupMode: 'domain',
  },
  {
    name: 'Gamma Institute',
    slug: 'gamma',
    domain: 'gamma.edu',
    color: '#b45309',
    signupMode: 'invite',
  },
];

function assertAllowed() {
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_SEED_PASSWORD) {
    console.error('Refusing to seedDemo in production without ADMIN_SEED_PASSWORD');
    process.exit(1);
  }
}

async function loadModels() {
  const { connectDb } = await import('../src/config/db.js');
  await connectDb();
  const { runWithTenantContext } = await import('../src/utils/tenantContext.js');
  const { clearTenantCache } = await import('../src/utils/tenantCache.js');
  const { Tenant } = await import('../src/models/Tenant.js');
  const { University } = await import('../src/models/University.js');
  const { Campus } = await import('../src/models/Campus.js');
  const { Department } = await import('../src/models/Department.js');
  const { Course } = await import('../src/models/Course.js');
  const { Subject } = await import('../src/models/Subject.js');
  const { User } = await import('../src/models/User.js');
  const { Material } = await import('../src/models/Material.js');
  const { Invite } = await import('../src/models/Invite.js');
  const { createInvite } = await import('../src/modules/invites/invite.service.js');
  return {
    runWithTenantContext,
    clearTenantCache,
    Tenant,
    University,
    Campus,
    Department,
    Course,
    Subject,
    User,
    Material,
    Invite,
    createInvite,
  };
}

async function resetDemo(models) {
  const { Tenant, University, Campus, Department, Course, Subject, User, Material, Invite } =
    models;
  const tenants = await Tenant.find({ slug: { $in: DEMO_SLUGS } });
  const tids = tenants.map((t) => t._id);
  const unis = await University.find({ slug: { $in: DEMO_SLUGS } });
  const uids = unis.map((u) => u._id);

  if (tids.length) {
    await Material.collection.deleteMany({ tenantId: { $in: tids } });
    await Invite.collection.deleteMany({ tenantId: { $in: tids } });
    await Subject.collection.deleteMany({ tenantId: { $in: tids } });
    await Course.collection.deleteMany({ tenantId: { $in: tids } });
    await Department.collection.deleteMany({ tenantId: { $in: tids } });
    await Campus.collection.deleteMany({ tenantId: { $in: tids } });
    await User.collection.deleteMany({ tenantId: { $in: tids } });
    await Tenant.deleteMany({ _id: { $in: tids } });
  }
  if (uids.length) {
    await University.deleteMany({ _id: { $in: uids } });
  }
  console.log('Reset: removed demo tenants', DEMO_SLUGS.join(', '));
}

async function upsertSuperadmin(User, passwordHash) {
  const email = process.env.ADMIN_SEED_EMAIL || 'super@platform.local';
  const username = process.env.ADMIN_SEED_USERNAME || 'superadmin';
  let user = await User.findOne({ email }).setOptions({ skipTenant: true });
  if (!user) {
    user = new User({
      fullName: 'Platform Superadmin',
      username,
      email,
      passwordHash,
      role: 'superadmin',
      tenantId: null,
    });
  } else {
    user.role = 'superadmin';
    user.tenantId = null;
    user.passwordHash = passwordHash;
    user.username = username;
  }
  await user.save();
  return user;
}

async function seedOne(def, passwordHash, models) {
  const {
    runWithTenantContext,
    Tenant,
    University,
    Campus,
    Department,
    Course,
    Subject,
    User,
    Material,
    createInvite,
  } = models;

  let tenant = await Tenant.findOne({ slug: def.slug });
  if (!tenant) {
    tenant = await Tenant.create({
      name: def.name,
      slug: def.slug,
      domainWhitelist: [def.domain],
      status: 'active',
      signupMode: def.signupMode,
      theme: { primaryColor: def.color },
      settings: {
        maxUploadMB: 50,
        moderationEnabled: true,
        inviteCode: `${def.slug}-invite`,
        allowedFileTypes: ['application/pdf', 'image/png', 'image/jpeg'],
        storageQuotaMB: 500,
      },
    });
    console.log(`Tenant created: ${def.slug}`);
  } else {
    tenant.name = def.name;
    tenant.domainWhitelist = [def.domain];
    tenant.signupMode = def.signupMode;
    tenant.status = 'active';
    tenant.deletedAt = null;
    tenant.theme = { primaryColor: def.color };
    await tenant.save();
    console.log(`Tenant upserted: ${def.slug}`);
  }

  let uni = await University.findOne({ slug: def.slug });
  if (!uni) {
    uni = await University.create({ name: def.name, slug: def.slug });
  }
  tenant.legacyUniversityId = uni._id;
  await tenant.save();

  return runWithTenantContext({ tenantId: tenant._id, tenant }, async () => {
    let campus = await Campus.findOne({ slug: 'main', university: uni._id });
    if (!campus) {
      campus = await Campus.create({
        name: `${def.name} Main`,
        slug: 'main',
        city: `${def.slug} City`,
        university: uni._id,
        tenantId: tenant._id,
      });
    }

    let campusB = await Campus.findOne({ slug: 'east', university: uni._id });
    if (!campusB) {
      campusB = await Campus.create({
        name: `${def.name} East`,
        slug: 'east',
        city: 'East',
        university: uni._id,
        tenantId: tenant._id,
      });
    }

    let department = await Department.findOne({ slug: 'cs', campus: campus._id });
    if (!department) {
      department = await Department.create({
        name: 'Computer Science',
        slug: 'cs',
        campus: campus._id,
        university: uni._id,
        tenantId: tenant._id,
      });
    }

    let course = await Course.findOne({ slug: 'bscs', department: department._id });
    if (!course) {
      course = await Course.create({
        name: 'BS Computer Science',
        slug: 'bscs',
        department: department._id,
        campus: campus._id,
        university: uni._id,
        tenantId: tenant._id,
      });
    }

    let subject = await Subject.findOne({ slug: 'pf', course: course._id });
    if (!subject) {
      subject = await Subject.create({
        name: 'Programming Fundamentals',
        slug: 'pf',
        course: course._id,
        tenantId: tenant._id,
      });
    }

    async function upsertUser(spec) {
      let u = await User.findOne({ email: spec.email });
      if (!u) {
        u = new User({ ...spec, passwordHash, tenantId: tenant._id, emailVerified: true });
      } else {
        Object.assign(u, { ...spec, passwordHash, tenantId: tenant._id, emailVerified: true });
      }
      await u.save();
      return u;
    }

    const admin = await upsertUser({
      fullName: `${def.name} Admin`,
      username: `${def.slug}_admin`,
      email: `admin@${def.domain}`,
      role: 'tenantAdmin',
      adminLevel: 'university',
      university: uni._id,
      campus: campus._id,
      department: department._id,
    });

    const campusAdmin = await upsertUser({
      fullName: `${def.name} Campus Admin`,
      username: `${def.slug}_campus`,
      email: `campus@${def.domain}`,
      role: 'tenantAdmin',
      adminLevel: 'campus',
      university: uni._id,
      campus: campus._id,
    });

    const student = await upsertUser({
      fullName: `${def.name} Student`,
      username: `${def.slug}_student`,
      email: `student@${def.domain}`,
      role: 'student',
      university: uni._id,
      campus: campus._id,
      department: department._id,
    });

    // Shared identity across tenants
    await upsertUser({
      fullName: 'Shared Demo User',
      username: 'shared_user',
      email: 'shared.user@uni.edu',
      role: 'student',
      university: uni._id,
      campus: campus._id,
      department: department._id,
    });

    async function upsertMaterial(title, status) {
      let m = await Material.findOne({ title, uploader: student._id });
      const file = {
        publicId: `tenants/${tenant._id}/materials/demo-${status}/asset`,
        deliveryRef: `tenants/${tenant._id}/materials/demo-${status}/asset`,
        provider: 'local',
        mimeType: 'application/pdf',
        size: 100,
        bytes: 100,
        originalName: `${status}.pdf`,
      };
      if (!m) {
        m = await Material.create({
          title,
          type: 'notes',
          description: `${def.slug} ${status}`,
          file,
          uploader: student._id,
          university: uni._id,
          campus: campus._id,
          department: department._id,
          course: course._id,
          subject: subject._id,
          status,
          tenantId: tenant._id,
          rejectionReason: status === 'rejected' ? 'Needs citations' : '',
          popularityScore: status === 'approved' ? 8 : 0,
          stats: {
            views: status === 'approved' ? 40 : 0,
            downloads: 2,
            ratingAvg: status === 'approved' ? 4 : 0,
            ratingCount: status === 'approved' ? 2 : 0,
          },
        });
      } else {
        m.status = status;
        await m.save();
      }
      return m;
    }

    await upsertMaterial('Shared Notes Title', 'approved');
    await upsertMaterial(`${def.slug}-pending`, 'pending');
    await upsertMaterial(`${def.slug}-rejected`, 'rejected');
    await upsertMaterial(`${def.slug}-latest`, 'approved');

    const { plainCode } = await createInvite(admin, { maxUses: 20, expiresInDays: 90 });

    return {
      slug: def.slug,
      admin: admin.email,
      campusAdmin: campusAdmin.email,
      student: student.email,
      inviteCode: plainCode,
    };
  });
}

async function main() {
  assertAllowed();
  const models = await loadModels();
  models.clearTenantCache();

  if (RESET) {
    await resetDemo(models);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  await upsertSuperadmin(models.User, passwordHash);

  const summary = [];
  for (const def of TENANT_DEFS) {
    summary.push(await seedOne(def, passwordHash, models));
  }

  console.log('\n--- Demo accounts ---');
  console.log(`Password: ${PASSWORD}`);
  console.log(`Superadmin: ${process.env.ADMIN_SEED_EMAIL || 'super@platform.local'}`);
  for (const row of summary) {
    console.log(
      `${row.slug}: admin=${row.admin} campus=${row.campusAdmin} student=${row.student} invite=${row.inviteCode}`,
    );
  }
  console.log('seedDemo complete');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
