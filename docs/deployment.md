# Deployment Guide — Gylfa

Gylfa's backend runs on **Render** (Docker/FastAPI + Firebase Admin SDK), and the frontend is deployed to **Vercel** (React SPA). Both use **Firebase** for authentication and **Cloud Firestore** as the database.

---

## Prerequisites

| Service | Purpose | Notes |
|---------|---------|-------|
| [Firebase](https://console.firebase.google.com) | Auth + Firestore | Free Spark plan is sufficient |
| [Render](https://render.com) | Backend hosting | Free instance available |
| [Vercel](https://vercel.com) | Frontend hosting | Free hobby plan |
| [Resend](https://resend.com) | Transactional email | Free tier: 3,000 emails/month |

---

## 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com) and create (or reuse) a project.
2. **Enable Authentication** → Sign-in method → enable **Email/Password**.
3. **Enable Firestore** → Create a database in production mode.
4. **Generate a Service Account key**:
   - Project Settings → Service accounts → Generate new private key.
   - Download the JSON file. **Never commit this file** — add it as a Render Secret File (see below).
5. Note your **Project ID** (e.g., `cicp-a35c4`) — you'll need it for both Render and Vercel.

---

## 2. Backend: Render

### Via Blueprint (recommended)

1. Go to [Render](https://render.com) and connect your GitHub account.
2. Click **New + → Blueprint** and select the Gylfa repository.
3. Render reads `render.yaml` from the root and creates the `gylfa-backend` web service automatically.

### Environment Variables to set in Render Dashboard

Navigate to your service → **Environment** and fill in:

| Variable | Value |
|----------|-------|
| `FIREBASE_PROJECT_ID` | Your Firebase project ID (e.g., `cicp-a35c4`) |
| `FIREBASE_SERVICE_ACCOUNT` | `/etc/secrets/firebase-service-account.json` |
| `FRONTEND_URL` | Your Vercel URL (e.g., `https://gylfa.vercel.app`) |
| `CORS_ORIGINS` | Same as `FRONTEND_URL` (no trailing slash) |
| `ADMIN_EMAIL` | Your admin account email |
| `ADMIN_PASSWORD` | **Strong** password (not `admin123`) |
| `DEMO_EMAIL` | Demo account email |
| `DEMO_PASSWORD` | **Strong** password (not `demo123`) |
| `RESEND_API_KEY` | Your Resend API key |

### Upload the Firebase Service Account Key as a Secret File

1. In the Render service → **Secret Files** tab.
2. Add a new secret file with path `/etc/secrets/firebase-service-account.json`.
3. Paste the contents of your downloaded Firebase service account JSON.

### Confirm Deployment

- After deploy, visit `https://your-render-url.onrender.com/api/health` — it should return `{"status": "ok"}`.
- Render's `healthCheckPath` is configured to `/api/health` — the deploy won't go live until this passes.

---

## 3. Frontend: Vercel

1. Go to [Vercel](https://vercel.com) → **Add New → Project**.
2. Import the Gylfa repository.
3. Set **Root Directory** to `frontend`.
4. **Framework Preset**: `Create React App`.
5. Open **Environment Variables** and add all `REACT_APP_*` vars:

| Variable | Value |
|----------|-------|
| `REACT_APP_BACKEND_URL` | Your Render backend URL (e.g., `https://gylfa.onrender.com`) |
| `REACT_APP_FIREBASE_API_KEY` | From Firebase Console → Project Settings → Web app |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | `<project-id>.firebaseapp.com` |
| `REACT_APP_FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | `<project-id>.firebasestorage.app` |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | From Firebase Console |
| `REACT_APP_FIREBASE_APP_ID` | From Firebase Console |

6. Click **Deploy**.

> **Note**: React env vars are baked in at build time. After changing any `REACT_APP_*` variable, trigger a new Vercel deployment.

---

## 4. Final Wiring

Once both are deployed:

1. Go back to your **Render** service → Environment.
2. Update `FRONTEND_URL` and `CORS_ORIGINS` to the **exact** Vercel URL (e.g., `https://gylfa.vercel.app` — no trailing slash).
3. Render will redeploy automatically.

---

## 5. Local Docker Deployment

To run the full stack locally via Docker Compose:

```bash
# Copy and fill in local values
cp backend/.env.example backend/.env      # if you create one
cp frontend/.env.example frontend/.env    # if you create one

# Ensure firebase-service-account.json is in backend/
docker compose up --build
```

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`

The frontend Dockerfile is a multi-stage build — nginx serves the static bundle on port 80 (mapped to host port 3000).

> **Important**: React `REACT_APP_*` env vars are baked in at Docker build time, not at runtime. Pass them as `--build-arg` or via the `build.args` in `docker-compose.yml` if you need them injected during the Docker build.

---

## 6. Seed Data

On every cold start, the backend automatically seeds:
- An admin account (`ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- A demo user "Aria Shadow" (`DEMO_EMAIL` / `DEMO_PASSWORD`)
- Companion users, a "Shadow Guild" circle, goals, check-ins, and activities

Seeding is **idempotent** — safe to run repeatedly. All seed accounts use the credentials from the environment variables.

---

## 7. Firestore Security Rules (recommended)

The backend uses the Firebase **Admin SDK** which bypasses Firestore rules. However, if you ever expose Firestore directly to the client, add rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false; // deny all direct client access
    }
  }
}
```
