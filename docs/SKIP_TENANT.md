# skipTenant call sites (explicit only)

| Location | Why |
|---|---|
| `middleware/auth.js` `loadUserById` | Load user by JWT `sub` before tenant match check |
| `auth.service.js` refresh/logout RefreshToken ops | Token hash is globally unique |
| `auth.service.js` platform login/refresh User + RefreshToken | Superadmin has `tenantId: null` |
| `auth.service.js` getMe / updateProfile / updateAvatar / changePassword | Self-service by user id after auth |
| `auth.service.js` `revokeRefreshTokensForTenant` | Cross-tenant revoke on suspend |
| `platform.routes.js` stats counts | Platform aggregates across tenants |
| `plugins/tenantPlugin.js` bulkWrite re-entry | Avoid double-inject recursion |
| `seeds/seedTenants.js` upsertSuperadmin | Create/update platform user |
| `seeds/index.js` legacy scoped-admin lookups | Pre-tenant seed helpers (prefer `seed:tenants`) |
| `scripts/migrateToMultiTenant.js` | University→Tenant backfill + role remap |
| `scripts/migrateCloudinaryLayout.js` | Report/rename Cloudinary assets into `tenants/{tenantId}/materials/{materialId}` |
| `platform.routes.js` invite list/create (via ALS) | Superadmin invite ops for a tenant |
| `platformTenant.service.js` User/Material aggregates | Platform stats with skipTenant (incl. storage quota usage) |
| Tests (`tenantPlugin`, `step2`–`step8`) | Cleanup / assertions / fixtures |

Never use `skipTenant` on normal tenant material/taxonomy handlers.
