# Gylfa — Product Requirements Document

## Original Problem Statement
Build Gylfa: a responsive full-stack social accountability platform. Users create or join private circles where members set personal goals, track daily progress, earn XP, maintain streaks, and stay accountable through visibility and competition.

## Stack
- Frontend: React (CRA) + Tailwind + shadcn/ui + framer-motion + recharts + lucide-react + sonner toasts
- Backend: FastAPI (single `server.py`) with lifespan ctx manager + APScheduler
- DB: MongoDB (motor async)
- Auth: JWT custom (bcrypt + httpOnly cookies + Bearer fallback) + password reset via email
- Email: Resend with `[EMAIL-MOCK]` console fallback when `RESEND_API_KEY` is empty

## Design System
- Dark: bg #050505, surface #0e0e10, glass `rgba(255,255,255,0.04)` blur-xl border-white/10
- Accent: acid green #BAFB00 / hover #A3E635 — XP/streaks/levels/CTAs only
- Fonts: Outfit (display, 800), IBM Plex Sans (body), JetBrains Mono (labels)
- No purple/violet, no gradients, lucide-react icons only
- Custom SVG XP ring with neon drop-shadow + ring stroke transition
- Pill-shaped accent buttons, glass cards, animate-fade-up entrance

## What's Implemented
**2026-02-12 (v1)**
- Full MVP: auth, goals, check-ins, circles, achievements, notifications, weekly digest.

**2026-02-12 (v2 — current)**
- Public profile pages at `/u/:id` (no auth) with 14-day XP chart + unlocked achievements + signup CTA
- Profile page: `Share public profile` copy-link button
- Leaderboard time filters on Circle Detail: All-time · This week · This month (period_xp + period_checkins per row)
- Circle roles: `owner` / `admin` / `member` with role badges
- Member moderation via kebab menu: owner → promote/demote/remove · admin → remove (members only)
- `Invite by email` modal sends invite-code emails via Resend (mocked when key empty)
- Seed: Kai Mercer auto-promoted to admin in Shadow Guild

## Backlog (P1 / P2)
- P1: WebSocket real-time activity feed for circles
- P1: Notification preferences per type (level_up, streak, digest)
- P2: Leaderboard filters at the user level (filter by activity type)
- P2: Discord/Slack digest webhooks
- P2: Email verification + 2FA

## Env Reference
backend/.env keys: MONGO_URL, DB_NAME, CORS_ORIGINS, JWT_SECRET, FRONTEND_URL, ADMIN_EMAIL/PASSWORD, DEMO_EMAIL/PASSWORD, RESEND_API_KEY (empty=mock), EMAIL_FROM, DIGEST_ENABLED
