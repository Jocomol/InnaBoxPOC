# Mock Prodega Catalog Importer

Standalone demonstration adapter for the Event in a Box inbound catalog story:

```text
mock product API → normalization and enrichment → validation → MongoDB product entries
```

The real Prodega API is private and unavailable to this project. The API contract in `fixtures/prodega-products.json` is intentionally illustrative and does not claim to reproduce Prodega endpoints, authentication or response fields.

## Requirements

- Node.js 18 or later
- No npm dependencies

## Run the complete demo

```bash
cd prodega-catalog-importer
npm run demo
```

This command temporarily starts the mock HTTP API, follows its paginated product feed, transforms and validates every record, writes the outputs, and stops the API.

Generated files:

```text
output/products.json
output/products.mongo.js
```

## Import the generated entries into MongoDB

From the Event in a Box repository root:

```bash
docker compose exec -T mongodb mongosh catering \
  < prodega-catalog-importer/output/products.mongo.js
```

The generated script uses `replaceOne(..., { upsert: true })`, so rerunning the same import is idempotent.

## Run the API and importer separately

Terminal 1:

```bash
npm run mock-api
```

Terminal 2:

```bash
npm run import -- \
  --url http://127.0.0.1:4010/mock-prodega/v1/products \
  --json-out output/products.json \
  --mongo-out output/products.mongo.js
```

## Run tests

```bash
npm test
```

The test covers package-unit normalization, scoring, capabilities, dietary metadata, pagination, unique identifiers and both output formats.

For restricted environments where opening a localhost port is not allowed, generate the same outputs directly from the fixture:

```bash
npm run fixture-import
```

## Mapping

| Mock upstream field | Event in a Box field |
|---|---|
| `productId` | `externalReferences.productId` and stable internal `id` |
| `articleNumber` | `sku` |
| `displayName` | `name` |
| `ingredientConcept` | normalized `concept` |
| `countryOfOrigin` | `originCountry` |
| `pack` | normalized `package.amount` and `package.unit` |
| `salesPrice` | `price` and deterministic affordability score |
| `tags` | supported product `capabilities` and preparation score |
| `dietaryClaims` | supported `dietaryCapabilities` |
| `sustainabilityGrade` | normalized sustainability score |

Unknown tags are ignored rather than silently becoming planner capabilities. Invalid records stop the import with the upstream array index and validation reason.

## Replacing the mock with the real private API

Once access and documentation are available, keep the internal MongoDB contract and replace only:

1. the URL and authentication headers in the fetch adapter;
2. the upstream field mapping inside `transformProduct`;
3. any retailer-specific pagination behavior.

Credentials must come from environment variables or a secret manager and must never be committed.
