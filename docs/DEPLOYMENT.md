# Deployment

## Local

See the root [README.md](../README.md). Typical:

```bash
npm run seed:tenants --prefix server
npm run dev --prefix server
npm run dev --prefix client
```

## Cookies (refresh token)

`pl_refresh` is httpOnly, `path=/api/v1`:

| Env | `secure` | `sameSite` |
|-----|----------|------------|
| development | false | `lax` |
| production | true | `none` (cross-site SPA ↔ API) |

For production, set `CLIENT_URL` to the Vercel origin and ensure CORS `credentials: true` (already configured). Prefer same-site API access via a Vercel rewrite so cookies are first-party when possible.

## Vercel (client) + API rewrite

`client/vercel.json` rewrites `/api/*` to the Render (or other) API host. Replace `YOUR_API_HOST`, then set:

```env
# client
VITE_API_URL=/api/v1

# server
CLIENT_URL=https://your-app.vercel.app
NODE_ENV=production
```

With the rewrite, the browser talks to same-origin `/api/v1`, so refresh cookies work without relying solely on cross-site `SameSite=None`.

## Seed safety

`npm run seed` / `seed:tenants` / `seed:demo` **refuse to run in production** unless `ADMIN_SEED_PASSWORD` is explicitly set.

Migrations (`migrate:tenants`, `migrate:cloudinary`) refuse production unless `ALLOW_PRODUCTION_MIGRATE=1`.

## Isolation smoke

With API running and demo seeded (`npm run seed:demo`):

```bash
API_URL=http://localhost:5000/api/v1 npm run smoke:isolation --prefix server
```

## Stack (Phase 9 placeholders)

Vercel (client) · Render (API) · Atlas · Cloudinary · SMTP · OpenAI — wire secrets in the host dashboards; never commit `.env`.

See also: [MULTITENANCY.md](./MULTITENANCY.md), [DEMO.md](./DEMO.md), [HARDENING_AUDIT.md](./HARDENING_AUDIT.md), [SRS.md](./SRS.md).
