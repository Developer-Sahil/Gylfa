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
