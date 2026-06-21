# Log

## [2026-06-21] - Production Hardening + README Update

### Documentation
- **`README.md`**: Complete rewrite — removed stale MongoDB/JWT/Motor references; added feature list, accurate tech stack table, directory tree, corrected env var tables (Firebase), Docker usage instructions, and updated deployment section.

- **`.gitignore`**: Added explicit rules for `firebase-service-account.json` and `*service-account*.json` — the previous `*credentials.json*` pattern did NOT match the actual filename, risking accidental commit of the private key.
- **`backend/.dockerignore`** (new): Excludes `.env`, `firebase-service-account.json`, `__pycache__/`, `*.pyc`, `.pytest_cache/`, `tests/` from Docker build context — prevents secrets from being baked into image layers.
- **`frontend/.dockerignore`** (new): Excludes `node_modules`, `.env`, `build/`, `coverage/` from frontend Docker build context.

### Backend
- **`backend/requirements.txt`**: Trimmed to runtime-only packages. Removed `pytest`, `black`, `isort`, `flake8`, `mypy`, `pandas`, `numpy`, `jq`, `typer` — these were installed into the production Docker image unnecessarily.
- **`backend/requirements-dev.txt`** (new): Dev/test tools file. Install locally with `pip install -r requirements-dev.txt`.
- **`backend/Dockerfile`**: Added `--workers 2` and `--log-level info` to uvicorn CMD for production throughput. Relies on `.dockerignore` to exclude secrets.
- **`backend/server.py`**: Added `GET /api/health` endpoint returning `{"status": "ok"}` — used by Render's `healthCheckPath`, Docker health checks, and load balancers.

### Frontend
- **`frontend/Dockerfile`**: Rewritten as a **multi-stage build** — Stage 1 (node:18-alpine) builds the React app; Stage 2 (nginx:1.27-alpine) serves the static output. Final image is ~25MB vs ~1GB for the dev server approach.
- **`frontend/nginx.conf`** (new): Production nginx config with gzip compression, aggressive caching for content-hashed assets (1-year `Cache-Control: immutable`), and SPA fallback routing to `index.html`.
- **`frontend/package.json`**: Added `GENERATE_SOURCEMAP=false` to the `build` script to prevent source maps from being deployed.
- **`docker-compose.yml`**: Added Docker health check for backend (`/api/health`), `restart: unless-stopped` for both services, `${VAR:-default}` syntax for all env vars, frontend `depends_on` backend health.

### Infrastructure
- **`render.yaml`**: Removed stale `MONGO_URL`, `JWT_SECRET`, `DB_NAME` vars (from pre-Firebase migration). Added `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT` (secret file path). Fixed `dockerfilePath` (was `./backend/Dockerfile` but `rootDir` is already `backend`). Added `healthCheckPath: /api/health`.

### Documentation
- **`docs/deployment.md`**: Completely rewritten — replaced MongoDB Atlas deployment steps with Firebase/Firestore instructions. Added Render Secret File upload guide, Firestore security rules, local Docker usage, and updated Vercel env vars table with all `REACT_APP_FIREBASE_*` variables.



## [2026-06-13] - Initial Exploration & Documentation
- Created `LOG.md` in the root directory to track project changes.
- Started analyzing the project layout, including `README.md`, `backend/`, and `frontend/`.
- Created the `docs/` folder with detailed platform documentation:
  - `docs/architecture.md` describing database collection schema, custom auth flows, and gamification mechanics (XP, level calculation, titles, achievements).
  - `docs/setup.md` describing local deployment setup and how to run tests.
- Created root `docker-compose.yml` to orchestrate MongoDB, backend FastAPI service, and frontend React application.
- Created `backend/Dockerfile` and `frontend/Dockerfile` to allow standard building and running of Gylfa under containerization.
- Fixed a bug in `backend/tests/iter2_test.py` where `REACT_APP_BACKEND_URL` would evaluate to `None` if not provided in environment, causing pytest collection to fail with an AttributeError. Added the default fallback URL matching `backend_test.py`.
- Migration from Yarn to NPM:
  - Removed `"packageManager": "yarn..."` field from `frontend/package.json`.
  - Replaced all yarn script commands (`yarn install`, `yarn start`, `yarn test`) with their npm counterparts (`npm install`, `npm start`, `npm test`) in `README.md` and `docs/setup.md`.
  - Removed mentions of yarn in comments inside `frontend/public/index.html`.
- Git configuration:
  - Added `.env` and `.env.*` to `.gitignore` to prevent secret key leakage.

## [2026-06-14] - Remove All Emergent Platform Dependencies
- **Backend `server.py`**: Removed `/api/auth/google/session` route (called `demobackend.emergentagent.com`); removed `httpx` import; removed `GoogleSessionReq` model.
- **Backend `requirements.txt`**: Removed `emergentintegrations==0.2.0` (unused Emergent CLI package).
- **Backend `.env`**: Updated `CORS_ORIGINS` and `FRONTEND_URL` from Emergent preview URL to `http://localhost:3000`.
- **Frontend `public/index.html`**: Removed Emergent analytics script (`assets.emergent.sh/scripts/emergent-main.js`), the floating "Made with Emergent" badge, and Emergent meta/title branding. Replaced with Gylfa branding and proper Google Fonts preload.
- **Frontend `package.json`**: Removed `@emergentbase/visual-edits` devDependency.
- **Frontend `craco.config.js`**: Removed the `withVisualEdits` wrapper block.
- **Frontend `Login.jsx`**: Removed `googleLogin()` function and the "Continue with Google" button.
- **Frontend `Signup.jsx`**: Removed `googleSignup()` function and the "Continue with Google" button.
- **Frontend `AuthContext.jsx`**: Removed `googleExchange()` function and the `session_id` hash fragment check in `checkAuth`.
- **Frontend `App.js`**: Removed `AuthCallback` import/route and the `AppRouter` hash-detection wrapper. App is now a clean, flat route tree.
- **Frontend `constants/testIds/home.js`**: Removed `emergentLink` test ID key.
- **Frontend `constants/testIds/auth.js`**: Removed stale Emergent lint rule comment.
- **Frontend `.env`**: Set `REACT_APP_BACKEND_URL=http://localhost:8000`; removed `WDS_SOCKET_PORT` and `ENABLE_HEALTH_CHECK` Emergent dev-server vars.
- **Tests `backend_test.py` + `iter2_test.py`**: Updated fallback `BASE_URL` from Emergent preview domain to `http://localhost:8000`.
- **Docs `memory/PRD.md`**: Updated auth stack line to remove Emergent OAuth reference.

## [2026-06-14] - Stage 5: Production Configuration
- **CI/CD**: Added `.github/workflows/ci.yml` for automated backend and frontend testing on push/pull request.
- **Frontend Config**: Added `frontend/vercel.json` to handle client-side routing rewrites for Vercel deployment.
- **Backend Config**: Added `render.yaml` defining the backend Docker service and required environment variables for Render infrastructure-as-code.
- **Documentation**: Created `docs/deployment.md` outlining the steps for provisioning MongoDB Atlas, configuring Vercel, configuring Render, and wiring up the environment variables. Updated `README.md` to link to it.

## [2026-06-14] - Critical CORS Bug Fix (Login/Register broken)
- **Root cause**: `app.add_middleware(CORSMiddleware)` was registered AFTER `app.include_router(api)` in `backend/server.py`. FastAPI/Starlette requires middleware to be added BEFORE routes — all browser requests were silently rejected at the preflight OPTIONS stage, making login/register impossible.
- **Fix**: Swapped the order so `add_middleware` is called before `include_router`.
- **Bonus fix**: `CORS_ORIGINS` parser now strips trailing slashes (`rstrip("/")`) so URLs like `https://gylfa-ecru.vercel.app/` correctly match browser origins which never include a trailing slash.

## [2026-06-16] - Firebase Auth & Firestore Migration

### Auth
- **Removed**: Custom bcrypt password hashing, PyJWT token generation/validation, httpOnly cookie session management, localStorage token storage.
- **Added**: Firebase Authentication (Email/Password + Google OAuth via `signInWithPopup`).
- **Backend**: `get_current_user` now calls `firebase_admin.auth.verify_id_token()` to validate Firebase ID tokens — completely stateless.
- **Frontend**: `AuthContext.jsx` rewritten to use `onAuthStateChanged` as the session source of truth (auto-persists across page refreshes via Firebase IndexedDB). Added `loginWithGoogle()`.
- **New endpoint**: `POST /api/auth/profile` — called after Firebase sign-in/sign-up to upsert the Firestore user profile document. Replaces the old `/auth/register` and `/auth/login` endpoints.
- **Password Reset**: Kept custom Resend email flow; token validation unchanged but password update now calls `firebase_admin.auth.update_user(uid, password=...)` instead of bcrypt re-hash.

### Database
- **Removed**: MongoDB/Motor async driver (`motor==3.3.1`, `pymongo==4.5.0`), `motor.motor_asyncio.AsyncIOMotorClient`.
- **Added**: Cloud Firestore via `google-cloud-firestore>=2.16.0` + `firebase-admin>=6.5.0`.
- **User document IDs**: Now use Firebase UID (from Firebase Auth) instead of UUID4.
- **All other collection IDs** (goals, checkins, circles, activities, notifications): still UUID4.
- Firestore `ArrayUnion`, `ArrayRemove`, `Increment` sentinels used for atomic array/counter updates.
- Seeding rewritten to use Firestore `set()` / `update()` / async stream queries.

### Frontend
- **`frontend/src/lib/firebase.js`** (new): Firebase app initialisation, exports `auth` and `googleProvider`.
- **`frontend/src/lib/api.js`**: Replaced `getToken`/`setToken`/`clearToken` localStorage logic with async `auth.currentUser.getIdToken()` axios interceptor.
- **`frontend/src/pages/Login.jsx`**: Added "Continue with Google" button; added `firebaseErrorMessage()` mapper for Firebase error codes.
- **`frontend/src/pages/Signup.jsx`**: Added "Continue with Google" button; added `firebaseErrorMessage()` mapper.
- **`frontend/.env`**: Added `REACT_APP_FIREBASE_*` config vars for the client SDK.
- **`frontend/package.json`**: Added `firebase@^11.0.0` dependency.

### Infrastructure
- **`backend/requirements.txt`**: Added `firebase-admin>=6.5.0`, `google-cloud-firestore>=2.16.0`; removed `motor`, `pymongo`, `bcrypt`, `pyjwt`, `passlib`, `python-jose`, `boto3`.
- **`backend/.env`**: Replaced `MONGO_URL`, `DB_NAME`, `JWT_SECRET` with `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`.
- **`docker-compose.yml`**: Removed MongoDB service; backend now mounts `firebase-service-account.json` as read-only volume; frontend passes Firebase env vars.

### Documentation
- **`docs/architecture.md`**: Completely updated — new auth flow diagrams, Firestore schema replacing MongoDB schema.
- **`docs/setup.md`**: Completely updated — Firebase project setup steps, updated env references, demo credentials table.
- **`memory/PRD.md`**: Stack line updated to reflect Firebase Auth + Firestore.
