# API documentation

Base URL: `/api/v1`  
Response shape: `{ success, data, message, meta? }`

## Phase 0

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | Public | Liveness + DB status |
| GET | `/` | Public | API root metadata |

## Phase 1 — Auth (SRS-01..29)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public + `x-tenant` | Tenant-scoped student signup (`signupMode`: domain / invite / both / closed). Body `role`/`tenantId` ignored. Domain match is exact. Invite codes redeemed atomically. |
| POST | `/auth/verify-email` | Public + `x-tenant` | Confirm email with hashed token (24h). Required after domain signup before upload. |
| POST | `/auth/resend-verification` | Bearer + `x-tenant` | Resend verification email |
| POST | `/auth/login` | Public + `x-tenant` | Login with username **or** email; sets httpOnly refresh cookie |
| POST | `/auth/logout` | Public | Clears refresh cookie / revokes session |
| POST | `/auth/refresh` | Cookie + `x-tenant` | Rotate refresh → new access token |
| GET | `/auth/me` | Bearer + `x-tenant` | Current user profile (`emailVerified`, `tenantId`) |
| PATCH | `/auth/me` | Bearer + `x-tenant` | Update profile; students **cannot** change tenant |
| POST | `/auth/change-password` | Bearer + `x-tenant` | Change password (verifies old; strength rules) |
| POST | `/auth/set-password` | Public + `x-tenant` | Complete one-time password setup (platform-created tenantAdmin) |
| POST | `/auth/forgot-password` | Public + `x-tenant` | Email OTP (10 min, attempt-limited) |
| POST | `/auth/reset-password` | Public + `x-tenant` | Reset password with OTP |

Access token: returned in JSON (`data.accessToken`), send as `Authorization: Bearer <token>`.  
Refresh token: `pl_refresh` httpOnly cookie.  
JWT claims: `sub`, `role`, `tid` (tenant id; null for superadmin), `adminLevel`.

### SaaS signup (Step 4)

| Mode | Rule |
|---|---|
| `domain` | Email domain must **exactly** match `domainWhitelist` (case-insensitive). Subdomains only if listed. Sends verification email. |
| `invite` | Requires Invite model code (hashed). Atomic `usedCount` / `maxUses`. |
| `both` | Invite **or** domain. |
| `closed` | All signups → 403 `SIGNUP_CLOSED`. |

Default when `signupMode` unset: whitelist non-empty → `domain`, else `invite`.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/invites` | tenantAdmin | Create invite (plain code returned once) |
| GET | `/invites` | tenantAdmin | List invites (scoped by adminLevel) |
| POST | `/invites/:id/revoke` | tenantAdmin | Revoke invite |
| POST | `/platform/tenants/:id/invites` | superadmin | Create invite for tenant |
| GET | `/platform/tenants/:id/invites` | superadmin | List tenant invites |
| PATCH | `/platform/tenants/:id/signup-mode` | superadmin | Set signupMode |

### Step 6 — Platform + Tenant Admin

**Platform** (`/api/v1/platform`, superadmin; `skipTenant` only here):

| Method | Path | Description |
|---|---|---|
| GET/POST | `/tenants` | List / create (slug format + reserved-word check; optional `firstAdmin` → one-time `setupUrl`, never a password) |
| GET/PATCH | `/tenants/:id` | Detail / update (slug **immutable**) |
| PATCH | `/tenants/:id/status` | `active` \| `suspended` — suspend invalidates cache + revokes refresh tokens |
| DELETE | `/tenants/:id` | Soft delete (`deletedAt`) |
| GET | `/tenants/:id/stats` | userCount, materialCount, storageUsedBytes, storageQuotaMB, signupsLast30Days |
| GET | `/tenants/:id/audit` | Audit log for that tenant |

**Tenant Admin** (`/api/v1/tenant-admin`, `x-tenant` + tenantAdmin):

| Method | Path | Description |
|---|---|---|
| GET/PATCH | `/tenant` | Branding + settings (not slug/status/domainWhitelist) |
| GET | `/users` | List/search (orgScope) |
| PATCH | `/users/:id/active` | Deactivate / reactivate |
| PATCH | `/users/:id/role` | `student` ↔ `tenantAdmin` (no superadmin; cannot demote last admin) |
| GET | `/moderation/pending` | Scoped pending queue |
| PATCH | `/moderation/:id` | Approve / reject |
| GET | `/audit` | Own-tenant audit entries only |

`AuditLog`: actor, role, tenantId, action, target, ip, createdAt — no secrets/tokens.

Unverified students may log in but cannot `POST /materials` (403 `EMAIL_UNVERIFIED`). Same email may exist in two tenants (per-tenant unique index).

### Multi-tenancy (Campus → Department inside Tenant)

| Actor | Behaviour |
|---|---|
| Student | Registers into resolved tenant; library/uploads scoped by `tenantId` + campus/department |
| Guest | Must send `x-tenant`; browse approved materials in that tenant |
| tenantAdmin | Org scope via `adminLevel` (university/campus/department) |
| superadmin | `/api/v1/platform/*` only (unless future impersonation) |

## Phase 2 — Taxonomy & materials (SRS-30..53)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/taxonomy/universities` | Public | List universities |
| GET | `/taxonomy/universities/:id/campuses` | Public | Campuses for a university |
| GET | `/taxonomy/campuses/:id/departments` | Public | Departments for a campus |
| GET | `/taxonomy/departments/:id/courses` | Public | Courses for a department |
| GET | `/taxonomy/universities/:id/courses` | Public | Legacy: all courses under university |
| GET | `/taxonomy/courses/:id/subjects` | Public | Subjects for a course |
| POST | `/taxonomy/universities` | Admin | Create university |
| GET | `/materials` | Public | List/search **approved** materials (campus-scoped) |
| GET | `/materials/mine` | Bearer | Current user's uploads (all statuses) |
| GET | `/materials/pending` | Admin | Pending queue **scoped to adminLevel** |
| GET | `/materials/:id` | Optional | Detail (pending only for owner/in-scope admin) |
| POST | `/materials` | Bearer | Multipart upload → `pending`. Enforces tenant `maxUploadMB` (413), `allowedFileTypes` + magic-byte check, optional `storageQuotaMB`. Path: `tenants/{tenantId}/materials/{materialId}` (ids only; body `tenantId`/`folder`/`publicId` ignored). |
| PATCH | `/materials/:id` | Bearer | Edit metadata (owner/admin). Cannot move across tenants. |
| PATCH | `/materials/:id/moderation` | Admin | Approve / reject **if in scope** |
| DELETE | `/materials/:id` | Bearer | Delete (owner) + Cloudinary/local delete with retry |
| GET | `/materials/:id/file` | Bearer | Tenant-checked download/preview. Cloudinary → short-lived signed URL JSON; local → stream with `Content-Disposition` + `X-Content-Type-Options: nosniff`. Pending: uploader/moderators only. Cross-tenant → 404. |
| GET | `/materials/:id/file-url` | Bearer | Same ACL; returns signed URL (or local API path) without download count |

### Step 8 — Storage & upload enforcement (NFR)

- **Layout:** `tenants/{tenantId}/materials/{materialId}/asset` (immutable tenant **id**, not slug).
- **Material.file:** `publicId`, `deliveryRef`, `provider`, `resourceType`, `mimeType`, `size`/`bytes`, `originalName` — never accept these from the client body.
- **Limits:** multer hard-cap = `PLATFORM_MAX_UPLOAD_MB` (500); per-tenant `settings.maxUploadMB` enforced in service → **413** `FILE_TOO_LARGE`.
- **Types:** magic bytes via `file-type`; extension must match; tenant `allowedFileTypes` subset of platform allowlist. Rejects double extensions and empty files.
- **Quota:** optional `settings.storageQuotaMB`; exceeded → **413** `STORAGE_QUOTA_EXCEEDED`. Usage in `GET /platform/tenants/:id/stats` (`storageUsedBytes`, `storageQuotaMB`).
- **Delivery:** Cloudinary `type=authenticated`; downloads only via API after plugin-scoped lookup. Soft-deleted/suspended tenants cannot issue signed URLs.
- **Migration:** `npm run migrate:cloudinary` (dry-run) / `migrate:cloudinary:apply`.

Storage: Cloudinary when `CLOUDINARY_*` is set; otherwise private local `server/storage/` (not publicly served). Avatars remain under `server/uploads/`.

## Phase 3 — Search & filter (SRS-54..72)

`GET /materials` query params:

| Param | Description |
|---|---|
| `q` | Keyword search (partial match on title, description, tags) |
| `university` | Filter by university id |
| `campus` | Filter by campus id (**required for guests**) |
| `department` | Filter by department id |
| `course` | Filter by course id |
| `subject` | Filter by subject id |
| `type` | `notes \| past_paper \| mcq \| short_questions \| long_questions \| other` |
| `sort` / `view` | `latest` (default), `popular` / `trending`, `top_rated` / `top-rated` |
| `page`, `limit` | Pagination (default limit 12, max 50) |

Popularity score = `views*1 + downloads*3 + likes*2 + upvotes*4` (weights in `config/constants.js`). Recalculated on view/download.
