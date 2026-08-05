from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import logging
import jwt
import bcrypt
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from pydantic import BaseModel, EmailStr, Field

# ------------------------------------------------------------------ config
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get('EMERGENT_EMAIL_KEY')
EMAIL_FROM_NAME = os.environ.get('EMAIL_FROM_NAME', 'Bergslagsleden Ultra')
RACE_DATE = "12 september 2026"

DISTANCES = ["6 km", "14 km", "47 km"]

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ------------------------------------------------------------------ auth helpers
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(hours=12), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ------------------------------------------------------------------ models
class LoginRequest(BaseModel):
    email: str
    password: str


class RegistrationCreate(BaseModel):
    name: str
    birthdate: str
    club: str
    nationality: str
    email: EmailStr
    distance: str
    medal: Optional[str] = None
    bus_transfer: Optional[str] = None


class FinishTimeRequest(BaseModel):
    bib_number: int
    finish_time: str  # "HH:MM:SS" or "H:MM:SS" or "MM:SS"


class TimingActionRequest(BaseModel):
    distance: str


# ------------------------------------------------------------------ utils
def serialize_reg(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "bib_number": doc.get("bib_number"),
        "name": doc.get("name"),
        "birthdate": doc.get("birthdate"),
        "club": doc.get("club"),
        "nationality": doc.get("nationality"),
        "email": doc.get("email"),
        "distance": doc.get("distance"),
        "medal": doc.get("medal"),
        "bus_transfer": doc.get("bus_transfer"),
        "finish_time": doc.get("finish_time"),
        "finish_seconds": doc.get("finish_seconds"),
        "created_at": doc.get("created_at"),
    }


def parse_time_to_seconds(t: str) -> int:
    t = t.strip()
    if not re.match(r"^\d{1,2}:\d{2}(:\d{2})?$", t):
        raise HTTPException(status_code=400, detail="Ogiltigt tidsformat. Använd TT:MM:SS eller MM:SS.")
    parts = [int(p) for p in t.split(":")]
    if len(parts) == 3:
        h, m, s = parts
    else:
        h, m, s = 0, parts[0], parts[1]
    if m >= 60 or s >= 60:
        raise HTTPException(status_code=400, detail="Minuter och sekunder måste vara under 60.")
    return h * 3600 + m * 60 + s


def normalize_time(t: str) -> str:
    total = parse_time_to_seconds(t)
    h = total // 3600
    m = (total % 3600) // 60
    s = total % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


async def next_bib_number() -> int:
    last = await db.registrations.find_one(sort=[("bib_number", -1)])
    if last and last.get("bib_number"):
        return int(last["bib_number"]) + 1
    return 1


async def send_confirmation_email(reg: dict):
    if not EMAIL_KEY:
        logger.warning("EMERGENT_EMAIL_KEY saknas – hoppar över e-post.")
        return
    addons = ""
    if reg["distance"] == "47 km":
        if reg.get("medal"):
            addons += f"<tr><td style='padding:4px 0;color:#4A5A53;'>Medalj</td><td style='padding:4px 0;font-weight:bold;'>{reg['medal']}</td></tr>"
        if reg.get("bus_transfer"):
            addons += f"<tr><td style='padding:4px 0;color:#4A5A53;'>Busstransfer</td><td style='padding:4px 0;font-weight:bold;'>{reg['bus_transfer']}</td></tr>"
    html = f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F0;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #D3D7D4;border-radius:6px;overflow:hidden;">
          <tr><td style="background:#FF5A00;padding:28px 32px;">
            <div style="color:#ffffff;font-size:12px;letter-spacing:3px;text-transform:uppercase;">Bergslagsleden Ultra</div>
            <div style="color:#ffffff;font-size:26px;font-weight:800;margin-top:6px;">Anmälan bekräftad!</div>
          </td></tr>
          <tr><td style="padding:32px;">
            <p style="font-size:16px;color:#1A2421;">Hej {reg['name']},</p>
            <p style="font-size:15px;color:#4A5A53;line-height:1.6;">Tack för din anmälan till Bergslagsleden Ultra den {RACE_DATE}. Här är dina uppgifter:</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;font-size:15px;color:#1A2421;">
              <tr><td style="padding:4px 0;color:#4A5A53;">Deltagarnummer</td><td style="padding:4px 0;font-weight:bold;font-size:20px;color:#FF5A00;">{reg['bib_number']}</td></tr>
              <tr><td style="padding:4px 0;color:#4A5A53;">Namn</td><td style="padding:4px 0;font-weight:bold;">{reg['name']}</td></tr>
              <tr><td style="padding:4px 0;color:#4A5A53;">Klubb</td><td style="padding:4px 0;font-weight:bold;">{reg['club']}</td></tr>
              <tr><td style="padding:4px 0;color:#4A5A53;">Distans</td><td style="padding:4px 0;font-weight:bold;">{reg['distance']}</td></tr>
              {addons}
            </table>
            <p style="font-size:14px;color:#4A5A53;line-height:1.6;">Glöm inte att betala eventuell anmälningsavgift via Swish (070-2417158) eller banköverföring. Allt överskott går till Barndiabetesfonden.</p>
            <p style="font-size:14px;color:#4A5A53;">Vi ses vid start!</p>
          </td></tr>
          <tr><td style="background:#1A2421;padding:20px 32px;color:#8fa39a;font-size:12px;">Bergslagsleden Ultra · Digerberget–Ånnaboda</td></tr>
        </table>
      </td></tr>
    </table>
    """
    payload = {
        "to": [reg["email"]],
        "subject": f"Anmälan bekräftad – Bergslagsleden Ultra (nr {reg['bib_number']})",
        "html": html,
        "from_name": EMAIL_FROM_NAME,
    }
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            resp = await c.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
    except Exception as e:
        logger.error(f"E-post kunde inte skickas: {e}")


# ------------------------------------------------------------------ auth routes
@api_router.post("/auth/login")
async def login(body: LoginRequest, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Fel användarnamn eller lösenord.")
    token = create_access_token(str(user["_id"]), email)
    response.set_cookie(key="access_token", value=token, httponly=True, secure=True,
                        samesite="none", max_age=43200, path="/")
    return {"id": str(user["_id"]), "email": user["email"], "name": user.get("name"), "role": user.get("role")}


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"message": "Utloggad"}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ------------------------------------------------------------------ public routes
@api_router.get("/")
async def root():
    return {"message": "Bergslagsleden Ultra API"}


@api_router.get("/config")
async def config():
    return {"race_date": RACE_DATE, "distances": DISTANCES}


@api_router.post("/registrations")
async def create_registration(body: RegistrationCreate):
    if body.distance not in DISTANCES:
        raise HTTPException(status_code=400, detail="Ogiltig distans.")
    bib = await next_bib_number()
    doc = {
        "bib_number": bib,
        "name": body.name.strip(),
        "birthdate": body.birthdate.strip(),
        "club": body.club.strip() or "Klubblös",
        "nationality": body.nationality.strip(),
        "email": body.email.lower(),
        "distance": body.distance,
        "medal": body.medal if body.distance == "47 km" else None,
        "bus_transfer": body.bus_transfer if body.distance == "47 km" else None,
        "finish_time": None,
        "finish_seconds": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.registrations.insert_one(doc)
    doc["_id"] = result.inserted_id
    await send_confirmation_email(doc)
    return serialize_reg(doc)


@api_router.get("/startlist")
async def startlist():
    regs = await db.registrations.find().sort("bib_number", 1).to_list(5000)
    out = {d: [] for d in DISTANCES}
    for r in regs:
        d = r.get("distance")
        if d in out:
            out[d].append({
                "bib_number": r.get("bib_number"),
                "name": r.get("name"),
                "club": r.get("club"),
                "nationality": r.get("nationality"),
            })
    return {"distances": DISTANCES, "groups": out}


@api_router.get("/results")
async def results():
    regs = await db.registrations.find({"finish_seconds": {"$ne": None}}).to_list(5000)
    out = {d: [] for d in DISTANCES}
    for r in regs:
        d = r.get("distance")
        if d in out:
            out[d].append({
                "bib_number": r.get("bib_number"),
                "name": r.get("name"),
                "club": r.get("club"),
                "nationality": r.get("nationality"),
                "finish_time": r.get("finish_time"),
                "finish_seconds": r.get("finish_seconds"),
            })
    for d in out:
        out[d].sort(key=lambda x: x["finish_seconds"])
        for i, row in enumerate(out[d]):
            row["rank"] = i + 1
    return {"distances": DISTANCES, "groups": out}


# ------------------------------------------------------------------ admin routes
@api_router.get("/admin/registrations")
async def admin_registrations(user: dict = Depends(get_current_user)):
    regs = await db.registrations.find().sort("bib_number", 1).to_list(5000)
    return [serialize_reg(r) for r in regs]


@api_router.get("/admin/lookup/{bib}")
async def admin_lookup(bib: int, user: dict = Depends(get_current_user)):
    r = await db.registrations.find_one({"bib_number": bib})
    if not r:
        raise HTTPException(status_code=404, detail="Deltagarnummer hittades inte.")
    return serialize_reg(r)


@api_router.post("/admin/finish")
async def admin_finish(body: FinishTimeRequest, user: dict = Depends(get_current_user)):
    r = await db.registrations.find_one({"bib_number": body.bib_number})
    if not r:
        raise HTTPException(status_code=404, detail="Deltagarnummer hittades inte.")
    normalized = normalize_time(body.finish_time)
    seconds = parse_time_to_seconds(body.finish_time)
    await db.registrations.update_one(
        {"bib_number": body.bib_number},
        {"$set": {"finish_time": normalized, "finish_seconds": seconds}},
    )
    r["finish_time"] = normalized
    r["finish_seconds"] = seconds
    return serialize_reg(r)


@api_router.delete("/admin/finish/{bib}")
async def admin_clear_finish(bib: int, user: dict = Depends(get_current_user)):
    r = await db.registrations.find_one({"bib_number": bib})
    if not r:
        raise HTTPException(status_code=404, detail="Deltagarnummer hittades inte.")
    await db.registrations.update_one({"bib_number": bib},
                                      {"$set": {"finish_time": None, "finish_seconds": None}})
    return {"message": "Tid rensad"}


@api_router.delete("/admin/registrations/{bib}")
async def admin_delete_registration(bib: int, user: dict = Depends(get_current_user)):
    res = await db.registrations.delete_one({"bib_number": bib})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Deltagarnummer hittades inte.")
    return {"message": "Anmälan borttagen"}


# ------------------------------------------------------------------ timing (live)
@api_router.get("/admin/timing")
async def get_timing(user: dict = Depends(get_current_user)):
    docs = await db.timing.find().to_list(100)
    state = {d: None for d in DISTANCES}
    for doc in docs:
        if doc.get("distance") in state:
            state[doc["distance"]] = doc.get("start_time")
    state["server_now"] = datetime.now(timezone.utc).isoformat()
    return state


@api_router.post("/admin/timing/start")
async def start_timing(body: TimingActionRequest, user: dict = Depends(get_current_user)):
    if body.distance not in DISTANCES:
        raise HTTPException(status_code=400, detail="Ogiltig distans.")
    now = datetime.now(timezone.utc).isoformat()
    await db.timing.update_one({"distance": body.distance}, {"$set": {"start_time": now}}, upsert=True)
    return {"distance": body.distance, "start_time": now}


@api_router.post("/admin/timing/start-all")
async def start_all_timing(user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    for d in DISTANCES:
        await db.timing.update_one({"distance": d}, {"$set": {"start_time": now}}, upsert=True)
    return {"start_time": now}


@api_router.post("/admin/timing/reset")
async def reset_timing(body: TimingActionRequest, user: dict = Depends(get_current_user)):
    if body.distance not in DISTANCES:
        raise HTTPException(status_code=400, detail="Ogiltig distans.")
    await db.timing.update_one({"distance": body.distance}, {"$set": {"start_time": None}}, upsert=True)
    await db.registrations.update_many({"distance": body.distance}, {"$set": {"finish_time": None, "finish_seconds": None}})
    return {"distance": body.distance, "start_time": None}


@api_router.post("/admin/timing/reset-all")
async def reset_all_timing(user: dict = Depends(get_current_user)):
    await db.timing.update_many({}, {"$set": {"start_time": None}})
    await db.registrations.update_many({}, {"$set": {"finish_time": None, "finish_seconds": None}})
    return {"message": "Tidtagningen är nollställd."}


# ------------------------------------------------------------------ startup
@app.on_event("startup")
async def startup():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email, "password_hash": hash_password(admin_password),
            "name": "Funktionär", "role": "admin", "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Admin skapad: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Admin-lösenord uppdaterat.")
    await db.users.create_index("email", unique=True)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()
