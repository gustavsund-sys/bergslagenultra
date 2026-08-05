# Bergslagsleden Ultra – Companion App (PRD)

## Original problem statement
Bygg en responsiv companion-app till springloppet Bergslagsleden Ultra (12 sep 2026), användbar på både mobil och laptop. Löpare ska kunna anmäla sig (baserat på gamla formuläret på bergslagsledenultra.se). Funktionärer ska via ett admingränssnitt fylla i sluttider genom att bara ange deltagarnummer + sluttid; namn och klubb hämtas från databasen. Snyggt slutresultat genereras, sorterat och grupperat per vald loppdistans.

## Architecture
- Backend: FastAPI + MongoDB (motor). All routes under /api.
- Auth: JWT (httpOnly cookie), single admin role, seeded from ADMIN_EMAIL/ADMIN_PASSWORD.
- Email: Emergent-managed Resend (confirmation email on registration).
- Frontend: React + Tailwind + shadcn/ui, react-router. Fonts: Outfit + Manrope. Brand orange #FF5A00, forest theme.

## Distances
6 km, 14 km, 47 km (47 km has medal + bus-transfer addons).

## User personas
- Löpare/deltagare: anmäler sig, får deltagarnummer + bekräftelsemail, ser startlista/resultat.
- Funktionär (admin): loggar in, registrerar sluttider per deltagarnummer, ser alla anmälningar.

## Implemented (2026-08)
- Landing page (hero, distanser, välgörenhet Barndiabetesfonden).
- Registrering (/anmalan) med villkorliga 47km-tillval, deltagarnummer auto-tilldelas, bekräftelsemail.
- Startlista (/startlista) grupperad per distans.
- Resultat (/resultat) sorterat per sluttid, grupperat per distans, topp-3 markerade.
- Admin login (/admin/login) + dashboard (/admin): sluttidsregistrering via deltagarnummer med auto-lookup av namn/klubb, filter, rensa tid, ta bort anmälan.
- Full E2E-testad: 100% backend + frontend.

## Backlog / future (P1/P2)
- P1: Atomisk deltagarnummer-räknare (counters collection).
- P1: Lagra tillval som enum istället för lång text.
- P2: Brute-force-skydd på login.
- P2: Export av resultat (CSV/PDF), åldersklasser, kön.
- P2: Fire-and-forget email (asyncio.create_task).

## Credentials
See /app/memory/test_credentials.md (admin: gustavsund@gmail.com).
