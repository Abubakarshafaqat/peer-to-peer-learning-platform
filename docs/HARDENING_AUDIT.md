# Hardening audit (Step 9)

Report-only except clear bugs that were fixed in this step.

## Fixed in this step

| Finding | Fix |
|---------|-----|
| `POST /auth/verify-email` had no rate limit | `otpRateLimiter` |
| `POST /auth/set-password` had no rate limit | `authRateLimiter` |
| `GET /tenants/:slug/branding` had no rate limit | `publicTenantsRateLimiter` |
| Dev mail fallback could log OTP/tokens if SMTP missing in production | Refuse send/log bodies when `NODE_ENV=production` and no transporter |
| Migrations had no production kill-switch | Require `ALLOW_PRODUCTION_MIGRATE=1` for `migrateToMultiTenant` and `migrateCloudinaryLayout` |

## Findings left open (not bugs / deferred)

| Finding | Severity | Notes |
|---------|----------|-------|
| Access JWT still valid after password change until `ACCESS_TOKEN_TTL` | Low | By design: short-lived access + refresh revocation. Role change uses `TOKEN_STALE`. Documented in MULTITENANCY.md |
| Public tenant list enumerates universities | Info | Intentional picker UX |
| Storage quota check-then-act race | Low | Rare under parallel uploads |
| Hard-coded demo slugs/passwords | Info | Only in seeds, tests, DEMO.md — not in runtime app paths |
| Mail OTP in console in development | Info | Required for local FYP without SMTP |
| No per-tenant Mongo backups | Info | Shared-DB limitation |
| Comment / audit-by-id routes absent | Info | Cross-tenant id tests cover implemented resources |
| `npm audit` | See below | Re-run before release |

## Checklist review

| Control | Status |
|---------|--------|
| Hard-coded tenant slugs / seed passwords outside seeds/tests | **OK** — app code uses env + request slug |
| Tokens/passwords/setup URLs/signed URLs in prod logs | **OK** after mail fix; morgan does not log bodies |
| Rate limits: login, register, verify, resend, set-password, invite redeem/create, public tenants | **OK** (invite redeem is via register → signup limiter) |
| CORS: no wildcard + credentials; origin = `CLIENT_URL` | **OK** (`app.js`) |
| Cookie flags / Vercel rewrite | **OK** — `Secure`+`SameSite=None` in prod; `client/vercel.json` rewrite documented |
| Helmet, 1mb JSON, mongo-sanitize / Zod validation | **OK** |
| Seed/migrate production guards | **OK** — `ADMIN_SEED_PASSWORD` / `ALLOW_PRODUCTION_MIGRATE=1` |

## Cookies (Vercel + Render)

- Refresh cookie name: `pl_refresh`, httpOnly, `path=/api/v1`
- Production: `secure: true`, `sameSite: 'none'` for cross-site SPA↔API
- Preferred: Vercel rewrite `/api/*` → Render so cookies are first-party (`SameSite=Lax` still possible if you later tighten)

## npm audit

Recorded at Step 9 completion:

| Package tree | info | low | moderate | high | critical |
|--------------|------|-----|----------|------|----------|
| server | 0 | 0 | 1 | 0 | 0 |
| client | 0 | 0 | 2 | 0 | 0 |

Re-run before release:

```bash
npm audit --prefix server
npm audit --prefix client
```

Do not blindly `npm audit fix` without regression tests.
