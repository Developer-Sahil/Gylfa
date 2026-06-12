"""Gylfa iteration-2 backend tests: public profile, leaderboard time filters,
circle moderation (promote/demote/remove), invite-by-email."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

DEMO_EMAIL = "demo@gylfa.app"
DEMO_PASSWORD = "demo123"
KAI_EMAIL = "kai@gylfa.app"
LYRA_EMAIL = "lyra@gylfa.app"
COMP_PASSWORD = "companion123"


def auth_h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------- Fixtures ----------------
@pytest.fixture(scope="function")
def session():
    """Stateless session — no cookies stored (cookies would override Bearer token)."""
    class NoCookieSession(requests.Session):
        def prepare_request(self, request):
            p = super().prepare_request(request)
            # strip any cookie header
            p.headers.pop("Cookie", None)
            return p
    s = NoCookieSession()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login {email} failed: {r.status_code} {r.text}"
    j = r.json()
    return j["token"], j["user"]


@pytest.fixture(scope="module")
def demo():
    token, user = _login(DEMO_EMAIL, DEMO_PASSWORD)
    return {"token": token, "user": user}


@pytest.fixture(scope="module")
def kai():
    token, user = _login(KAI_EMAIL, COMP_PASSWORD)
    return {"token": token, "user": user}


@pytest.fixture(scope="module")
def lyra():
    token, user = _login(LYRA_EMAIL, COMP_PASSWORD)
    return {"token": token, "user": user}


@pytest.fixture(scope="module")
def shadow_circle(demo):
    """Fetch the Shadow Guild circle (SHADOW01)."""
    r = requests.get(f"{API}/circles", headers=auth_h(demo["token"]))
    assert r.status_code == 200
    circles = r.json()
    sg = next((c for c in circles if c.get("invite_code") == "SHADOW01"), None)
    assert sg is not None, "Shadow Guild seed circle not found"
    return sg


# ---------------- Public Profile ----------------
class TestPublicProfile:
    def test_public_profile_no_auth(self, session, demo):
        # explicitly use a fresh session with no auth
        clean = requests.Session()
        r = clean.get(f"{API}/users/{demo['user']['id']}/public")
        assert r.status_code == 200, r.text
        data = r.json()
        # required fields
        for k in ["name", "level", "title", "xp", "streak", "longest_streak",
                  "total_checkins", "achievements", "xp_history", "member_since"]:
            assert k in data, f"missing {k} in public profile"
        assert isinstance(data["achievements"], list)
        # only unlocked achievements
        assert all(a.get("unlocked") is True for a in data["achievements"])
        # 14-day xp history
        assert isinstance(data["xp_history"], list)
        assert len(data["xp_history"]) == 14
        assert all("date" in e and "xp" in e for e in data["xp_history"])
        assert data["name"]  # demo user name
        assert data["level"] >= 1

    def test_public_profile_404(self, session):
        clean = requests.Session()
        bogus = str(uuid.uuid4())
        r = clean.get(f"{API}/users/{bogus}/public")
        assert r.status_code == 404


# ---------------- Circle Detail / Leaderboard ----------------
class TestCircleDetailLeaderboard:
    def test_get_circle_all_period(self, session, demo, shadow_circle):
        r = session.get(f"{API}/circles/{shadow_circle['id']}?period=all", headers=auth_h(demo["token"]))
        assert r.status_code == 200
        data = r.json()
        assert data["my_role"] == "owner"
        assert "admin_ids" in data
        lb = data["leaderboard"]
        assert len(lb) >= 1
        # sorted by xp desc
        for i in range(len(lb) - 1):
            assert lb[i]["xp"] >= lb[i + 1]["xp"], "all leaderboard not sorted by xp desc"

    def test_get_circle_week_period(self, session, demo, shadow_circle):
        r = session.get(f"{API}/circles/{shadow_circle['id']}?period=week", headers=auth_h(demo["token"]))
        assert r.status_code == 200
        data = r.json()
        assert data["period"] == "week"
        lb = data["leaderboard"]
        assert len(lb) >= 1
        # each row has period_xp + period_checkins
        for row in lb:
            assert "period_xp" in row
            assert "period_checkins" in row
        # sorted desc by period_xp
        for i in range(len(lb) - 1):
            assert lb[i]["period_xp"] >= lb[i + 1]["period_xp"]

    def test_get_circle_month_period(self, session, demo, shadow_circle):
        r = session.get(f"{API}/circles/{shadow_circle['id']}?period=month", headers=auth_h(demo["token"]))
        assert r.status_code == 200
        data = r.json()
        assert data["period"] == "month"
        lb = data["leaderboard"]
        for row in lb:
            assert "period_xp" in row and "period_checkins" in row
        for i in range(len(lb) - 1):
            assert lb[i]["period_xp"] >= lb[i + 1]["period_xp"]

    def test_seed_admin_ids_contain_kai(self, session, demo, kai, shadow_circle):
        r = session.get(f"{API}/circles/{shadow_circle['id']}", headers=auth_h(demo["token"]))
        assert r.status_code == 200
        data = r.json()
        assert data["owner_id"] == demo["user"]["id"]
        assert kai["user"]["id"] in data["admin_ids"], \
            f"Kai not in admin_ids: {data['admin_ids']}"
        # role in member list
        kai_member = next((m for m in data["members"] if m["id"] == kai["user"]["id"]), None)
        assert kai_member and kai_member["role"] == "admin"

    def test_kai_sees_admin_role(self, session, kai, shadow_circle):
        r = session.get(f"{API}/circles/{shadow_circle['id']}", headers=auth_h(kai["token"]))
        assert r.status_code == 200
        assert r.json()["my_role"] == "admin"


# ---------------- Promote / Demote ----------------
class TestPromoteDemote:
    def test_owner_promote_then_demote_lyra(self, session, demo, lyra, shadow_circle):
        cid = shadow_circle["id"]
        # promote
        r = session.post(f"{API}/circles/{cid}/members/{lyra['user']['id']}/promote",
                         headers=auth_h(demo["token"]))
        assert r.status_code == 200, r.text
        assert lyra["user"]["id"] in r.json()["admin_ids"]
        # verify
        r2 = session.get(f"{API}/circles/{cid}", headers=auth_h(demo["token"]))
        assert lyra["user"]["id"] in r2.json()["admin_ids"]
        # demote
        r3 = session.post(f"{API}/circles/{cid}/members/{lyra['user']['id']}/demote",
                          headers=auth_h(demo["token"]))
        assert r3.status_code == 200
        assert lyra["user"]["id"] not in r3.json()["admin_ids"]

    def test_non_owner_promote_forbidden(self, session, kai, lyra, shadow_circle):
        # Kai is admin (not owner) → forbidden
        r = session.post(
            f"{API}/circles/{shadow_circle['id']}/members/{lyra['user']['id']}/promote",
            headers=auth_h(kai["token"]),
        )
        assert r.status_code == 403, r.text

    def test_promote_owner_returns_400(self, session, demo, shadow_circle):
        r = session.post(
            f"{API}/circles/{shadow_circle['id']}/members/{demo['user']['id']}/promote",
            headers=auth_h(demo["token"]),
        )
        assert r.status_code == 400

    def test_promote_non_member_returns_404(self, session, demo, shadow_circle):
        bogus = str(uuid.uuid4())
        r = session.post(
            f"{API}/circles/{shadow_circle['id']}/members/{bogus}/promote",
            headers=auth_h(demo["token"]),
        )
        assert r.status_code == 404


# ---------------- Remove member ----------------
class TestRemoveMember:
    def test_owner_cannot_be_removed(self, session, demo, shadow_circle):
        r = session.delete(
            f"{API}/circles/{shadow_circle['id']}/members/{demo['user']['id']}",
            headers=auth_h(demo["token"]),
        )
        assert r.status_code == 400

    def test_admin_cannot_remove_another_admin(self, session, demo, kai, shadow_circle):
        """Promote Lyra, then Kai (admin) tries to remove Lyra (admin) → 403."""
        cid = shadow_circle["id"]
        # get lyra id via login? Use circle members.
        r = session.get(f"{API}/circles/{cid}", headers=auth_h(demo["token"]))
        members = r.json()["members"]
        lyra_m = next((m for m in members if m["name"].lower().startswith("lyra")), None)
        assert lyra_m
        # owner promotes lyra
        rp = session.post(f"{API}/circles/{cid}/members/{lyra_m['id']}/promote",
                          headers=auth_h(demo["token"]))
        assert rp.status_code == 200
        try:
            # Kai (admin) tries to remove Lyra (admin) → 403
            rd = session.delete(
                f"{API}/circles/{cid}/members/{lyra_m['id']}",
                headers=auth_h(kai["token"]),
            )
            assert rd.status_code == 403, rd.text
        finally:
            # cleanup: demote lyra back
            session.post(f"{API}/circles/{cid}/members/{lyra_m['id']}/demote",
                         headers=auth_h(demo["token"]))

    def test_owner_can_remove_test_member_and_activity_created(self, session, demo, shadow_circle):
        """Register a TEST_ user, have them join SHADOW01, then owner removes them.
        Verify user.circles updated and activity created."""
        cid = shadow_circle["id"]
        email = f"TEST_remove_{uuid.uuid4().hex[:8]}@gylfa.app"
        # register
        r = session.post(f"{API}/auth/register", json={
            "email": email, "password": "Testpass123!", "name": "TEST RemoveMe"
        })
        assert r.status_code in (200, 201), r.text
        body = r.json()
        new_token = body["token"]
        new_id = body["user"]["id"]
        # join with SHADOW01
        rj = session.post(f"{API}/circles/join", json={"invite_code": "SHADOW01"},
                          headers=auth_h(new_token))
        assert rj.status_code == 200
        # owner removes them
        rd = session.delete(f"{API}/circles/{cid}/members/{new_id}",
                            headers=auth_h(demo["token"]))
        assert rd.status_code == 200, rd.text
        circle_after = rd.json()
        assert new_id not in circle_after["member_ids"]
        # user's /auth/me reflects circles updated
        rme = session.get(f"{API}/auth/me", headers=auth_h(new_token))
        assert rme.status_code == 200
        assert cid not in rme.json().get("circles", [])
        # activity created (fetch fresh circle as owner with activities)
        rc = session.get(f"{API}/circles/{cid}", headers=auth_h(demo["token"]))
        acts = rc.json().get("activities", [])
        assert any(a.get("type") == "remove" and ("TEST RemoveMe" in a.get("message", ""))
                   for a in acts), "remove activity not created"


# ---------------- Demote ----------------
class TestDemote:
    def test_demote_removes_from_admin_ids(self, session, demo, kai, shadow_circle):
        cid = shadow_circle["id"]
        # demote kai
        r = session.post(f"{API}/circles/{cid}/members/{kai['user']['id']}/demote",
                         headers=auth_h(demo["token"]))
        assert r.status_code == 200
        assert kai["user"]["id"] not in r.json()["admin_ids"]
        # restore: promote kai back
        r2 = session.post(f"{API}/circles/{cid}/members/{kai['user']['id']}/promote",
                          headers=auth_h(demo["token"]))
        assert r2.status_code == 200
        assert kai["user"]["id"] in r2.json()["admin_ids"]


# ---------------- Invite by email ----------------
class TestInvite:
    def test_owner_invite_two_emails(self, session, demo, shadow_circle):
        r = session.post(
            f"{API}/circles/{shadow_circle['id']}/invite",
            json={"emails": ["t1@example.com", "t2@example.com"]},
            headers=auth_h(demo["token"]),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["sent"] == 2
        assert data["invite_code"] == "SHADOW01"

    def test_admin_can_invite(self, session, kai, shadow_circle):
        r = session.post(
            f"{API}/circles/{shadow_circle['id']}/invite",
            json={"emails": ["admin-invite@example.com"]},
            headers=auth_h(kai["token"]),
        )
        assert r.status_code == 200
        assert r.json()["sent"] == 1

    def test_non_member_invite_forbidden(self, shadow_circle):
        # Register a brand-new user not in the circle (use bare requests, no cookies)
        email = f"TEST_nonmember_{uuid.uuid4().hex[:6]}@gylfa.app"
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "Testpass123!", "name": "TEST NonMember"})
        assert r.status_code in (200, 201)
        token = r.json()["token"]
        rr = requests.post(
            f"{API}/circles/{shadow_circle['id']}/invite",
            json={"emails": ["x@y.com"]},
            headers=auth_h(token),
        )
        # helper only allows owner/admin → 403 (since non-member is treated as 'member' here)
        assert rr.status_code == 403, rr.text

    def test_empty_emails_returns_422(self, session, demo, shadow_circle):
        r = session.post(
            f"{API}/circles/{shadow_circle['id']}/invite",
            json={"emails": []},
            headers=auth_h(demo["token"]),
        )
        assert r.status_code == 422


# ---------------- Regression spot checks ----------------
class TestRegressionSpot:
    def test_dashboard(self, session, demo):
        r = session.get(f"{API}/auth/me", headers=auth_h(demo["token"]))
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == DEMO_EMAIL

    def test_achievements_list(self, session, demo):
        r = session.get(f"{API}/achievements", headers=auth_h(demo["token"]))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 8

    def test_notifications(self, session, demo):
        r = session.get(f"{API}/notifications", headers=auth_h(demo["token"]))
        assert r.status_code == 200
        assert "items" in r.json() and "unread" in r.json()
