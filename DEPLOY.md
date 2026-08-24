# Driftsättning – GitHub Pages och Firebase Spark

## 1. Aktivera Firebase-tjänster

I Firebase Console för projektet `bergslagenultra`:

1. Skapa Cloud Firestore i produktionsläge, helst i en europeisk region.
2. Öppna Authentication → Sign-in method och aktivera Email/Password.
3. Skapa funktionärskontot under Authentication → Users.
4. Lägg till GitHub Pages-domänen under Authentication → Settings →
   Authorized domains. Exempel: `gustavsund-sys.github.io`.

## 2. Skapa startnummerräknaren

Skapa dokumentet nedan manuellt i Firestore:

```text
Collection: metadata
Document:   counters
Field:      nextBib
Type:       number
Value:      1
```

Om befintliga deltagare importeras ska `nextBib` sättas till det högsta
startnumret plus ett.

## 3. Ge funktionären adminbehörighet

Kopiera användarens UID från Authentication → Users. Skapa sedan:

```text
Collection: admins
Document:   <användarens UID>
Field:      email
Type:       string
Value:      <funktionärens e-postadress>
```

Dokumentets ID, inte e-postfältet, styr behörigheten.

## 4. Publicera Firestore-regler

Installera Firebase CLI, logga in och välj projektet:

```bash
npx firebase-tools login
npx firebase-tools use bergslagenultra
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

Reglerna separerar privata personuppgifter från publika start- och
resultatlistor. Publicera inte appen med Firestore i testläge.

## 5. Aktivera GitHub Pages

I GitHub-repot:

1. Öppna Settings → Pages.
2. Välj Source: GitHub Actions.
3. Pusha grenen till `main`.

Workflow-filen `.github/workflows/deploy-pages.yml` installerar beroenden,
bygger `frontend/` och publicerar resultatet. Appen använder hash-routing,
exempelvis `/#/admin/timing`, för att alla rutter ska fungera på GitHub Pages.

## 6. Kontroll efter publicering

- Skicka en testanmälan och kontrollera att två dokument skapas med samma
  startnummer i `registrations_private` och `registrations_public`.
- Kontrollera att en utloggad besökare inte kan läsa
  `registrations_private`.
- Logga in som funktionär och testa betalstatus, tidtagning och målgång.
- Öppna livetavlan i ett separat fönster och kontrollera realtidsuppdateringen.

## E-post

Spark kan inte köra en säker serverfunktion för Resend eller Gmail SMTP.
Automatiska bekräftelsemejl kräver en separat backend eller Blaze-planen.
