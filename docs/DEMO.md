# Demo guide

## Prerequisites

```bash
# Server
cp server/.env.example server/.env   # if you have an example; else ensure MONGODB_URI is set
npm install --prefix server
npm run seed:demo --prefix server          # or: npm run seed:demo:reset --prefix server
npm run dev --prefix server

# Client
npm install --prefix client
npm run dev --prefix client
```

Default API: `http://localhost:5000/api/v1`  
Default client: `http://localhost:5173`

## Seeded accounts

Password for all (unless `ADMIN_SEED_PASSWORD` overridden): **`ChangeMeAdmin1!`**

| Role | Email | Header / context |
|------|-------|------------------|
| Super Admin | `super@platform.local` | Platform login (no `x-tenant`) |
| Alpha university admin | `admin@alpha.edu` | `x-tenant: alpha` |
| Alpha campus admin | `campus@alpha.edu` | `x-tenant: alpha` |
| Alpha student | `student@alpha.edu` | `x-tenant: alpha` |
| Beta university admin | `admin@beta.edu` | `x-tenant: beta` |
| Beta student | `student@beta.edu` | `x-tenant: beta` |
| Gamma university admin | `admin@gamma.edu` | `x-tenant: gamma` |
| Gamma student | `student@gamma.edu` | `x-tenant: gamma` |
| Shared identity (per tenant) | `shared.user@uni.edu` / `shared_user` | Works in alpha, beta, and gamma separately |

Materials per tenant: approved (`Shared Notes Title`, `{slug}-latest`), pending (`{slug}-pending`), rejected (`{slug}-rejected`).

## URLs

| Scene | Client path | Notes |
|-------|-------------|-------|
| Choose university | `/choose` | Public picker |
| Tenant login | `/t/:slug/login` or login with tenant selected | |
| Register | `/t/:slug/register` | Respects signupMode |
| Library | `/library` | Tenant materials only |
| Upload | `/uploads/new` | Needs verified email |
| Tenant admin | `/admin/*` | Settings, users, moderation, invites, audit |
| Platform | `/platform` | Super Admin |

## Scripted demo scenes

1. **Picker → Alpha login → Library**  
   Show only Alpha materials; search `Shared Notes Title`.

2. **Cross-tenant attempt**  
   Copy a Beta material id; call Alpha `GET /materials/:id` with Alpha token → 404/403.

3. **Shared email**  
   Login `shared.user@uni.edu` under Alpha, then under Beta — two separate accounts.

4. **Invite (Gamma)**  
   Admin creates invite; student registers with code while signupMode=`invite`.

5. **Moderation**  
   Alpha student has pending item; admin approves; library updates.

6. **Suspend**  
   Super Admin suspends Beta → branding/login returns unavailable; reactivate.

7. **Smoke script** (API must be running + demo seeded):

```bash
API_URL=http://localhost:5000/api/v1 npm run smoke:isolation --prefix server
```
