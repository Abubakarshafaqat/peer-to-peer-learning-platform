/**
 * Legacy org seed. Prefer `npm run seed:tenants` for SaaS fixtures.
 * Creates Tenant per University and stamps tenantId via ALS.
 */
import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from '../config/db.js';
import { env } from '../config/env.js';
import { runWithTenantContext } from '../utils/tenantContext.js';
import { User } from '../models/User.js';
import { Tenant } from '../models/Tenant.js';
import { University } from '../models/University.js';
import { Campus } from '../models/Campus.js';
import { Department } from '../models/Department.js';
import { Course } from '../models/Course.js';
import { Subject } from '../models/Subject.js';

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function assertSeedPasswordAllowed() {
  if (env.NODE_ENV === 'production' && !process.env.ADMIN_SEED_PASSWORD) {
    console.error(
      'Refusing to seed in production without ADMIN_SEED_PASSWORD set in the environment.',
    );
    process.exit(1);
  }
}

const SAMPLE = [
  {
    university: 'NUST',
    campuses: [
      {
        name: 'Islamabad Campus',
        city: 'Islamabad',
        departments: [
          {
            name: 'SEECS',
            courses: [
              {
                name: 'BE Software Engineering',
                subjects: ['Object Oriented Programming', 'Software Design'],
              },
            ],
          },
          {
            name: 'SMME',
            courses: [
              {
                name: 'BE Mechanical Engineering',
                subjects: ['Thermodynamics', 'Mechanics'],
              },
            ],
          },
        ],
      },
      {
        name: 'Karachi Campus',
        city: 'Karachi',
        departments: [
          {
            name: 'SEECS',
            courses: [
              {
                name: 'BS Computer Science',
                subjects: ['Programming Fundamentals', 'Data Structures'],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    university: 'University of the Punjab',
    campuses: [
      {
        name: 'Quaid-e-Azam Campus',
        city: 'Lahore',
        departments: [
          {
            name: 'Department of Computer Science',
            courses: [
              {
                name: 'BS Computer Science',
                subjects: ['Programming Fundamentals', 'Database Systems'],
              },
            ],
          },
        ],
      },
    ],
  },
];

async function seedPlatformAdmin() {
  const existing = await User.findOne({
    $or: [{ email: env.ADMIN_SEED_EMAIL }, { username: env.ADMIN_SEED_USERNAME }],
  });

  if (existing) {
    existing.role = 'superadmin';
    existing.adminLevel = undefined;
    existing.tenantId = null;
    await existing.save({ validateBeforeSave: false });
    console.log('Platform superadmin already exists — ensured role=superadmin');
    return existing;
  }

  const passwordHash = await bcrypt.hash(env.ADMIN_SEED_PASSWORD, 12);
  const admin = await User.create({
    fullName: 'Platform Superadmin',
    username: env.ADMIN_SEED_USERNAME,
    email: env.ADMIN_SEED_EMAIL,
    phone: '',
    passwordHash,
    role: 'superadmin',
    tenantId: null,
  });

  console.log(`Platform superadmin created: ${admin.email}`);
  return admin;
}

async function upsertScopedAdmin({
  fullName,
  username,
  email,
  password,
  adminLevel,
  university,
  campus,
  department,
  tenantId,
}) {
  let user = await User.findOne({ email }).setOptions({ skipTenant: true });
  if (!user) user = await User.findOne({ username }).setOptions({ skipTenant: true });
  const passwordHash = await bcrypt.hash(password, 12);
  const payload = {
    fullName,
    username,
    email,
    passwordHash,
    role: 'tenantAdmin',
    adminLevel,
    university: university || null,
    campus: campus || null,
    department: department || null,
    tenantId: tenantId || null,
  };

  if (user) {
    const $set = {
      fullName: payload.fullName,
      email: payload.email,
      passwordHash: payload.passwordHash,
      role: 'tenantAdmin',
      adminLevel: payload.adminLevel,
      university: payload.university,
      campus: payload.campus,
      department: payload.department,
    };
    if (tenantId) $set.tenantId = tenantId;

    if (user.username !== username) {
      const taken = await User.findOne({ username, _id: { $ne: user._id } }).setOptions({
        skipTenant: true,
      });
      if (!taken) $set.username = username;
    }

    await User.updateOne({ _id: user._id }, { $set }, { skipTenant: true, overwriteImmutable: true });
    console.log(`  Scoped tenantAdmin updated: ${email} (${adminLevel})`);
    return User.findById(user._id).setOptions({ skipTenant: true });
  }

  user = await User.create(payload);
  console.log(`  Scoped tenantAdmin created: ${email} (${adminLevel})`);
  return user;
}

async function migrateCourseIndexes() {
  try {
    await Course.collection.dropIndex('university_1_slug_1');
    console.log('Dropped legacy courses index university_1_slug_1');
  } catch {
    // index may not exist
  }
  await Course.syncIndexes();
}

async function seedTaxonomyAndOrgAdmins() {
  const defaultPassword = env.ADMIN_SEED_PASSWORD || 'Admin123!';
  await migrateCourseIndexes();
  console.log('Note: prefer `npm run seed:tenants` for SaaS demo data.');

  for (const uni of SAMPLE) {
    const uniSlug = slugify(uni.university);
    let university = await University.findOne({ slug: uniSlug });
    if (!university) {
      university = await University.create({ name: uni.university, slug: uniSlug });
      console.log(`University: ${university.name}`);
    }

    let tenant = await Tenant.findOne({ legacyUniversityId: university._id });
    if (!tenant) tenant = await Tenant.findOne({ slug: uniSlug });
    if (!tenant) {
      tenant = await Tenant.create({
        name: university.name,
        slug: uniSlug,
        status: 'active',
        legacyUniversityId: university._id,
      });
      console.log(`Tenant: ${tenant.slug}`);
    } else if (!tenant.legacyUniversityId) {
      tenant.legacyUniversityId = university._id;
      await tenant.save();
    }

    await runWithTenantContext({ tenantId: tenant._id, tenant }, async () => {
      await upsertScopedAdmin({
        fullName: `${uni.university} Admin`,
        username: `${uniSlug}-admin`,
        email: `${uniSlug}-admin@example.com`,
        password: defaultPassword,
        adminLevel: 'university',
        university: university._id,
        tenantId: tenant._id,
      });

      for (const campusDef of uni.campuses) {
        const campusSlug = slugify(campusDef.name);
        let campus = await Campus.findOne({ university: university._id, slug: campusSlug });
        if (!campus) {
          campus = await Campus.create({
            name: campusDef.name,
            slug: campusSlug,
            city: campusDef.city || '',
            university: university._id,
            tenantId: tenant._id,
          });
          console.log(`  Campus: ${campus.name}`);
        }

        await upsertScopedAdmin({
          fullName: `${campusDef.name} Admin`,
          username: `${uniSlug}-${campusSlug}-admin`.slice(0, 32),
          email: `${uniSlug}.${campusSlug}.admin@example.com`,
          password: defaultPassword,
          adminLevel: 'campus',
          university: university._id,
          campus: campus._id,
          tenantId: tenant._id,
        });

        for (const deptDef of campusDef.departments) {
          const deptSlug = slugify(deptDef.name);
          let department = await Department.findOne({ campus: campus._id, slug: deptSlug });
          if (!department) {
            department = await Department.create({
              name: deptDef.name,
              slug: deptSlug,
              campus: campus._id,
              university: university._id,
              tenantId: tenant._id,
            });
            console.log(`    Department: ${department.name}`);
          }

          await upsertScopedAdmin({
            fullName: `${deptDef.name} Admin (${campusDef.name})`,
            username: `${uniSlug}-${campusSlug}-${deptSlug}-a`.slice(0, 32),
            email: `${uniSlug}.${campusSlug}.${deptSlug}.admin@example.com`,
            password: defaultPassword,
            adminLevel: 'department',
            university: university._id,
            campus: campus._id,
            department: department._id,
            tenantId: tenant._id,
          });

          for (const courseDef of deptDef.courses) {
            const courseSlug = slugify(courseDef.name);
            let course = await Course.findOne({ department: department._id, slug: courseSlug });
            if (!course) {
              course = await Course.findOne({ university: university._id, slug: courseSlug });
            }
            if (course) {
              course.department = department._id;
              course.campus = campus._id;
              course.university = university._id;
              await course.save();
            } else {
              course = await Course.create({
                name: courseDef.name,
                slug: courseSlug,
                department: department._id,
                campus: campus._id,
                university: university._id,
                tenantId: tenant._id,
              });
              console.log(`      Course: ${course.name}`);
            }

            for (const subjectName of courseDef.subjects) {
              const subjectSlug = slugify(subjectName);
              const exists = await Subject.findOne({ course: course._id, slug: subjectSlug });
              if (!exists) {
                await Subject.create({
                  name: subjectName,
                  slug: subjectSlug,
                  course: course._id,
                  tenantId: tenant._id,
                });
                console.log(`        Subject: ${subjectName}`);
              }
            }
          }
        }
      }
    });
  }
}

async function run() {
  assertSeedPasswordAllowed();
  await connectDb();
  await seedPlatformAdmin();
  await seedTaxonomyAndOrgAdmins();
  await disconnectDb();
  console.log('Seed complete');
}

run().catch(async (err) => {
  console.error('Seed failed:', err);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
