"""Gylfa backend API tests — comprehensive pytest suite."""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"

DEMO_EMAIL = "demo@gylfa.app"
DEMO_PASSWORD = "demo123"
ADMIN_EMAIL = "admin@gylfa.app"
ADMIN_PASSWORD = "admin123"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def demo_token(session):
    r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, f"Demo login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def auth_h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------- Health ----------------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert data["app"] == "gylfa"


# ---------------- Auth ----------------
class TestAuth:
    def test_demo_login_returns_expected_profile(self, session):
        r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 10
        u = data["user"]
        assert u["email"] == DEMO_EMAIL
        assert u["xp"] == 2840
        assert u["level"] == 8
        assert u["title"] == "Adept"
        assert u["streak"] == 12
        # httpOnly cookie should be set
        assert "access_token" in r.cookies

    def test_invalid_credentials(self, session):
        r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_register_new_user(self, session):
        email = f"test_{uuid.uuid4().hex[:8]}@gylfa.app"
        r = session.post(f"{API}/auth/register", json={"email": email, "password": "secret123", "name": "Test User"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert data["user"]["email"] == email
        assert data["user"]["xp"] == 0
        assert data["user"]["level"] == 1
        assert data["user"]["title"] == "Initiate"
        assert "access_token" in r.cookies

    def test_register_duplicate_email_rejected(self, session):
        r = session.post(f"{API}/auth/register", json={"email": DEMO_EMAIL, "password": "secret123", "name": "Dup"})
        assert r.status_code == 400

    def test_me_with_bearer(self, session, demo_token):
        r = requests.get(f"{API}/auth/me", headers=auth_h(demo_token))
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == DEMO_EMAIL
        assert u["xp"] == 2840

    def test_me_without_token_401(self, session):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_logout_clears_cookie(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
        assert r.status_code == 200
        token = r.json()["token"]
        r2 = s.post(f"{API}/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 200
        assert r2.json().get("ok") is True

    def test_forgot_and_reset_password_flow(self, session):
        # Request reset
        r = session.post(f"{API}/auth/forgot-password", json={"email": DEMO_EMAIL})
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # We need to fetch the token directly from DB via a side-channel — but we have no DB endpoint.
        # Instead, attempt reset with an invalid token first to assert error handling.
        r_bad = session.post(f"{API}/auth/reset-password", json={"token": "doesnotexist", "password": "newpass123"})
        assert r_bad.status_code == 400

        # Use Mongo to retrieve token (motor not available — use pymongo).
        try:
            from pymongo import MongoClient
        except ImportError:
            pytest.skip("pymongo not installed; cannot verify reset flow end-to-end")

        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        mc = MongoClient(mongo_url)
        db = mc[db_name]
        rec = db.password_reset_tokens.find_one({"used": False}, sort=[("created_at", -1)])
        assert rec is not None, "Reset token not stored"
        token = rec["token"]

        # Reset to new password
        new_password = "tempReset!23"
        r = session.post(f"{API}/auth/reset-password", json={"token": token, "password": new_password})
        assert r.status_code == 200, r.text

        # Login with new password
        r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": new_password})
        assert r.status_code == 200

        # Reset back to demo123 by issuing forgot again
        session.post(f"{API}/auth/forgot-password", json={"email": DEMO_EMAIL})
        rec2 = db.password_reset_tokens.find_one({"used": False}, sort=[("created_at", -1)])
        assert rec2 is not None
        r = session.post(f"{API}/auth/reset-password", json={"token": rec2["token"], "password": DEMO_PASSWORD})
        assert r.status_code == 200

        # Verify original demo password works
        r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
        assert r.status_code == 200


# ---------------- Goals ----------------
class TestGoals:
    def test_list_goals_seeded(self, demo_token):
        r = requests.get(f"{API}/goals", headers=auth_h(demo_token))
        assert r.status_code == 200
        goals = r.json()
        assert len(goals) >= 5
        for g in goals:
            assert "id" in g and "_id" not in g

    def test_goal_crud_cycle(self, demo_token):
        # CREATE
        payload = {"title": "TEST_meditate", "description": "10 min", "frequency": "daily", "xp_reward": 25, "icon": "brain"}
        r = requests.post(f"{API}/goals", headers=auth_h(demo_token), json=payload)
        assert r.status_code == 200
        g = r.json()
        assert g["title"] == "TEST_meditate"
        assert g["xp_reward"] == 25
        gid = g["id"]

        # READ (verify persisted in list)
        r = requests.get(f"{API}/goals", headers=auth_h(demo_token))
        ids = [x["id"] for x in r.json()]
        assert gid in ids

        # UPDATE
        r = requests.patch(f"{API}/goals/{gid}", headers=auth_h(demo_token), json={"title": "TEST_meditate_v2", "xp_reward": 35})
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_meditate_v2"
        assert r.json()["xp_reward"] == 35

        # DELETE
        r = requests.delete(f"{API}/goals/{gid}", headers=auth_h(demo_token))
        assert r.status_code == 200

        # Verify deleted
        r = requests.delete(f"{API}/goals/{gid}", headers=auth_h(demo_token))
        assert r.status_code == 404


# ---------------- Checkins ----------------
class TestCheckins:
    def test_checkin_creates_xp_and_duplicate_400(self, demo_token):
        # Create a fresh goal to ensure not completed today
        r = requests.post(
            f"{API}/goals",
            headers=auth_h(demo_token),
            json={"title": f"TEST_checkin_{uuid.uuid4().hex[:6]}", "frequency": "daily", "xp_reward": 30},
        )
        assert r.status_code == 200
        gid = r.json()["id"]

        # Initial user xp
        u_before = requests.get(f"{API}/auth/me", headers=auth_h(demo_token)).json()
        xp_before = u_before["xp"]

        # First checkin
        r = requests.post(f"{API}/checkins", headers=auth_h(demo_token), json={"goal_id": gid, "note": "ok"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["xp_earned"] == 30
        assert "leveled_up" in data
        assert data["user"]["xp"] == xp_before + 30
        assert data["user"]["total_checkins"] >= 1

        # Second checkin same day → 400
        r2 = requests.post(f"{API}/checkins", headers=auth_h(demo_token), json={"goal_id": gid})
        assert r2.status_code == 400
        assert "Already checked in" in r2.json().get("detail", "")

        # Cleanup goal
        requests.delete(f"{API}/goals/{gid}", headers=auth_h(demo_token))


# ---------------- Circles ----------------
class TestCircles:
    def test_list_circles_includes_shadow_guild(self, demo_token):
        r = requests.get(f"{API}/circles", headers=auth_h(demo_token))
        assert r.status_code == 200
        circles = r.json()
        names = [c["name"] for c in circles]
        assert "Shadow Guild" in names

    def test_create_join_get_circle(self, demo_token, session):
        # Register a 2nd user to test joining
        em = f"join_{uuid.uuid4().hex[:6]}@gylfa.app"
        r = session.post(f"{API}/auth/register", json={"email": em, "password": "secret123", "name": "Joiner Test"})
        assert r.status_code == 200
        join_token = r.json()["token"]

        # demo creates a new circle
        r = requests.post(
            f"{API}/circles",
            headers=auth_h(demo_token),
            json={"name": f"TEST_Circle_{uuid.uuid4().hex[:4]}", "description": "test", "emoji": "🔥"},
        )
        assert r.status_code == 200
        circle = r.json()
        assert len(circle["invite_code"]) == 8
        cid = circle["id"]
        code = circle["invite_code"]

        # joiner joins
        r = requests.post(f"{API}/circles/join", headers=auth_h(join_token), json={"invite_code": code})
        assert r.status_code == 200

        # GET detail (as demo) — verify stats + leaderboard sorted desc + activities list
        r = requests.get(f"{API}/circles/{cid}", headers=auth_h(demo_token))
        assert r.status_code == 200
        d = r.json()
        assert "stats" in d and d["stats"]["members"] >= 2
        lb = d["leaderboard"]
        assert lb == sorted(lb, key=lambda m: m["xp"], reverse=True)
        assert isinstance(d.get("activities", []), list)

    def test_join_invalid_code_404(self, demo_token):
        r = requests.post(f"{API}/circles/join", headers=auth_h(demo_token), json={"invite_code": "BADCODEZ"})
        assert r.status_code == 404


# ---------------- Achievements ----------------
class TestAchievements:
    def test_list_achievements_eight_items(self, demo_token):
        r = requests.get(f"{API}/achievements", headers=auth_h(demo_token))
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 8
        unlocked_ids = {a["id"] for a in items if a["unlocked"]}
        assert "first_checkin" in unlocked_ids
        assert "level_5" in unlocked_ids


# ---------------- Notifications ----------------
class TestNotifications:
    def test_list_mark_all_read_and_single_read(self, demo_token):
        # Ensure at least one notification exists by triggering a checkin on a new goal
        r = requests.post(f"{API}/goals", headers=auth_h(demo_token),
                          json={"title": f"TEST_notif_{uuid.uuid4().hex[:5]}", "frequency": "daily", "xp_reward": 30})
        gid = r.json()["id"]
        requests.post(f"{API}/checkins", headers=auth_h(demo_token), json={"goal_id": gid})

        r = requests.get(f"{API}/notifications", headers=auth_h(demo_token))
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "unread" in d

        # mark all read
        r = requests.post(f"{API}/notifications/mark-all-read", headers=auth_h(demo_token))
        assert r.status_code == 200
        r = requests.get(f"{API}/notifications", headers=auth_h(demo_token))
        assert r.json()["unread"] == 0

        # single read for first item (if any)
        items = r.json()["items"]
        if items:
            nid = items[0]["id"]
            r = requests.patch(f"{API}/notifications/{nid}/read", headers=auth_h(demo_token))
            assert r.status_code == 200

        # cleanup
        requests.delete(f"{API}/goals/{gid}", headers=auth_h(demo_token))


# ---------------- Admin ----------------
class TestAdmin:
    def test_send_digest_requires_admin(self, demo_token):
        r = requests.post(f"{API}/admin/send-digest", headers=auth_h(demo_token))
        assert r.status_code == 403

    def test_send_digest_as_admin(self, admin_token):
        r = requests.post(f"{API}/admin/send-digest", headers=auth_h(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert "sent" in d
        assert isinstance(d["sent"], int)
