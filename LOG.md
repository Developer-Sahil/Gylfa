# Log

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
