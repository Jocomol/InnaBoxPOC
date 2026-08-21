# Catering Planner PoC

A deterministic Kotlin/Spring Boot catering resolver backed by MongoDB, with a small browser frontend. It converts an event template, guest count, budget, priorities, constraints, and existing stock into an explainable menu and package-level shopping list.

## Run it

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). The backend API is also available at [http://localhost:8080/api/templates](http://localhost:8080/api/templates).

The first MongoDB initialization automatically seeds 6 templates, 19 meals, and 17 mock products. The seed is idempotent. To apply it again without deleting the volume:

```bash
./scripts/reseed.sh
```

Verify the catalog:

```bash
docker compose exec -T mongodb mongosh catering < mongo/check-seed.js
```

## Included event templates

- Business Apéro
- Brunch
- Coffee Break
- Team Lunch Buffet
- Vegan Reception
- Swiss Breakfast

Every seeded template can be resolved entirely from the mock catalog. The additional meals include parfaits, fruit cups and skewers, break-time bites, lunch bowls and platters, vegan canapés, and Swiss breakfast dishes.

## API

```text
GET  /api/templates
GET  /api/templates/{id}
GET  /api/meals
GET  /api/products
POST /api/plans/resolve
```

Example resolution request:

```bash
curl -X POST http://localhost:8080/api/plans/resolve \
  -H 'Content-Type: application/json' \
  -d '{
    "templateId": "business-apero",
    "guestCount": 40,
    "budget": 800,
    "servingsPerGuest": 4,
    "requiredMealIds": ["mini-spinach-quiche"],
    "weights": { "price": 0.3, "swiss": 0.25, "presentation": 0.2, "prepEase": 0.15, "sustainability": 0.1 },
    "availableInventory": [{ "concept": "mini-spinach-quiche", "amount": 40, "unit": "piece" }]
  }'
```

`servingsPerGuest` is optional and accepts an integer from 1 to 10. It scales the combined meal quantity while preserving the template's proportions between selected dishes; omitting it uses the template quantities unchanged. Drinks and non-food supplies are not scaled.

`requiredMealIds` guarantees that specific catalog meals appear in the menu. A guaranteed meal occupies a compatible template requirement when possible; otherwise it is included as an additional dish. Unknown meals or meals that conflict with hard dietary constraints make the plan unresolvable with HTTP 422.

Weight overrides are merged with template defaults and normalized. `requiredCapabilities` and exclusions are hard filters applied before scoring. Quantities support compatible mass, volume, and count units; product conversions handle serving units such as cups of coffee to grams of beans.

## Backend tests

```bash
cd backend
mvn test
```
