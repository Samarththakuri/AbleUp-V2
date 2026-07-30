# AbelUp Backend

Node.js + Express + MongoDB backend for AbelUp, written in JavaScript (native
ESM — `package.json` sets `"type": "module"`, so relative imports carry
explicit `.js` extensions). There is no build step: `npm start` runs
`src/server.js` directly.

## Setup

```bash
cd backend
npm install

# Copy env and configure
cp .env.example .env

# Start MongoDB locally (or update MONGO_URI)

# Seed a clean slate: DROPS every collection, then creates one
# candidate, one recruiter and one admin. --yes is required.
npm run seed -- --yes

# ...or seed the recruiter as PENDING to walk the onboarding flow
npm run seed -- --yes --pending-recruiter

# Start dev server
npm run dev
```

Server runs on `http://localhost:5000` by default.

## API Endpoints

### Auth
- `POST /api/auth/register` — Register (CANDIDATE or RECRUITER)
- `POST /api/auth/login` — Login → returns JWT + user
- `POST /api/auth/change-password` — Change password (auth required)

### Candidate (auth + CANDIDATE role)
- `GET /api/candidate/profile` — Get profile
- `PUT /api/candidate/profile` — Update profile
- `GET /api/candidate/applied` — Applied jobs
- `GET /api/candidate/saved` — Saved jobs
- `POST /api/candidate/save/:jobId` — Toggle save
- `POST /api/candidate/apply/:jobId` — Apply (must be VERIFIED)
- `POST /api/candidate/resume` — Upload resume (multipart)

### Recruiter (auth + RECRUITER role)
- `GET /api/recruiter/jobs` — List own jobs (`?active=true`)
- `POST /api/recruiter/jobs` — Create job
- `GET /api/recruiter/job/:jobId/applicants` — List applicants
- `GET /api/recruiter/job/:jobId/summary` — Quick stats
- `PUT /api/recruiter/application/:id/shortlist` — Shortlist/reject

### Admin (auth + ADMIN role)
- `POST /api/admin/create-user` — Create user with temp password
- `PUT /api/admin/verify/:userId` — Verify/reject candidate
- `GET /api/admin/users` — List users
- `PUT /api/admin/user/:userId/force-reset` — Force password change

### Public
- `GET /api/jobs/search` — Search jobs (`?q=&location=&remote=&disability=`)
- `GET /api/jobs/:jobId` — Job detail

## Seeded Credentials

Created by `npm run seed -- --yes`. All three share the same password:

| Role | Email | Password |
|---|---|---|
| Candidate | candidate@ableup.test | `Password@123` |
| Recruiter | recruiter@ableup.test | `Password@123` |
| Admin | admin@ableup.test | `Password@123` |
