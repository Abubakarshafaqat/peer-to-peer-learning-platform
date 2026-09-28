# API documentation

Base URL: `/api/v1`  
Response shape: `{ success, data, message, meta? }`

## Phase 0

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | Public | Liveness + DB status (Render health check) |
| GET | `/` | Public | API root metadata |

Further endpoints are added per phase (auth, materials, …).
