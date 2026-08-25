# Bergslagsleden Ultra

Webbapp för anmälan, startlistor, tidtagning och resultat för Bergslagsleden
Ultra. Appen är byggd för att köras utan egen server:

- React på GitHub Pages
- Cloud Firestore på Firebase Spark
- Firebase Authentication för funktionärer
- Firestore Security Rules för behörighet och datavalidering

## Datamodell

Personuppgifter och publik tävlingsdata hålls åtskilda:

- `registrations_private`: fullständiga anmälningar; endast funktionärer
- `registrations_public`: namn, klubb, distans, startnummer och resultat
- `public_results`: kompakta publika resultatsammanställningar per distans
- `timing`: servergenererade starttider per distans
- `admins`: funktionärernas Firebase Auth-UID:n
- `metadata/counters`: atomär räknare för nästa startnummer

## Lokal utveckling

```bash
cd frontend
yarn install
yarn start
```

Firebase-konfigurationen för projektet `bergslagenultra` finns i
`frontend/src/lib/firebase.js`. Konfigurationen är publik enligt Firebase
Web SDK:s modell; åtkomsten skyddas av `firestore.rules`.

## Produktion

Push till `main` bygger och publicerar automatiskt via GitHub Actions. Följ
engångsinställningarna i [DEPLOY.md](DEPLOY.md) innan första publiceringen.

## Begränsning på Spark

Automatiska bekräftelsemejl är avstängda. En Resend- eller Gmail-hemlighet får
inte lagras i frontendkod. Övriga funktioner, inklusive realtidstidtagning,
fungerar med Firebase Spark.

Den tidigare FastAPI/MongoDB-backenden ligger kvar i `backend/` som
migrationsreferens men används inte av den publicerade appen.
