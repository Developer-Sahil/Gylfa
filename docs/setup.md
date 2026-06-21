# Setup and Running Guide

Follow these steps to run Gylfa locally or execute tests.

## Prerequisites

- Python 3.10+
- Node.js (v18+ recommended) and npm
- A **Firebase project** with:
  - **Authentication** → Email/Password sign-in method **enabled**
  - **Authentication** → Google sign-in method **enabled** (for Google OAuth)
  - **Firestore Database** created (Start in production mode, pick a region)

---

## Firebase Project Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create (or select) a project.
2. **Enable Authentication providers**:
   - Authentication → Sign-in method → Email/Password → Enable
   - Authentication → Sign-in method → Google → Enable (set support email)
3. **Enable Firestore**:
   - Firestore Database → Create database → Production mode → choose region
4. **Generate Service Account key** (for the backend):
   - Project Settings → Service Accounts → Generate new private key
   - Save the downloaded JSON as `backend/firebase-service-account.json`
   - ⚠️ Never commit this file — it's in `.gitignore`
5. **Register a Web App** (for the frontend):
   - Project Settings → General → Your apps → Add app → Web (`</>`)
   - Copy the `firebaseConfig` values for the frontend `.env`

---

## Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Ensure `backend/firebase-service-account.json` is in place (from Firebase setup above).
4. Edit `backend/.env`:
   ```env
   FIREBASE_SERVICE_ACCOUNT=./firebase-service-account.json
   FIREBASE_PROJECT_ID=your-firebase-project-id
   FRONTEND_URL=http://localhost:3000
   ADMIN_EMAIL=admin@gylfa.app
   ADMIN_PASSWORD=admin123
   DEMO_EMAIL=demo@gylfa.app
   DEMO_PASSWORD=demo123
   RESEND_API_KEY=          # leave empty to use console mock
   EMAIL_FROM=Gylfa <onboarding@resend.dev>
   DIGEST_ENABLED=true
   CORS_ORIGINS=http://localhost:3000
   ```
5. Start the backend:
   ```bash
   uvicorn server:app --reload --host 0.0.0.0 --port 8000
   ```
   On launch, the backend auto-seeds the admin user, demo user (`Aria Shadow`), default companions, the "Shadow Guild" circle, and seed goals and check-ins into Firestore (idempotent).

---

## Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Edit `frontend/.env` with your Firebase Web App config:
   ```env
   REACT_APP_BACKEND_URL=http://localhost:8000
   REACT_APP_FIREBASE_API_KEY=AIzaSy...
   REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your-project-id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
   REACT_APP_FIREBASE_APP_ID=1:123:web:abc
   ```
4. Start the development server:
   ```bash
   npm start
   ```

---

## Running Tests

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd frontend
npm test
```

---

## Demo Credentials (seeded on startup)

| Role  | Email             | Password    |
|-------|-------------------|-------------|
| Admin | admin@gylfa.app   | admin123    |
| Demo  | demo@gylfa.app    | demo123     |

Companion accounts: `kai@gylfa.app`, `lyra@gylfa.app`, `renji@gylfa.app`, `mira@gylfa.app` — all use password `companion123`.

Circle invite code: `SHADOW01`
