# Merge Problems Resolution Report

Date: 2026-08-22

## A. Merge Summary

`feat/pipeline_improvements` was merged into the target branch `fix/merge_problems`.

Git reported textual conflicts in exactly two files:

- `backend/src/main/kotlin/ch/inabox/catering/service/PlannerEngine.kt`
- `mongo/check-seed.js`

`PlannerEngine.kt` was resolved around the newer multi-meal pipeline implementation. The UI branch's useful response metadata (`guaranteed`, selected dietary metadata, and the existing response shape) was retained, while its old behavior of converting dietary selections into global hard constraints was removed. The pipeline branch's meal-count selection, exact serving allocation, dietary minimum precedence, deterministic weighting, inventory, package rounding, and cost calculation remain in place.

`mongo/check-seed.js` was resolved by combining the UI metadata/category checks with the pipeline branch's exact enriched-catalog, weight, Swiss-score, halal-fixture, water-alternative, template-default, requirement, and ingredient checks. New checks enforce the event/dietary field boundary.

Several files merged automatically but needed semantic reconciliation:

- `RequestModels.kt`: retained `mealCount`, introduced canonical `dietaryShares`, and retained documented aliases.
- `PlannerEngineTest.kt`: kept the tests from both branches, then rewrote dietary fixtures and assertions around serving coverage instead of whole-menu filtering.
- `mongo/seed.js`: combined enriched weighting fixtures with dietary/catalog metadata and categories.
- Frontend files: retained search, catalog browsing, required-meal selection, inventory, and scoring controls while changing dietary input from checkboxes to guest counts.

## B. Final Data/API Model

### `Meal.capabilities`

Dynamic event/menu suitability strings, for example `lunch`, `buffet`, `apero`, `finger-food`, `savory`, and `sweet`. Template meal requirements and automatic event-compatible expansion use this field.

### `Meal.dietaryCapabilities`

Dynamic dietary coverage strings, for example `vegetarian`, `vegan`, `halal`, and future catalog-defined values. Dietary meal selection, overlapping coverage, and serving allocation use this field.

`Product.dietaryCapabilities` was also added for schema consistency. Product-level certification or dietary compliance is not used to redesign product selection in this merge.

### `ResolvePlanRequest.mealCount`

Optional desired number of distinct meals. Resolution order is request value, then `template.defaults["mealCount"]`, then legacy planner behavior. Required meals count toward the total. Increasing the count does not increase total servings.

### `ResolvePlanRequest.dietaryShares`

Canonical request field. Each arbitrary key maps to a minimum share of total servings. It is nullable internally only to distinguish an omitted JSON field from an explicitly supplied empty object, so canonical `{}` can correctly override legacy aliases. The resolved response always exposes a non-null `event.dietaryShares` map.

For `T` total servings and share `p`, the target is `ceil(T * p)`. One serving can count toward multiple shares when its meal has overlapping dietary capabilities.

### Compatibility aliases

The following are retained temporarily:

1. `capabilityShares`: converted to `dietaryShares` when the canonical field is omitted.
2. `selectedConstraintIds`: each selected metadata definition becomes a `1.0` dietary share when neither canonical nor `capabilityShares` is supplied.
3. `preferences.vegetarianShare`: becomes the vegetarian dietary share when no higher-precedence map supplies dietary semantics; it can supplement other legacy selected IDs without overriding them.

Precedence is canonical `dietaryShares` (including explicit `{}`), then `capabilityShares`, then the older selected-ID/preference forms. Dietary aliases never modify `hardConstraints`. `DietaryConstraintDefinition.requiredCapabilities` remains only as old-volume metadata fallback; new metadata has the explicit `dietaryCapability` field.

`ConstraintConflict` remains in the response for compatibility, but partial dietary shares no longer produce per-meal conflicts. Aggregate dietary shortfalls use the established warnings or strict planning exception path.

## C. Planner Semantics

### Event compatibility

Normal automatic meal selection first applies explicit hard constraints and then requires a meal to satisfy the complete event capability set of at least one meal requirement in the chosen template. Extra meals added for `mealCount` therefore cannot leak in from an unrelated event. Explicit `requiredMealIds` may bypass template event suitability, but only after normal hard-capability and excluded-ingredient checks.

### Dietary allocation

Dietary keys are matched only against `Meal.dietaryCapabilities`. The selector ensures requested dietary options are represented where the meal-count limit permits; the allocator then assigns exact integer servings to meet minimums before distributing the remainder by the existing deterministic weights. Overlapping tags count toward every matching target.

Meal-like plans (`servingsPerGuest <= 2`) fail when a minimum cannot be met. Snack-like plans retain the established warning behavior and still preserve the requested total servings.

### Meal count

`mealCount` is a distinct-offer count, not a quantity multiplier. Required/template meals are preserved, selected IDs are unique, and the exact total is allocated over the chosen meals. Clear warnings are returned when the requested distinct count is unattainable.

### Weight precedence

The preserved flow is:

```text
planningPriorities.defaultWeight
  -> overridden by EventTemplate.weights
  -> overridden by ResolvePlanRequest.weights
  -> normalized to sum to 1.0
```

Eligibility and dietary feasibility run before weighted ranking. Request weights still change both meal and product winners, with stable ID tie-breaking.

## D. Seed Changes

The final seed combines:

- 6 templates with `defaults.mealCount` and no template dietary percentages;
- 21 enriched meals and 20 products used by weighting tests;
- 5 planning-priority metadata records;
- 3 dietary metadata records (`vegetarian`, `vegan`, `halal`), now with explicit `dietaryCapability`;
- 7 UI meal categories and their meal assignments;
- halal and competing water fixtures from the pipeline branch.

The seed normalizes catalog documents before upsert: dietary names are removed from `capabilities` and written to `dietaryCapabilities`. The same optional split is applied to products. The former vegan tags were removed from event-template `requiredCapabilities`; templates contain event/menu suitability only. Indexes were added for both meal and product dietary fields.

`mongo/check-seed.js` verifies exact enriched counts, metadata references, category references, template meal-count defaults, absence of template dietary shares, resolvable requirements, product coverage for every ingredient, weight/score metadata, Swiss score conventions, halal fixtures, water alternatives, and that dietary values do not leak into meal event capabilities or template event requirements.

## E. Tests

Commands actually used for final validation:

```bash
cd backend
mvn -B test
```

PASS: 21 tests, 0 failures, 0 errors, 0 skipped.

```bash
docker compose up --build -d mongodb backend
./scripts/reseed.sh
docker compose exec -T mongodb mongosh catering < mongo/check-seed.js
```

PASS: images built; 6 templates, 21 meals, 20 products, 5 priorities, 3 dietary constraints, and 7 categories were present; all seed invariants passed.

```bash
./scripts/test-pipeline-weighting.sh
```

PASS twice (before and after the final compatibility-precedence refinement): all eight REST scenarios passed. The realistic lunch returned 10 total servings, 7 vegetarian-compatible servings, and 7 halal-compatible servings against minimums of 2 and 3. Meal and product weight-winner assertions remained unchanged.

```bash
./scripts/test-planner-pipeline.sh
```

PASS twice. The final run verified distinct meal counts, 400-serving preservation, meal-like and snack-like dietary allocation, strict/warning shortfalls, old requests without new fields, all retained aliases, and canonical precedence including an explicit empty map.

```bash
node --check mongo/seed.js
node --check mongo/check-seed.js
node --check frontend/app.js
bash -n scripts/test-pipeline-weighting.sh
bash -n scripts/test-planner-pipeline.sh
jq -e . specdrive/pipeline/pipeline_weighting_test_scenarios.json
```

PASS: JavaScript syntax, shell syntax, and scenario JSON validation.

```bash
docker compose up --build -d frontend
curl --fail http://localhost:3000/
curl --fail http://localhost:3000/app.js
curl --fail http://localhost:3000/api/dietary-constraints
```

PASS: the frontend image built and served the new dietary-count/meal-count controls; its JavaScript payload contained canonical `dietaryShares`; the proxied metadata endpoint returned at least three definitions with `dietaryCapability`.

```bash
git diff --check
```

PASS: no whitespace errors.

During development, the first merged backend run had three expected semantic errors from old test fixtures, and the next run had one order-sensitive assertion failure. Those were corrected as described below; no failed command is represented as a pass.

## F. Regressions / Bugs Found

1. The UI branch converted dietary checkboxes into global hard capabilities and emitted a conflict for every nonmatching meal. This contradicted partial guest-share semantics. The service now converts aliases to shares and leaves explicit hard constraints untouched; per-meal dietary conflicts were removed.
2. The pipeline branch used `Meal.capabilities` for both event compatibility and dietary allocation. This allowed dietary terms to act as event terms. Models, seed data, selection ranking, coverage checks, and allocation now use the split fields.
3. Explicit required meals in the UI branch bypassed some hard checks, while the pipeline branch checked them. The merged path preserves required meals only after normal hard capability and ingredient exclusions.
4. A normal non-null map default could not distinguish omitted canonical input from an explicit `{}`. The request uses null as a wire-presence sentinel so canonical empty input also wins over aliases; unit and REST regressions cover this.
5. The seeded vegan-reception requirements still used `vegan` as an event capability after the catalog split. Those requirement filters were changed to reception/event capabilities, preventing an unresolvable seed and preserving the field boundary.
6. UI checkbox and guaranteed-meal warnings communicated whole-menu dietary enforcement. The UI now accepts per-dietary guest counts, converts count/guestCount to shares, and does not flag a required dish merely because it does not cover every dietary group.
7. The pipeline branch's prior cross-event `mealCount` fix was retained: automatic expansion considers only meals compatible with a complete template meal requirement.

## G. Remaining Limitations

- Dietary catalog values are metadata, not legal, religious, allergen, certification, or cross-contamination guarantees.
- Product `dietaryCapabilities` is schema metadata only; the product purchasing stage does not implement end-to-end dietary certification.
- The `vegan-reception` template name is historical. Because templates intentionally carry no dietary shares, users who need a fully vegan reception must enter the full guest count in the vegan UI control.
- The deterministic heuristic may provide more compatible servings than the requested minimum; it does not optimize for the smallest possible over-coverage.
- `ConstraintConflict` remains an empty compatibility field for dietary-share plans; aggregate shortfalls are represented by warnings/errors.
- Budget is evaluated after planning rather than used by a global under-budget optimizer.
- The POC still loads complete meal/product collections before in-memory planning.
- Legacy exclusion-only dietary metadata cannot be losslessly translated to a share unless it also supplies `dietaryCapability` (or an old required capability).

## H. Manual UI Test Handoff

The validation stack is available through the Compose setup. The human owner should manually verify:

1. Set 10 guests, 1 serving per guest, 2 vegetarian guests, and 3 halal guests; confirm the generated plan totals 10 servings and shows sensible compatible coverage.
2. Change “Distinct meals offered” and confirm menu variety changes without changing total servings.
3. Add and remove guaranteed dishes; confirm they remain selected without false dietary-conflict styling and that genuinely explicit hard rules are still respected by the API.
4. Browse/search recipes by category and event food type, and confirm dietary tags appear separately in catalog cards.
5. Confirm inventory deduction, weight sliders, budget status, shopping quantities, warnings, and mobile layout still look plausible.
6. Inspect the plan request in browser developer tools and confirm it sends `dietaryShares`, not `selectedConstraintIds` or dietary hard capabilities.
