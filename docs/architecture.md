# Architecture Documentation

Gylfa is a social accountability platform structured as a full-stack application with a FastAPI backend and a React (CRA + CRACO) frontend.

## System Architecture Overview

```
+------------------------------------------------------------------+
|                        React Frontend                            |
|  - App Layout: fixed sidebar, dashboard, circles, goals          |
|  - Theme: Dark (#050505 bg, #0e0e10 surface, #BAFB00 accent)     |
|  - Firebase JS SDK: onAuthStateChanged session management         |
|  - Axios API client: attaches Firebase ID token per request       |
+------------------------------------+-----------------------------+
                                     |
                      (JSON REST API + Firebase ID Token)
                                     v
+------------------------------------------------------------------+
|                        FastAPI Backend                           |
|  - Authentication: firebase-admin verifies ID tokens             |
|  - Profile: /api/auth/profile upserts Firestore user doc         |
|  - Scheduler: Weekly Digest (APScheduler)                        |
|  - Seeding: Idempotent user/circle/goals/check-in seeding        |
+------------------------------------+-----------------------------+
                                     |
           +--------------+----------+------------------+
           |              |                             |
           v              v                             v
+------------------+ +------------------+  +---------------------------+
| Firebase Auth    | |   Firestore DB   |  |  Resend (email)           |
| - Email/Password | | - users          |  |  - Password reset emails  |
| - Google OAuth   | | - circles        |  |  - Weekly digest emails   |
|                  | | - goals          |  |  - Console mock in dev    |
|                  | | - checkins       |  +---------------------------+
|                  | | - activities     |
|                  | | - notifications  |
|                  | | - password_reset_tokens |
+------------------+ +------------------+
```

---

## Auth Flow

### Email/Password
1. User submits credentials on the Login page.
2. Frontend calls `signInWithEmailAndPassword(auth, email, password)` via Firebase JS SDK.
3. Firebase returns a signed ID token (JWT) stored locally in IndexedDB — no localStorage management needed.
4. Frontend calls `POST /api/auth/profile` with the ID token in `Authorization: Bearer <token>`.
5. Backend calls `firebase_admin.auth.verify_id_token(token)` to authenticate.
6. Backend upserts a Firestore document in `users/{uid}` with profile data and returns it.
7. Subsequent API calls attach a fresh token via the axios request interceptor (`auth.currentUser.getIdToken()`).

### Google OAuth
1. User clicks "Continue with Google" on Login or Signup page.
2. Frontend calls `signInWithPopup(auth, googleProvider)`.
3. Firebase handles the OAuth flow and returns a signed ID token.
4. Frontend calls `POST /api/auth/profile` — backend creates a Firestore profile doc if it doesn't exist.

### Password Reset (custom Resend flow)
1. `POST /api/auth/forgot-password` → backend looks up the Firebase user by email, generates a secure token stored in Firestore `password_reset_tokens`.
2. Resend sends a branded email with the reset link (or logs to console in dev when `RESEND_API_KEY` is empty).
3. `POST /api/auth/reset-password` → validates the token, calls `firebase_admin.auth.update_user(uid, password=...)`.

### Session Persistence
- Firebase SDK stores the session in IndexedDB automatically — users stay logged in across page refreshes without any server-side session management.
- `onAuthStateChanged` in `AuthContext` fires on every mount and auth state change, calling `GET /api/auth/me` to sync the Firestore profile into React state.

---

## Database Schema & Collections (Firestore)

All collections use Firestore (NoSQL document store). Document IDs noted below.

1. **`users/{firebase_uid}`**:
   - `email`: String
   - `name`: String
   - `avatar`: String (Initials or OAuth display photo URL)
   - `xp`: Integer
   - `level`: Integer
   - `streak`: Integer
   - `longest_streak`: Integer
   - `title`: String (Gamified rank)
   - `circles`: Array of Strings (Circle document IDs)
   - `achievements`: Array of Strings (Unlocked achievement IDs)
   - `last_checkin_date`: String (ISO date `YYYY-MM-DD` or null)
   - `total_checkins`: Integer
   - `auth_provider`: String (`password` or `google.com`)
   - `role`: String (`user` or `admin`)
   - `created_at`: String (ISO datetime)

2. **`circles/{uuid}`**:
   - `name`, `description`, `emoji`: Strings
   - `invite_code`: String (unique, e.g. `SHADOW01`)
   - `owner_id`: String (Firebase UID)
   - `admin_ids`: Array of Strings (Firebase UIDs)
   - `member_ids`: Array of Strings (Firebase UIDs)
   - `created_at`: String (ISO datetime)

3. **`goals/{uuid}`**:
   - `user_id`: String (Firebase UID)
   - `title`, `description`: Strings
   - `frequency`: String (`daily` or `weekly`)
   - `xp_reward`: Integer
   - `icon`: String (Lucide icon name)
   - `total_completions`: Integer
   - `last_completed_date`: String (ISO date or null)
   - `created_at`: String (ISO datetime)

4. **`checkins/{uuid}`**:
   - `user_id`, `goal_id`: Strings
   - `goal_title`: String
   - `xp_earned`: Integer
   - `date`: String (ISO date `YYYY-MM-DD`)
   - `note`: String
   - `created_at`: String (ISO datetime)

5. **`activities/{uuid}`**:
   - `circle_id`, `user_id`: Strings
   - `user_name`: String
   - `type`: String (`checkin`, `level_up`, `streak`, `join`, `remove`)
   - `message`: String
   - `created_at`: String (ISO datetime)

6. **`notifications/{uuid}`**:
   - `user_id`: String
   - `type`: String (`level_up`, `streak_milestone`, `weekly_digest`)
   - `title`, `body`: Strings
   - `meta`: Object
   - `read`: Boolean
   - `created_at`: String (ISO datetime)

7. **`password_reset_tokens/{uuid}`**:
   - `token`: String
   - `user_id`: String (Firebase UID)
   - `email`: String
   - `used`: Boolean
   - `expires_at`: String (ISO datetime, 1 hour TTL)
   - `created_at`: String (ISO datetime)

---

## Game Mechanics

### 1. Level-Up Thresholds
Level is derived mathematically from the current XP:
- `xp_for_level(n) = 50 * (n - 1) * n`
- Level is determined by finding the largest integer $n$ such that `xp_for_level(n) <= XP`.

### 2. Title progression
Ranks/titles are mapped based on level thresholds:
- Level $\ge 30$: **Monarch**
- Level $\ge 20$: **Sovereign**
- Level $\ge 15$: **Shadow**
- Level $\ge 10$: **Hunter**
- Level $\ge 6$: **Adept**
- Level $\ge 3$: **Apprentice**
- Level $\ge 1$: **Initiate**

### 3. Streak rules
- Checked-in today: Keep current streak.
- Checked-in yesterday: Increment streak by 1.
- Checked-in before yesterday: Reset streak to 1.
- Streak milestones ($3, 7, 14, 30, 50, 100$) trigger notifications and circle activities.

### 4. Achievements
Automatically checks and unlocks:
- `first_checkin`: 1+ total check-ins or XP > 0.
- `streak_3`: Streak $\ge 3$.
- `streak_7`: Streak $\ge 7$.
- `streak_30`: Streak $\ge 30$.
- `level_5`: Level $\ge 5$.
- `level_10`: Level $\ge 10$.
- `xp_1000`: XP $\ge 1000$.
- `circle_join`: Joined at least one circle.
