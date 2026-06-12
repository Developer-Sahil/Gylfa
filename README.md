# Gylfa

Gylfa is a social accountability platform with a React frontend and FastAPI backend. It includes user authentication, goal tracking, habit check-ins, game-like XP and title progression, and collaborative circles.

## Repository Structure

- `backend/` - FastAPI backend service
- `frontend/` - React frontend app using Create React App and CRACO
- `test_reports/` - generated test report files
- `backend/tests/` - backend API tests

## Tech Stack

- Backend: Python, FastAPI, Motor, MongoDB, Pydantic, JWT auth
- Frontend: React, Tailwind CSS, Radix UI, React Router, Axios, React Query
- Testing: pytest for backend, CRA test scripts for frontend

## Setup

### Backend

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create a `.env` file with the required environment variables.
4. Start the backend server:
   ```bash
   uvicorn server:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend

1. Navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   yarn install
   ```
3. Create a `.env` file with the required frontend environment variables.
4. Start the frontend app:
   ```bash
   yarn start
   ```

## Environment Variables

### Backend

The backend requires these environment variables:

- `MONGO_URL`
- `DB_NAME`
- `JWT_SECRET`
- `FRONTEND_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `DEMO_EMAIL`
- `DEMO_PASSWORD`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `DIGEST_ENABLED`
- `CORS_ORIGINS`

### Frontend

The frontend may use variables such as:

- `REACT_APP_BACKEND_URL`

## Testing

### Backend

Run backend tests from the `backend/` folder:

```bash
cd backend
pytest
```

### Frontend

Run frontend tests from the `frontend/` folder:

```bash
yarn test
```

## Notes

- The repository currently includes untracked local `.env` files. Keep secret credentials out of version control.
- If you add example environment files, use them as templates for your local `.env` files.
