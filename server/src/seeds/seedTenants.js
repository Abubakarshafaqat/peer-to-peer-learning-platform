/**
 * Step 1 seed: two tenants × (tenantAdmin + student) for Postman isolation tests.
 * Usage: npm run seed:tenants --prefix server
 *
 * Default passwords come from ADMIN_SEED_PASSWORD (or ChangeMeAdmin1!).
 */
import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from '../config/db.js';
import { env } from '../config/env.js';
import { runWithTenantContext } from '../utils/tenantContext.js';
import { Tenant } from '../models/Tenant.js';
import { University } from '../models/University.js';
import { Campus } from '../models/Campus.js';
import { Department } from '../models/Department.js';
import { Course } from '../models/Course.js';
import { Subject } from '../models/Subject.js';
import { User } from '../models/User.js';

function assertSeedPasswordAllowed() {
  if (env.NODE_ENV === 'production' && !process.env.ADMIN_SEED_PASSWORD) {
    console.error(
      'Refusing to seed in production without ADMIN_SEED_PASSWORD set in the environment.',
    );
    process.exit(1);
  }
}

const PASSWORD = env.ADMIN_SEED_PASSWORD || 'ChangeMeAdmin1!';

const TENANTS = [
  {
    name: 'Alpha University',
    slug: 'alpha',
    domainWhitelist: ['alpha.edu'],
    theme: { primaryColor: '#0f766e' },
    campus: { name: 'Alpha Main Campus', slug: 'main', city: 'Alpha City' },
    department: { name: 'Computer Science', slug: 'cs' },
    course: { name: 'BS Computer Science', slug: 'bscs' },
    subject: { name: 'Programming Fundamentals', slug: 'pf' },
    admin: {
      fullName: 'Alpha Tenant Admin',
      username: 'alpha_admin',
      email: 'admin@alpha.edu',
    },
    student: {
      fullName: 'Alpha Student',
      username: 'alpha_student',
      email: 'student@alpha.edu',
    },
  },
  {
    name: 'Beta University',
    slug: 'beta',
    domainWhitelist: ['beta.edu'],
    theme: { primaryColor: '#1d4ed8' },
    campus: { name: 'Beta Main Campus', slug: 'main', city: 'Beta City' },
    department: { name: 'Software Engineering', slug: 'se' },
    course: { name: 'BE Software Engineering', slug: 'bese' },
    subject: { name: 'OOP', slug: 'oop' },
    admin: {
      fullName: 'Beta Tenant Admin',
      username: 'beta_admin',
      email: 'admin@beta.edu',
    },
    student: {
      fullName: 'Beta Student',
      username: 'beta_student',
      email: 'student@beta.edu',
    },
  },
];

async function upsertSuperadmin(passwordHash) {
  let user = await User.findOne({ email: env.ADMIN_SEED_EMAIL }).setOptions({ skipTenant: true });
  if (!user) {
    user = await User.findOne({ username: env.ADMIN_SEED_USERNAME }).setOptions({
      skipTenant: true,
    });
  }

  const payload = {
    fullName: 'Platform Superadmin',
    username: env.ADMIN_SEED_USERNAME,
    email: env.ADMIN_SEED_EMAIL,
    passwordHash,
    role: 'superadmin',
    tenantId: null,
    adminLevel: undefined,
    university: null,
    campus: null,
    department: null,
  };

  if (user) {
    Object.assign(user, payload);
    await user.save();
    console.log(`Superadmin updated: ${user.email}`);
  } else {
    user = new User(payload);
    await user.save();
    console.log(`Superadmin created: ${user.email}`);
  }
  return user;
}

async function seedOneTenant(def, passwordHash) {
  let tenant = await Tenant.findOne({ slug: def.slug });
  if (!tenant) {
    tenant = await Tenant.create({
      name: def.name,
      slug: def.slug,
      domainWhitelist: def.domainWhitelist,
      theme: def.theme,
      status: 'active',
      signupMode: 'domain',
      settings: {
        maxUploadMB: 50,
        moderationEnabled: true,
        inviteCode: `${def.slug}-invite`,
      },
    });
    console.log(`Tenant created: ${tenant.slug}`);
  } else {
    if (!tenant.signupMode) {
      tenant.signupMode = 'domain';
      await tenant.save();
    }
    console.log(`Tenant exists: ${tenant.slug}`);
  }

  // Keep a legacy University row (1:1 map target for later migration); not plugin-scoped
  let university = await University.findOne({ slug: def.slug });
  if (!university) {
    university = await University.create({ name: def.name, slug: def.slug });
  }
  if (!tenant.legacyUniversityId) {
    tenant.legacyUniversityId = university._id;
    await tenant.save();
  }

  return runWithTenantContext({ tenantId: tenant._id, tenant }, async () => {
    // Lookups must be scoped to university/campus/course — slug alone reuses
    // leftover test taxonomy from other campuses and leaves the seeded campus empty.
    let campus = await Campus.findOne({
      university: university._id,
      slug: def.campus.slug,
    });
    if (!campus) {
      campus = await Campus.create({
        name: def.campus.name,
        slug: def.campus.slug,
        city: def.campus.city,
        university: university._id,
        tenantId: tenant._id,
      });
    }

    let department = await Department.findOne({
      campus: campus._id,
      slug: def.department.slug,
    });
    if (!department) {
      department = await Department.create({
        name: def.department.name,
        slug: def.department.slug,
        campus: campus._id,
        university: university._id,
        tenantId: tenant._id,
      });
    }

    let course = await Course.findOne({
      department: department._id,
      slug: def.course.slug,
    });
    if (!course) {
      course = await Course.create({
        name: def.course.name,
        slug: def.course.slug,
        department: department._id,
        campus: campus._id,
        university: university._id,
        tenantId: tenant._id,
      });
    }

    let subject = await Subject.findOne({
      course: course._id,
      slug: def.subject.slug,
    });
    if (!subject) {
      subject = await Subject.create({
        name: def.subject.name,
        slug: def.subject.slug,
        course: course._id,
        tenantId: tenant._id,
      });
    }

    async function upsertTenantUser(person, role) {
      let user = await User.findOne({ email: person.email });
      const payload = {
        fullName: person.fullName,
        username: person.username,
        email: person.email,
        passwordHash,
        role,
        tenantId: tenant._id,
        adminLevel: role === 'tenantAdmin' ? 'department' : undefined,
        university: university._id,
        campus: campus._id,
        department: department._id,
        emailVerified: true,
      };
      if (user) {
        Object.assign(user, payload);
        await user.save();
        console.log(`  User updated: ${user.email} (${role})`);
      } else {
        user = await User.create(payload);
        console.log(`  User created: ${user.email} (${role})`);
      }
      return user;
    }

    await upsertTenantUser(def.admin, 'tenantAdmin');
    await upsertTenantUser(def.student, 'student');

    return { tenant, campus, department };
  });
}

async function run() {
  assertSeedPasswordAllowed();
  await connectDb();
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  await upsertSuperadmin(passwordHash);

  for (const def of TENANTS) {
    await seedOneTenant(def, passwordHash);
  }

  console.log('\n--- Isolation test accounts ---');
  console.log(`Password for all: ${PASSWORD}`);
  console.log('Superadmin:', env.ADMIN_SEED_EMAIL);
  console.log('Alpha admin:   admin@alpha.edu   (x-tenant: alpha)');
  console.log('Alpha student: student@alpha.edu (x-tenant: alpha)');
  console.log('Beta admin:    admin@beta.edu    (x-tenant: beta)');
  console.log('Beta student:  student@beta.edu  (x-tenant: beta)');
  console.log('Invite codes: alpha-invite | beta-invite');
  console.log('Seed complete');

  await disconnectDb();
}

run().catch(async (err) => {
  console.error('seed:tenants failed:', err);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
