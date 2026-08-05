# Deploy-guide – Bergslagsleden Ultra

Companion-app för loppet Bergslagsleden Ultra.
Stack: **React** (frontend) · **FastAPI/Python** (backend) · **MongoDB** (databas).

> Detta är en fullstack-app. Den kan **inte** köras på GitHub Pages eller ett vanligt
> (delat) webbhotell – den behöver en riktig server (VPS/molnserver) eller Emergent Deploy.

---

## Innehåll
1. Snabbstart lokalt
2. Miljövariabler
3. Bygg frontend
4. Kör backend
5. Produktion på en VPS (nginx + systemd + HTTPS)
6. E-post (eget Resend-konto)
7. Vanliga problem

---

## 1. Snabbstart lokalt

Krav: Python 3.11+, Node 18+, Yarn, MongoDB.

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fyll i värden
uvicorn server:app --host 0.0.0.0 --port 8001

# Frontend (nytt terminalfönster)
cd frontend
yarn install
cp .env.example .env          # sätt REACT_APP_BACKEND_URL=http://localhost:8001
yarn start
```

---

## 2. Miljövariabler

Kopiera exempelfilerna och fyll i:

- `backend/.env`  (se `backend/.env.example`)
- `frontend/.env` (se `frontend/.env.example`)

Viktigast:
- `MONGO_URL`, `DB_NAME` – databas
- `JWT_SECRET` – lång slumpsträng: `openssl rand -hex 32`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` – funktionärsinloggning (skapas automatiskt vid start)
- `FRONTEND_URL` / `CORS_ORIGINS` – frontendens publika URL
- `REACT_APP_BACKEND_URL` – backendens publika URL (i frontend/.env)
- E-post: se avsnitt 6

> Alla API-rutter ligger under `/api`. Backend lyssnar internt på port `8001`.

---

## 3. Bygg frontend (produktion)

```bash
cd frontend
yarn install
yarn build           # skapar mappen build/ med statiska filer
```

Servera `frontend/build/` med nginx (se avsnitt 5).

---

## 4. Kör backend (produktion)

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2
```

Håll processen igång med **systemd** eller **supervisor** (se nedan).

> Obs: raden `emergentintegrations` i `requirements.txt` är bortkommenterad –
> den används inte i koden och ligger på ett privat paket-index (endast Emergent).

---

## 5. Produktion på en VPS (t.ex. one.com Virtual Server / DigitalOcean)

### 5.1 Installera beroenden
```bash
sudo apt update
sudo apt install -y python3-venv python3-pip nginx
# Node/Yarn
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs && sudo npm i -g yarn
# MongoDB: installera lokalt ELLER använd MongoDB Atlas (moln)
```

### 5.2 Klona koden
```bash
cd /opt
git clone <DITT_GITHUB_REPO> bergslagsleden
cd bergslagsleden
```

### 5.3 systemd-tjänst för backend
Skapa `/etc/systemd/system/bergslagsleden-api.service`:
```ini
[Unit]
Description=Bergslagsleden Ultra API
After=network.target

[Service]
WorkingDirectory=/opt/bergslagsleden/backend
Environment="PATH=/opt/bergslagsleden/backend/.venv/bin"
ExecStart=/opt/bergslagsleden/backend/.venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001 --workers 2
Restart=always

[Install]
WantedBy=multi-user.target
```
```bash
cd /opt/bergslagsleden/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fyll i
sudo systemctl daemon-reload
sudo systemctl enable --now bergslagsleden-api
```

### 5.4 Bygg frontend
```bash
cd /opt/bergslagsleden/frontend
cp .env.example .env    # REACT_APP_BACKEND_URL=https://bergslagsledenultra.se
yarn install && yarn build
```

### 5.5 nginx (servera frontend + proxa /api)
Skapa `/etc/nginx/sites-available/bergslagsleden`:
```nginx
server {
    listen 80;
    server_name bergslagsledenultra.se www.bergslagsledenultra.se;

    root /opt/bergslagsleden/frontend/build;
    index index.html;

    # API -> backend
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # React SPA (alla andra rutter -> index.html)
    location / {
        try_files $uri /index.html;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/bergslagsleden /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 5.6 HTTPS (gratis via Let's Encrypt)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d bergslagsledenultra.se -d www.bergslagsledenultra.se
```

> Eftersom frontend och backend ligger på samma domän blir inloggnings-cookien
> (httpOnly) enkel att hantera. Se till att `FRONTEND_URL`/`CORS_ORIGINS` i
> backend/.env matchar din domän.

---

## 6. E-post (eget Resend-konto)

Appen skickar en bekräftelse vid anmälan. Koden stödjer två lägen:

- **Self-hosting:** sätt `RESEND_API_KEY` och `RESEND_FROM` i `backend/.env`.
  1. Skapa konto på https://resend.com
  2. Verifiera din avsändardomän (t.ex. `bergslagsledenultra.se`)
  3. Skapa en API-nyckel → `RESEND_API_KEY`
  4. `RESEND_FROM=Bergslagsleden Ultra <noreply@bergslagsledenultra.se>`
- **På Emergent:** lämna `RESEND_API_KEY` tom och använd `EMERGENT_EMAIL_KEY`.

Om ingen nyckel är satt hoppas mejlet bara över – **anmälan lyckas ändå**.

---

## 7. Vanliga problem

- **Frontend når inte backend** → kontrollera `REACT_APP_BACKEND_URL` (måste vara
  hela https-URL:en) och att nginx proxar `/api/`.
- **CORS-fel / utloggad direkt** → `FRONTEND_URL` i backend/.env måste matcha sidans URL.
- **`pip install` misslyckas på emergentintegrations** → den raden ska vara
  bortkommenterad (den behövs inte utanför Emergent).
- **MongoDB-anslutning** → verifiera `MONGO_URL` och att MongoDB körs (`systemctl status mongod`).
- **Admin kan inte logga in** → admin skapas vid backend-start från
  `ADMIN_EMAIL`/`ADMIN_PASSWORD`; ändra dem i `.env` och starta om backend.
