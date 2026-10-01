# Software Requirements Specification (Multi-Tenant Peer Learning)

**Product:** Peer-to-Peer Learning Platform (SaaS multi-tenant)  
**Scope of this update:** Tenant management module and isolation requirements (Steps 1–9)

## 1. Overview

The platform hosts multiple universities (tenants) in a **shared database / shared collections** model. Every tenant-owned document carries `tenantId`. Isolation is enforced by middleware (ALS), a Mongoose tenant plugin, JWT `tid` binding, and storage path prefixes.

## 2. Actors

| Actor | Description |
|-------|-------------|
| **Super Admin** | Platform operator; manages tenants; no tenant membership (`tenantId` null) |
| **Tenant Admin** | University operator; scoped by `adminLevel` (university / campus / department) |
| **Student** | End user within one tenant; uploads and browses materials |

## 3. Functional requirements — Tenant management

| ID | Requirement |
|----|-------------|
| **TM-01** | Super Admin can create a tenant with unique slug, branding, domain whitelist, and signup mode |
| **TM-02** | Super Admin can suspend, reactivate, soft-delete tenants; suspended tenants cannot resolve routes |
| **TM-03** | Super Admin can change signup mode (`domain` \| `invite` \| `both` \| `closed`) |
| **TM-04** | Super Admin can view per-tenant stats and audit logs scoped to that tenant ObjectId |
| **TM-05** | Public tenant picker and branding endpoints expose only non-sensitive fields |
| **TM-06** | Tenant Admin can update own branding/settings within platform caps (upload size, MIME allow-list, moderation, quota) |
| **TM-07** | Tenant Admin can list/deactivate users and change roles within org scope |
| **TM-08** | Tenant Admin can moderate pending materials within campus/department scope |
| **TM-09** | Tenant Admin can create/list/revoke invites within scope |
| **TM-10** | Domain signup requires email verification before upload |
| **TM-11** | Invite redemption is atomic (max uses, expiry, revoke) |
| **TM-12** | Materials storage is under `tenants/{tenantId}/materials/{materialId}` with size/MIME/quota checks |
| **TM-13** | Audit log records tenant-scoped admin/platform actions |
| **TM-14** | Same email/username/course slug may exist in different tenants without conflict |

## 4. Functional requirements — Isolation

| ID | Requirement |
|----|-------------|
| **ISO-01** | Every tenant route requires resolved tenant (`x-tenant` or subdomain); body `tenantId` is ignored |
| **ISO-02** | Access JWT `tid` must match resolved tenant; mismatch → 403 |
| **ISO-03** | Cross-tenant read/update/delete by foreign id → 404 or 403, never 200 with foreign data |
| **ISO-04** | List/search/sort/filter/aggregations return only the current tenant’s documents |
| **ISO-05** | Queries on tenant-owned models outside ALS tenant context throw |
| **ISO-06** | Deactivation and role demotion revoke refresh tokens; role mismatch → `TOKEN_STALE` |
| **ISO-07** | Tenant suspension blocks resolution and revokes that tenant’s refresh tokens |

## 5. Non-functional requirements

| ID | Requirement |
|----|-------------|
| **NFR-I1** | Data isolation: shared-DB tenancy with plugin + ALS; no cross-tenant leakage under concurrent load |
| **NFR-I2** | Per-tenant storage quota enforced at upload |
| **NFR-S1** | Helmet, CORS restricted to `CLIENT_URL` with credentials, mongo-sanitize, JSON body ≤ 1mb |
| **NFR-S2** | Rate limits on login, register, OTP/verify, set-password, invite create, public tenant endpoints |
| **NFR-S3** | Refresh cookie: httpOnly; production `Secure` + `SameSite=None` (or first-party via Vercel `/api` rewrite) |
| **NFR-S4** | Seeds/migrations refuse production without explicit env flags |

## 6. Use cases

### UC-1 Super Admin onboards a tenant
1. Super Admin authenticates on `/platform`.
2. Creates tenant (slug, domains, signup mode, optional first admin).
3. System writes audit `tenant.create`, caches nothing stale after invalidate.
4. First admin sets password via setup link; students register per signup policy.

### UC-2 Student registers via invite
1. Student opens tenant branding (`signupMode=invite|both`).
2. Registers with invite code; system redeems invite atomically.
3. Student verifies email if required; then uploads materials.

### UC-3 Tenant Admin moderates
1. Tenant Admin lists pending materials (org-scoped).
2. Approves or rejects; audit recorded; student sees status on My Uploads.

## 7. Out of scope (known limitations)

Per-tenant DB backups, noisy-neighbor CPU isolation, real-time sockets multi-tenant hardening beyond current API, and Comment/audit-by-id routes (not yet implemented).
