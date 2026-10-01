/**
 * Step 8: report (and optionally rename) Cloudinary assets not under
 * tenants/{tenantId}/materials/{materialId}.
 *
 * Dry-run by default. Pass --apply to call Cloudinary rename.
 *
 * Usage:
 *   node scripts/migrateCloudinaryLayout.js
 *   node scripts/migrateCloudinaryLayout.js --apply
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

const APPLY = process.argv.includes('--apply');

function cloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

function expectedPrefix(tenantId, materialId) {
  return `tenants/${String(tenantId)}/materials/${String(materialId)}`;
}

async function run() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_MIGRATE !== '1') {
    console.error(
      'Refusing to run migrateCloudinaryLayout in production without ALLOW_PRODUCTION_MIGRATE=1',
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const materials = await mongoose.connection.db
    .collection('materials')
    .find({ 'file.provider': 'cloudinary' })
    .project({ tenantId: 1, file: 1 })
    .toArray();

  const legacy = [];
  for (const m of materials) {
    const publicId = m.file?.publicId || '';
    const prefix = expectedPrefix(m.tenantId, m._id);
    if (!publicId.startsWith(prefix)) {
      legacy.push({
        materialId: String(m._id),
        tenantId: String(m.tenantId),
        publicId,
        expectedPrefix: prefix,
        resourceType: m.file?.resourceType || 'raw',
      });
    }
  }

  console.log(`Scanned ${materials.length} cloudinary materials`);
  console.log(`Legacy / non-layout paths: ${legacy.length}`);
  for (const row of legacy.slice(0, 50)) {
    console.log(` - ${row.publicId} → ${row.expectedPrefix}/asset`);
  }
  if (legacy.length > 50) console.log(` ... and ${legacy.length - 50} more`);

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to rename on Cloudinary + update DB.');
    await mongoose.disconnect();
    return;
  }

  if (!cloudinaryConfigured()) {
    console.error('CLOUDINARY_* env required for --apply');
    process.exit(1);
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  let moved = 0;
  let failed = 0;
  for (const row of legacy) {
    const toPublicId = `${row.expectedPrefix}/asset`;
    try {
      await cloudinary.uploader.rename(row.publicId, toPublicId, {
        resource_type: row.resourceType === 'image' ? 'image' : 'raw',
        type: 'authenticated',
        overwrite: true,
      });
      await mongoose.connection.db.collection('materials').updateOne(
        { _id: new mongoose.Types.ObjectId(row.materialId) },
        {
          $set: {
            'file.publicId': toPublicId,
            'file.deliveryRef': toPublicId,
          },
        },
      );
      moved += 1;
      console.log(`Moved ${row.publicId} → ${toPublicId}`);
    } catch (err) {
      failed += 1;
      console.error(`Failed ${row.publicId}:`, err.message);
    }
  }

  console.log(`\nDone. moved=${moved} failed=${failed}`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
