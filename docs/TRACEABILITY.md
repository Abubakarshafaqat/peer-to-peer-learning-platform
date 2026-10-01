# Requirements traceability

| SRS / ID | Requirement (short) | Route / API | UI |
|---|---|---|---|
| — | Health / uptime | `GET /api/v1/health` | Home → API status |
| SRS-01..05 | Register (tenant-scoped; domain/invite/closed) | `POST /api/v1/auth/register` + `x-tenant` | `/register` |
| — | Email verification (domain signup) | `POST /auth/verify-email`, `/resend-verification` | (link / later UI) |
| — | Invite create/list/revoke | `/api/v1/invites`, `/platform/tenants/:id/invites` | (admin UI later) |
| — | Platform tenant CRUD / stats / audit | `/api/v1/platform/tenants*` | (Super Admin UI later) |
| — | Tenant admin settings / users / moderation / audit | `/api/v1/tenant-admin/*` | (Tenant Admin UI later) |
| SRS-06..10 | Login (username or email) | `POST /api/v1/auth/login` + `x-tenant` | `/login` |
| SRS-11 | Logout | `POST /api/v1/auth/logout` | Navbar Sign out |
| — | Refresh session | `POST /api/v1/auth/refresh` | AuthProvider bootstrap |
| SRS-12..15 | View / edit profile (org read-only) | `GET/PATCH /api/v1/auth/me` | `/profile` |
| SRS-16..20 | Change password | `POST /api/v1/auth/change-password` | `/profile` |
| SRS-21..25 | Reset via email OTP | `POST /auth/forgot-password`, `/auth/reset-password` | `/forgot-password` |
| SRS-26..29 | Role dashboards | Role guard middleware | `/dashboard`, `/admin` |
| — | Org multi-tenancy + scoped admins | `resolveTenant`, `adminLevel` scopes | TenantProvider, pending queue |
| SRS-30..33 | Upload materials (dept-scoped) | `POST /api/v1/materials` (+ magic-byte / size / quota) | `/uploads/new` |
| SRS-34..40 | Edit metadata | `PATCH /api/v1/materials/:id` | Material detail / my uploads |
| SRS-41..45 | Delete own / admin any | `DELETE /api/v1/materials/:id` (+ storage delete retry) | My uploads / detail |
| SRS-46..53 | Authorized download + PDF preview | `GET .../file`, `.../file-url` (signed, tenant-checked) | `/materials/:id` |
| NFR-storage | Tenant folder layout + private delivery | `tenants/{tenantId}/materials/{materialId}`; authenticated Cloudinary / private `storage/` | — |
| NFR-upload | Enforce tenant settings on upload | `maxUploadMB`→413, `allowedFileTypes`+magic bytes, `storageQuotaMB` | Upload error messages |
| — | Taxonomy lists | `GET /api/v1/taxonomy/...` | Register / library / upload |
| SRS-54..72 | Search, filter, sort (campus-scoped) | `GET /api/v1/materials?campus&...` | `/library` |
| — | Pending moderation (scoped) | `GET/PATCH .../pending`, `.../moderation` | `/admin/pending` |
| — | Multi-tenancy design | — | [MULTITENANCY.md](./MULTITENANCY.md) |
| — | Demo / smoke | `npm run seed:demo`, `smoke:isolation` | [DEMO.md](./DEMO.md) |
| — | Hardening audit | — | [HARDENING_AUDIT.md](./HARDENING_AUDIT.md) |
| — | SRS tenant module | — | [SRS.md](./SRS.md) |
| SRS-73–80 | Peer interaction | _Phase 4_ | _Phase 4_ |
| SRS-81–90 | Chat, notifications, AI Buddy, Away Mode | _Phases 6 & 8_ | _Phases 6 & 8_ |
| SRS-91–98 | Feedback & rating | _Phase 4_ | _Phase 4_ |
| SRS-99–104 | AI recommendations | _Phase 8_ | _Phase 8_ |
| SRS-105–113 | Admin (full) | _Phase 5_ | `/admin` shell + pending |
| SRS-114–123 | Dashboard | _Phase 9_ | `/dashboard` shell |
| SSD 42–43 | Quiz start/submit | _Phase 7_ | _Phase 7_ |
