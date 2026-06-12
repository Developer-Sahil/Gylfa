# Gylfa — Product Requirements Document

## Original Problem Statement
Build Gylfa: a responsive full-stack social accountability platform. Users create or join private circles where members set personal goals, track daily progress, earn XP, maintain streaks, and stay accountable through visibility and competition.

## Stack
- Frontend: React (CRA) + Tailwind + shadcn/ui + framer-motion + recharts + lucide-react + sonner toasts
- Backend: FastAPI (single `server.py`) with lifespan ctx manager + APScheduler
- DB: MongoDB (motor async)
- Auth: JWT custom (bcrypt + httpOnly cookies + Bearer fallback) + Emergent Google OAuth
- Email: Resend with `[EMAIL-MOCK]` console fallback when `RESEND_API_KEY` is empty

## Design System
- Dark: bg #050505, surface #0e0e10, glass `rgba(255,255,255,0.04)` blur-xl border-white/10
- Accent: acid green #BAFB00 / hover #A3E635 — XP/streaks/levels/CTAs only
- Fonts: Outfit (display, 800), IBM Plex Sans (body), JetBrains Mono (labels)
- No purple/violet, no gradients, lucide-react icons only
- Custom SVG XP ring with neon drop-shadow + ring stroke transition
- Pill-shaped accent buttons, glass cards, animate-fade-up entrance

## What's Implemented (2026-02-12)
- ✅ Backend: full API (auth, goals, checkins, circles, achievements, notifications, admin digest)
- ✅ JWT auth + bcrypt + Google OAuth via Emergent (with synchronous fragment detection)
- ✅ Game mechanics (xp_for_level, titles, streaks, achievements, milestones)
- ✅ Email helper with `[EMAIL-MOCK]` fallback
- ✅ Resend integration ready (RESEND_API_KEY empty → mock)
- ✅ APScheduler weekly digest (Monday 09:00 UTC) + admin manual trigger
- ✅ Seed: admin, demo user (Aria Shadow), 4 companions, Shadow Guild circle (SHADOW01), 5 goals, 10 check-ins, 7 activities
- ✅ Frontend pages: Landing, Login, Signup, Forgot/Reset password, Dashboard, Goals (CRUD), Circles (list/create/join), CircleDetail (leaderboard + activity), Profile (XP chart + achievements)
- ✅ AppLayout with sidebar + notifications bell + mobile drawer
- ✅ All interactive elements have `data-testid`

## Personas
- **Demo user (Aria Shadow)**: 2,840 XP (Lv.8 Adept), 12-day streak, longest 14
- **Companions**: Kai Mercer (3,920/18d), Lyra Voss (2,110/7d), Renji Tao (1,640/4d), Mira Quinn (980/9d)
- **Circle**: Shadow Guild (⚔️) — invite `SHADOW01`

## Acceptance Tested
Landing → demo login → dashboard check-in (XP/level/streak + toast) → goals CRUD → circle leaderboard + activity → profile XP chart + achievements → notifications bell with unread badge → forgot/reset password flow → logout returns to /.

## Backlog (P1 / P2)
- P1: Real-time circle activity via WebSocket
- P1: Circle member roles + admin moderation
- P2: Customizable achievement set, public profile pages, leaderboard filters (week/month)
- P2: Slack/Discord webhooks for digest delivery
- P2: i18n + dark/light light mode toggle (currently dark-only by design)

## Env Reference
backend/.env keys: MONGO_URL, DB_NAME, CORS_ORIGINS, JWT_SECRET, FRONTEND_URL, ADMIN_EMAIL/PASSWORD, DEMO_EMAIL/PASSWORD, RESEND_API_KEY (empty=mock), EMAIL_FROM, DIGEST_ENABLED
