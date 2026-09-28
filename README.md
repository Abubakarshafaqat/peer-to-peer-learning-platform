# Peer-to-Peer Learning Platform

University FYP — students share and practice exam-prep material (notes, past papers, MCQs, quizzes) in a distraction-free space.

**Stack:** React (Vite) + Tailwind · Node/Express · MongoDB · JWT · Cloudinary · Socket.IO · OpenAI

See [PROJECT_BRIEF.md](./PROJECT_BRIEF.md) for full scope and phases.

## Security note (registration)

Public registration **always** creates a `student` account. Admin accounts are created by the seed script or promoted by an existing admin — never self-selected on the form.

## Prerequisites

- Node.js **20+**
- MongoDB locally **or** Atlas connection string

## Setup

```bash
# from repo root
npm install
npm install --prefix server
npm install --prefix client

# copy env files if needed
copy server\.env.example server\.env
copy client\.env.example client\.env
```

Edit `server/.env` — at minimum set `MONGODB_URI`.

## Run

```bash
# both apps
npm run dev

# or separately
npm run dev:server   # http://localhost:5000
npm run dev:client   # http://localhost:5173
```

Seed admin + sample universities/courses/subjects:

```bash
npm run seed
```

Default admin (change in production): see `ADMIN_SEED_*` in `server/.env.example`.

## Phase 0 checklist

- [x] Monorepo structure (`client`, `server`, `docs`)
- [x] ESLint + Prettier
- [x] Express app, env validation, Mongo connect, error handler, `/api/v1/health`
- [x] Vite React + Tailwind + Router + TanStack Query + Axios
- [x] Layout shell + design tokens
- [x] Seed skeleton
- [x] Docs: DATA_MODEL, DESIGN_SYSTEM, API, TRACEABILITY

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Client + server |
| `npm run lint` | Lint both packages |
| `npm run seed` | Seed admin + taxonomy |
| `npm run format` | Prettier write |

## License

Private — academic FYP use.
