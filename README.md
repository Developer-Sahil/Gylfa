# Gylfa

[![CI/CD Pipeline](https://github.com/Developer-Sahil/Gylfa/actions/workflows/ci.yml/badge.svg)](https://github.com/Developer-Sahil/Gylfa/actions/workflows/ci.yml)

**Gylfa** is a social accountability platform — track personal goals, earn XP, climb levels, and stay consistent alongside your circle. Built with React + FastAPI + Firebase.

---

## Features

- 🔐 **Firebase Authentication** — email/password and Google OAuth
- 🎯 **Goal Tracking** — daily and weekly goals with XP rewards
- 🔥 **Streak System** — daily check-ins build streaks and trigger milestone notifications
- 🏆 **Gamification** — XP, levels, titles (Initiate → Monarch), and achievement badges
- 👥 **Circles** — invite-only accountability groups with a shared activity feed and leaderboard
- 📬 **Weekly Digest** — automated email summaries via Resend
- 🔔 **Notifications** — in-app level-up, streak milestone, and digest alerts

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, CRACO, Tailwind CSS, Radix UI, React Router v7, Axios, TanStack Query, Framer Motion |
| **Backend** | Python 3.11, FastAPI, Uvicorn, APScheduler, Pydantic v2 |
| **Auth** | Firebase Authentication (email/password + Google) |
| **Database** | Cloud Firestore (via Firebase Admin SDK) |
| **Email** | Resend |
| **Infra** | Docker (multi-stage), Render (backend), Vercel (frontend) |
| **Testing** | pytest (backend), CRA test scripts (frontend) |

---

## Repository Structure

```
Gylfa/
├── backend/
│   ├── server.py              # FastAPI app — all routes and business logic
│   ├── requirements.txt       # Runtime dependencies (production)
│   ├── requirements-dev.txt   # Dev/test dependencies
│   ├── Dockerfile             # Production image (python:3.11-slim + uvicorn)
│   ├── .dockerignore          # Excludes secrets from Docker build context
│   └── tests/                 # pytest test suite
├── frontend/
│   ├── src/                   # React source (pages, components, hooks, contexts)
│   ├── Dockerfile             # Multi-stage build: Node builder → nginx:alpine
│   ├── nginx.conf             # SPA routing + gzip + asset caching
│   └── .dockerignore
├── docs/
│   ├── architecture.md        # Firestore schema, auth flow, gamification mechanics
│   ├── deployment.md          # Full cloud deployment guide
│   └── setup.md               # Local development setup
├── docker-compose.yml         # Full local stack (backend + frontend)
├── render.yaml                # Render infrastructure-as-code (backend)
└── LOG.md                     # Change log
```

---

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Firebase project with **Authentication** (email/password) and **Firestore** enabled
- A Firebase **service account key** JSON file (download from Firebase Console → Project Settings → Service accounts)

### Backend

```bash
cd backend

# Install runtime + dev dependencies
pip install -r requirements-dev.txt

# Create your local env file
cp .env.example .env   # or create manually (see Environment Variables below)

# Place your Firebase service account key in backend/
# (named firebase-service-account.json — already gitignored)

# Start the dev server
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Create your local env file
cp .env.example .env   # or create manually (see Environment Variables below)

# Start the dev server
npm start
```

### Docker (full stack)

```bash
# From the project root
docker compose up --build
```

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`
- Health check: `http://localhost:8000/api/health`

> **Note**: React `REACT_APP_*` vars are baked in at build time. Rebuild the frontend image after changing them.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `FIREBASE_SERVICE_ACCOUNT` | Path to the service account JSON file | ✅ |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID | ✅ |
| `FRONTEND_URL` | Frontend origin URL (for password reset links) | ✅ |
| `CORS_ORIGINS` | Comma-separated allowed origins (no trailing slash) | ✅ |
| `ADMIN_EMAIL` | Seed admin account email | ✅ |
| `ADMIN_PASSWORD` | Seed admin account password | ✅ |
| `DEMO_EMAIL` | Seed demo account email | ✅ |
| `DEMO_PASSWORD` | Seed demo account password | ✅ |
| `RESEND_API_KEY` | Resend API key (leave blank to mock emails in dev) | ⬜ |
| `EMAIL_FROM` | Sender name + address for transactional emails | ⬜ |
| `DIGEST_ENABLED` | Enable weekly digest scheduler (`true`/`false`) | ⬜ |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `REACT_APP_BACKEND_URL` | Backend API base URL |
| `REACT_APP_FIREBASE_API_KEY` | Firebase web app API key |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `REACT_APP_FIREBASE_PROJECT_ID` | Firebase project ID |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `REACT_APP_FIREBASE_APP_ID` | Firebase app ID |
| `REACT_APP_FIREBASE_MEASUREMENT_ID` | Firebase Analytics measurement ID (optional) |

---

## Testing

### Backend

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

### Frontend

```bash
cd frontend
npm test
```

CI runs automatically on every push and pull request to `main` via GitHub Actions.

---

## Deployment

Gylfa is production-ready and configured for one-click cloud deployment:

- **Backend** → [Render](https://render.com) via `render.yaml` (Docker, health-checked)
- **Frontend** → [Vercel](https://vercel.com) via `vercel.json` (SPA rewrites)

See **[docs/deployment.md](docs/deployment.md)** for the complete step-by-step guide covering Firebase setup, Render Secret Files, and Vercel environment variables.

---

## Seed Data

On first boot the backend automatically seeds (idempotent):

- **Admin** account (`ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- **Demo user** "Aria Shadow" with XP, streaks, goals, and check-ins
- **4 companions** in a "Shadow Guild" circle
- Sample activities, notifications, and leaderboard data

Demo credentials: see your `.env` file.
