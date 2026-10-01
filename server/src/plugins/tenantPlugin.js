import mongoose from 'mongoose';
import { getTenantId } from '../utils/tenantContext.js';

function toObjectId(tid) {
  if (!tid) return null;
  if (tid instanceof mongoose.Types.ObjectId) return tid;
  return new mongoose.Types.ObjectId(String(tid));
}

function resolveTenantId(queryOrOptions) {
  const options =
    typeof queryOrOptions?.getOptions === 'function'
      ? queryOrOptions.getOptions()
      : queryOrOptions || {};
  if (options.skipTenant) return null;
  if (options.tenantId) return toObjectId(options.tenantId);
  return toObjectId(getTenantId());
}

function stripTenantIdFromUpdate(update) {
  if (!update || typeof update !== 'object') return;
  if (Object.prototype.hasOwnProperty.call(update, 'tenantId')) {
    delete update.tenantId;
  }
  for (const op of ['$set', '$unset', '$setOnInsert', '$rename']) {
    if (update[op] && typeof update[op] === 'object') {
      delete update[op].tenantId;
    }
  }
  // Upserts: force tenantId via $setOnInsert only (never overwrite)
  return update;
}

function injectTenantIntoBulkOps(ops, tid) {
  for (const op of ops) {
    if (op.insertOne?.document) {
      op.insertOne.document.tenantId = tid;
    }
    if (op.updateOne) {
      op.updateOne.filter = { ...(op.updateOne.filter || {}), tenantId: tid };
      if (op.updateOne.update) {
        stripTenantIdFromUpdate(op.updateOne.update);
        if (op.updateOne.upsert) {
          op.updateOne.update.$setOnInsert = {
            ...(op.updateOne.update.$setOnInsert || {}),
            tenantId: tid,
          };
        }
      }
    }
    if (op.updateMany) {
      op.updateMany.filter = { ...(op.updateMany.filter || {}), tenantId: tid };
      if (op.updateMany.update) stripTenantIdFromUpdate(op.updateMany.update);
    }
    if (op.deleteOne?.filter) {
      op.deleteOne.filter = { ...op.deleteOne.filter, tenantId: tid };
    }
    if (op.deleteMany?.filter) {
      op.deleteMany.filter = { ...op.deleteMany.filter, tenantId: tid };
    }
    if (op.replaceOne) {
      op.replaceOne.filter = { ...(op.replaceOne.filter || {}), tenantId: tid };
      if (op.replaceOne.replacement) {
        op.replaceOne.replacement.tenantId = tid;
      }
    }
  }
}

/** Inject tenant match into $lookup / $unionWith pipeline stages */
function scopeAggregatePipeline(pipeline, tid) {
  for (const stage of pipeline) {
    if (stage.$lookup) {
      const lookup = stage.$lookup;
      if (lookup.pipeline && Array.isArray(lookup.pipeline)) {
        lookup.pipeline = [{ $match: { tenantId: tid } }, ...lookup.pipeline];
        scopeAggregatePipeline(lookup.pipeline, tid);
      } else if (lookup.from) {
        // Simple lookup — convert to pipeline form with tenant match
        const as = lookup.as;
        const localField = lookup.localField;
        const foreignField = lookup.foreignField;
        if (localField && foreignField) {
          stage.$lookup = {
            from: lookup.from,
            let: { localVal: `$${localField}` },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: [`$${foreignField}`, '$$localVal'] },
                  tenantId: tid,
                },
              },
            ],
            as,
          };
        }
      }
    }
    if (stage.$unionWith) {
      const uw = stage.$unionWith;
      if (typeof uw === 'string') {
        stage.$unionWith = {
          coll: uw,
          pipeline: [{ $match: { tenantId: tid } }],
        };
      } else if (uw && typeof uw === 'object') {
        const inner = Array.isArray(uw.pipeline) ? uw.pipeline : [];
        uw.pipeline = [{ $match: { tenantId: tid } }, ...inner];
        scopeAggregatePipeline(uw.pipeline, tid);
      }
    }
    if (stage.$facet && typeof stage.$facet === 'object') {
      for (const key of Object.keys(stage.$facet)) {
        if (Array.isArray(stage.$facet[key])) {
          scopeAggregatePipeline(stage.$facet[key], tid);
        }
      }
    }
  }
}

/**
 * Shared-DB multi-tenancy plugin.
 * Opt out only with `{ skipTenant: true }` — explicit, never default.
 */
export function tenantPlugin(schema, options = {}) {
  const optional = Boolean(options.optional);

  schema.add({
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: !optional,
      index: true,
      default: null,
      immutable: true,
    },
  });

  const readOps = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'findOneAndDelete',
    'findOneAndReplace',
    'countDocuments',
    'estimatedDocumentCount',
    'deleteMany',
    'updateMany',
    'updateOne',
    'deleteOne',
    'replaceOne',
  ];

  readOps.forEach((op) => {
    schema.pre(op, function tenantScopePre() {
      if (this.getOptions?.()?.skipTenant) return;
      if (op === 'estimatedDocumentCount') {
        if (optional) return;
        throw new Error(
          `[tenantPlugin] estimatedDocumentCount is not tenant-safe; use countDocuments or skipTenant`,
        );
      }
      const tid = resolveTenantId(this);
      if (!tid) {
        if (optional) return;
        throw new Error(
          `[tenantPlugin] tenantId missing for ${op} on ${schema.options.collection || 'model'}`,
        );
      }
      this.where({ tenantId: tid });

      // Strip tenantId from updates; stamp upserts via $setOnInsert
      if (['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace'].includes(op)) {
        const update = this.getUpdate?.();
        if (update) {
          stripTenantIdFromUpdate(update);
          const opts = this.getOptions?.() || {};
          if (opts.upsert) {
            update.$setOnInsert = { ...(update.$setOnInsert || {}), tenantId: tid };
            this.setUpdate(update);
          }
        }
      }
    });
  });

  schema.pre('aggregate', function tenantAggregatePre() {
    const opts = this.options || {};
    if (opts.skipTenant) return;
    const tid = toObjectId(opts.tenantId || getTenantId());
    if (!tid) {
      if (optional) return;
      throw new Error(
        `[tenantPlugin] tenantId missing for aggregate on ${schema.options.collection || 'model'}`,
      );
    }
    const pipeline = this.pipeline();
    pipeline.unshift({ $match: { tenantId: tid } });
    scopeAggregatePipeline(pipeline, tid);
  });

  // eslint-disable-next-line no-param-reassign
  schema.statics.bulkWrite = function tenantBulkWrite(ops, options = {}) {
    const opts = { ...options };
    if (!opts.skipTenant) {
      const tid = toObjectId(opts.tenantId || getTenantId());
      if (!tid) {
        if (!optional) {
          return Promise.reject(
            new Error(
              `[tenantPlugin] tenantId missing for bulkWrite on ${schema.options.collection || 'model'}`,
            ),
          );
        }
      } else {
        injectTenantIntoBulkOps(ops, tid);
        opts.tenantId = tid;
      }
    }
    return mongoose.Model.bulkWrite.call(this, ops, { ...opts, skipTenant: true });
  };

  schema.pre('validate', function tenantValidatePre(next) {
    if (this.$__.skipTenant) return next();
    if (!this.tenantId) {
      const tid = getTenantId();
      if (tid) this.tenantId = tid;
    }
    return next();
  });

  schema.pre('save', function tenantSavePre(next) {
    if (this.$__.skipTenant) return next();
    if (!this.tenantId) {
      const tid = getTenantId();
      if (tid) this.tenantId = tid;
    }
    if (!this.tenantId && !optional) {
      return next(new Error('[tenantPlugin] tenantId missing on save'));
    }
    if (!this.isNew && this.isModified('tenantId')) {
      return next(new Error('[tenantPlugin] tenantId is immutable'));
    }
    return next();
  });

  schema.pre('insertMany', function tenantInsertManyPre(next, docs) {
    const tid = toObjectId(getTenantId());
    const list = Array.isArray(docs) ? docs : [docs];
    for (const doc of list) {
      if (!doc.tenantId) {
        if (tid) doc.tenantId = tid;
        else if (!optional) {
          return next(new Error('[tenantPlugin] tenantId missing on insertMany'));
        }
      } else if (tid && String(doc.tenantId) !== String(tid)) {
        return next(new Error('[tenantPlugin] insertMany tenantId mismatch'));
      }
    }
    next();
  });
}

/** Places that use skipTenant — keep this list updated. */
export const SKIP_TENANT_CALL_SITES = [
  'auth.middleware loadUserById',
  'auth.service refresh/logout RefreshToken + User',
  'auth.service platform/superadmin User lookups',
  'auth.service changePassword / profile (self by id)',
  'seeds/seedTenants upsertSuperadmin',
  'seeds/index legacy scoped-admin lookups',
  'scripts/migrateToMultiTenant.js',
  'platform invites runWithTenantContext',
  'tenantPlugin bulkWrite internal re-entry',
  'platform/* handlers (explicit)',
  'tests cleanup / tenantPlugin / step2 / step3 / step4',
];
