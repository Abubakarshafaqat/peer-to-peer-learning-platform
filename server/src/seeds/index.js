function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Seed skeleton — admin user + sample taxonomy.
 * Full demo data lands in Phase 9.
 */
import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { University } from '../models/University.js';
import { Course } from '../models/Course.js';
import { Subject } from '../models/Subject.js';

const SAMPLE = [
  {
    university: 'University of the Punjab',
    courses: [
      {
        name: 'BS Computer Science',
        subjects: ['Programming Fundamentals', 'Data Structures', 'Database Systems'],
      },
    ],
  },
  {
    university: 'NUST',
    courses: [
      {
        name: 'BE Software Engineering',
        subjects: ['Object Oriented Programming', 'Software Design'],
      },
    ],
  },
];

async function seedAdmin() {
  const existing = await User.findOne({
    $or: [{ email: env.ADMIN_SEED_EMAIL }, { username: env.ADMIN_SEED_USERNAME }],
  });

  if (existing) {
    console.log('Admin user already exists — skipping');
    return existing;
  }

  const passwordHash = await bcrypt.hash(env.ADMIN_SEED_PASSWORD, 12);
  const admin = await User.create({
    fullName: 'Platform Admin',
    username: env.ADMIN_SEED_USERNAME,
    email: env.ADMIN_SEED_EMAIL,
    phone: '',
    passwordHash,
    role: 'admin',
  });

  console.log(`Admin created: ${admin.email} / ${admin.username}`);
  return admin;
}

async function seedTaxonomy() {
  for (const uni of SAMPLE) {
    const uniSlug = slugify(uni.university);
    let university = await University.findOne({ slug: uniSlug });
    if (!university) {
      university = await University.create({ name: uni.university, slug: uniSlug });
      console.log(`University: ${university.name}`);
    }

    for (const courseDef of uni.courses) {
      const courseSlug = slugify(courseDef.name);
      let course = await Course.findOne({ university: university._id, slug: courseSlug });
      if (!course) {
        course = await Course.create({
          name: courseDef.name,
          slug: courseSlug,
          university: university._id,
        });
        console.log(`  Course: ${course.name}`);
      }

      for (const subjectName of courseDef.subjects) {
        const subjectSlug = slugify(subjectName);
        const exists = await Subject.findOne({ course: course._id, slug: subjectSlug });
        if (!exists) {
          await Subject.create({
            name: subjectName,
            slug: subjectSlug,
            course: course._id,
          });
          console.log(`    Subject: ${subjectName}`);
        }
      }
    }
  }
}

async function run() {
  await connectDb();
  await seedAdmin();
  await seedTaxonomy();
  await disconnectDb();
  console.log('Seed complete');
}

run().catch(async (err) => {
  console.error('Seed failed:', err);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
