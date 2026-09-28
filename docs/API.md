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
| POST | `/auth/register` | Public | Register student (role forced to `student`) |
| POST | `/auth/login` | Public | Login with username **or** email; sets httpOnly refresh cookie |
| POST | `/auth/logout` | Public | Clears refresh cookie / revokes session |
| POST | `/auth/refresh` | Cookie | Rotate refresh → new access token |
| GET | `/auth/me` | Bearer | Current user profile |
| PATCH | `/auth/me` | Bearer | Update profile (name, phone, avatar, university) |
| POST | `/auth/change-password` | Bearer | Change password (verifies old; strength rules) |
| POST | `/auth/forgot-password` | Public | Email OTP (10 min, attempt-limited) |
| POST | `/auth/reset-password` | Public | Reset password with OTP |

Access token: returned in JSON (`data.accessToken`), send as `Authorization: Bearer <token>`.  
Refresh token: `pl_refresh` httpOnly cookie (path `/api/v1/auth`).
