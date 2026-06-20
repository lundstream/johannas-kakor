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
