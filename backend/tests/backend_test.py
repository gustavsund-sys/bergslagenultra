"""Bergslagsleden Ultra backend tests."""
import os
import time
from pathlib import Path
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if not BASE_URL:
    # Fallback: read frontend/.env
    env_file = Path(__file__).resolve().parents[2] / "frontend" / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip()
if not BASE_URL:
    pytest.skip("Set REACT_APP_BACKEND_URL to run backend integration tests", allow_module_level=True)
BASE_URL = BASE_URL.rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


# ---------- health / config ----------
def test_config(client):
    r = client.get(f"{API}/config", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data["distances"] == ["6 km", "14 km", "47 km"]


# ---------- auth ----------
def test_login_bad_password(client):
    r = client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=30)
    assert r.status_code == 401


def test_login_good_and_me(admin_session):
    r = admin_session.get(f"{API}/auth/me", timeout=30)
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN_EMAIL


def test_me_unauthed(client):
    r = client.get(f"{API}/auth/me", timeout=30)
    assert r.status_code == 401


# ---------- registration ----------
@pytest.fixture(scope="session")
def created_regs(client):
    """Create 3 registrations across distances (47/14/6) so we can test grouping & results ordering."""
    ts = int(time.time())
    payloads = [
        {"name": f"TEST_Alice_{ts}", "birthdate": "1990-01-01", "club": "Testklubb",
         "nationality": "Sverige", "email": f"test_alice_{ts}@example.com",
         "distance": "47 km", "medal": "Ja", "bus_transfer": "Nej"},
        {"name": f"TEST_Bob_{ts}", "birthdate": "1985-05-05", "club": "Bobs IF",
         "nationality": "Sverige", "email": f"test_bob_{ts}@example.com",
         "distance": "14 km"},
        {"name": f"TEST_Cecilia_{ts}", "birthdate": "2000-03-03", "club": "",
         "nationality": "Sverige", "email": f"test_cec_{ts}@example.com",
         "distance": "6 km"},
    ]
    regs = []
    for p in payloads:
        r = client.post(f"{API}/registrations", json=p, timeout=60)
        assert r.status_code == 200, f"registration failed: {r.status_code} {r.text}"
        d = r.json()
        assert d["bib_number"] and isinstance(d["bib_number"], int)
        assert d["distance"] == p["distance"]
        if p["distance"] == "47 km":
            assert d["medal"] == "Ja"
            assert d["bus_transfer"] == "Nej"
        else:
            assert d["medal"] is None
            assert d["bus_transfer"] is None
        regs.append(d)
    # Bib numbers should be strictly increasing
    bibs = [r["bib_number"] for r in regs]
    assert bibs == sorted(bibs)
    return regs


def test_registrations_created(created_regs):
    assert len(created_regs) == 3


def test_registration_invalid_distance(client):
    r = client.post(f"{API}/registrations", json={
        "name": "X", "birthdate": "1990-01-01", "club": "c", "nationality": "SE",
        "email": "x@example.com", "distance": "99 km"}, timeout=30)
    assert r.status_code == 400


def test_registration_missing_field(client):
    r = client.post(f"{API}/registrations", json={"name": "X"}, timeout=30)
    assert r.status_code == 422


def test_startlist_contains_created(client, created_regs):
    r = client.get(f"{API}/startlist", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert set(data["groups"].keys()) == {"6 km", "14 km", "47 km"}
    all_names = []
    for group in data["groups"].values():
        all_names.extend([x["name"] for x in group])
    for reg in created_regs:
        assert reg["name"] in all_names


# ---------- admin ----------
def test_admin_endpoints_unauthed(client):
    r = client.get(f"{API}/admin/registrations", timeout=30)
    assert r.status_code == 401


def test_admin_lookup_and_finish(admin_session, created_regs):
    # Lookup all 3
    for reg in created_regs:
        r = admin_session.get(f"{API}/admin/lookup/{reg['bib_number']}", timeout=30)
        assert r.status_code == 200
        assert r.json()["name"] == reg["name"]

    # Invalid bib
    r = admin_session.get(f"{API}/admin/lookup/999999", timeout=30)
    assert r.status_code == 404

    # Post finish times (Alice=47km slower, Bob=14km, Cecilia=6km fastest)
    times = {
        created_regs[0]["bib_number"]: "4:12:33",   # 47 km
        created_regs[1]["bib_number"]: "01:30:15",  # 14 km
        created_regs[2]["bib_number"]: "35:20",     # 6 km MM:SS
    }
    for bib, t in times.items():
        r = admin_session.post(f"{API}/admin/finish", json={"bib_number": bib, "finish_time": t}, timeout=30)
        assert r.status_code == 200, f"finish failed for {bib}: {r.text}"
        d = r.json()
        assert d["finish_time"] is not None
        assert len(d["finish_time"]) == 8  # HH:MM:SS
        assert d["finish_seconds"] > 0

    # Invalid time format
    r = admin_session.post(f"{API}/admin/finish",
                           json={"bib_number": created_regs[0]["bib_number"], "finish_time": "abc"},
                           timeout=30)
    assert r.status_code == 400

    # Invalid bib
    r = admin_session.post(f"{API}/admin/finish",
                           json={"bib_number": 999999, "finish_time": "1:00:00"}, timeout=30)
    assert r.status_code == 404


def test_results_sorted(client, admin_session, created_regs):
    # Add a second 47km finisher slower than Alice to check sort
    ts = int(time.time())
    payload = {"name": f"TEST_Dan_{ts}", "birthdate": "1988-02-02", "club": "Slow",
               "nationality": "Sverige", "email": f"test_dan_{ts}@example.com",
               "distance": "47 km", "medal": "Nej", "bus_transfer": "Nej"}
    r = client.post(f"{API}/registrations", json=payload, timeout=60)
    assert r.status_code == 200
    dan_bib = r.json()["bib_number"]
    r = admin_session.post(f"{API}/admin/finish",
                           json={"bib_number": dan_bib, "finish_time": "5:30:00"}, timeout=30)
    assert r.status_code == 200

    r = client.get(f"{API}/results", timeout=30)
    assert r.status_code == 200
    data = r.json()
    g47 = data["groups"]["47 km"]
    # Ensure Alice is ranked before Dan
    alice_bib = created_regs[0]["bib_number"]
    ranks = {row["bib_number"]: row["rank"] for row in g47}
    assert alice_bib in ranks and dan_bib in ranks
    assert ranks[alice_bib] < ranks[dan_bib]
    # Sorted by seconds ascending
    secs = [row["finish_seconds"] for row in g47]
    assert secs == sorted(secs)
    # Rank 1 has lowest seconds
    rank1 = next(r for r in g47 for _ in [0] if r["rank"] == 1)
    assert rank1["finish_seconds"] == min(secs)

    # Cleanup Dan
    admin_session.delete(f"{API}/admin/registrations/{dan_bib}", timeout=30)


def test_cleanup(admin_session, created_regs):
    for reg in created_regs:
        admin_session.delete(f"{API}/admin/registrations/{reg['bib_number']}", timeout=30)
