# Pipeline Weighting Validation Report

Date: 2026-08-22

## A. Summary

The existing weighting formula was correct. The application resolves weights in the intended order, normalizes the final vector, and computes candidate scores as the weighted sum of score components. Pure request priorities changed both meal and direct-product winners as expected in the enriched catalog.

One production-code correction was necessary. Enhanced meal selection previously filled `mealCount` from every globally hard-valid meal, which allowed an unrelated meal from another event type to enter a plan. Automatic expansion is now limited to meals satisfying the complete capability set of at least one meal requirement in the selected template. Explicit `requiredMealIds` remain exempt from event-template compatibility after passing hard constraints.

Files changed for this validation:

- `backend/src/main/kotlin/ch/inabox/catering/service/PlannerEngine.kt`
- `backend/src/test/kotlin/ch/inabox/catering/service/PlannerEngineTest.kt`
- `mongo/seed.js`
- `mongo/check-seed.js`
- `scripts/test-pipeline-weighting.sh`
- `specdrive/pipeline/pipeline_weighting_test_scenarios.json`
- `specdrive/PIPELINE_WEIGHTING_VALIDATION_REPORT.md`

The existing `scripts/test-planner-pipeline.sh` regression harness was also executed without modification during this task.

## B. Weight Resolution

Actual precedence:

```text
planningPriorities.defaultWeight
    -> overridden by EventTemplate.weights
    -> overridden by ResolvePlanRequest.weights
    -> normalized so the final sum is 1.0
```

`PlanningService` loads and orders database priorities, builds the default map, and overlays template weights. `PlannerEngine` then overlays request weights and normalizes the merged values. The normalized result is returned in `ShoppingPlan.event.appliedWeights`.

Concrete seeded example from `apero-normalized-mixed-weights`:

```text
request: price = 0.15, presentation = 0.35, all other keys = 0
sum before normalization = 0.50
normalized: price = 0.30, presentation = 0.70

halal-chicken-skewers:
price score = 0.72
presentation score = 0.88

weighted score = (0.30 × 0.72) + (0.70 × 0.88)
               = 0.216 + 0.616
               = 0.832
```

The REST response returned the expected applied vector and final score `0.832`. Missing score components retain the existing value of `0.0`; a focused unit test documents this behavior.

## C. Scenario Results

Weight order below is `price / swiss / presentation / prepEase / sustainability`.

| Scenario | Result | Selected meals and allocated servings | Capability servings | Relevant products | Applied weights | Warnings |
|---|---|---|---|---|---|---|
| `lunch-10-guests-mixed-dietary` | PASS | `mediterranean-falafel-bowl` 4, `halal-chicken-rice-bowl` 3, `caprese-lunch-bowl` 3 | vegetarian 7/10; halal 7/10 | water `mineral-water-6x15`; juice `apple-juice-6l`; napkins `napkins-250` | `0.25 / 0.20 / 0.15 / 0.15 / 0.25` | none |
| `apero-price-only` | PASS | `falafel-bites` 80, score 0.85 | not requested | soft drinks `budget-water-12l`; napkins `napkins-250` | `1 / 0 / 0 / 0 / 0` | none |
| `apero-presentation-only` | PASS | `caprese-skewers` 80, score 0.90 | not requested | soft drinks `apple-juice-6l`; napkins `napkins-250` | `0 / 0 / 1 / 0 / 0` | none |
| `apero-sustainability-only` | PASS | `falafel-bites` 80, score 0.90 | not requested | soft drinks `mineral-water-6x15`; napkins `napkins-250` | `0 / 0 / 0 / 0 / 1` | none |
| `apero-normalized-mixed-weights` | PASS | `halal-chicken-skewers` 80, score 0.832 | not requested | soft drinks `budget-water-12l`; napkins `napkins-250` | `0.30 / 0 / 0.70 / 0 / 0` | none |
| `halal-share-beats-swiss-preference` | PASS | `falafel-bites` 10, score 0.0 | halal 10/10 | soft drinks `apple-juice-6l`; napkins `napkins-250` | `0 / 1 / 0 / 0 / 0` | none |
| `water-price-priority` | PASS | `apple-yogurt-parfaits` 20, `mini-quiche-break-bites` 20 | not requested | water `budget-water-12l` | `1 / 0 / 0 / 0 / 0` | none |
| `water-swiss-priority` | PASS | `apple-yogurt-parfaits` 20, `ham-croissant-break-bites` 20 | not requested | water `mineral-water-6x15` | `0 / 1 / 0 / 0 / 0` | none |

All eight expected HTTP statuses, selected IDs, serving totals, minimum capability quantities, normalized weights, final scores, event-compatibility checks, product choices, and warning expectations were met. The mixed lunch meals all contain `savory`, `lunch`, and `buffet`; no unrelated event meal was selected.

## D. Database Changes

The enriched seed contains exactly six templates, five planning priorities, 21 meals, and 20 products.

Template `defaults.mealCount` values are:

- Business Apéro: 5
- Brunch: 3
- Coffee Break: 4
- Team Lunch Buffet: 4
- Vegan Reception: 3
- Swiss Breakfast: 2

Template-level `vegetarianShare` defaults and dietary `target.share` requirements were removed. Dietary shares now come from `ResolvePlanRequest.capabilityShares` only for the canonical flow.

Plant-based POC fixtures were enriched with the dynamic `halal` capability. `halal-chicken-skewers` and `halal-chicken-rice-bowl`, with their matching products, provide explicit non-vegetarian halal test choices. This is catalog test data, not certification logic.

The two water alternatives provide the intended tradeoff: imported `budget-water-12l` has the stronger affordability score, while Swiss `mineral-water-6x15` has the Swiss score and stronger sustainability score.

The `swiss` capability was removed from Swiss Breakfast requirements and seeded breakfast meals. Swiss preference remains score-based, and seed validation checks product origins plus the existing all-ingredients-Swiss meal convention.

`mongo/check-seed.js` now verifies all requested structural, requirement, ingredient, priority, Swiss-score, halal-fixture, and water-alternative invariants. It also uses an explicit nonzero exit for failures when streamed into `mongosh`.

## E. Bugs Found

### Cross-event automatic meal selection

Before this change, the enhanced `mealCount` fill loops used all globally hard-valid meals. A high-scoring lunch, breakfast, or reception meal could therefore be added to an Apéro plan even though it did not match any Apéro meal requirement.

Fix: derive the required-capability sets from the template's meal requirements and restrict only automatically added meals to candidates satisfying at least one complete set. Initial mandatory selections already apply their own requirement capabilities. Explicit user-required meals continue through the guaranteed-meal path.

### Seed-check shell reliability

The first enriched seed-check run exposed that a dot-prefixed multiline expression was split when the file was redirected into interactive `mongosh`. In that mode an uncaught expression error could also be printed without making the shell command fail. The checker now uses REPL-safe loops and calls `quit(1)` for validation failures.

No defect was found in weight merging, normalization, weighted-sum calculation, deterministic tie-breaking, or direct-product weighting.

## F. Known POC Limitations

- Scores are curated/enriched catalog input; the planner does not calculate them universally.
- A missing score component counts as `0.0`, which may disadvantage incomplete catalog entries.
- Capability-share minimums may overlap; one serving can count toward multiple requested capabilities.
- `halal` is a dynamic capability tag, not a certification or compliance subsystem.
- Budget is evaluated after planning. The planner reports status and warnings but does not globally search for an under-budget combination.
- The POC still loads the complete meal and product collections before planning.
- Scoring and allocation are deterministic heuristics, not global combinatorial optimization.

## G. Commands and Test Results

```bash
cd backend
mvn -B test
```

PASS: 20 tests, 0 failures, 0 errors, 0 skipped.

```bash
docker compose up --build -d mongodb backend
./scripts/reseed.sh
docker compose exec -T mongodb mongosh catering < mongo/check-seed.js
```

PASS: backend image built; the enriched database was seeded; the checker reported 6 templates, 21 meals, 20 products, and 5 priorities with all invariants valid.

```bash
./scripts/test-pipeline-weighting.sh
```

PASS: all eight authoritative REST scenarios.

```bash
./scripts/test-planner-pipeline.sh
```

PASS: distinct meal counts, total-serving preservation, meal-like and snack-like shares, impossible-share behavior, and legacy request compatibility.

```bash
bash -n scripts/test-pipeline-weighting.sh
jq -e . specdrive/pipeline/pipeline_weighting_test_scenarios.json
git diff --check
```

PASS: script syntax, scenario JSON, and patch whitespace checks.

```bash
docker compose down
```

PASS: validation containers and the temporary Compose network were removed; the reseeded Mongo volume was retained.

Assumptions made:

- The supplied embedded seed and scenarios are authoritative, so they were extracted without changing expected outcomes.
- The local `catering` database is the POC validation database and may be reseeded by the handoff's explicit workflow.
- Event compatibility is based exactly on full capability coverage of at least one `type = "meal"` template requirement; no new schema or semantic diversity model was introduced.
