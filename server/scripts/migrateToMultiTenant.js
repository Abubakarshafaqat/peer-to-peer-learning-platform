/**
 * Step 3+5: University → Tenant backfill + role remap.
 *
 * Dry-run by default. Pass --apply to write.
 * Uses skipTenant explicitly and only in this script.
 *
 * Usage:
 *   node scripts/migrateToMultiTenant.js
 *   node scripts/migrateToMultiTenant.js --apply
 */
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { University } from '../src/models/University.js';
import { Tenant } from '../src/models/Tenant.js';
import { Campus } from '../src/models/Campus.js';
import { Department } from '../src/models/Department.js';
import { Course } from '../src/models/Course.js';
import { Subject } from '../src/models/Subject.js';
import { Material } from '../src/models/Material.js';
import { User } from '../src/models/User.js';
import { RefreshToken } from '../src/models/RefreshToken.js';

const SKIP = { skipTenant: true };
const SKIP_WRITE = { skipTenant: true, overwriteImmutable: true };
const MISSING_TENANT = {
  $or: [{ tenantId: null }, { tenantId: { $exists: false } }],
};

function slugifyBase(input) {
  const raw = String(input || 'tenant')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return raw.length >= 2 ? raw : `t-${raw || 'x'}`.slice(0, 40);
}

function ensureUniqueSlug(preferred, used) {
  let slug = preferred;
  let n = 2;
  while (used.has(slug)) {
    const suffix = `-${n}`;
    slug = `${preferred.slice(0, Math.max(2, 40 - suffix.length))}${suffix}`;
    n += 1;
  }
  used.add(slug);
  return slug;
}

function oid(id) {
  if (!id) return null;
  return String(id._id || id);
}

function emptyCounts() {
  return {
    tenantsCreated: 0,
    Campus: 0,
    Department: 0,
    Course: 0,
    Subject: 0,
    Material: 0,
    User: 0,
    RefreshToken: 0,
    rolesRemapped: 0,
  };
}

function pathEquals(a, b) {
  if (!a || !b) return false;
  return a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase();
}

/**
 * Core migration. Safe to call from tests (pass { apply }).
 */
export async function runMigration({ apply = false } = {}) {
  const counts = emptyCounts();
  const underived = [];
  const planned = [];
  const uniToTenant = new Map();
  const usedSlugs = new Set();

  const existingTenants = await Tenant.find({}).lean();
  for (const t of existingTenants) {
    usedSlugs.add(t.slug);
    if (t.legacyUniversityId) {
      uniToTenant.set(oid(t.legacyUniversityId), t._id);
    }
  }

  const universities = await University.find({}).lean();
  console.log(`\n=== Universities → Tenants (${universities.length}) ===`);

  for (const uni of universities) {
    const uniId = oid(uni._id);
    if (uniToTenant.has(uniId)) {
      console.log(`  [skip] ${uni.name} (${uni.slug}) → tenant ${uniToTenant.get(uniId)}`);
      continue;
    }

    const slug = ensureUniqueSlug(slugifyBase(uni.slug || uni.name), usedSlugs);
    const payload = {
      name: uni.name,
      slug,
      status: 'active',
      legacyUniversityId: uni._id,
    };

    counts.tenantsCreated += 1;
    if (apply) {
      const tenant = await Tenant.create(payload);
      uniToTenant.set(uniId, tenant._id);
      console.log(`  [create] ${uni.name} → tenant ${tenant._id} slug=${slug}`);
    } else {
      const fakeId = new mongoose.Types.ObjectId();
      uniToTenant.set(uniId, fakeId);
      planned.push({ op: 'createTenant', universityId: uniId, slug, name: uni.name });
      console.log(`  [would create] ${uni.name} → slug=${slug}`);
    }
  }

  console.log('\nUniversity → Tenant map:');
  for (const [uniId, tid] of uniToTenant) {
    console.log(`  ${uniId} → ${tid}`);
  }

  const campusById = new Map();
  const deptById = new Map();
  const courseById = new Map();
  const subjectById = new Map();
  const userById = new Map();

  for (const c of await Campus.find({}).setOptions(SKIP).lean()) campusById.set(oid(c._id), c);
  for (const d of await Department.find({}).setOptions(SKIP).lean()) deptById.set(oid(d._id), d);
  for (const c of await Course.find({}).setOptions(SKIP).lean()) courseById.set(oid(c._id), c);
  for (const s of await Subject.find({}).setOptions(SKIP).lean()) subjectById.set(oid(s._id), s);
  for (const u of await User.find({}).setOptions(SKIP).lean()) userById.set(oid(u._id), u);

  function tenantFromUniversity(universityRef) {
    if (!universityRef) return null;
    return uniToTenant.get(oid(universityRef)) || null;
  }

  function tenantFromCampus(campusRef) {
    if (!campusRef) return null;
    const c = campusById.get(oid(campusRef));
    if (!c) return null;
    if (c.tenantId) return c.tenantId;
    return tenantFromUniversity(c.university);
  }

  function tenantFromDepartment(deptRef) {
    if (!deptRef) return null;
    const d = deptById.get(oid(deptRef));
    if (!d) return null;
    if (d.tenantId) return d.tenantId;
    return tenantFromUniversity(d.university) || tenantFromCampus(d.campus);
  }

  function tenantFromCourse(courseRef) {
    if (!courseRef) return null;
    const c = courseById.get(oid(courseRef));
    if (!c) return null;
    if (c.tenantId) return c.tenantId;
    return (
      tenantFromUniversity(c.university) ||
      tenantFromCampus(c.campus) ||
      tenantFromDepartment(c.department)
    );
  }

  async function stampMissing(Model, label, derive, map) {
    const docs = await Model.find(MISSING_TENANT).setOptions(SKIP).lean();
    let stamped = 0;
    for (const doc of docs) {
      const tid = derive(doc);
      if (!tid) {
        underived.push({ collection: label, id: oid(doc._id) });
        continue;
      }
      stamped += 1;
      counts[label] += 1;
      if (apply) {
        await Model.updateOne({ _id: doc._id }, { $set: { tenantId: tid } }, SKIP_WRITE);
      } else {
        planned.push({ op: 'stamp', collection: label, id: oid(doc._id), tenantId: oid(tid) });
      }
      if (map?.has(oid(doc._id))) map.get(oid(doc._id)).tenantId = tid;
    }
    console.log(`  ${label}: ${stamped} to stamp (${docs.length} missing tenantId scanned)`);
  }

  console.log('\n=== Backfill tenantId ===');
  await stampMissing(Campus, 'Campus', (d) => tenantFromUniversity(d.university), campusById);
  await stampMissing(
    Department,
    'Department',
    (d) => tenantFromUniversity(d.university) || tenantFromCampus(d.campus),
    deptById,
  );
  await stampMissing(
    Course,
    'Course',
    (d) =>
      tenantFromUniversity(d.university) ||
      tenantFromCampus(d.campus) ||
      tenantFromDepartment(d.department),
    courseById,
  );
  await stampMissing(Subject, 'Subject', (d) => tenantFromCourse(d.course), subjectById);
  await stampMissing(Material, 'Material', (d) => tenantFromUniversity(d.university), null);

  // --- Role remap ---
  console.log('\n=== Role remap ===');
  const roleBefore = await roleCounts();
  printRoleTable('BEFORE', roleBefore);

  const legacyAdmins = await User.find({ role: 'admin' }).setOptions(SKIP).lean();
  for (const user of legacyAdmins) {
    const level = user.adminLevel || 'department';
    const nextRole = level === 'platform' ? 'superadmin' : 'tenantAdmin';

    counts.rolesRemapped += 1;
    if (apply) {
      if (nextRole === 'superadmin') {
        await User.updateOne(
          { _id: user._id },
          { $set: { role: 'superadmin', tenantId: null }, $unset: { adminLevel: 1 } },
          SKIP_WRITE,
        );
      } else {
        // Preserve adminLevel + university/campus/department scope fields
        await User.updateOne({ _id: user._id }, { $set: { role: 'tenantAdmin' } }, SKIP_WRITE);
      }
    } else {
      planned.push({
        op: 'remapRole',
        id: oid(user._id),
        from: 'admin',
        to: nextRole,
        adminLevel: level,
      });
    }

    const cached = userById.get(oid(user._id));
    if (cached) {
      cached.role = nextRole;
      if (nextRole === 'superadmin') {
        cached.tenantId = null;
        cached.adminLevel = undefined;
      }
    }
  }
  console.log(`  Remapped ${counts.rolesRemapped} legacy admin user(s)`);

  // Reload users after apply so tenant stamp sees remapped roles
  if (apply) {
    userById.clear();
    for (const u of await User.find({}).setOptions(SKIP).lean()) userById.set(oid(u._id), u);
  }

  console.log('\n=== Backfill User.tenantId ===');
  for (const user of userById.values()) {
    if (user.role === 'superadmin') {
      if (user.tenantId) {
        counts.User += 1;
        if (apply) {
          await User.updateOne(
            { _id: user._id },
            { $set: { tenantId: null }, $unset: { adminLevel: 1 } },
            SKIP_WRITE,
          );
        } else {
          planned.push({ op: 'clearTenant', collection: 'User', id: oid(user._id) });
        }
        user.tenantId = null;
      }
      continue;
    }

    if (user.tenantId) continue;

    const tid =
      tenantFromUniversity(user.university) ||
      tenantFromCampus(user.campus) ||
      tenantFromDepartment(user.department);

    if (!tid) {
      underived.push({
        collection: 'User',
        id: oid(user._id),
        email: user.email,
        role: user.role,
      });
      continue;
    }

    counts.User += 1;
    if (apply) {
      await User.updateOne({ _id: user._id }, { $set: { tenantId: tid } }, SKIP_WRITE);
    } else {
      planned.push({ op: 'stamp', collection: 'User', id: oid(user._id), tenantId: oid(tid) });
    }
    user.tenantId = tid;
  }
  console.log(`  User: ${counts.User} changes`);

  console.log('\n=== Backfill RefreshToken.tenantId ===');
  const tokens = await RefreshToken.find(MISSING_TENANT).setOptions(SKIP).lean();
  for (const tok of tokens) {
    const user = userById.get(oid(tok.user));
    if (!user) {
      underived.push({ collection: 'RefreshToken', id: oid(tok._id), reason: 'user missing' });
      continue;
    }

    if (user.role === 'superadmin') {
      // null is correct — nothing to stamp
      continue;
    }

    if (!user.tenantId) {
      underived.push({
        collection: 'RefreshToken',
        id: oid(tok._id),
        reason: 'user has no tenantId',
        userId: oid(user._id),
      });
      continue;
    }

    counts.RefreshToken += 1;
    if (apply) {
      await RefreshToken.updateOne(
        { _id: tok._id },
        { $set: { tenantId: user.tenantId } },
        SKIP_WRITE,
      );
    } else {
      planned.push({
        op: 'stamp',
        collection: 'RefreshToken',
        id: oid(tok._id),
        tenantId: oid(user.tenantId),
      });
    }
  }
  console.log(`  RefreshToken: ${counts.RefreshToken} to stamp`);

  if (underived.length) {
    console.log(`\n!!! Underived documents (left untouched): ${underived.length}`);
    for (const row of underived) console.log(`  - ${JSON.stringify(row)}`);
  } else {
    console.log('\nNo underived documents.');
  }

  const roleAfter = apply
    ? await roleCounts()
    : simulateRoleAfter(roleBefore, legacyAdmins);
  printRoleTable('AFTER', roleAfter);

  const duplicates = findDuplicateIdentityKeys([...userById.values()]);
  if (duplicates.blocking.length) {
    console.log('\n!!! BLOCKING duplicates (unique index would fail):');
    for (const d of duplicates.blocking) console.log(`  - ${JSON.stringify(d)}`);
  }
  if (duplicates.crossUniversity.length) {
    console.log(
      '\nWarning: same email in two former universities (allowed per-tenant; review manually):',
    );
    for (const d of duplicates.crossUniversity) console.log(`  - ${JSON.stringify(d)}`);
  }

  let indexSync = { ok: true, error: null };
  if (apply) {
    console.log('\n=== syncIndexes ===');
    try {
      await Promise.all([
        Campus.syncIndexes(),
        Department.syncIndexes(),
        Course.syncIndexes(),
        Subject.syncIndexes(),
        Material.syncIndexes(),
        User.syncIndexes(),
        RefreshToken.syncIndexes(),
        Tenant.syncIndexes(),
      ]);
      console.log('  Indexes synced OK');
    } catch (err) {
      indexSync = { ok: false, error: err.message };
      console.error(`  Index sync failed: ${err.message}`);
    }
  }

  const verification = await runVerification({
    apply,
    userById,
    campusById,
    deptById,
    courseById,
    subjectById,
    uniToTenant,
  });

  console.log('\n=== Verification ===');
  console.log('  Missing tenantId counts:', verification.missing);
  console.log('  Cross-tenant Material refs:', verification.crossTenantMaterials.length);
  for (const row of verification.crossTenantMaterials.slice(0, 20)) {
    console.log(`    - ${JSON.stringify(row)}`);
  }
  console.log(`  Legacy role "admin" remaining: ${verification.legacyAdminCount}`);

  console.log('\n=== Counts summary ===');
  console.log(JSON.stringify(counts, null, 2));
  console.log(apply ? '\nMode: APPLY (writes performed)' : '\nMode: DRY-RUN (no writes)');

  const ok =
    verification.ok &&
    duplicates.blocking.length === 0 &&
    indexSync.ok &&
    underived.length === 0;

  return {
    apply,
    uniToTenant,
    counts,
    underived,
    roleBefore,
    roleAfter,
    verification,
    duplicates,
    indexSync,
    planned,
    ok,
  };
}

async function roleCounts() {
  const rows = await User.aggregate([
    { $group: { _id: { role: '$role', adminLevel: '$adminLevel' }, n: { $sum: 1 } } },
    { $sort: { '_id.role': 1, '_id.adminLevel': 1 } },
  ]).option(SKIP);

  const byRole = { student: 0, tenantAdmin: 0, superadmin: 0, admin: 0, other: 0 };
  for (const r of rows) {
    const role = r._id.role || 'other';
    if (byRole[role] != null) byRole[role] += r.n;
    else byRole.other += r.n;
  }
  return { byRole, detail: rows };
}

function simulateRoleAfter(before, legacyAdmins) {
  const byRole = { ...before.byRole, admin: 0 };
  for (const u of legacyAdmins) {
    const level = u.adminLevel || 'department';
    if (level === 'platform') byRole.superadmin += 1;
    else byRole.tenantAdmin += 1;
  }
  return { byRole, detail: [], simulated: true };
}

function printRoleTable(label, data) {
  console.log(`\nRole counts ${label}:`);
  console.log('  role         | count');
  console.log('  -------------|------');
  for (const role of ['student', 'tenantAdmin', 'superadmin', 'admin', 'other']) {
    const n = data.byRole[role] || 0;
    if (role === 'other' && n === 0) continue;
    console.log(`  ${role.padEnd(13)}| ${n}`);
  }
}

function findDuplicateIdentityKeys(users) {
  const blocking = [];
  const crossUniversity = [];
  const emailBuckets = new Map();
  const usernameBuckets = new Map();
  const globalEmailUnis = new Map();

  for (const u of users) {
    if (u.role === 'superadmin') {
      const key = `super::${u.email}`;
      emailBuckets.set(key, (emailBuckets.get(key) || []).concat(oid(u._id)));
      const ukey = `super::${u.username}`;
      usernameBuckets.set(ukey, (usernameBuckets.get(ukey) || []).concat(oid(u._id)));
      continue;
    }
    const tid = u.tenantId ? oid(u.tenantId) : 'none';
    const ek = `${tid}::${u.email}`;
    const uk = `${tid}::${u.username}`;
    emailBuckets.set(ek, (emailBuckets.get(ek) || []).concat(oid(u._id)));
    usernameBuckets.set(uk, (usernameBuckets.get(uk) || []).concat(oid(u._id)));

    if (u.email && u.university) {
      if (!globalEmailUnis.has(u.email)) globalEmailUnis.set(u.email, new Set());
      globalEmailUnis.get(u.email).add(oid(u.university));
    }
  }

  for (const [key, ids] of emailBuckets) {
    if (ids.length > 1) blocking.push({ type: 'email', key, userIds: ids });
  }
  for (const [key, ids] of usernameBuckets) {
    if (ids.length > 1) blocking.push({ type: 'username', key, userIds: ids });
  }
  for (const [email, unis] of globalEmailUnis) {
    if (unis.size > 1) crossUniversity.push({ email, universities: [...unis] });
  }

  return { blocking, crossUniversity };
}

async function runVerification({
  apply,
  userById,
  campusById,
  deptById,
  courseById,
  subjectById,
  uniToTenant,
}) {
  const missing = {};

  if (apply) {
    missing.Campus = await Campus.countDocuments(MISSING_TENANT).setOptions(SKIP);
    missing.Department = await Department.countDocuments(MISSING_TENANT).setOptions(SKIP);
    missing.Course = await Course.countDocuments(MISSING_TENANT).setOptions(SKIP);
    missing.Subject = await Subject.countDocuments(MISSING_TENANT).setOptions(SKIP);
    missing.Material = await Material.countDocuments(MISSING_TENANT).setOptions(SKIP);
    missing.User = await User.countDocuments({
      role: { $ne: 'superadmin' },
      ...MISSING_TENANT,
    }).setOptions(SKIP);

    const tokens = await RefreshToken.find(MISSING_TENANT).setOptions(SKIP).lean();
    let tokenMissing = 0;
    for (const t of tokens) {
      const u = userById.get(oid(t.user));
      if (u && u.role !== 'superadmin') tokenMissing += 1;
    }
    missing.RefreshToken = tokenMissing;
  } else {
    // After stampMissing overlays tenantId onto in-memory maps, remaining null = underivable
    missing.Campus = [...campusById.values()].filter((d) => !d.tenantId).length;
    missing.Department = [...deptById.values()].filter((d) => !d.tenantId).length;
    missing.Course = [...courseById.values()].filter((d) => !d.tenantId).length;
    missing.Subject = [...subjectById.values()].filter((d) => !d.tenantId).length;
    const matDocs = await Material.find({}).setOptions(SKIP).lean();
    missing.Material = matDocs.filter(
      (d) => !d.tenantId && !uniToTenant.get(oid(d.university)),
    ).length;
    missing.User = [...userById.values()].filter(
      (u) => u.role !== 'superadmin' && !u.tenantId,
    ).length;
    missing.RefreshToken = 0;
  }

  const crossTenantMaterials = [];
  const materials = await Material.find({}).setOptions(SKIP).lean();
  for (const m of materials) {
    const tid = m.tenantId
      ? oid(m.tenantId)
      : oid(uniToTenant.get(oid(m.university))) || null;
    if (!tid) continue;

    const pairs = [
      ['campus', campusById.get(oid(m.campus))],
      ['department', deptById.get(oid(m.department))],
      ['course', courseById.get(oid(m.course))],
      ['subject', subjectById.get(oid(m.subject))],
    ];
    for (const [field, ref] of pairs) {
      if (!ref?.tenantId) continue;
      if (oid(ref.tenantId) !== tid) {
        crossTenantMaterials.push({
          materialId: oid(m._id),
          field,
          materialTenant: tid,
          refTenant: oid(ref.tenantId),
        });
      }
    }
  }

  const legacyAdminCount = apply
    ? await User.countDocuments({ role: 'admin' }).setOptions(SKIP)
    : [...userById.values()].filter((u) => u.role === 'admin').length;

  const missingTotal = Object.values(missing).reduce((a, b) => a + b, 0);
  const ok = missingTotal === 0 && crossTenantMaterials.length === 0 && legacyAdminCount === 0;

  return { missing, crossTenantMaterials, legacyAdminCount, ok };
}

async function main() {
  const apply = process.argv.includes('--apply');
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_MIGRATE !== '1') {
    console.error(
      'Refusing to run migrateToMultiTenant in production without ALLOW_PRODUCTION_MIGRATE=1',
    );
    process.exit(1);
  }
  await connectDb();
  try {
    const result = await runMigration({ apply });
    if (apply && !result.ok) {
      console.error('\nMigration verification FAILED');
      process.exitCode = 1;
    } else if (!apply) {
      console.log('\nDry-run complete. Re-run with --apply to write changes.');
      if (result.duplicates.blocking.length) {
        console.error('\nBlocking duplicates present — fix before --apply');
        process.exitCode = 1;
      }
    } else {
      console.log('\nMigration OK');
    }
  } finally {
    await disconnectDb();
  }
}

if (pathEquals(fileURLToPath(import.meta.url), process.argv[1])) {
  main().catch(async (err) => {
    console.error(err);
    process.exitCode = 1;
    try {
      await disconnectDb();
    } catch {
      /* ignore */
    }
    process.exit(process.exitCode || 1);
  });
}
