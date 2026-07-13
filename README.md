# Tavla — avgångar för SL

En enkel avgångstavla för tunnelbana, buss, pendeltåg, spårvagn och båt i
Stockholm. Bygger på **SL Transport API** via Trafiklab — det kräver ingen
API-nyckel, så det finns inga hemligheter att hantera.

- `index.html`, `style.css`, `app.js` — själva sidan (statiska filer)
- `api/sites.js` — proxar SL:s hållplatslista (så sökningen funkar i webbläsaren)
- `api/departures.js` — proxar avgångar för en given hållplats

Sidan sparar dina valda hållplatser i webbläsarens `localStorage`, så olika
personer som besöker sidan kan ha olika hållplatser sparade.

## Kom igång lokalt

```bash
npm install -g vercel   # om du inte redan har Vercel CLI
vercel dev
```

Öppna sedan `http://localhost:3000`.

## Driftsätt på Vercel

**Alternativ A — via webben (enklast):**

1. Lägg mappen i ett GitHub-repo (`git init`, `git add .`, `git commit`, push).
2. Gå till [vercel.com](https://vercel.com) → **Add New… → Project** → importera repot.
3. Inga miljövariabler behövs (inget API-nyckel-krav).
4. Klicka **Deploy**. Klart.

**Alternativ B — via terminalen:**

```bash
vercel        # första gången, följ frågorna
vercel --prod # för produktionsdeploy
```

## Lägg till hållplatser

Klicka **"Lägg till hållplats"** och sök på namn, t.ex. "Slussen" eller
"Fruängen". Sidan hämtar SL:s fullständiga hållplatslista en gång (cachas i
24 h) och söker lokalt i webbläsaren, så det går snabbt.

## Anpassa

- `FORECAST_MINUTES` i `app.js` styr hur långt fram avgångar hämtas (default 90 min).
- `MAX_ROWS_PER_STOP` styr hur många avgångar som visas per hållplats.
- `REFRESH_MS` styr hur ofta avgångarna uppdateras (default var 20:e sekund).
- Färger och typsnitt för avgångstavlan finns längst upp i `style.css`.

## Om API:et

SL Transport API (`transport.integration.sl.se`) kräver ingen nyckel men bör
inte anropas i onödigt hög takt — därför cachas hållplatslistan i 24 h.
Om du senare vill växla till **ResRobot** (hela Sverige, kräver nyckel från
Trafiklab) hör av dig så bygger vi om `api/`-funktionerna för det.
