# TABLEPLAN — localization & responsive UI polish

This bundle is an incremental update for the current localized/visual branch.

## Replace these files

- `frontend/app.js`
- `frontend/i18n.js`
- `frontend/styles.css`
- `backend/src/main/kotlin/ch/inabox/catering/service/TranslationService.kt`
- `docker-compose.localization.yml`

No MongoDB files changed and no reseed is required.

## What changed

### Localization

- Curated DE/FR/IT translations now cover the complete current demo catalog display vocabulary:
  - 6 event names + descriptions
  - 6 dietary labels + descriptions
  - 7 meal categories + descriptions
  - 5 planning priorities + descriptions + scale labels
  - all 33 seeded meal names
  - all 36 seeded product names
  - all current meal/product capability labels
  - all current ingredient concepts used by the stock/catalog UI
  - current requirement labels
- `Scrambled Eggs` is explicitly `Rührei` / `Œufs brouillés` / `Uova strapazzate`.
- Capability chips are curated too, e.g. `Savory -> Herzhaft`, `Cold -> Kalt serviert`, `Breakfast -> Frühstück`.
- Existing browser translation cache entries are bypassed with a new cache namespace, so old bad MT results do not survive this update.
- Dynamic translation batches are chunked instead of overflowing the backend's batch limit.
- Dynamic elements that appeared before LibreTranslate was ready are now retried automatically instead of remaining English forever.
- Curated translations work even while LibreTranslate is still warming up; unknown future DB text still falls through to machine translation when the provider is ready.
- Localized search now also reverses the curated catalog glossary. Partial localized terms such as `Rührei`, `herzhaft`, `Rösti`, `saumon`, etc. produce useful English catalog search variants without modifying MongoDB.

### Responsive UI

- Meal-category filter buttons wrap onto as many rows as needed. There is no horizontal category scrollbar anymore.
- Dietary cards always place their guest-count input on a separate row underneath the icon/description. Long translated descriptions cannot overlap or push into the number input at any width.
- Event cards become one-column on phones and retain their translated subtitle instead of hiding it.
- Responsive shopping-table labels and several dynamic status/helper strings now use localized UI text as well.

## Clean rebuild

```bash
sudo docker compose \
  -f docker-compose.yml \
  -f docker-compose.localization.yml \
  down

sudo docker compose \
  -f docker-compose.yml \
  -f docker-compose.localization.yml \
  build --no-cache

sudo docker compose \
  -f docker-compose.yml \
  -f docker-compose.localization.yml \
  up -d
```

Check the stack:

```bash
sudo docker compose \
  -f docker-compose.yml \
  -f docker-compose.localization.yml \
  ps
```

Check localization service:

```bash
curl http://localhost:8080/api/i18n/status
```

## Useful checks

German translation:

```bash
curl -sS -X POST http://localhost:8080/api/i18n/translate \
  -H 'Content-Type: application/json' \
  -d '{
    "sourceLanguage":"en",
    "targetLanguage":"de",
    "items":[
      {"text":"Scrambled Eggs","context":"meal-name"},
      {"text":"Savory","context":"capability"},
      {"text":"Cold","context":"capability"},
      {"text":"Breakfast","context":"capability"},
      {"text":"A warm and cold Swiss-inspired breakfast with coffee and apple juice.","context":"event-description"}
    ]
  }'
```

Expected terms include `Rührei`, `Herzhaft`, `Kalt serviert`, and `Frühstück`.

Localized meal search:

```bash
curl -sS --get 'http://localhost:8080/api/i18n/meals/search' \
  --data-urlencode 'query=Rührei' \
  --data-urlencode 'language=de' \
  --data-urlencode 'limit=10'
```

Another useful search test:

```bash
curl -sS --get 'http://localhost:8080/api/i18n/meals/search' \
  --data-urlencode 'query=Rösti' \
  --data-urlencode 'language=de' \
  --data-urlencode 'limit=10'
```

After rebuilding, do one hard browser refresh (`Ctrl+Shift+R`).
