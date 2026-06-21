"""Gylfa - Social Accountability Platform Backend (Firebase Auth + Firestore)."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import secrets
import asyncio
# pyrefly: ignore [missing-import]
import resend
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import firebase_admin
from firebase_admin import credentials, auth as fb_auth
from google.cloud import firestore
from google.cloud.firestore_v1.async_client import AsyncClient as AsyncFirestoreClient

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
# pyrefly: ignore [missing-import]
from apscheduler.schedulers.asyncio import AsyncIOScheduler
# pyrefly: ignore [missing-import]
from apscheduler.triggers.cron import CronTrigger

# ---------- Config ----------
FIREBASE_SERVICE_ACCOUNT = os.environ.get("FIREBASE_SERVICE_ACCOUNT", str(ROOT_DIR / "firebase-service-account.json"))
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@gylfa.app")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
DEMO_EMAIL = os.environ.get("DEMO_EMAIL", "demo@gylfa.app")
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "demo123")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
EMAIL_FROM = os.environ.get("EMAIL_FROM", "Gylfa <onboarding@resend.dev>")
DIGEST_ENABLED = os.environ.get("DIGEST_ENABLED", "true").lower() == "true"
CORS_ORIGINS = [o.strip().rstrip("/") for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("gylfa")

# ---------- Firebase Admin SDK ----------
_sa_path = Path(FIREBASE_SERVICE_ACCOUNT)
if _sa_path.exists():
    cred = credentials.Certificate(str(_sa_path))
    firebase_admin.initialize_app(cred)
    logger.info(f"Firebase Admin initialized from service account: {_sa_path}")
elif FIREBASE_PROJECT_ID:
    # Application Default Credentials (Cloud Run / GCP environments)
    firebase_admin.initialize_app(options={"projectId": FIREBASE_PROJECT_ID})
    logger.info("Firebase Admin initialized with Application Default Credentials")
else:
    raise RuntimeError(
        "Firebase not configured. Set FIREBASE_SERVICE_ACCOUNT path or FIREBASE_PROJECT_ID env var."
    )

# ---------- Firestore Async Client ----------
db: AsyncFirestoreClient = firestore.AsyncClient()

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
async def get_current_user(request: Request) -> dict:
    """Verify Firebase ID token and fetch user profile from Firestore."""
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        decoded = fb_auth.verify_id_token(token)
    except fb_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    uid = decoded["uid"]
    doc = await db.collection("users").document(uid).get()
    if not doc.exists:
        raise HTTPException(status_code=401, detail="User profile not found")
    user = doc.to_dict()
    user["_id"] = uid
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

# ---------- Pydantic Models ----------
class ProfileUpsertReq(BaseModel):
    """Called by frontend after Firebase sign-up to create/update the Firestore profile."""
    name: str = Field(min_length=1)

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

class CircleInviteReq(BaseModel):
    emails: List[EmailStr] = Field(min_length=1, max_length=30)

# ---------- Utilities ----------
def today_iso() -> str:
    return datetime.now(timezone.utc).date().isoformat()

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def safe_user(u: dict) -> dict:
    u = dict(u)
    uid = u.pop("_id", u.get("id"))
    u["id"] = uid
    u.pop("id", None)
    u["id"] = uid
    return u

def gen_invite_code() -> str:
    return secrets.token_hex(4).upper()

# ---------- Firestore Helpers ----------
async def get_user_doc(uid: str) -> Optional[dict]:
    doc = await db.collection("users").document(uid).get()
    if not doc.exists:
        return None
    u = doc.to_dict()
    u["_id"] = uid
    return u

async def set_user_doc(uid: str, data: dict):
    await db.collection("users").document(uid).set(data, merge=True)

async def find_one(collection: str, field: str, value) -> Optional[dict]:
    """Query Firestore for a single document matching field == value."""
    docs = db.collection(collection).where(field, "==", value).limit(1).stream()
    async for doc in docs:
        result = doc.to_dict()
        result["_id"] = doc.id
        return result
    return None

async def find_many(collection: str, field: str, value, order_by: Optional[str] = None, desc: bool = False, limit: int = 500) -> List[dict]:
    q = db.collection(collection).where(field, "==", value)
    if order_by:
        direction = firestore.Query.DESCENDING if desc else firestore.Query.ASCENDING
        q = q.order_by(order_by, direction=direction)
    q = q.limit(limit)
    results = []
    async for doc in q.stream():
        r = doc.to_dict()
        r["_id"] = doc.id
        results.append(r)
    return results

async def create_doc(collection: str, data: dict, doc_id: Optional[str] = None) -> str:
    """Insert a document; returns the document ID."""
    if doc_id is None:
        doc_id = str(uuid.uuid4())
    await db.collection(collection).document(doc_id).set(data)
    return doc_id

async def update_doc(collection: str, doc_id: str, updates: dict):
    await db.collection(collection).document(doc_id).update(updates)

async def delete_doc(collection: str, doc_id: str):
    await db.collection(collection).document(doc_id).delete()

async def doc_exists(collection: str, doc_id: str) -> bool:
    doc = await db.collection(collection).document(doc_id).get()
    return doc.exists

async def count_docs(collection: str, field: str, value) -> int:
    # Firestore doesn't have a native count; stream and count
    n = 0
    async for _ in db.collection(collection).where(field, "==", value).stream():
        n += 1
    return n

# ---------- Firebase Auth helper: create or get user ----------
async def _firebase_create_or_get_user(email: str, password: str, display_name: str) -> str:
    """Create a Firebase Auth user (idempotent). Returns uid."""
    try:
        fb_user = fb_auth.create_user(email=email, password=password, display_name=display_name)
        return fb_user.uid
    except fb_auth.EmailAlreadyExistsError:
        fb_user = fb_auth.get_user_by_email(email)
        return fb_user.uid

# ---------- App init ----------
api = APIRouter(prefix="/api")
scheduler: Optional[AsyncIOScheduler] = None

# ---------- Seeding ----------
async def seed_data():
    """Idempotent seeding of admin, demo user, companions, circle, goals in Firestore."""
    today = today_iso()

    # Admin
    admin_existing = await find_one("users", "email", ADMIN_EMAIL)
    if not admin_existing:
        admin_uid = await asyncio.to_thread(_firebase_create_or_get_user, ADMIN_EMAIL, ADMIN_PASSWORD, "Gylfa Admin")
        await set_user_doc(admin_uid, {
            "email": ADMIN_EMAIL,
            "name": "Gylfa Admin",
            "avatar": "GA",
            "xp": 0, "level": 1, "streak": 0, "longest_streak": 0,
            "title": "Initiate", "circles": [], "achievements": [],
            "last_checkin_date": None, "total_checkins": 0,
            "auth_provider": "password", "role": "admin",
            "created_at": now_iso(),
        })
        admin_uid_val = admin_uid
    else:
        admin_uid_val = admin_existing["_id"]

    # Demo user (Aria Shadow)
    demo_existing = await find_one("users", "email", DEMO_EMAIL)
    if not demo_existing:
        demo_uid = await asyncio.to_thread(_firebase_create_or_get_user, DEMO_EMAIL, DEMO_PASSWORD, "Aria Shadow")
        xp = 2840
        lvl = level_for_xp(xp)
        await set_user_doc(demo_uid, {
            "email": DEMO_EMAIL,
            "name": "Aria Shadow",
            "avatar": "AS",
            "xp": xp, "level": lvl, "streak": 12, "longest_streak": 14,
            "title": title_for_level(lvl),
            "circles": [], "achievements": ["first_checkin", "streak_3", "streak_7", "level_5", "xp_1000"],
            "last_checkin_date": today, "total_checkins": 38,
            "auth_provider": "password", "role": "user",
            "created_at": now_iso(),
        })
        demo_uid_val = demo_uid
    else:
        demo_uid_val = demo_existing["_id"]
        await update_doc("users", demo_uid_val, {"last_checkin_date": today})

    # Companions
    companions = [
        {"email": "kai@gylfa.app", "name": "Kai Mercer", "avatar": "KM", "xp": 3920, "streak": 18, "longest_streak": 21},
        {"email": "lyra@gylfa.app", "name": "Lyra Voss", "avatar": "LV", "xp": 2110, "streak": 7, "longest_streak": 9},
        {"email": "renji@gylfa.app", "name": "Renji Tao", "avatar": "RT", "xp": 1640, "streak": 4, "longest_streak": 11},
        {"email": "mira@gylfa.app", "name": "Mira Quinn", "avatar": "MQ", "xp": 980, "streak": 9, "longest_streak": 9},
    ]
    companion_ids = []
    for c in companions:
        existing = await find_one("users", "email", c["email"])
        if not existing:
            cuid = await asyncio.to_thread(_firebase_create_or_get_user, c["email"], "companion123", c["name"])
            lvl = level_for_xp(c["xp"])
            await set_user_doc(cuid, {
                "email": c["email"], "name": c["name"], "avatar": c["avatar"],
                "xp": c["xp"], "level": lvl, "streak": c["streak"], "longest_streak": c["longest_streak"],
                "title": title_for_level(lvl), "circles": [], "achievements": [],
                "last_checkin_date": today, "total_checkins": 30,
                "auth_provider": "password", "role": "user", "created_at": now_iso(),
            })
            companion_ids.append(cuid)
        else:
            companion_ids.append(existing["_id"])

    # Circle "Shadow Guild"
    circle_existing = await find_one("circles", "invite_code", "SHADOW01")
    member_ids = [demo_uid_val] + companion_ids
    if not circle_existing:
        circle_id = str(uuid.uuid4())
        await create_doc("circles", {
            "name": "Shadow Guild", "description": "An elite circle of nocturnal hunters.",
            "emoji": "⚔️", "invite_code": "SHADOW01",
            "owner_id": demo_uid_val, "admin_ids": [companion_ids[0]] if companion_ids else [],
            "member_ids": member_ids, "created_at": now_iso(),
        }, doc_id=circle_id)
        for mid in member_ids:
            await update_doc("users", mid, {"circles": firestore.ArrayUnion([circle_id])})
    else:
        circle_id = circle_existing["_id"]
        await update_doc("circles", circle_id, {
            "member_ids": member_ids,
            "admin_ids": [companion_ids[0]] if companion_ids else [],
        })
        for mid in member_ids:
            await update_doc("users", mid, {"circles": firestore.ArrayUnion([circle_id])})

    # Demo goals for Aria
    existing_goals_count = await count_docs("goals", "user_id", demo_uid_val)
    yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    if existing_goals_count == 0:
        seed_goals = [
            {"title": "Morning workout", "description": "30-min strength + mobility", "frequency": "daily", "xp_reward": 60, "icon": "dumbbell", "last": today},
            {"title": "Deep work block", "description": "90 minutes of focused work", "frequency": "daily", "xp_reward": 80, "icon": "brain", "last": today},
            {"title": "Read 20 pages", "description": "Non-fiction or fiction", "frequency": "daily", "xp_reward": 40, "icon": "book-open", "last": yesterday},
            {"title": "Cold shower", "description": "3 minutes minimum", "frequency": "daily", "xp_reward": 30, "icon": "droplets", "last": yesterday},
            {"title": "Weekly review", "description": "Sunday journal + plan", "frequency": "weekly", "xp_reward": 120, "icon": "calendar-check", "last": yesterday},
        ]
        for g in seed_goals:
            await create_doc("goals", {
                "user_id": demo_uid_val, "title": g["title"], "description": g["description"],
                "frequency": g["frequency"], "xp_reward": g["xp_reward"], "icon": g["icon"],
                "total_completions": 5, "last_completed_date": g["last"], "created_at": now_iso(),
            })

    # Historical check-ins
    existing_checkins_count = await count_docs("checkins", "user_id", demo_uid_val)
    if existing_checkins_count == 0:
        aria_goals = await find_many("goals", "user_id", demo_uid_val)
        for i in range(10):
            d = (datetime.now(timezone.utc).date() - timedelta(days=i)).isoformat()
            g = aria_goals[i % len(aria_goals)]
            await create_doc("checkins", {
                "user_id": demo_uid_val, "goal_id": g["_id"], "goal_title": g["title"],
                "xp_earned": g["xp_reward"], "date": d, "note": "",
                "created_at": (datetime.now(timezone.utc) - timedelta(days=i)).isoformat(),
            })

    # Seed activities
    existing_acts_count = await count_docs("activities", "circle_id", circle_id)
    if existing_acts_count == 0:
        seed_acts = [
            (demo_uid_val, "Aria Shadow", "checkin", "completed Deep work block (+80 XP)"),
            (companion_ids[0], "Kai Mercer", "checkin", "completed Morning workout (+60 XP)"),
            (companion_ids[1], "Lyra Voss", "level_up", "reached Level 7"),
            (demo_uid_val, "Aria Shadow", "streak", "hit a 12-day streak"),
            (companion_ids[2], "Renji Tao", "checkin", "completed Read 20 pages (+40 XP)"),
            (companion_ids[3], "Mira Quinn", "checkin", "completed Cold shower (+30 XP)"),
            (companion_ids[0], "Kai Mercer", "streak", "hit an 18-day streak"),
        ]
        for i, (uid_val, uname, atype, msg) in enumerate(seed_acts):
            await create_doc("activities", {
                "circle_id": circle_id, "user_id": uid_val, "user_name": uname,
                "type": atype, "message": msg,
                "created_at": (datetime.now(timezone.utc) - timedelta(hours=i * 3)).isoformat(),
            })

    logger.info("Seeding complete.")

# ---------- Weekly Digest ----------
async def run_weekly_digest():
    if not DIGEST_ENABLED:
        return {"sent": 0, "skipped": True}
    logger.info("Running weekly digest...")
    sent = 0
    circles_ref = db.collection("circles")
    async for cdoc in circles_ref.stream():
        c = cdoc.to_dict()
        c["_id"] = cdoc.id
        member_ids = c.get("member_ids", [])
        members = []
        for mid in member_ids:
            mu = await get_user_doc(mid)
            if mu:
                members.append(mu)
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
            await create_doc("notifications", {
                "user_id": u["_id"], "type": "weekly_digest",
                "title": f"Weekly digest — {c['name']}",
                "body": f"Top: {top5[0]['name'] if top5 else 'n/a'} • Streaks: {len(survivors)} survivors",
                "meta": {"circle_id": c["_id"]}, "read": False, "created_at": now_iso(),
            })
            await send_email(u["email"], f"Gylfa weekly digest — {c['name']}", body)
            sent += 1
    return {"sent": sent, "skipped": False}

@asynccontextmanager
async def lifespan(app: FastAPI):
    global scheduler
    await seed_data()
    if DIGEST_ENABLED:
        scheduler = AsyncIOScheduler(timezone="UTC")
        scheduler.add_job(run_weekly_digest, CronTrigger(day_of_week="mon", hour=9, minute=0, timezone="UTC"))
        scheduler.start()
        logger.info("Scheduler started.")
    yield
    if scheduler:
        scheduler.shutdown(wait=False)

app = FastAPI(lifespan=lifespan, title="Gylfa API")

# ---------- Routes: Auth (Firebase-backed) ----------

@api.post("/auth/profile")
async def upsert_profile(payload: ProfileUpsertReq, request: Request):
    """
    Called by the frontend after Firebase sign-up/login.
    Creates or updates the user's Firestore profile document using their Firebase UID.
    Returns the user profile.
    """
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        decoded = fb_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    uid = decoded["uid"]
    email = decoded.get("email", "")
    name = payload.name or decoded.get("name", email.split("@")[0])
    initials = "".join([p[0] for p in name.split()[:2]]).upper() or "U"

    existing = await get_user_doc(uid)
    if not existing:
        profile = {
            "email": email,
            "name": name,
            "avatar": initials,
            "xp": 0, "level": 1, "streak": 0, "longest_streak": 0,
            "title": "Initiate", "circles": [], "achievements": [],
            "last_checkin_date": None, "total_checkins": 0,
            "auth_provider": decoded.get("firebase", {}).get("sign_in_provider", "password"),
            "role": "user",
            "created_at": now_iso(),
        }
        await set_user_doc(uid, profile)
        profile["_id"] = uid
        return safe_user(profile)
    else:
        return safe_user(existing)

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return safe_user(user)

@api.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    # Firebase sessions are managed client-side; server just acknowledges
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordReq):
    """Custom forgot-password flow using Resend email + Firestore token store."""
    email = payload.email.lower()
    try:
        fb_user = await asyncio.to_thread(fb_auth.get_user_by_email, email)
    except fb_auth.UserNotFoundError:
        # Don't reveal whether user exists
        return {"ok": True}

    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    await create_doc("password_reset_tokens", {
        "token": token,
        "user_id": fb_user.uid,
        "email": email,
        "used": False,
        "expires_at": expires.isoformat(),
        "created_at": now_iso(),
    })
    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
    html = (
        f"<p>Hi {fb_user.display_name or email},</p>"
        f"<p>Reset your Gylfa password using the link below (valid for 1 hour):</p>"
        f'<p><a href="{reset_link}">{reset_link}</a></p>'
    )
    await send_email(email, "Gylfa — reset your password", html)
    return {"ok": True}

@api.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordReq):
    """Validate reset token and update password via Firebase Admin SDK."""
    rec = await find_one("password_reset_tokens", "token", payload.token)
    if not rec or rec.get("used"):
        raise HTTPException(status_code=400, detail="Invalid or used token")
    exp_str = rec["expires_at"]
    exp = datetime.fromisoformat(exp_str)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expired")
    await asyncio.to_thread(fb_auth.update_user, rec["user_id"], password=payload.password)
    await update_doc("password_reset_tokens", rec["_id"], {"used": True})
    return {"ok": True}

# ---------- Routes: Goals ----------
@api.get("/goals")
async def list_goals(user: dict = Depends(get_current_user)):
    goals = await find_many("goals", "user_id", user["_id"])
    for g in goals:
        g["id"] = g.pop("_id")
    return goals

@api.post("/goals")
async def create_goal(payload: GoalCreate, user: dict = Depends(get_current_user)):
    goal_id = str(uuid.uuid4())
    goal = {
        "user_id": user["_id"],
        "title": payload.title, "description": payload.description,
        "frequency": payload.frequency, "xp_reward": payload.xp_reward, "icon": payload.icon,
        "total_completions": 0, "last_completed_date": None, "created_at": now_iso(),
    }
    await create_doc("goals", goal, doc_id=goal_id)
    goal["id"] = goal_id
    return goal

@api.patch("/goals/{goal_id}")
async def update_goal(goal_id: str, payload: GoalUpdate, user: dict = Depends(get_current_user)):
    doc = await db.collection("goals").document(goal_id).get()
    if not doc.exists or doc.to_dict().get("user_id") != user["_id"]:
        raise HTTPException(status_code=404, detail="Goal not found")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await update_doc("goals", goal_id, updates)
    updated = (await db.collection("goals").document(goal_id).get()).to_dict()
    updated["id"] = goal_id
    return updated

@api.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, user: dict = Depends(get_current_user)):
    doc = await db.collection("goals").document(goal_id).get()
    if not doc.exists or doc.to_dict().get("user_id") != user["_id"]:
        raise HTTPException(status_code=404, detail="Goal not found")
    await delete_doc("goals", goal_id)
    return {"ok": True}

# ---------- Routes: Checkins ----------
@api.get("/checkins")
async def list_checkins(user: dict = Depends(get_current_user), days: int = 30):
    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=days)).isoformat()
    q = db.collection("checkins").where("user_id", "==", user["_id"]).where("date", ">=", cutoff).order_by("date", direction=firestore.Query.DESCENDING).limit(500)
    results = []
    async for doc in q.stream():
        r = doc.to_dict()
        r["id"] = doc.id
        results.append(r)
    return results

@api.post("/checkins")
async def create_checkin(payload: CheckinCreate, user: dict = Depends(get_current_user)):
    goal_doc = await db.collection("goals").document(payload.goal_id).get()
    if not goal_doc.exists or goal_doc.to_dict().get("user_id") != user["_id"]:
        raise HTTPException(status_code=404, detail="Goal not found")
    goal = goal_doc.to_dict()
    today = today_iso()

    # Check for existing checkin today
    existing_q = db.collection("checkins").where("user_id", "==", user["_id"]).where("goal_id", "==", payload.goal_id).where("date", "==", today).limit(1)
    async for _ in existing_q.stream():
        raise HTTPException(status_code=400, detail="Already checked in for this goal today")

    xp_earned = goal["xp_reward"]
    prev_level = user.get("level", 1)
    new_xp = user.get("xp", 0) + xp_earned
    new_level = level_for_xp(new_xp)
    new_title = title_for_level(new_level)

    # Streak calculation
    last = user.get("last_checkin_date")
    streak = user.get("streak", 0)
    yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    if last == today:
        pass
    elif last == yesterday:
        streak += 1
    else:
        streak = 1
    longest = max(user.get("longest_streak", 0), streak)
    total_checkins = user.get("total_checkins", 0) + 1

    updated_user_fields = {
        "xp": new_xp, "level": new_level, "title": new_title,
        "streak": streak, "longest_streak": longest,
        "last_checkin_date": today, "total_checkins": total_checkins,
    }

    # Achievement check
    test_user = {**user, **updated_user_fields}
    newly = check_achievements(test_user)
    if newly:
        updated_user_fields["achievements"] = list(set(user.get("achievements", []) + newly))

    await update_doc("users", user["_id"], updated_user_fields)
    await update_doc("goals", payload.goal_id, {
        "last_completed_date": today,
        "total_completions": firestore.Increment(1),
    })

    checkin_id = str(uuid.uuid4())
    checkin_doc = {
        "user_id": user["_id"], "goal_id": payload.goal_id,
        "goal_title": goal["title"], "xp_earned": xp_earned,
        "date": today, "note": payload.note, "created_at": now_iso(),
    }
    await create_doc("checkins", checkin_doc, doc_id=checkin_id)

    # Activities for circles
    for cid in user.get("circles", []):
        await create_doc("activities", {
            "circle_id": cid, "user_id": user["_id"], "user_name": user["name"],
            "type": "checkin", "message": f"completed {goal['title']} (+{xp_earned} XP)",
            "created_at": now_iso(),
        })

    notifications_created = []
    if new_level > prev_level:
        await create_doc("notifications", {
            "user_id": user["_id"], "type": "level_up",
            "title": f"Level up — Lv.{new_level} {new_title}",
            "body": f"You reached Level {new_level}. Title: {new_title}.",
            "meta": {"level": new_level, "title": new_title},
            "read": False, "created_at": now_iso(),
        })
        notifications_created.append("level_up")
        for cid in user.get("circles", []):
            await create_doc("activities", {
                "circle_id": cid, "user_id": user["_id"], "user_name": user["name"],
                "type": "level_up", "message": f"reached Level {new_level} ({new_title})",
                "created_at": now_iso(),
            })

    if streak in STREAK_MILESTONES and streak != user.get("streak", 0):
        await create_doc("notifications", {
            "user_id": user["_id"], "type": "streak_milestone",
            "title": f"{streak}-day streak",
            "body": f"You hit a {streak}-day streak. Keep going.",
            "meta": {"streak": streak}, "read": False, "created_at": now_iso(),
        })
        notifications_created.append("streak_milestone")
        for cid in user.get("circles", []):
            await create_doc("activities", {
                "circle_id": cid, "user_id": user["_id"], "user_name": user["name"],
                "type": "streak", "message": f"hit a {streak}-day streak",
                "created_at": now_iso(),
            })

    checkin_doc["id"] = checkin_id
    updated_user = await get_user_doc(user["_id"])
    return {
        "checkin": checkin_doc,
        "user": safe_user(updated_user),
        "xp_earned": xp_earned,
        "leveled_up": new_level > prev_level,
        "new_achievements": newly,
        "notifications": notifications_created,
    }

# ---------- Routes: Circles ----------
def role_for(c: dict, user_id: str) -> str:
    if user_id == c.get("owner_id"):
        return "owner"
    if user_id in c.get("admin_ids", []):
        return "admin"
    return "member"

async def serialize_circle(c: dict) -> dict:
    admin_ids = c.get("admin_ids", [])
    members = []
    for mid in c.get("member_ids", []):
        mu = await get_user_doc(mid)
        if mu:
            members.append(mu)
    member_list = [
        {
            "id": m["_id"], "name": m["name"], "avatar": m.get("avatar"),
            "xp": m.get("xp", 0), "level": m.get("level", 1),
            "title": m.get("title", "Initiate"), "streak": m.get("streak", 0),
            "role": role_for(c, m["_id"]),
        }
        for m in members
    ]
    return {
        "id": c["_id"], "name": c["name"], "description": c.get("description", ""),
        "emoji": c.get("emoji", "⚔️"), "invite_code": c["invite_code"],
        "owner_id": c["owner_id"], "admin_ids": admin_ids,
        "member_ids": c.get("member_ids", []), "members": member_list,
        "created_at": c.get("created_at"),
    }

@api.get("/circles")
async def list_circles(user: dict = Depends(get_current_user)):
    q = db.collection("circles").where("member_ids", "array_contains", user["_id"]).limit(100)
    results = []
    async for doc in q.stream():
        c = doc.to_dict()
        c["_id"] = doc.id
        results.append(await serialize_circle(c))
    return results

@api.post("/circles")
async def create_circle(payload: CircleCreate, user: dict = Depends(get_current_user)):
    code = gen_invite_code()
    while await find_one("circles", "invite_code", code):
        code = gen_invite_code()
    cid = str(uuid.uuid4())
    circle = {
        "name": payload.name, "description": payload.description, "emoji": payload.emoji,
        "invite_code": code, "owner_id": user["_id"], "admin_ids": [],
        "member_ids": [user["_id"]], "created_at": now_iso(),
    }
    await create_doc("circles", circle, doc_id=cid)
    await update_doc("users", user["_id"], {"circles": firestore.ArrayUnion([cid])})
    refreshed = await get_user_doc(user["_id"])
    newly = check_achievements(refreshed)
    if newly:
        await update_doc("users", user["_id"], {"achievements": list(set(refreshed.get("achievements", []) + newly))})
    circle["_id"] = cid
    return await serialize_circle(circle)

@api.post("/circles/join")
async def join_circle(payload: CircleJoinReq, user: dict = Depends(get_current_user)):
    code = payload.invite_code.strip().upper()
    circle = await find_one("circles", "invite_code", code)
    if not circle:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    if user["_id"] in circle.get("member_ids", []):
        return await serialize_circle(circle)
    await update_doc("circles", circle["_id"], {"member_ids": firestore.ArrayUnion([user["_id"]])})
    await update_doc("users", user["_id"], {"circles": firestore.ArrayUnion([circle["_id"]])})
    await create_doc("activities", {
        "circle_id": circle["_id"], "user_id": user["_id"], "user_name": user["name"],
        "type": "join", "message": "joined the circle", "created_at": now_iso(),
    })
    refreshed = await get_user_doc(user["_id"])
    newly = check_achievements(refreshed)
    if newly:
        await update_doc("users", user["_id"], {"achievements": list(set(refreshed.get("achievements", []) + newly))})
    updated_circle = (await db.collection("circles").document(circle["_id"]).get()).to_dict()
    updated_circle["_id"] = circle["_id"]
    return await serialize_circle(updated_circle)

@api.get("/circles/{circle_id}")
async def get_circle(circle_id: str, period: str = "all", user: dict = Depends(get_current_user)):
    doc = await db.collection("circles").document(circle_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Circle not found")
    circle = doc.to_dict()
    circle["_id"] = circle_id
    if user["_id"] not in circle.get("member_ids", []):
        raise HTTPException(status_code=403, detail="Not a member")
    payload = await serialize_circle(circle)

    acts_q = db.collection("activities").where("circle_id", "==", circle_id).order_by("created_at", direction=firestore.Query.DESCENDING).limit(50)
    activities = []
    async for adoc in acts_q.stream():
        a = adoc.to_dict()
        a["id"] = adoc.id
        activities.append(a)
    payload["activities"] = activities

    member_xp = sum(m["xp"] for m in payload["members"])
    member_checkins = await count_docs("checkins", "circle_id", circle_id)
    # Approximate: count checkins per member
    mc = 0
    for mid in circle.get("member_ids", []):
        mc += await count_docs("checkins", "user_id", mid)
    avg_streak = round(sum(m["streak"] for m in payload["members"]) / max(len(payload["members"]), 1), 1)
    payload["stats"] = {
        "members": len(payload["members"]),
        "total_xp": member_xp,
        "total_checkins": mc,
        "avg_streak": avg_streak,
    }

    period = (period or "all").lower()
    if period in ("week", "month"):
        days_back = 7 if period == "week" else 30
        cutoff = (datetime.now(timezone.utc).date() - timedelta(days=days_back)).isoformat()
        # Aggregate period XP per member
        period_stats: dict = {}
        for mid in circle.get("member_ids", []):
            pq = db.collection("checkins").where("user_id", "==", mid).where("date", ">=", cutoff)
            period_xp = 0
            period_checkins = 0
            async for pdoc in pq.stream():
                pd_data = pdoc.to_dict()
                period_xp += pd_data.get("xp_earned", 0)
                period_checkins += 1
            period_stats[mid] = {"period_xp": period_xp, "period_checkins": period_checkins}
        board = [{**m, **period_stats.get(m["id"], {"period_xp": 0, "period_checkins": 0})} for m in payload["members"]]
        board.sort(key=lambda x: x["period_xp"], reverse=True)
        payload["leaderboard"] = board
    else:
        payload["leaderboard"] = sorted(payload["members"], key=lambda m: m["xp"], reverse=True)
    payload["period"] = period
    payload["my_role"] = role_for(circle, user["_id"])
    return payload

# ---------- Circle moderation ----------
async def _require_circle_role(circle_id: str, user_id: str, allowed: List[str]) -> dict:
    doc = await db.collection("circles").document(circle_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Circle not found")
    circle = doc.to_dict()
    circle["_id"] = circle_id
    role = role_for(circle, user_id)
    if role not in allowed:
        raise HTTPException(status_code=403, detail="Forbidden")
    return circle

@api.post("/circles/{circle_id}/members/{member_id}/promote")
async def promote_member(circle_id: str, member_id: str, user: dict = Depends(get_current_user)):
    circle = await _require_circle_role(circle_id, user["_id"], ["owner"])
    if member_id not in circle.get("member_ids", []):
        raise HTTPException(status_code=404, detail="Not a member")
    if member_id == circle["owner_id"]:
        raise HTTPException(status_code=400, detail="Owner cannot be promoted")
    await update_doc("circles", circle_id, {"admin_ids": firestore.ArrayUnion([member_id])})
    updated = (await db.collection("circles").document(circle_id).get()).to_dict()
    updated["_id"] = circle_id
    return await serialize_circle(updated)

@api.post("/circles/{circle_id}/members/{member_id}/demote")
async def demote_member(circle_id: str, member_id: str, user: dict = Depends(get_current_user)):
    await _require_circle_role(circle_id, user["_id"], ["owner"])
    await update_doc("circles", circle_id, {"admin_ids": firestore.ArrayRemove([member_id])})
    updated = (await db.collection("circles").document(circle_id).get()).to_dict()
    updated["_id"] = circle_id
    return await serialize_circle(updated)

@api.delete("/circles/{circle_id}/members/{member_id}")
async def remove_member(circle_id: str, member_id: str, user: dict = Depends(get_current_user)):
    circle = await _require_circle_role(circle_id, user["_id"], ["owner", "admin"])
    if member_id == circle["owner_id"]:
        raise HTTPException(status_code=400, detail="Cannot remove the owner")
    if role_for(circle, member_id) == "admin" and role_for(circle, user["_id"]) != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can remove an admin")
    await update_doc("circles", circle_id, {
        "member_ids": firestore.ArrayRemove([member_id]),
        "admin_ids": firestore.ArrayRemove([member_id]),
    })
    await update_doc("users", member_id, {"circles": firestore.ArrayRemove([circle_id])})
    target = await get_user_doc(member_id)
    if target:
        await create_doc("activities", {
            "circle_id": circle_id, "user_id": user["_id"], "user_name": user["name"],
            "type": "remove", "message": f"removed {target['name']} from the circle",
            "created_at": now_iso(),
        })
    updated = (await db.collection("circles").document(circle_id).get()).to_dict()
    updated["_id"] = circle_id
    return await serialize_circle(updated)

@api.post("/circles/{circle_id}/invite")
async def invite_members(circle_id: str, payload: CircleInviteReq, user: dict = Depends(get_current_user)):
    circle = await _require_circle_role(circle_id, user["_id"], ["owner", "admin"])
    sent = 0
    link = f"{FRONTEND_URL}/circles?join={circle['invite_code']}"
    for raw in payload.emails:
        em = str(raw).lower()
        html = (
            f"<p>{user['name']} invited you to join <strong>{circle['name']}</strong> on Gylfa.</p>"
            f"<p>Invite code: <code>{circle['invite_code']}</code></p>"
            f'<p><a href="{link}">Open Gylfa and join</a></p>'
        )
        await send_email(em, f"You're invited to {circle['name']} on Gylfa", html)
        sent += 1
    return {"sent": sent, "invite_code": circle["invite_code"]}

# ---------- Public profile ----------
@api.get("/users/{user_id}/public")
async def public_profile(user_id: str):
    u = await get_user_doc(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    earned = set(u.get("achievements", []))
    achievements = [{**a, "unlocked": a["id"] in earned} for a in ACHIEVEMENT_DEFS if a["id"] in earned]
    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=13)).isoformat()
    q = db.collection("checkins").where("user_id", "==", user_id).where("date", ">=", cutoff)
    history = {}
    async for doc in q.stream():
        cd = doc.to_dict()
        history[cd["date"]] = history.get(cd["date"], 0) + cd.get("xp_earned", 0)
    series = []
    today_d = datetime.now(timezone.utc).date()
    for i in range(13, -1, -1):
        d = (today_d - timedelta(days=i)).isoformat()
        series.append({"date": d, "xp": history.get(d, 0)})
    return {
        "id": u["_id"], "name": u["name"], "avatar": u.get("avatar"),
        "xp": u.get("xp", 0), "level": u.get("level", 1),
        "title": u.get("title", "Initiate"), "streak": u.get("streak", 0),
        "longest_streak": u.get("longest_streak", 0),
        "total_checkins": u.get("total_checkins", 0),
        "achievements": achievements, "xp_history": series,
        "member_since": u.get("created_at"),
    }

# ---------- Routes: Achievements ----------
@api.get("/achievements")
async def list_achievements(user: dict = Depends(get_current_user)):
    earned = set(user.get("achievements", []))
    return [{**a, "unlocked": a["id"] in earned} for a in ACHIEVEMENT_DEFS]

# ---------- Routes: Notifications ----------
@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    q = db.collection("notifications").where("user_id", "==", user["_id"]).order_by("created_at", direction=firestore.Query.DESCENDING).limit(100)
    notifs = []
    async for doc in q.stream():
        n = doc.to_dict()
        n["id"] = doc.id
        notifs.append(n)
    unread = sum(1 for n in notifs if not n.get("read"))
    return {"items": notifs, "unread": unread}

@api.post("/notifications/mark-all-read")
async def mark_all_read(user: dict = Depends(get_current_user)):
    q = db.collection("notifications").where("user_id", "==", user["_id"]).where("read", "==", False)
    batch = db.batch()
    async for doc in q.stream():
        batch.update(doc.reference, {"read": True})
    await batch.commit()
    return {"ok": True}

@api.patch("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, user: dict = Depends(get_current_user)):
    doc = await db.collection("notifications").document(notif_id).get()
    if not doc.exists or doc.to_dict().get("user_id") != user["_id"]:
        raise HTTPException(status_code=404, detail="Notification not found")
    await update_doc("notifications", notif_id, {"read": True})
    return {"ok": True}

# ---------- Routes: Admin ----------
@api.post("/admin/send-digest")
async def admin_send_digest(admin: dict = Depends(require_admin)):
    res = await run_weekly_digest()
    return res

@api.get("/")
async def root():
    return {"app": "gylfa", "ok": True}

@api.get("/health")
async def health():
    """Liveness probe — used by Render, Docker health checks, and load balancers."""
    return {"status": "ok"}

# IMPORTANT: Middleware must be added BEFORE include_router.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api)
