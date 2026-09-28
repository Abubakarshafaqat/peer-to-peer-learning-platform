# Requirements traceability

| SRS / ID | Requirement (short) | Route / API | UI |
|---|---|---|---|
| — | Health / uptime | `GET /api/v1/health` | Home → API status |
| SRS-01..05 | Register | `POST /api/v1/auth/register` | `/register` |
| SRS-06..10 | Login (username or email) | `POST /api/v1/auth/login` | `/login` |
| SRS-11 | Logout | `POST /api/v1/auth/logout` | Navbar Sign out |
| — | Refresh session | `POST /api/v1/auth/refresh` | AuthProvider bootstrap |
| SRS-12..15 | View / edit profile | `GET/PATCH /api/v1/auth/me` | `/profile` |
| SRS-16..20 | Change password | `POST /api/v1/auth/change-password` | `/profile` |
| SRS-21..25 | Reset via email OTP | `POST /auth/forgot-password`, `/auth/reset-password` | `/forgot-password` |
| SRS-26..29 | Role dashboards | Role guard middleware | `/dashboard`, `/admin` |
| SRS-30–53 | Study materials | _Phase 2_ | _Phase 2_ |
| SRS-54–72 | Search & filter | _Phase 3_ | _Phase 3_ |
| SRS-73–80 | Peer interaction | _Phase 4_ | _Phase 4_ |
| SRS-81–90 | Chat, notifications, AI Buddy, Away Mode | _Phases 6 & 8_ | _Phases 6 & 8_ |
| SRS-91–98 | Feedback & rating | _Phase 4_ | _Phase 4_ |
| SRS-99–104 | AI recommendations | _Phase 8_ | _Phase 8_ |
| SRS-105–113 | Admin | _Phase 5_ | `/admin` shell |
| SRS-114–123 | Dashboard | _Phase 9_ | `/dashboard` shell |
| SSD 42–43 | Quiz start/submit | _Phase 7_ | _Phase 7_ |
