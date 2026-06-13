# Architecture Documentation

Gylfa is a social accountability platform structured as a full-stack application with a FastAPI backend and a React (CRA + CRACO) frontend.

## System Architecture Overview

```
+----------------------------------------------------------------+
|                        React Frontend                          |
|  - App Layout: fixed sidebar, dashboard, circles, goals       |
|  - Theme: Dark (#050505 bg, #0e0e10 surface, #BAFB00 accent)   |
|  - Auth contexts & Axios api clients                           |
+------------------------------------+---------------------------+
                                     |
                                     | (JSON REST APIs + Cookies/JWT)
                                     v
+----------------------------------------------------------------+
|                        FastAPI Backend                         |
|  - Authentication: JWT in httpOnly cookie + Bearer token       |
|  - Scheduler: Weekly Digest (APScheduler)                      |
|  - Seeding: Idempotent user/circle/goals/check-in seeding      |
+------------------------------------+---------------------------+
                                     |
                                     | (Async Motor connection)
                                     v
+----------------------------------------------------------------+
|                           MongoDB                              |
|  - Collections: users, circles, goals, checkins, activities,   |
|    notifications, password_reset_tokens                        |
+----------------------------------------------------------------+
```

## Database Schema & Collections

MongoDB is utilized via the motor async driver. The primary collections are:

1. **`users`**:
   - `_id`: String (UUID)
   - `email`: String (Unique index)
   - `name`: String
   - `password_hash`: String (bcrypt)
   - `avatar`: String (Initials or OAuth URL)
   - `xp`: Integer (Current total XP)
   - `level`: Integer (Calculated level based on XP)
   - `streak`: Integer (Current consecutive days checked in)
   - `longest_streak`: Integer (Personal record streak)
   - `title`: String (Gamified rank based on level)
   - `circles`: Array of Strings (Circle IDs user belongs to)
   - `achievements`: Array of Strings (Unlocked achievement IDs)
   - `last_checkin_date`: String (ISO date `YYYY-MM-DD`)
   - `total_checkins`: Integer
   - `auth_provider`: String (`password` or `google`)
   - `role`: String (`user` or `admin`)
   - `created_at`: String (ISO datetime)

2. **`circles`**:
   - `_id`: String (UUID)
   - `name`: String
   - `description`: String
   - `emoji`: String
   - `invite_code`: String (Unique index, e.g. `SHADOW01`)
   - `owner_id`: String (User ID of the creator)
   - `admin_ids`: Array of Strings (User IDs of admins)
   - `member_ids`: Array of Strings (User IDs of members)
   - `created_at`: String (ISO datetime)

3. **`goals`**:
   - `_id`: String (UUID)
   - `user_id`: String (User ID)
   - `title`: String
   - `description`: String
   - `frequency`: String (`daily` or `weekly`)
   - `xp_reward`: Integer
   - `icon`: String (Lucide icon name)
   - `total_completions`: Integer
   - `last_completed_date`: String (ISO date or `null`)
   - `created_at`: String (ISO datetime)

4. **`checkins`**:
   - `_id`: String (UUID)
   - `user_id`: String (User ID)
   - `goal_id`: String (Goal ID)
   - `goal_title`: String
   - `xp_earned`: Integer
   - `date`: String (ISO date `YYYY-MM-DD`)
   - `note`: String
   - `created_at`: String (ISO datetime)

5. **`activities`**:
   - `_id`: String (UUID)
   - `circle_id`: String (Circle ID)
   - `user_id`: String (User ID)
   - `user_name`: String
   - `type`: String (`checkin`, `level_up`, `streak`, `join`, `remove`)
   - `message`: String
   - `created_at`: String (ISO datetime)

6. **`notifications`**:
   - `_id`: String (UUID)
   - `user_id`: String (User ID)
   - `type`: String (`level_up`, `streak_milestone`, `weekly_digest`)
   - `title`: String
   - `body`: String
   - `meta`: Object (Details e.g. `{ level, title }`, `{ streak }`)
   - `read`: Boolean
   - `created_at`: String (ISO datetime)

7. **`password_reset_tokens`**:
   - `_id`: String (UUID)
   - `token`: String (Unique index)
   - `user_id`: String
   - `used`: Boolean
   - `expires_at`: Datetime (TTL index)
   - `created_at`: String (ISO datetime)

---

## Authentication flow

- **Standard Route**: Password hashed using `bcrypt` and compared. Success responds with a JWT token, which is stored in a cookie (`access_token`) with attributes `HttpOnly`, `Secure`, `SameSite=none`.
- **Google OAuth Route**: Integrates via Emergent OAuth exchange. The frontend passes a `session_id` to `POST /api/auth/google/session` which calls a verification backend at `https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data`. If verified, it returns the user email and details, logging the user in or registering them if they do not exist.
- **Header Fallback**: If cookie authorization is not found, the server checks the `Authorization: Bearer <JWT>` header.

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
