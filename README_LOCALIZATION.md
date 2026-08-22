# TABLEPLAN localization update — current visual/dietary branch

This bundle adds localization to the current branch that already contains:
- visual event-format cards and icons
- dietary guest-count allocation
- pinned/removed meal workflow
- pinned-meal dietary warnings
- searchable meal and inventory pickers

It does **not** change MongoDB data or planner semantics.

## Replace / add these files

### Frontend
- `frontend/index.html` — replace
- `frontend/styles.css` — replace
- `frontend/app.js` — replace
- `frontend/Dockerfile` — replace
- `frontend/nginx.conf` — replace
- `frontend/i18n.js` — NEW

### Backend
- `backend/src/main/kotlin/ch/inabox/catering/controller/TranslationController.kt` — NEW
- `backend/src/main/kotlin/ch/inabox/catering/controller/LocalizedCatalogController.kt` — NEW
- `backend/src/main/kotlin/ch/inabox/catering/service/TranslationService.kt` — NEW
- `backend/src/main/kotlin/ch/inabox/catering/service/LocalizedCatalogSearchService.kt` — NEW

### Project root
- `docker-compose.localization.yml` — NEW

No Mongo seed changes are required and no reseed is required.

## How it works

### Static UI
English, German, French and Italian are curated in `frontend/i18n.js`.
English is the default and remains selectable in the header.

### Dynamic MongoDB content
Names/descriptions coming from MongoDB are translated in batches through:

`POST /api/i18n/translate`

The planner continues to send the original IDs, concepts, capabilities and request fields. Translation is presentation-only.

### Culinary terminology correction
Generic machine translation is kept as the fallback for future database values, but known culinary mistranslations are corrected before/after machine translation.

Examples:
- `Scrambled Eggs` -> German `Rührei`
- `Fruit Salad` -> `Obstsalat` / `Salade de fruits` / `Macedonia di frutta`
- dietary terms and common category terms receive conventional food terminology
- `Bircher Müesli` is preserved

This is a quality layer, not a requirement for new DB values: unknown future content still uses machine translation automatically.

### Localized search
The meal and inventory pickers use new generic localized endpoints:

- `GET /api/i18n/meals/search`
- `GET /api/i18n/inventory-concepts/search`

Search generates multiple English catalog variants from the selected UI language and merges the deterministic catalog results.

Examples in German:
- `Rührei` -> `scrambled eggs`
- `rühr` -> `scrambled eggs`
- `gekratzt` -> `scrambled eggs` (compatibility with the previous bad machine translation)
- `Wasser` -> `water`
- `Apfel` -> `apple`
- unknown future German/French/Italian terms -> machine-translated to English and searched

Category/capability filters continue to use stable internal IDs and are not translated before being sent to the backend.

## Start the complete stack

Stop the complete stack using both Compose files:

```bash
sudo docker compose \
  -f docker-compose.yml \
  -f docker-compose.localization.yml \
  down
```

Rebuild from the current local files:

```bash
sudo docker compose \
  -f docker-compose.yml \
  -f docker-compose.localization.yml \
  build --no-cache
```

Start everything:

```bash
sudo docker compose \
  -f docker-compose.yml \
  -f docker-compose.localization.yml \
  up -d
```

Check status:

```bash
sudo docker compose \
  -f docker-compose.yml \
  -f docker-compose.localization.yml \
  ps
```

The first LibreTranslate startup may take longer while language models are prepared. The volume `libretranslate-models` keeps them for later starts.

## Verify translation

```bash
curl http://localhost:8080/api/i18n/status
```

Expected once ready:

```json
{
  "provider": "libretranslate",
  "ready": true,
  "databaseIndependent": true,
  "defaultLanguage": "en",
  "supportedLanguages": ["en", "de", "fr", "it"],
  "localizedSearch": true
}
```

Check the culinary correction directly:

```bash
curl -sS -X POST http://localhost:8080/api/i18n/translate \
  -H 'Content-Type: application/json' \
  -d '{
    "sourceLanguage": "en",
    "targetLanguage": "de",
    "items": [{"text":"Scrambled Eggs","context":"meal-name"}]
  }'
```

The translated text should be `Rührei`.

## Verify localized meal search

Correct German term:

```bash
curl -sS --get 'http://localhost:8080/api/i18n/meals/search' \
  --data-urlencode 'query=Rührei' \
  --data-urlencode 'language=de' \
  --data-urlencode 'limit=10'
```

Partial German term:

```bash
curl -sS --get 'http://localhost:8080/api/i18n/meals/search' \
  --data-urlencode 'query=rühr' \
  --data-urlencode 'language=de' \
  --data-urlencode 'limit=10'
```

Compatibility with the previous poor translation:

```bash
curl -sS --get 'http://localhost:8080/api/i18n/meals/search' \
  --data-urlencode 'query=gekratzt' \
  --data-urlencode 'language=de' \
  --data-urlencode 'limit=10'
```

All three should be able to find the `scrambled-eggs` catalog meal when it exists in the current seed.

## Frontend static-asset sanity check

The Dockerfile now explicitly copies `i18n.js`, and nginx returns a real 404 for missing JS/CSS rather than serving `index.html` as JavaScript.

After rebuilding:

```bash
curl -i http://localhost:3000/i18n.js | head -n 10
```

The response should be JavaScript, not `<!doctype html>`.

A deliberately missing JS file should return 404:

```bash
curl -i http://localhost:3000/definitely-missing.js | head
```

## Design guarantees

- English remains the default and selectable language.
- Translation failure never prevents planner API data from loading.
- MongoDB does not contain localized duplicates.
- Planner IDs/concepts/capabilities remain unchanged.
- Unknown future DB values fall back to machine translation automatically.
- Known culinary terminology can be corrected without changing MongoDB.
- Localized meal/inventory search works against the existing English catalog.
