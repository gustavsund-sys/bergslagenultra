"""Regression tests for the email/config refactor (Jan 2026).

Verifies:
- POST /api/registrations succeeds even when RESEND_API_KEY is not set
  (Emergent proxy path or logger-only warn path must not break registration).
- 15 seeded runners (bibs 1..15) are present via GET /api/admin/registrations.
- POST /api/admin/timing/reset {distance} clears both start_time AND
  finish_time/finish_seconds for all registrations of that distance.
- POST /api/admin/timing/reset-all clears everything.
- Results are grouped by distance and sorted ascending by finish time.

Cleans up any TEST_ registrations and resets timing/finish state at the end
so the database is left with the 15 seeded runners and no times.
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if not BASE_URL:
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip()
BASE_URL = BASE_URL.rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin"
ADMIN_PASSWORD = "bergslagenadmin"
DISTANCES = ["6 km", "14 km", "47 km"]


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.text}"
    return s


# ---------- seeded data ----------
def test_15_seeded_runners_present(admin):
    r = admin.get(f"{API}/admin/registrations", timeout=30)
    assert r.status_code == 200
    regs = r.json()
    bibs = sorted({rr["bib_number"] for rr in regs if rr.get("bib_number") is not None})
    for b in range(1, 16):
        assert b in bibs, f"Seeded bib {b} missing"
    # 5 per distance among first 15 seeded (ignoring TEST_ ones we may add later)
    per_dist = {d: 0 for d in DISTANCES}
    for rr in regs:
        if rr["bib_number"] and 1 <= rr["bib_number"] <= 15 and rr["distance"] in per_dist:
            per_dist[rr["distance"]] += 1
    assert per_dist == {"6 km": 5, "14 km": 5, "47 km": 5}, per_dist


# ---------- registration works despite no RESEND_API_KEY ----------
def test_registration_47km_no_resend_key():
    """Registration must succeed even if the email provider is missing/failing."""
    ts = int(time.time())
    payload = {
        "name": f"TEST_Regress47_{ts}",
        "birthdate": "1990-06-06",
        "club": "Regression IF",
        "nationality": "Sverige",
        "email": f"test_regress47_{ts}@example.com",
        "distance": "47 km",
        "medal": "Ja",
        "bus_transfer": "Ja",
    }
    r = requests.post(f"{API}/registrations", json=payload, timeout=60)
    assert r.status_code in (200, 201), f"registration failed: {r.status_code} {r.text}"
    data = r.json()
    assert isinstance(data["bib_number"], int) and data["bib_number"] > 0
    assert data["distance"] == "47 km"
    assert data["medal"] == "Ja"
    assert data["bus_transfer"] == "Ja"
    # cleanup via admin
    s = requests.Session()
    s.post(f"{API}/auth/login",
           json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    s.delete(f"{API}/admin/registrations/{data['bib_number']}", timeout=30)


# ---------- timing reset clears finish times ----------
def test_reset_distance_clears_finish_times(admin):
    # Set finish times on seeded bibs 1 (6 km) and 6 (14 km)
    r = admin.get(f"{API}/admin/lookup/1", timeout=30)
    assert r.status_code == 200
    assert r.json()["distance"] == "6 km"

    r = admin.post(f"{API}/admin/finish",
                   json={"bib_number": 1, "finish_time": "00:35:00"}, timeout=30)
    assert r.status_code == 200
    r = admin.post(f"{API}/admin/finish",
                   json={"bib_number": 2, "finish_time": "00:36:00"}, timeout=30)
    assert r.status_code == 200
    r = admin.post(f"{API}/admin/finish",
                   json={"bib_number": 6, "finish_time": "01:20:00"}, timeout=30)
    assert r.status_code == 200

    # Start 6 km timer
    r = admin.post(f"{API}/admin/timing/start", json={"distance": "6 km"}, timeout=30)
    assert r.status_code == 200
    # Reset 6 km should clear start_time AND all 6km finishes
    r = admin.post(f"{API}/admin/timing/reset", json={"distance": "6 km"}, timeout=30)
    assert r.status_code == 200

    # Verify start_time cleared
    r = admin.get(f"{API}/admin/timing", timeout=30)
    assert r.json()["6 km"] is None

    # Verify 6 km finishes cleared but 14 km finish still there
    r = admin.get(f"{API}/admin/lookup/1", timeout=30)
    assert r.json()["finish_time"] is None
    assert r.json()["finish_seconds"] is None
    r = admin.get(f"{API}/admin/lookup/2", timeout=30)
    assert r.json()["finish_time"] is None
    r = admin.get(f"{API}/admin/lookup/6", timeout=30)
    assert r.json()["finish_time"] == "01:20:00"


def test_reset_all_clears_everything(admin):
    # Start all + add a finish
    r = admin.post(f"{API}/admin/timing/start-all", timeout=30)
    assert r.status_code == 200
    r = admin.post(f"{API}/admin/finish",
                   json={"bib_number": 11, "finish_time": "04:00:00"}, timeout=30)
    assert r.status_code == 200

    # Reset all
    r = admin.post(f"{API}/admin/timing/reset-all", timeout=30)
    assert r.status_code == 200

    # Verify all timers null and no finishes
    r = admin.get(f"{API}/admin/timing", timeout=30)
    data = r.json()
    for d in DISTANCES:
        assert data[d] is None, f"{d} start_time not cleared"

    r = admin.get(f"{API}/admin/registrations", timeout=30)
    for rr in r.json():
        assert rr.get("finish_time") is None
        assert rr.get("finish_seconds") is None


# ---------- results ordering ----------
def test_results_grouped_and_sorted(admin):
    # Give a few 47 km finishers
    admin.post(f"{API}/admin/finish",
               json={"bib_number": 11, "finish_time": "05:10:00"}, timeout=30)
    admin.post(f"{API}/admin/finish",
               json={"bib_number": 12, "finish_time": "04:30:00"}, timeout=30)
    admin.post(f"{API}/admin/finish",
               json={"bib_number": 13, "finish_time": "04:55:00"}, timeout=30)

    r = requests.get(f"{API}/results", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert set(data["groups"].keys()) == set(DISTANCES)
    g47 = data["groups"]["47 km"]
    bibs_in_order = [row["bib_number"] for row in g47]
    secs = [row["finish_seconds"] for row in g47]
    assert secs == sorted(secs), f"not sorted asc: {secs}"
    # 12 (fastest) should come before 13 which comes before 11
    assert bibs_in_order.index(12) < bibs_in_order.index(13) < bibs_in_order.index(11)
    # rank field present and sequential
    ranks = [row["rank"] for row in g47]
    assert ranks == list(range(1, len(ranks) + 1))


# ---------- final cleanup: reset DB to clean state ----------
def test_zzz_final_cleanup(admin):
    """Reset all timing + finish times so the app is left clean."""
    r = admin.post(f"{API}/admin/timing/reset-all", timeout=30)
    assert r.status_code == 200
    # Delete any leftover TEST_ registrations (bibs > 15)
    r = admin.get(f"{API}/admin/registrations", timeout=30)
    for rr in r.json():
        if rr["name"].startswith("TEST_") or (rr["bib_number"] and rr["bib_number"] > 15):
            admin.delete(f"{API}/admin/registrations/{rr['bib_number']}", timeout=30)
    # Final assertion: 15 clean seeded runners with no finish times
    r = admin.get(f"{API}/admin/registrations", timeout=30)
    regs = r.json()
    assert len(regs) == 15
    for rr in regs:
        assert rr.get("finish_time") is None
        assert rr.get("finish_seconds") is None
    r = admin.get(f"{API}/admin/timing", timeout=30)
    data = r.json()
    for d in DISTANCES:
        assert data[d] is None
