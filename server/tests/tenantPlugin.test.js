import mongoose from 'mongoose';
import { runWithTenantContext } from '../src/utils/tenantContext.js';
import { tenantPlugin } from '../src/plugins/tenantPlugin.js';

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/peer-learning-test';

let mongoAvailable = false;

const sampleSchema = new mongoose.Schema({
  title: { type: String, required: true },
});
sampleSchema.plugin(tenantPlugin);
const Sample =
  mongoose.models.TenantPluginSample || mongoose.model('TenantPluginSample', sampleSchema);

beforeAll(async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 15000 });
    }
    mongoAvailable = true;
  } catch (err) {
    console.warn(`[tenantPlugin.test] MongoDB not reachable — skipped. ${err.message}`);
  }
}, 30000);

afterEach(async () => {
  if (!mongoAvailable) return;
  await Sample.collection.deleteMany({});
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

function pluginIt(name, fn) {
  it(name, async () => {
    if (!mongoAvailable) {
      throw new Error('MongoDB required for tenantPlugin tests — set MONGODB_URI in server/.env');
    }
    await fn();
  });
}

const tidA = new mongoose.Types.ObjectId();
const tidB = new mongoose.Types.ObjectId();

describe('tenantPlugin (Step 1)', () => {
  pluginIt('throws on find without tenant context', async () => {
    await expect(Sample.find({})).rejects.toThrow(/tenantId missing/);
  });

  pluginIt('throws on save without tenantId / context', async () => {
    const doc = new Sample({ title: 'orphan' });
    await expect(doc.save()).rejects.toThrow(/tenantId/i);
  });

  pluginIt('scopes find to current tenant via AsyncLocalStorage', async () => {
    await runWithTenantContext({ tenantId: tidA }, async () => {
      await Sample.create({ title: 'a1', tenantId: tidA });
      await Sample.create({ title: 'a2', tenantId: tidA });
    });
    await runWithTenantContext({ tenantId: tidB }, async () => {
      await Sample.create({ title: 'b1', tenantId: tidB });
    });

    const fromA = await runWithTenantContext({ tenantId: tidA }, async () =>
      Sample.find({}).lean(),
    );
    const fromB = await runWithTenantContext({ tenantId: tidB }, async () =>
      Sample.find({}).lean(),
    );

    expect(fromA).toHaveLength(2);
    expect(fromA.every((d) => String(d.tenantId) === String(tidA))).toBe(true);
    expect(fromB).toHaveLength(1);
    expect(String(fromB[0].tenantId)).toBe(String(tidB));
  });

  pluginIt('injects $match as first aggregate stage', async () => {
    await runWithTenantContext({ tenantId: tidA }, async () => {
      await Sample.create({ title: 'agg-a', tenantId: tidA });
    });
    await runWithTenantContext({ tenantId: tidB }, async () => {
      await Sample.create({ title: 'agg-b', tenantId: tidB });
    });

    const rows = await runWithTenantContext({ tenantId: tidA }, async () =>
      Sample.aggregate([{ $project: { title: 1, tenantId: 1 } }]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('agg-a');
  });

  pluginIt('allows skipTenant only when explicit', async () => {
    await runWithTenantContext({ tenantId: tidA }, async () => {
      await Sample.create({ title: 'skip-me', tenantId: tidA });
    });
    const all = await Sample.find({}).setOptions({ skipTenant: true }).lean();
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  pluginIt('scopes bulkWrite filters to tenant', async () => {
    await runWithTenantContext({ tenantId: tidA }, async () => {
      await Sample.create({ title: 'bulk-a', tenantId: tidA });
    });
    await runWithTenantContext({ tenantId: tidB }, async () => {
      await Sample.create({ title: 'bulk-b', tenantId: tidB });
    });

    await runWithTenantContext({ tenantId: tidA }, async () =>
      Sample.bulkWrite([
        { updateMany: { filter: {}, update: { $set: { title: 'bulk-a-updated' } } } },
      ]),
    );

    const aDocs = await runWithTenantContext({ tenantId: tidA }, async () =>
      Sample.find({}).lean(),
    );
    const bDocs = await runWithTenantContext({ tenantId: tidB }, async () =>
      Sample.find({}).lean(),
    );
    expect(aDocs[0].title).toBe('bulk-a-updated');
    expect(bDocs[0].title).toBe('bulk-b');
  });
});
