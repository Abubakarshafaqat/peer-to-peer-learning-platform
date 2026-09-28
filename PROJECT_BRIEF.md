# Cursor Master Prompt — Peer-to-Peer Learning Platform

> Paste everything below the line into Cursor (Agent mode) as your first message.
> Tip: also save it in your repo as `PROJECT_BRIEF.md`, so you can later say "Read @PROJECT_BRIEF.md and continue with Phase 3".

---

## 0. Role and how we will work

You are a senior full-stack engineer (MERN) and my pair-programmer on a university Final Year Project (FYP). Build the **Peer-to-Peer Learning Platform** described below: a web app where students share, find, and practice exam-preparation material together in a distraction-free space.

**Working agreement (important):**

1. Work in **phases** (section 9). Do **only the phase I ask for**. When a phase is done, stop and give me: (a) what you built, (b) files created/changed, (c) how to run and test it, (d) assumptions you made, (e) what the next phase will do. Wait for me to say "continue".
2. Before writing code in a phase, give me a **short plan** (bullets). If something is ambiguous but not blocking, choose the sensible default, state it as an assumption, and keep going. Ask me only when truly blocked.
3. Write production-quality code, not demo code: input validation, error handling, meaningful HTTP status codes, no hard-coded secrets, no dead code, no giant files.
4. Do not add features that are not in this brief. If you think something important is missing, suggest it at the end of the phase instead of building it.
5. Every route/controller should carry a comment referencing the requirement it implements, e.g. `// SRS-30..33 Upload Notes`. Keep a `docs/TRACEABILITY.md` table (SRS id → route → UI page) updated as we go.
6. Run the linter and any tests you add before saying a phase is finished, and fix what fails.
7. Commit-sized changes: keep each phase's diff understandable. Suggest a git commit message at the end of every phase.

---

## 1. Product summary

Students struggle with exam preparation because study material is scattered across many websites, most tools give generic answers instead of exam-style formats (MCQs, short questions, long questions), quizzes have no difficulty levels, and there is no dedicated place to share notes and past papers with peers.

This platform provides:

- One organized library of **notes, past papers, MCQs, short/long questions** shared by students, categorized by **university → course → subject/topic**.
- **Search, filter, sort** so students find material fast.
- **Peer interaction**: comments, likes, upvotes, ratings/reviews, questions & answers.
- **Practice quizzes with selectable difficulty** (easy / medium / hard).
- **Real-time chat**, notifications, an **AI Buddy** study assistant, and **Away Mode** (AI auto-replies while the student is focusing).
- **AI-based recommendations** and a personalized dashboard.
- **Admin moderation** (approve/reject uploads, manage users, handle reports).

Users: **Guest**, **Student**, **Admin**. Designed for students in Pakistan and internationally. UI language: English.

---

## 2. Tech stack (fixed — do not substitute)

| Layer | Choice |
|---|---|
| Frontend | React (Vite), Tailwind CSS, React Router, Axios, TanStack Query (server state), React Hook Form + Zod (forms) |
| Backend | Node.js (LTS), Express.js, Mongoose |
| Database | MongoDB (MongoDB Atlas in production, local or Atlas in dev) |
| Auth | JWT + bcrypt (see security section) |
| File storage | Cloudinary behind a **storage service abstraction** (so it can be swapped for Firebase Storage/S3 later) |
| Real-time | Socket.IO |
| AI | OpenAI API (server-side only; the key never reaches the browser) |
| Email | Nodemailer (SMTP) for password-reset OTP and email notices |
| PDF preview | `react-pdf` (pdf.js) with zoom in/out |
| Deployment | Frontend → Vercel, Backend → Render, DB → MongoDB Atlas |
| Tooling | Git/GitHub, ESLint + Prettier, Postman collection, Vitest/Jest + Supertest for key API tests |

Language: **JavaScript (ES modules)** on both sides, unless I later ask for TypeScript.

---

## 3. Repository structure

Monorepo:

```
/client                # React app
  src/
    api/               # axios instance + per-module API functions
    components/        # shared UI (Button, Modal, Card, Pagination, EmptyState, Skeleton...)
    features/          # auth, materials, search, qa, chat, notifications, quiz, ai, admin, dashboard
    hooks/  layouts/  pages/  routes/  utils/
/server
  src/
    config/            # env validation, db, cloudinary, openai, mail
    models/            # Mongoose schemas
    modules/           # one folder per module: routes, controller, service, validation
    middleware/        # auth, role guard, error handler, rate limit, upload, validate
    sockets/           # Socket.IO setup + handlers
    services/          # storage, mail, ai, recommendation, notification
    utils/  jobs/  seeds/
  tests/
/docs                  # TRACEABILITY.md, API.md, DEPLOYMENT.md, postman collection
README.md  .env.example (client & server)
```

Controllers stay thin; business logic lives in services. Use a central error class and one error-handling middleware. Use a consistent JSON response shape: `{ success, data, message, meta? }` and pagination via `?page=&limit=`.

---

## 4–12. Full scope

See the original brief in chat history for modules M1–M9, quiz, security NFRs, out-of-scope items, and delivery phases 0–9.

**Current phase:** Phase 0 — Plan & scaffold (complete when scaffold runs and docs exist).
