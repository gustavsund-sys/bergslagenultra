"""Tests for the new live-timing endpoints."""
import os
from pathlib import Path
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if not BASE_URL:
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
DISTANCES = ["6 km", "14 km", "47 km"]


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.text}"
    return s


def test_timing_unauthed():
    r = requests.get(f"{API}/admin/timing", timeout=30)
    assert r.status_code == 401


def test_get_timing_shape(admin):
    r = admin.get(f"{API}/admin/timing", timeout=30)
    assert r.status_code == 200
    data = r.json()
    for d in DISTANCES:
        assert d in data


def test_start_and_reset_single_distance(admin):
    r = admin.post(f"{API}/admin/timing/start", json={"distance": "6 km"}, timeout=30)
    assert r.status_code == 200
    assert r.json()["distance"] == "6 km"
    assert r.json()["start_time"] is not None

    r = admin.get(f"{API}/admin/timing", timeout=30)
    assert r.json()["6 km"] is not None

    r = admin.post(f"{API}/admin/timing/reset", json={"distance": "6 km"}, timeout=30)
    assert r.status_code == 200
    r = admin.get(f"{API}/admin/timing", timeout=30)
    assert r.json()["6 km"] is None


def test_start_invalid_distance(admin):
    r = admin.post(f"{API}/admin/timing/start", json={"distance": "100 km"}, timeout=30)
    assert r.status_code == 400


def test_start_all(admin):
    r = admin.post(f"{API}/admin/timing/start-all", timeout=30)
    assert r.status_code == 200
    start = r.json()["start_time"]
    assert start is not None
    r = admin.get(f"{API}/admin/timing", timeout=30)
    data = r.json()
    for d in DISTANCES:
        assert data[d] == start
    # reset all
    for d in DISTANCES:
        admin.post(f"{API}/admin/timing/reset", json={"distance": d}, timeout=30)


def test_finish_and_edit_and_clear_flow(admin):
    # Assumes at least bibs 1-15 exist (seeded). We use bib 1.
    r = admin.get(f"{API}/admin/lookup/1", timeout=30)
    if r.status_code != 200:
        pytest.skip("Bib 1 not seeded")
    # First save
    r = admin.post(f"{API}/admin/finish", json={"bib_number": 1, "finish_time": "00:32:15"}, timeout=30)
    assert r.status_code == 200
    assert r.json()["finish_time"] == "00:32:15"

    # Verify via /api/results
    r = requests.get(f"{API}/results", timeout=30)
    assert r.status_code == 200
    groups = r.json()["groups"]
    found = None
    for d, rows in groups.items():
        for row in rows:
            if row["bib_number"] == 1:
                found = (d, row)
    assert found is not None
    assert found[1]["finish_time"] == "00:32:15"

    # Edit
    r = admin.post(f"{API}/admin/finish", json={"bib_number": 1, "finish_time": "03:15:00"}, timeout=30)
    assert r.status_code == 200
    assert r.json()["finish_time"] == "03:15:00"

    # MM:SS format accepted
    r = admin.post(f"{API}/admin/finish", json={"bib_number": 1, "finish_time": "42:10"}, timeout=30)
    assert r.status_code == 200
    assert r.json()["finish_time"] == "00:42:10"

    # Clear
    r = admin.delete(f"{API}/admin/finish/1", timeout=30)
    assert r.status_code == 200
    r = admin.get(f"{API}/admin/lookup/1", timeout=30)
    assert r.json()["finish_time"] is None


def test_invalid_time_format(admin):
    r = admin.post(f"{API}/admin/finish", json={"bib_number": 1, "finish_time": "notatime"}, timeout=30)
    assert r.status_code == 400
