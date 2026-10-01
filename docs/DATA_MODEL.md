# Data model

**SaaS tenancy:** shared MongoDB collections keyed by `tenantId` (ObjectId → `Tenant`). Superadmin users have `tenantId: null`.

## ER sketch

```
Tenant 1──* User
Tenant 1──* Campus / Department / Course / Subject / Material / Invite / AuditLog / RefreshToken
University (legacy) ← Tenant.legacyUniversityId
User → Campus, Department (org placement)
Material → User (uploader), Campus, Department, Course, Subject
Invite → User (createdBy), optional Campus/Department
AuditLog → User (actor), Tenant
```

## Collections

| Collection | Key fields | Relationships / indexes |
|---|---|---|
| **Tenant** | name, slug*, status, domainWhitelist, signupMode, logoUrl, theme, settings (maxUploadMB, allowedFileTypes, storageQuotaMB, moderationEnabled), legacyUniversityId, deletedAt | isolation root |
| **User** | role (`student\|tenantAdmin\|superadmin`), adminLevel, tenantId?, email*, username*, emailVerified, org refs, isActive | unique (tenantId, email), (tenantId, username); superadmin unique email/username when tenantId null |
| **University** | name, slug* | legacy org root; linked from Tenant |
| **Campus** | name, slug, city, university, tenantId | unique (tenantId, university, slug) |
| **Department** | name, slug, campus, university, tenantId | unique (tenantId, campus, slug) |
| **Course** | name, slug, department, campus, university, tenantId | unique (tenantId, department, slug) — same course code allowed across tenants |
| **Subject** | name, slug, course, tenantId | unique (tenantId, course, slug) |
| **Material** | title, type, file (publicId, deliveryRef, mimeType, size, **bytes**, originalName, provider, resourceType), status, stats, popularityScore, **tenantId** | storage `tenants/{tenantId}/materials/{materialId}` |
| **Invite** | codeHash, maxUses, usedCount, expiresAt, revokedAt, campus?, department?, createdBy, tenantId | unique (tenantId, codeHash) |
| **AuditLog** | actor, role, tenantId, action, target, meta, ip | queried with explicit ObjectId tenant filter |
| **RefreshToken** | tokenHash*, user, tenantId?, expiresAt | revoked on deactivate/demote/password change/tenant suspend |

\*unique where noted.

## Isolation rules

- Tenant-owned models use `tenantPlugin` (required `tenantId` except User optional for superadmin).
- Never trust `tenantId` from client body/query.
- Platform audit endpoints filter `{ tenantId: ObjectId(id) }` — never null-tenant bleed.

Re-seed demo data: `npm run seed:demo --prefix server` (add `--reset` via `seed:demo:reset`).
