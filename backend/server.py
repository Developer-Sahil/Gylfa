"""Gylfa - Social Accountability Platform Backend."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import bcrypt
import jwt
import logging
import secrets
import asyncio
import resend
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta, date as dt_date
from typing import List, Optional, Literal, Dict, Any

import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

# ---------- Config ----------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_DAYS = 7
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@gylfa.app")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
DEMO_EMAIL = os.environ.get("DEMO_EMAIL", "demo@gylfa.app")
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "demo123")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
EMAIL_FROM = os.environ.get("EMAIL_FROM", "Gylfa <onboarding@resend.dev>")
DIGEST_ENABLED = os.environ.get("DIGEST_ENABLED", "true").lower() == "true"
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("gylfa")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ---------- Email Helper ----------
async def send_email(to: str, subject: str, html: str):
    """Send transactional email via Resend, fall back to console mock when key empty."""
    if not RESEND_API_KEY:
        logger.info(f"[EMAIL-MOCK] to={to} subject={subject}\n{html}")
        return {"id": "mock", "mocked": True}
    resend.api_key = RESEND_API_KEY
    try:
        result = await asyncio.to_thread(
            resend.Emails.send,
            {"from": EMAIL_FROM, "to": [to], "subject": subject, "html": html},
        )
        return result
    except Exception as e:
        logger.error(f"Resend failed: {e}")
        logger.info(f"[EMAIL-MOCK-FALLBACK] to={to} subject={subject}\n{html}")
        return {"id": "mock-fallback", "mocked": True, "error": str(e)}

# ---------- Auth Helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_jwt(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRES_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=JWT_EXPIRES_DAYS * 24 * 3600,
        path="/",
    )

def clear_auth_cookie(response: Response):
    response.delete_cookie("access_token", path="/")

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_jwt(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"_id": payload["sub"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user.pop("password_hash", None)
    return user

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user

# ---------- Game Mechanics ----------
TITLE_THRESHOLDS = [
    (30, "Monarch"),
    (20, "Sovereign"),
    (15, "Shadow"),
    (10, "Hunter"),
    (6, "Adept"),
    (3, "Apprentice"),
    (1, "Initiate"),
]
STREAK_MILESTONES = {3, 7, 14, 30, 50, 100}

def xp_for_level(n: int) -> int:
    return 50 * (n - 1) * n

def level_for_xp(xp: int) -> int:
    n = 1
    while xp_for_level(n + 1) <= xp:
        n += 1
    return n

def title_for_level(level: int) -> str:
    for threshold, title in TITLE_THRESHOLDS:
        if level >= threshold:
            return title
    return "Initiate"

ACHIEVEMENT_DEFS = [
    {"id": "first_checkin", "title": "First Step", "description": "Complete your first check-in", "icon": "footprints"},
    {"id": "streak_3", "title": "Three in a Row", "description": "Hold a 3-day streak", "icon": "flame"},
    {"id": "streak_7", "title": "Week Warrior", "description": "Hold a 7-day streak", "icon": "flame"},
    {"id": "streak_30", "title": "Iron Will", "description": "Hold a 30-day streak", "icon": "shield"},
    {"id": "level_5", "title": "Awakened", "description": "Reach Level 5", "icon": "sparkles"},
    {"id": "level_10", "title": "Hunter Class", "description": "Reach Level 10", "icon": "swords"},
    {"id": "xp_1000", "title": "Grinder", "description": "Earn 1,000 XP", "icon": "trophy"},
    {"id": "circle_join", "title": "In the Pack", "description": "Join a circle", "icon": "users"},
]

def check_achievements(user: dict) -> List[str]:
    earned = set(user.get("achievements", []))
    new_unlocked = []
    rules = {
        "first_checkin": (user.get("total_checkins", 0) >= 1) or (user.get("xp", 0) > 0),
        "streak_3": user.get("longest_streak", user.get("streak", 0)) >= 3,
        "streak_7": user.get("longest_streak", user.get("streak", 0)) >= 7,
        "streak_30": user.get("longest_streak", user.get("streak", 0)) >= 30,
        "level_5": user.get("level", 1) >= 5,
        "level_10": user.get("level", 1) >= 10,
        "xp_1000": user.get("xp", 0) >= 1000,
        "circle_join": len(user.get("circles", [])) > 0,
    }
    for ach_id, ok in rules.items():
        if ok and ach_id not in earned:
            new_unlocked.append(ach_id)
    return new_unlocked

# ---------- Models ----------
class RegisterReq(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)

class LoginReq(BaseModel):
    email: EmailStr
    password: str

class GoogleSessionReq(BaseModel):
    session_id: str

class ForgotPasswordReq(BaseModel):
    email: EmailStr

class ResetPasswordReq(BaseModel):
    token: str
    password: str = Field(min_length=6)

class GoalCreate(BaseModel):
    title: str
    description: str = ""
    frequency: Literal["daily", "weekly"] = "daily"
    xp_reward: int = 30
    icon: str = "target"

class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    frequency: Optional[Literal["daily", "weekly"]] = None
    xp_reward: Optional[int] = None
    icon: Optional[str] = None

class CheckinCreate(BaseModel):
    goal_id: str
    note: str = ""

class CircleCreate(BaseModel):
    name: str
    description: str = ""
    emoji: str = "⚔️"

class CircleJoinReq(BaseModel):
    invite_code: str

# ---------- Utilities ----------
def today_iso() -> str:
    return datetime.now(timezone.utc).date().isoformat()

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def safe_user(u: dict) -> dict:
    u = dict(u)
    u.pop("password_hash", None)
    u["id"] = u.get("_id")
    u.pop("_id", None)
    return u

def gen_invite_code() -> str:
    return secrets.token_hex(4).upper()

# ---------- App init ----------
api = APIRouter(prefix="/api")

scheduler: Optional[AsyncIOScheduler] = None

# ---------- Seeding ----------
async def seed_data():
    """Idempotent seeding of admin, demo user, companions, circle, goals."""
    # Admin
    admin = await db.users.find_one({"email": ADMIN_EMAIL})
    if not admin:
        await db.users.insert_one({
            "_id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "name": "Gylfa Admin",
            "password_hash": hash_password(ADMIN_PASSWORD),
            "avatar": "GA",
            "xp": 0,
            "level": 1,
            "streak": 0,
            "longest_streak": 0,
            "title": "Initiate",
            "circles": [],
            "achievements": [],
            "last_checkin_date": None,
            "total_checkins": 0,
            "auth_provider": "password",
            "role": "admin",
            "created_at": now_iso(),
        })
    elif not verify_password(ADMIN_PASSWORD, admin["password_hash"]):
        await db.users.update_one({"_id": admin["_id"]}, {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})

    # Demo user (Aria Shadow)
    demo = await db.users.find_one({"email": DEMO_EMAIL})
    today = today_iso()
    if not demo:
        demo_id = str(uuid.uuid4())
        await db.users.insert_one({
            "_id": demo_id,
            "email": DEMO_EMAIL,
            "name": "Aria Shadow",
            "password_hash": hash_password(DEMO_PASSWORD),
            "avatar": "AS",
            "xp": 2840,
            "level": level_for_xp(2840),
            "streak": 12,
            "longest_streak": 14,
            "title": title_for_level(level_for_xp(2840)),
            "circles": [],
            "achievements": ["first_checkin", "streak_3", "streak_7", "level_5", "xp_1000"],
            "last_checkin_date": today,
            "total_checkins": 38,
            "auth_provider": "password",
            "role": "user",
            "created_at": now_iso(),
        })
        demo = await db.users.find_one({"_id": demo_id})
    else:
        if not verify_password(DEMO_PASSWORD, demo["password_hash"]):
            await db.users.update_one({"_id": demo["_id"]}, {"$set": {"password_hash": hash_password(DEMO_PASSWORD)}})
        await db.users.update_one({"_id": demo["_id"]}, {"$set": {"last_checkin_date": today}})

    # Companions
    companions = [
        {"email": "kai@gylfa.app", "name": "Kai Mercer", "avatar": "KM", "xp": 3920, "streak": 18, "longest_streak": 21},
        {"email": "lyra@gylfa.app", "name": "Lyra Voss", "avatar": "LV", "xp": 2110, "streak": 7, "longest_streak": 9},
        {"email": "renji@gylfa.app", "name": "Renji Tao", "avatar": "RT", "xp": 1640, "streak": 4, "longest_streak": 11},
        {"email": "mira@gylfa.app", "name": "Mira Quinn", "avatar": "MQ", "xp": 980, "streak": 9, "longest_streak": 9},
    ]
    companion_ids = []
    for c in companions:
        existing = await db.users.find_one({"email": c["email"]})
        if not existing:
            cid = str(uuid.uuid4())
            lvl = level_for_xp(c["xp"])
            await db.users.insert_one({
                "_id": cid,
                "email": c["email"],
                "name": c["name"],
                "password_hash": hash_password("companion123"),
                "avatar": c["avatar"],
                "xp": c["xp"],
                "level": lvl,
                "streak": c["streak"],
                "longest_streak": c["longest_streak"],
                "title": title_for_level(lvl),
                "circles": [],
                "achievements": [],
                "last_checkin_date": today,
                "total_checkins": 30,
                "auth_provider": "password",
                "role": "user",
                "created_at": now_iso(),
            })
            companion_ids.append(cid)
        else:
            companion_ids.append(existing["_id"])

    # Circle "Shadow Guild" with invite SHADOW01
    circle = await db.circles.find_one({"invite_code": "SHADOW01"})
    member_ids = [demo["_id"]] + companion_ids
    if not circle:
        circle_id = str(uuid.uuid4())
        await db.circles.insert_one({
            "_id": circle_id,
            "name": "Shadow Guild",
            "description": "An elite circle of nocturnal hunters.",
            "emoji": "⚔️",
            "invite_code": "SHADOW01",
            "owner_id": demo["_id"],
            "member_ids": member_ids,
            "created_at": now_iso(),
        })
        # update users circles
        await db.users.update_many({"_id": {"$in": member_ids}}, {"$addToSet": {"circles": circle_id}})
    else:
        circle_id = circle["_id"]
        await db.circles.update_one({"_id": circle_id}, {"$set": {"member_ids": member_ids}})
        await db.users.update_many({"_id": {"$in": member_ids}}, {"$addToSet": {"circles": circle_id}})

    # Demo goals for Aria
    existing_goals = await db.goals.count_documents({"user_id": demo["_id"]})
    yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    if existing_goals == 0:
        seed_goals = [
            {"title": "Morning workout", "description": "30-min strength + mobility", "frequency": "daily", "xp_reward": 60, "icon": "dumbbell", "last": today},
            {"title": "Deep work block", "description": "90 minutes of focused work", "frequency": "daily", "xp_reward": 80, "icon": "brain", "last": today},
            {"title": "Read 20 pages", "description": "Non-fiction or fiction", "frequency": "daily", "xp_reward": 40, "icon": "book-open", "last": yesterday},
            {"title": "Cold shower", "description": "3 minutes minimum", "frequency": "daily", "xp_reward": 30, "icon": "droplets", "last": yesterday},
            {"title": "Weekly review", "description": "Sunday journal + plan", "frequency": "weekly", "xp_reward": 120, "icon": "calendar-check", "last": yesterday},
        ]
        for g in seed_goals:
            await db.goals.insert_one({
                "_id": str(uuid.uuid4()),
                "user_id": demo["_id"],
                "title": g["title"],
                "description": g["description"],
                "frequency": g["frequency"],
                "xp_reward": g["xp_reward"],
                "icon": g["icon"],
                "total_completions": 5,
                "last_completed_date": g["last"],
                "created_at": now_iso(),
            })

    # Historical check-ins (10)
    existing_checkins = await db.checkins.count_documents({"user_id": demo["_id"]})
    if existing_checkins == 0:
        aria_goals = await db.goals.find({"user_id": demo["_id"]}).to_list(50)
        for i in range(10):
            d = (datetime.now(timezone.utc).date() - timedelta(days=i)).isoformat()
            g = aria_goals[i % len(aria_goals)]
            await db.checkins.insert_one({
                "_id": str(uuid.uuid4()),
                "user_id": demo["_id"],
                "goal_id": g["_id"],
                "goal_title": g["title"],
                "xp_earned": g["xp_reward"],
                "date": d,
                "note": "",
                "created_at": (datetime.now(timezone.utc) - timedelta(days=i)).isoformat(),
            })

    # Seed activities (7)
    existing_acts = await db.activities.count_documents({"circle_id": circle_id})
    if existing_acts == 0:
        seed_acts = [
            (demo["_id"], "Aria Shadow", "checkin", "completed Deep work block (+80 XP)"),
            (companion_ids[0], "Kai Mercer", "checkin", "completed Morning workout (+60 XP)"),
            (companion_ids[1], "Lyra Voss", "level_up", "reached Level 7"),
            (demo["_id"], "Aria Shadow", "streak", "hit a 12-day streak"),
            (companion_ids[2], "Renji Tao", "checkin", "completed Read 20 pages (+40 XP)"),
            (companion_ids[3], "Mira Quinn", "checkin", "completed Cold shower (+30 XP)"),
            (companion_ids[0], "Kai Mercer", "streak", "hit an 18-day streak"),
        ]
        for i, (uid, uname, atype, msg) in enumerate(seed_acts):
            await db.activities.insert_one({
                "_id": str(uuid.uuid4()),
                "circle_id": circle_id,
                "user_id": uid,
                "user_name": uname,
                "type": atype,
                "message": msg,
                "created_at": (datetime.now(timezone.utc) - timedelta(hours=i * 3)).isoformat(),
            })

    # Write test credentials
    creds_path = Path("/app/memory/test_credentials.md")
    creds_path.parent.mkdir(parents=True, exist_ok=True)
    creds_path.write_text(
        "# Gylfa Test Credentials\n\n"
        f"## Admin\n- email: `{ADMIN_EMAIL}`\n- password: `{ADMIN_PASSWORD}`\n- role: admin\n\n"
        f"## Demo User (Aria Shadow)\n- email: `{DEMO_EMAIL}`\n- password: `{DEMO_PASSWORD}`\n- role: user\n- XP: 2840 (Lv.8 Adept), streak 12, longest 14\n\n"
        "## Companions (password: `companion123`)\n"
        "- kai@gylfa.app — Kai Mercer\n- lyra@gylfa.app — Lyra Voss\n- renji@gylfa.app — Renji Tao\n- mira@gylfa.app — Mira Quinn\n\n"
        "## Circle\n- name: Shadow Guild\n- invite_code: `SHADOW01`\n\n"
        "## Auth endpoints\n"
        "- POST /api/auth/register\n- POST /api/auth/login\n- POST /api/auth/logout\n- GET /api/auth/me\n"
        "- POST /api/auth/google/session\n- POST /api/auth/forgot-password\n- POST /api/auth/reset-password\n"
    )
    logger.info("Seeding complete.")

async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.circles.create_index("invite_code", unique=True)
    await db.password_reset_tokens.create_index("token", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.activities.create_index([("circle_id", 1), ("created_at", -1)])
    await db.checkins.create_index([("user_id", 1), ("date", -1)])

# ---------- Weekly Digest ----------
async def run_weekly_digest():
    if not DIGEST_ENABLED:
        return {"sent": 0, "skipped": True}
    logger.info("Running weekly digest...")
    sent = 0
    circles = await db.circles.find().to_list(1000)
    for c in circles:
        members = await db.users.find({"_id": {"$in": c["member_ids"]}}).to_list(1000)
        top5 = sorted(members, key=lambda u: u.get("xp", 0), reverse=True)[:5]
        survivors = [u for u in members if u.get("streak", 0) >= 7]
        leaderboard_html = "".join(
            f"<li><strong>{i+1}.</strong> {u['name']} — {u['xp']} XP (Lv.{u['level']})</li>"
            for i, u in enumerate(top5)
        )
        survivors_html = ", ".join(f"{u['name']} ({u['streak']}d)" for u in survivors) or "none"
        body = (
            f"<h2>Weekly Digest — {c['name']}</h2>"
            f"<h3>Top 5</h3><ol>{leaderboard_html}</ol>"
            f"<h3>Streak survivors (7+ days)</h3><p>{survivors_html}</p>"
        )
        for u in members:
            await db.notifications.insert_one({
                "_id": str(uuid.uuid4()),
                "user_id": u["_id"],
                "type": "weekly_digest",
                "title": f"Weekly digest — {c['name']}",
                "body": f"Top: {top5[0]['name'] if top5 else 'n/a'} • Streaks: {len(survivors)} survivors",
                "meta": {"circle_id": c["_id"]},
                "read": False,
                "created_at": now_iso(),
            })
            await send_email(u["email"], f"Gylfa weekly digest — {c['name']}", body)
            sent += 1
    return {"sent": sent, "skipped": False}

@asynccontextmanager
async def lifespan(app: FastAPI):
    global scheduler
    await ensure_indexes()
    await seed_data()
    if DIGEST_ENABLED:
        scheduler = AsyncIOScheduler(timezone="UTC")
        scheduler.add_job(run_weekly_digest, CronTrigger(day_of_week="mon", hour=9, minute=0, timezone="UTC"))
        scheduler.start()
        logger.info("Scheduler started.")
    yield
    if scheduler:
        scheduler.shutdown(wait=False)
    client.close()

app = FastAPI(lifespan=lifespan, title="Gylfa API")

# ---------- Routes: Auth ----------
@api.post("/auth/register")
async def register(payload: RegisterReq, response: Response):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = str(uuid.uuid4())
    initials = "".join([p[0] for p in payload.name.split()[:2]]).upper() or "U"
    user = {
        "_id": uid,
        "email": email,
        "name": payload.name,
        "password_hash": hash_password(payload.password),
        "avatar": initials,
        "xp": 0,
        "level": 1,
        "streak": 0,
        "longest_streak": 0,
        "title": "Initiate",
        "circles": [],
        "achievements": [],
        "last_checkin_date": None,
        "total_checkins": 0,
        "auth_provider": "password",
        "role": "user",
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    token = create_jwt(uid, email)
    set_auth_cookie(response, token)
    return {"token": token, "user": safe_user(user)}

@api.post("/auth/login")
async def login(payload: LoginReq, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_jwt(user["_id"], email)
    set_auth_cookie(response, token)
    return {"token": token, "user": safe_user(user)}

@api.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    clear_auth_cookie(response)
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return safe_user(user)

@api.post("/auth/google/session")
async def google_session(payload: GoogleSessionReq, response: Response):
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH.
    try:
        async with httpx.AsyncClient(timeout=10.0) as hc:
            r = await hc.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": payload.session_id},
            )
            if r.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid OAuth session")
            data = r.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"OAuth provider error: {e}")

    email = (data.get("email") or "").lower()
    name = data.get("name") or "Gylfa Hunter"
    picture = data.get("picture")
    if not email:
        raise HTTPException(status_code=400, detail="OAuth response missing email")

    user = await db.users.find_one({"email": email})
    if not user:
        uid = str(uuid.uuid4())
        initials = "".join([p[0] for p in name.split()[:2]]).upper() or "U"
        user = {
            "_id": uid,
            "email": email,
            "name": name,
            "password_hash": hash_password(secrets.token_urlsafe(32)),
            "avatar": picture or initials,
            "xp": 0,
            "level": 1,
            "streak": 0,
            "longest_streak": 0,
            "title": "Initiate",
            "circles": [],
            "achievements": [],
            "last_checkin_date": None,
            "total_checkins": 0,
            "auth_provider": "google",
            "role": "user",
            "created_at": now_iso(),
        }
        await db.users.insert_one(user)
    token = create_jwt(user["_id"], email)
    set_auth_cookie(response, token)
    return {"token": token, "user": safe_user(user)}

@api.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordReq):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    # Always return success to avoid user enumeration
    if user:
        token = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.password_reset_tokens.insert_one({
            "_id": str(uuid.uuid4()),
            "token": token,
            "user_id": user["_id"],
            "used": False,
            "expires_at": expires,
            "created_at": now_iso(),
        })
        reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
        html = (
            f"<p>Hi {user['name']},</p>"
            f"<p>Reset your Gylfa password using the link below (valid for 1 hour):</p>"
            f'<p><a href="{reset_link}">{reset_link}</a></p>'
        )
        await send_email(email, "Gylfa — reset your password", html)
    return {"ok": True}

@api.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordReq):
    rec = await db.password_reset_tokens.find_one({"token": payload.token})
    if not rec or rec.get("used"):
        raise HTTPException(status_code=400, detail="Invalid or used token")
    exp = rec["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expired")
    await db.users.update_one({"_id": rec["user_id"]}, {"$set": {"password_hash": hash_password(payload.password)}})
    await db.password_reset_tokens.update_one({"_id": rec["_id"]}, {"$set": {"used": True}})
    return {"ok": True}

# ---------- Routes: Goals ----------
@api.get("/goals")
async def list_goals(user: dict = Depends(get_current_user)):
    goals = await db.goals.find({"user_id": user["_id"]}).to_list(500)
    for g in goals:
        g["id"] = g.pop("_id")
    return goals

@api.post("/goals")
async def create_goal(payload: GoalCreate, user: dict = Depends(get_current_user)):
    goal = {
        "_id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "title": payload.title,
        "description": payload.description,
        "frequency": payload.frequency,
        "xp_reward": payload.xp_reward,
        "icon": payload.icon,
        "total_completions": 0,
        "last_completed_date": None,
        "created_at": now_iso(),
    }
    await db.goals.insert_one(goal)
    goal["id"] = goal.pop("_id")
    return goal

@api.patch("/goals/{goal_id}")
async def update_goal(goal_id: str, payload: GoalUpdate, user: dict = Depends(get_current_user)):
    goal = await db.goals.find_one({"_id": goal_id, "user_id": user["_id"]})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await db.goals.update_one({"_id": goal_id}, {"$set": updates})
    updated = await db.goals.find_one({"_id": goal_id})
    updated["id"] = updated.pop("_id")
    return updated

@api.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, user: dict = Depends(get_current_user)):
    res = await db.goals.delete_one({"_id": goal_id, "user_id": user["_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"ok": True}

# ---------- Routes: Checkins ----------
@api.get("/checkins")
async def list_checkins(user: dict = Depends(get_current_user), days: int = 30):
    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=days)).isoformat()
    checkins = await db.checkins.find({"user_id": user["_id"], "date": {"$gte": cutoff}}).sort("created_at", -1).to_list(500)
    for c in checkins:
        c["id"] = c.pop("_id")
    return checkins

@api.post("/checkins")
async def create_checkin(payload: CheckinCreate, user: dict = Depends(get_current_user)):
    goal = await db.goals.find_one({"_id": payload.goal_id, "user_id": user["_id"]})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    today = today_iso()
    existing = await db.checkins.find_one({"user_id": user["_id"], "goal_id": payload.goal_id, "date": today})
    if existing:
        raise HTTPException(status_code=400, detail="Already checked in for this goal today")

    xp_earned = goal["xp_reward"]
    prev_level = user.get("level", 1)
    new_xp = user.get("xp", 0) + xp_earned
    new_level = level_for_xp(new_xp)
    new_title = title_for_level(new_level)

    # streak
    last = user.get("last_checkin_date")
    streak = user.get("streak", 0)
    yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    if last == today:
        pass  # already today, keep streak
    elif last == yesterday:
        streak += 1
    else:
        streak = 1
    longest = max(user.get("longest_streak", 0), streak)

    total_checkins = user.get("total_checkins", 0) + 1
    updated_user_fields = {
        "xp": new_xp,
        "level": new_level,
        "title": new_title,
        "streak": streak,
        "longest_streak": longest,
        "last_checkin_date": today,
        "total_checkins": total_checkins,
    }
    # achievements
    test_user = {**user, **updated_user_fields}
    newly = check_achievements(test_user)
    if newly:
        updated_user_fields["achievements"] = list(set(user.get("achievements", []) + newly))

    await db.users.update_one({"_id": user["_id"]}, {"$set": updated_user_fields})
    await db.goals.update_one(
        {"_id": payload.goal_id},
        {"$set": {"last_completed_date": today}, "$inc": {"total_completions": 1}},
    )
    checkin_doc = {
        "_id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "goal_id": payload.goal_id,
        "goal_title": goal["title"],
        "xp_earned": xp_earned,
        "date": today,
        "note": payload.note,
        "created_at": now_iso(),
    }
    await db.checkins.insert_one(checkin_doc)

    # activities to circles
    for cid in user.get("circles", []):
        await db.activities.insert_one({
            "_id": str(uuid.uuid4()),
            "circle_id": cid,
            "user_id": user["_id"],
            "user_name": user["name"],
            "type": "checkin",
            "message": f"completed {goal['title']} (+{xp_earned} XP)",
            "created_at": now_iso(),
        })

    notifications_created = []
    if new_level > prev_level:
        notif = {
            "_id": str(uuid.uuid4()),
            "user_id": user["_id"],
            "type": "level_up",
            "title": f"Level up — Lv.{new_level} {new_title}",
            "body": f"You reached Level {new_level}. Title: {new_title}.",
            "meta": {"level": new_level, "title": new_title},
            "read": False,
            "created_at": now_iso(),
        }
        await db.notifications.insert_one(notif)
        notifications_created.append("level_up")
        for cid in user.get("circles", []):
            await db.activities.insert_one({
                "_id": str(uuid.uuid4()),
                "circle_id": cid,
                "user_id": user["_id"],
                "user_name": user["name"],
                "type": "level_up",
                "message": f"reached Level {new_level} ({new_title})",
                "created_at": now_iso(),
            })

    if streak in STREAK_MILESTONES and streak != user.get("streak", 0):
        notif = {
            "_id": str(uuid.uuid4()),
            "user_id": user["_id"],
            "type": "streak_milestone",
            "title": f"{streak}-day streak",
            "body": f"You hit a {streak}-day streak. Keep going.",
            "meta": {"streak": streak},
            "read": False,
            "created_at": now_iso(),
        }
        await db.notifications.insert_one(notif)
        notifications_created.append("streak_milestone")
        for cid in user.get("circles", []):
            await db.activities.insert_one({
                "_id": str(uuid.uuid4()),
                "circle_id": cid,
                "user_id": user["_id"],
                "user_name": user["name"],
                "type": "streak",
                "message": f"hit a {streak}-day streak",
                "created_at": now_iso(),
            })

    checkin_doc["id"] = checkin_doc.pop("_id")
    updated_user = await db.users.find_one({"_id": user["_id"]})
    return {
        "checkin": checkin_doc,
        "user": safe_user(updated_user),
        "xp_earned": xp_earned,
        "leveled_up": new_level > prev_level,
        "new_achievements": newly,
        "notifications": notifications_created,
    }

# ---------- Routes: Circles ----------
async def serialize_circle(c: dict) -> dict:
    members = await db.users.find({"_id": {"$in": c["member_ids"]}}).to_list(500)
    member_list = [
        {"id": m["_id"], "name": m["name"], "avatar": m.get("avatar"), "xp": m.get("xp", 0),
         "level": m.get("level", 1), "title": m.get("title", "Initiate"), "streak": m.get("streak", 0)}
        for m in members
    ]
    return {
        "id": c["_id"],
        "name": c["name"],
        "description": c.get("description", ""),
        "emoji": c.get("emoji", "⚔️"),
        "invite_code": c["invite_code"],
        "owner_id": c["owner_id"],
        "member_ids": c["member_ids"],
        "members": member_list,
        "created_at": c.get("created_at"),
    }

@api.get("/circles")
async def list_circles(user: dict = Depends(get_current_user)):
    circles = await db.circles.find({"member_ids": user["_id"]}).to_list(100)
    return [await serialize_circle(c) for c in circles]

@api.post("/circles")
async def create_circle(payload: CircleCreate, user: dict = Depends(get_current_user)):
    code = gen_invite_code()
    while await db.circles.find_one({"invite_code": code}):
        code = gen_invite_code()
    cid = str(uuid.uuid4())
    circle = {
        "_id": cid,
        "name": payload.name,
        "description": payload.description,
        "emoji": payload.emoji,
        "invite_code": code,
        "owner_id": user["_id"],
        "member_ids": [user["_id"]],
        "created_at": now_iso(),
    }
    await db.circles.insert_one(circle)
    await db.users.update_one({"_id": user["_id"]}, {"$addToSet": {"circles": cid}})
    # achievement check
    refreshed = await db.users.find_one({"_id": user["_id"]})
    newly = check_achievements(refreshed)
    if newly:
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"achievements": list(set(refreshed.get("achievements", []) + newly))}})
    return await serialize_circle(circle)

@api.post("/circles/join")
async def join_circle(payload: CircleJoinReq, user: dict = Depends(get_current_user)):
    code = payload.invite_code.strip().upper()
    circle = await db.circles.find_one({"invite_code": code})
    if not circle:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    if user["_id"] in circle["member_ids"]:
        return await serialize_circle(circle)
    await db.circles.update_one({"_id": circle["_id"]}, {"$addToSet": {"member_ids": user["_id"]}})
    await db.users.update_one({"_id": user["_id"]}, {"$addToSet": {"circles": circle["_id"]}})
    await db.activities.insert_one({
        "_id": str(uuid.uuid4()),
        "circle_id": circle["_id"],
        "user_id": user["_id"],
        "user_name": user["name"],
        "type": "join",
        "message": "joined the circle",
        "created_at": now_iso(),
    })
    refreshed = await db.users.find_one({"_id": user["_id"]})
    newly = check_achievements(refreshed)
    if newly:
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"achievements": list(set(refreshed.get("achievements", []) + newly))}})
    circle = await db.circles.find_one({"_id": circle["_id"]})
    return await serialize_circle(circle)

@api.get("/circles/{circle_id}")
async def get_circle(circle_id: str, user: dict = Depends(get_current_user)):
    circle = await db.circles.find_one({"_id": circle_id})
    if not circle:
        raise HTTPException(status_code=404, detail="Circle not found")
    if user["_id"] not in circle["member_ids"]:
        raise HTTPException(status_code=403, detail="Not a member")
    payload = await serialize_circle(circle)
    activities = await db.activities.find({"circle_id": circle_id}).sort("created_at", -1).to_list(50)
    for a in activities:
        a["id"] = a.pop("_id")
    payload["activities"] = activities
    # 4-stat grid
    member_xp = sum(m["xp"] for m in payload["members"])
    member_checkins = await db.checkins.count_documents({"user_id": {"$in": circle["member_ids"]}})
    avg_streak = round(sum(m["streak"] for m in payload["members"]) / max(len(payload["members"]), 1), 1)
    payload["stats"] = {
        "members": len(payload["members"]),
        "total_xp": member_xp,
        "total_checkins": member_checkins,
        "avg_streak": avg_streak,
    }
    payload["leaderboard"] = sorted(payload["members"], key=lambda m: m["xp"], reverse=True)
    return payload

# ---------- Routes: Achievements ----------
@api.get("/achievements")
async def list_achievements(user: dict = Depends(get_current_user)):
    earned = set(user.get("achievements", []))
    return [{**a, "unlocked": a["id"] in earned} for a in ACHIEVEMENT_DEFS]

# ---------- Routes: Notifications ----------
@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    notifs = await db.notifications.find({"user_id": user["_id"]}).sort("created_at", -1).to_list(100)
    for n in notifs:
        n["id"] = n.pop("_id")
    unread = sum(1 for n in notifs if not n.get("read"))
    return {"items": notifs, "unread": unread}

@api.post("/notifications/mark-all-read")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["_id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}

@api.patch("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, user: dict = Depends(get_current_user)):
    res = await db.notifications.update_one(
        {"_id": notif_id, "user_id": user["_id"]},
        {"$set": {"read": True}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}

# ---------- Routes: Admin ----------
@api.post("/admin/send-digest")
async def admin_send_digest(admin: dict = Depends(require_admin)):
    res = await run_weekly_digest()
    return res

@api.get("/")
async def root():
    return {"app": "gylfa", "ok": True}

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
