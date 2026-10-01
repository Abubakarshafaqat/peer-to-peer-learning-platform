# Multi-tenancy

## Chosen model

**Shared database, shared collections**, with a mandatory `tenantId` on every tenant-owned document.

Request flow:

1. Resolve tenant slug (`x-tenant` header preferred, else subdomain).
2. Enter **AsyncLocalStorage** store `{ tenantId, tenant }` around `next()`.
3. **tenantPlugin** injects `tenantId` into find/update/aggregate/bulkWrite/save.
4. JWT access token carries `tid`; middleware requires `tid === req.tenant._id`.
5. Cloudinary/local storage paths: `tenants/{tenantId}/materials/{materialId}`.

## Alternatives rejected

| Option | Why not |
|--------|---------|
| **DB-per-tenant** | Ops cost (N connection pools, migrations × N), Atlas cost for FYP, harder platform analytics |
| **Deploy-per-tenant** | One Render service per university is not SaaS; onboarding would require infra, not an API call |

Shared-DB matches the FYP constraint (one API, one MongoDB) while still proving isolation in tests.

## How isolation is enforced

| Layer | Mechanism |
|-------|-----------|
| Middleware | `resolveTenant` → ALS; rejects suspended/deleted |
| Plugin | Auto-scope queries; throw if no tenant context (non-optional models) |
| Auth | JWT `tid` + DB user `tenantId` must match; superadmin blocked on tenant routes |
| Org scope | Campus/department admins cannot act outside their campus/dept |
| Storage | Path prefix + signed URLs; static `/uploads` blocks `tenants` paths |
| Cache | In-memory slug cache (60s) invalidated on settings/status/signup/delete |
| Sockets | Not yet multi-tenant shipped; future work must bind room keys to `tenantId` |

`skipTenant: true` is allow-listed (see `docs/SKIP_TENANT.md` / `SKIP_TENANT_CALL_SITES`).

## Trade-offs

- **Pros:** Simple ops, cheap, one migration story, easy cross-tenant platform stats.
- **Cons:** Noisy neighbor (one tenant’s heavy query hits the same cluster); quota race under concurrent uploads; no per-tenant backup restore; public tenant list reveals active university names.

## Known limitations

1. Shared-DB noisy neighbor — no per-tenant resource quotas at the Mongo tier.
2. Storage quota check is check-then-act (rare race under parallel uploads).
3. No per-tenant backups / PITR isolation.
4. Public `GET /tenants/public` enumerates active tenants (intentional for picker UX).
5. Access JWT after password change remains valid until `ACCESS_TOKEN_TTL`; refresh is revoked immediately. Role changes reject via `TOKEN_STALE`.
6. Comment / audit-entry-by-id HTTP routes are not implemented yet (audit is list-only).

## Future work

- Socket.io rooms keyed by `tenantId`
- Stronger password-version claim in access JWT (optional)
- Per-tenant rate-limit budgets
- Optional dedicated DB for largest tenants
- Hide public tenant list behind feature flag for private campuses
