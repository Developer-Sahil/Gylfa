# Setup and Running Guide

Follow these steps to run Gylfa locally or execute tests.

## Local Development Setup

### 1. Prerequisites
- Python 3.10+
- Node.js (v18+ recommended) and npm
- MongoDB instance running locally (or remote Mongo URL)

---

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create a `.env` file in the `backend/` directory. Example:
   ```env
   MONGO_URL=mongodb://localhost:27017
   DB_NAME=gylfa
   JWT_SECRET=supersecretjwtkeygylfa123
   FRONTEND_URL=http://localhost:3000
   ADMIN_EMAIL=admin@gylfa.app
   ADMIN_PASSWORD=admin123
   DEMO_EMAIL=demo@gylfa.app
   DEMO_PASSWORD=demo123
   RESEND_API_KEY=
   EMAIL_FROM=Gylfa <onboarding@resend.dev>
   DIGEST_ENABLED=true
   CORS_ORIGINS=http://localhost:3000
   ```
4. Start the backend:
   ```bash
   uvicorn server:app --reload --host 0.0.0.0 --port 8000
   ```
   On launch, the backend will auto-seed the admin user, demo user (`Aria Shadow`), default companions, the "Shadow Guild" circle, and seed goals and check-ins.

---

### 3. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `frontend/` directory:
   ```env
   REACT_APP_BACKEND_URL=http://localhost:8000
   ```
4. Start the development server:
   ```bash
   npm start
   ```

---

## Running Tests

### Backend Tests
Ensure pytest is installed (in backend requirements) and run from the `backend/` directory:
```bash
cd backend
pytest
```

### Frontend Tests
Run from the `frontend/` directory:
```bash
cd frontend
npm test
```
