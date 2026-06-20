# Johannas Kakor – Etikettsystem

Modern svensk webbapp för att designa, förhandsgranska och skriva ut produkt­etiketter på termoskrivare (testad mot **Katasymbol T50M Pro**, men fungerar mot vilken etikettskrivare som helst som accepterar standard webbläsarutskrift / PDF).

Byggd med **React + TypeScript + Tailwind CSS + Vite**. All data sparas lokalt i din webbläsare – ingen server, inget konto.

---

## Funktioner

- Live-redigerare för bageriprodukter
- Förhandsvisning i realtid med exakt mm-skala
- Direktutskrift via `Ctrl+P` (skarp svart text på vit bakgrund)
- Export till PDF i exakt etikettstorlek
- Spara/ladda mallar (lokal lagring)
- Färdiga mallar: Kanelbulle, Kardemummabulle, Mandelkubb, Rågbröd
- Sökbart **svenskt ingrediensregister** med 150+ vanliga bagerivaror
- Egna ingredienser med autocomplete + drag-and-drop sortering
- Automatisk allergendetektering – allergener skrivs i **VERSALER** inne i ingredienstexten:
  > "Vetemjöl, VATTEN, MJÖLK, smör, ÄGG, jäst"
- QR-kod (URL, produktsida, ingredienslista, egen text)
- Streckkod (CODE128, EAN-13, EAN-8, UPC)
- Loggauppladdning (PNG/SVG/JPG/WEBP) med svartvitt termoläge
- Färdiga termostorlekar: 62×29, 62×40, 89×36, 102×59, 50×80, 50×120, 70×100, 100×150 mm
- Anpassad etikettstorlek (mm)
- 4 layout-varianter: Klassisk, Kompakt, Banner, Minimal
- Mobilanpassat gränssnitt
- 100 % på svenska

## Allergener som hanteras

GLUTEN · MJÖLK · ÄGG · NÖTTER · MANDEL · SOJA · SESAM · JORDNÖTTER · FISK · SKALDJUR · SELLERI · SENAP · LUPIN · SULFITER

## Kom igång

Kräver **Node.js 18+**.

```bash
cd Johannas-kakor
npm install
npm run dev
```

Öppna sedan http://localhost:3050

### Bygga produktion

```bash
npm run build
npm run preview   # serverar på port 3050
```

## Miljövariabler (Stripe-betalning)

Prenumerationsbetalning hanteras via Stripe. Nycklarna läses **endast** från
miljövariabler (aldrig från `settings.json`, databasen eller klienten). Kopiera
`.env.example` till `.env` och fyll i:

| Variabel | Beskrivning |
| --- | --- |
| `STRIPE_SECRET_KEY` | Hemlig API-nyckel (`sk_test_…` i utveckling). |
| `STRIPE_WEBHOOK_SECRET` | Signeringshemlighet för `/api/billing/webhook` (eller `whsec_…` från `stripe listen`). |
| `STRIPE_PRICE_ID` | Pris-id för prenumerationen som Checkout säljer. |

`.env` är gitignorerad. I produktion sätts variablerna som riktiga
miljövariabler. Utan dem är betalvägarna inaktiva (returnerar `503`); resten av
appen fungerar som vanligt.

### Webhook bakom Cloudflare

Endpointen `POST /api/billing/webhook` verifieras enbart via Stripes signatur på
den råa request-bodyn. Cloudflare framför origin måste därför:

- **Inte** utmana (Bot Fight / Managed Challenge), cacha eller rate-limita den vägen.
- Lämna bodyn orörd (ingen transformering).

Korrektheten beror **inte** på klient-IP eller proxy-headers – sätt alltså inga
`TRUST_PROXY`-antaganden för webhooken; den litar bara på den signerade bodyn.

### Lokal test av webhook

```bash
stripe listen --forward-to localhost:3060/api/billing/webhook
# klistra in den utskrivna whsec_… som STRIPE_WEBHOOK_SECRET i .env
```

## Export & vattenmärkning (PDF/PNG)

PDF- och PNG-export renderas **på servern** i headless Chromium (`puppeteer`),
som laddar appens dolda `/__export`-route och fotograferar/skriver ut etiketten.
Det gör att vattenmärket för icke-betalande konton bakas in i filen och **inte**
kan tas bort i webbläsarens devtools.

- **Vem vattenmärks?** Beslutas server-side: inloggade konton via `isWatermarked()`
  (plan/prenumerationsstatus), anonyma gratisslugar via sluggens plan
  (`prova` = trial → vattenmärks, `johanna` = free_comp → ren). En klient-flagga
  litas aldrig på vid själva exporten.
- **Termoutskrift** (`window.print()`) kan inte ske server-side; där bakas en liten
  svensk fotnot in i etikettlayouten i stället (samma rad som i exporten).
- **Live-förhandsvisningen vattenmärks aldrig.**

Chromium laddas ned automatiskt när `npm install` kör. I produktion (Linux)
krävs systembibliotek för Chromium. I utveckling serverar API:t inte SPA:t, så
sätt `EXPORT_BASE_URL` till en körande build (t.ex. `http://localhost:3050`),
annars används API:ts egen origin (som serverar `dist` i produktion).

## Docker / driftsättning

Appen körs som **en container** (Express + byggd SPA + Chromium för export).

```bash
cp .env.example .env      # fyll i alla värden (secrets injiceras i runtime)
docker compose up -d --build
```

- All konfiguration/secrets kommer **endast** från `.env` (env_file) – inget
  bakas in i image-lager, `settings.json` krävs inte i containern.
- SQLite ligger på en namngiven volym (`app-data` → `/app/data`); sätt `DB_PATH`
  därefter. `dist` byggs i imagen.
- Containern binds till `127.0.0.1:3060` och nås via din reverse proxy.

### Bakom Cloudflare + reverse proxy

Sätt `TRUST_PROXY` så att Express ser rätt klient-IP genom kedjan
Cloudflare → proxy → app. Värdet kan vara ett **hopp-antal** (`2`), `true`/`false`,
eller en **lista med betrodda proxy-IP/CIDR** (kommaseparerat) – t.ex. din proxys
IP. Använd aldrig `true` i produktion (då kan klienter förfalska `X-Forwarded-For`).

> Verifiera: logga `req.ip` för en riktig request. Visar den proxyns/Cloudflares
> IP i stället för klientens, lägger din proxy till `X-Forwarded-For` – lägg då
> även till Cloudflares IP-intervall i `TRUST_PROXY`, eller låt proxyn sätta
> klient-IP från `CF-Connecting-IP`.

Stripe-webhooken (`/api/billing/webhook`) tar emot **rå body** och rate-limitas
inte – oberoende av `TRUST_PROXY`.

### E-post (SMTP)

Inloggningslänkar skickas via SMTP (Gmail / Google Workspace). Konfigureras med
`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` och `EMAIL_FROM`.

- Använd ett **app-lösenord** (kräver 2-stegsverifiering på Google-kontot) – inte
  det vanliga lösenordet.
- `EMAIL_FROM` måste vara det autentiserade kontot eller en godkänd
  "skicka e-post som"-alias (annars skriver Gmail om eller avvisar avsändaren).
- Standard: `smtp.gmail.com:587` (STARTTLS). Utan SMTP-konfig loggas mejlen bara
  till konsolen (utveckling).

## Näringsdeklaration (Livsmedelsverket)

Näringsvärden beräknas från receptet (Phase B) mot en lokalt importerad kopia av
**Livsmedelsverkets Livsmedelsdatabas** – ingen live-API-anrop per beräkning.

**Importera datan (operatör):**
1. Lägg en export från Livsmedelsdatabasen i `NUTRITION_DIR`
   (standard: `<data>/livsmedelsdatabasen/`), som **CSV eller JSON**.
2. Gå till `/admin`, ange version (t.ex. `2024-01`) och klicka **Importera**.
   Re-import skriver över datan (versionsstämplas).

**Förväntat filformat** (per 100 g). CSV med `;` eller `,` som avgränsare och
decimalkomma stöds; svenska rubriker matchas automatiskt. Nödvändiga kolumner:

| Fält | Accepterade rubriker (urval) |
| --- | --- |
| livsmedelsnummer | `Livsmedelsnummer`, `Nummer` |
| namn | `Livsmedelsnamn`, `Namn` |
| energi (kcal) | `Energi (kcal)` |
| energi (kJ) | `Energi (kJ)` |
| fett | `Fett` |
| varav mättat | `Mättat fett`, `Summa mättade fettsyror` |
| kolhydrat | `Kolhydrater` |
| varav socker | `Sockerarter` |
| protein | `Protein` |
| salt | `Salt` |

(JSON: en array av objekt med dessa fält, eller nycklarna `livsmedelsnummer, namn,
energi_kcal, energi_kj, fett, mattat_fett, kolhydrat, sockerarter, protein, salt`.)

- **Källvärden ändras aldrig** – de lagras som importerade. Per-recept-värden är en
  **beräkning** (per 100 g × gram, normaliserat). Attribution visas där värden visas:
  *"Källa: Livsmedelsverkets Livsmedelsdatabas version [X]"* (CC BY 4.0).
- Koppla varje ingrediens till ett **livsmedelsnummer** i `/admin`.
- Funktionen är **premium** (kräver betald plan / komp). Excel: exportera till CSV/JSON
  först (xlsx läses inte direkt).

## Skriva ut till termoskrivare

1. Klicka **Skriv ut** (eller `Ctrl+P`).
2. Välj din etikettskrivare (t.ex. *Katasymbol T50M Pro*).
3. Pappersstorlek: välj **exakt samma mått** som vald etikett (t.ex. 102 × 59 mm).
4. Skalning: **Faktisk storlek** / **100 %** – inte "Anpassa till sida".
5. Marginaler: **Ingen** / **Inga**.
6. För skarpast tryck: aktivera **svartvitt** i skrivardialogen.

Recommended Katasymbol T50M Pro-inställningar: *Direct Thermal*, 203 dpi, hastighet 4 ips.

## Projektstruktur

```
Johannas-kakor/
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── favicon.svg
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── types.ts
    ├── data/
    │   ├── allergens.ts        # 14 svenska allergener + auto-detection
    │   ├── ingredients.ts      # 150+ ingredienser (sökbar databas)
    │   ├── labelSizes.ts       # Termostorlekar
    │   └── templates.ts        # Färdiga mallar
    ├── hooks/
    │   └── useLocalStorage.ts
    ├── utils/
    │   ├── allergens.ts        # Renderar "Vetemjöl, MJÖLK, smör…"
    │   ├── barcode.ts
    │   ├── format.ts           # sv-SE datum etc.
    │   ├── pdf.ts              # html2canvas + jsPDF
    │   └── print.ts
    └── components/
        ├── AllergenLegend.tsx
        ├── BarcodeSection.tsx
        ├── Field.tsx
        ├── IngredientList.tsx  # @dnd-kit drag-and-drop
        ├── IngredientPicker.tsx
        ├── LabelPreview.tsx    # Live + exakt mm-render
        ├── LabelSizeSelector.tsx
        ├── LogoUploader.tsx
        ├── QRCodeSection.tsx
        ├── TemplateManager.tsx
        └── Toolbar.tsx
```

## Tangentbord

- `Enter` i ingredienssökaren – lägg till markerat förslag (eller skapa egen)
- `↑` / `↓` – navigera förslag
- `Ctrl+P` – skriv ut

## Licens

Privat – för Johannas Kakor.
