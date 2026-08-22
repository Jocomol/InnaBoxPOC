# Pin / Reject / Regenerate Implementation Report

## A. Changed files

- `backend/src/main/kotlin/ch/inabox/catering/model/RequestModels.kt` — added the `excludedMealIds` request field and its OpenAPI schema.
- `backend/src/main/kotlin/ch/inabox/catering/model/PlanModels.kt` — exposed normalized exclusions in `EventSummary`.
- `backend/src/main/kotlin/ch/inabox/catering/service/PlannerEngine.kt` — added normalization, validation, catalog checks, and common pre-selector filtering.
- `backend/src/main/kotlin/ch/inabox/catering/controller/PlanningController.kt` — documented pin/reject behavior, request examples, and 400/422 errors in Swagger.
- `backend/src/test/kotlin/ch/inabox/catering/service/PlannerEngineTest.kt` — added focused legacy, enhanced, meal-count, dietary, and validation tests.
- `frontend/app.js` — added session state and synchronized Pin, Unpin, Remove, Undo, template-reset, and Regenerate behavior; each selected card now renders its action toolbar immediately below the card heading.
- `frontend/index.html` — added result-area feedback, rejected-meal visibility, the Regenerate action, and versioned frontend asset URLs so an older cached script cannot hide newly deployed controls.
- `frontend/styles.css` — added prominent pinned/rejected states and a two-button, 44 px-high action toolbar that remains visible on desktop and mobile.
- `scripts/test-frontend-pin-reject.mjs` — added a retained, dependency-free Chromium smoke test for action visibility, state changes, request payloads, regeneration, and responsive geometry.
- `scripts/test-planner-pipeline.sh` — added live API checks for pin/reject regeneration, overlap validation, unknown exclusions, and the insufficient-candidate warning fallback.
- `specdrive/PIN_REJECT_REGENERATE_REPORT.md` — this report.

No Mongo seed, database schema, catalog document, scoring formula, dietary-allocation rule, inventory rule, or product-selection behavior was changed.

## B. API

`requiredMealIds` remains the only backend concept for pinning. Its IDs are trimmed, lower-cased for matching, checked against the catalog, and guaranteed by the existing required-meal behavior.

`excludedMealIds` is an optional set, defaulting to empty. Its IDs are trimmed and lower-cased, blank IDs are rejected with HTTP 400, and unknown catalog IDs fail with HTTP 422 and a message such as `Unknown excluded meal IDs: does-not-exist`.

The normalized sets must be disjoint. A case-insensitive overlap returns HTTP 400 with `Meal IDs cannot be both required and excluded: ...`; neither side silently wins. The response repeats the effective normalized exclusions in `event.excludedMealIds` for traceability.

Swagger documents both fields, their interaction, the selection timing, a combined request example, and dedicated overlap/unknown-ID error examples.

## C. Planner behavior

`PlannerEngine.resolve` validates and normalizes exclusions against the complete meal catalog, resolves required meals against that complete catalog separately, then creates one `selectableMeals` list by removing excluded normalized meal IDs. That filtered list is passed to both `selectLegacyMeals` and `selectEnhancedMeals`.

Consequently, an excluded meal never reaches hard-constraint candidate selection, dietary candidate selection, scoring, deterministic tie-breaking, extra `mealCount` filling, or fallback selection. Required meals are not filtered silently because required/excluded overlap is rejected first. Existing serving allocation, dietary strict/warning behavior, weighting, and insufficient-candidate warning behavior then operate on the reduced candidate pool unchanged.

## D. Frontend state

`state.requiredMeals` remains the single source of truth for manual selections and result-card pins. Pin removes the ID from exclusions and adds meal metadata to this map. Unpin only removes it from this map, leaving the visible dish eligible for future automatic selection.

`state.excludedMealIds` is the session-only rejection set. Remove deletes the meal from `requiredMeals`, adds its ID to this set, records its display name for the small Undo list, and hides the current card. Request construction sends sorted `requiredMealIds` and `excludedMealIds` through the same form-submit path.

The frontend also retains the current response solely for re-rendering meal cards and tracks whether quantities/costs are stale. It never recalculates totals or shopping quantities locally. A successful regeneration replaces the current response and clears the stale notice; a failed regeneration preserves form values, pins, exclusions, the current displayed result, and the notice. Manual picker selection removes a prior exclusion, and template changes clear exclusions while preserving required meals.

### Selected-card visibility follow-up

The initial implementation did create Pin and Remove elements, but placed the action row after the card's capability, quantity, and score-detail content and presented it as small secondary controls. That made the feature easy to miss, particularly in a long card or narrow viewport. The asset URLs were also unversioned, so a browser with an older cached `app.js` or `styles.css` could continue showing the pre-feature card after a rebuilt deployment.

`renderMeals()` now puts a labeled, two-column action toolbar directly below every meal heading. Both controls fill their column and have a 44 px minimum height. Pin/Unpin still derives exclusively from `state.requiredMeals`; Remove still adds to `state.excludedMealIds`. The Regenerate button and form-submit path are unchanged. The stylesheet and script URLs carry a version query so this frontend revision is fetched after deployment.

## E. Tests

Commands and results actually run:

- `cd backend && mvn -q -Dtest=PlannerEngineTest test` — passed.
- `cd backend && mvn -q test` — passed; 27 tests, 0 failures, 0 errors, 0 skipped.
- `cd frontend && node --check app.js` — passed.
- `bash -n scripts/test-planner-pipeline.sh` — passed.
- `docker build -q .` from `frontend/` — passed.
- `docker build -t innaboxpoc-frontend-pin-reject-test .` from `frontend/` — passed.
- `docker build -t innaboxpoc-backend-pin-reject-test .` from `backend/` — passed; the image build also ran all 27 Maven tests successfully.
- `API_BASE_URL=http://localhost:8081 ./scripts/test-planner-pipeline.sh` — the first run exposed an over-strict smoke assertion that always expected five seeded apéro dishes after an exclusion. The seed has only five compatible candidates, so the valid planner result is four plus the existing insufficient-candidate warning. The assertion was corrected to accept a replacement when available or the documented warning fallback; the rerun passed all pipeline, pin/reject, overlap, unknown-ID, dietary, and compatibility checks.
- `API_BASE_URL=http://localhost:8081 ./scripts/test-pipeline-weighting.sh` — passed all eight weighting scenarios.
- `curl ... http://localhost:8081/v3/api-docs | jq -e ...` — passed; the generated OpenAPI document contains `excludedMealIds` on both request and event-response schemas and describes it on the resolve operation.
- `SCREENSHOT_PATH=/tmp/pin-reject-browser.png node scripts/test-frontend-pin-reject.mjs` — passed in real headless Chromium against the actual `frontend/index.html`, `app.js`, and `styles.css`. It verified that all five selected desktop cards render visible Pin and Remove controls before their detail content; clicked Pin and Remove; directly checked `state.requiredMeals` and `state.excludedMealIds`; verified the regenerated request carries both IDs and the regenerated menu keeps/excludes them; checked Unpin; then repeated visibility/geometry checks at 390 × 844 px. Action buttons measured 44 px high and Regenerate measured 354 × 46 px. The captured browser card visibly showed **Unpin** and **Remove** in the two-column toolbar.
- `git diff --check` — passed both before and after report creation.

The prior report referred only to a deleted temporary browser harness, so that result could not be rerun and did not protect the card renderer from regression. The new browser smoke is retained in `scripts/`, uses a local read-only fixture server by default, and does not start, reseed, or write MongoDB. Set `UI_BASE_URL` to exercise an already running deployment instead.

## F. Manual test checklist

### Pin

1. Open `http://localhost:3000` and generate a five-dish Business Apéro plan.
2. Press **Pin** on one card.
3. Confirm the button becomes **Unpin** with `aria-pressed="true"`, the card shows **Pinned**, and the same dish appears under specific required dishes.
4. Press **Regenerate menu** and confirm the dish remains.

### Unpin

1. Press **Unpin** on a pinned visible card.
2. Confirm its card remains visible, its pinned styling disappears, and it disappears from specific required dishes.
3. Regenerate and confirm the dish is eligible but no longer guaranteed.

### Remove

1. Note the current totals, then press **Remove** on a meal.
2. Confirm its card disappears immediately and it appears under **Excluded from next generation**.
3. Confirm the notice says quantities and costs are stale and that totals/shopping quantities have not been changed locally.

### Regenerate

1. With at least one removed dish, press the result-area **Regenerate menu** button.
2. Confirm all form inputs remain unchanged.
3. Confirm rejected dishes do not return, replacements appear when compatible catalog meals remain, and the stale notice clears on success.
4. If too few candidates remain, confirm the planner shows its existing requested-versus-available warning and does not reintroduce a rejection.

### Pin and remove together

1. Pin one generated dish and remove one or two different dishes.
2. Regenerate.
3. Confirm the pinned dish remains, all rejected dishes remain absent, and the resulting distinct-meal count follows existing planner/warning semantics.

### Change mind

1. Remove a meal and press **Undo** beside it; confirm it becomes eligible for the next generation without being inserted into the current stale menu.
2. Alternatively, remove a meal, open the recipe picker, manually add the same meal, and confirm it becomes required and disappears from the exclusion list.

### Dietary interaction

1. Request a non-zero halal or vegetarian guest count and generate.
2. Remove one matching dietary meal and regenerate.
3. Confirm another compatible meal supplies the requested minimum when available.
4. If every viable matching meal is excluded, confirm meal-like planning retains the existing 422 behavior and snack planning retains its warning behavior.

### Mobile viewport

1. Set the browser viewport to about 390 × 844 px.
2. Confirm meal names and score circles do not overlap.
3. Confirm Pin and Remove are readable, keyboard-focusable, and comfortably tappable.
4. Confirm the Regenerate button spans the result section and remains easy to find.

## G. Remaining limitations

- Pin/reject state is intentionally page-session-only; refreshing the page clears it.
- Remove hides only the meal card. Totals, shopping items, ingredient requirements, and serving allocation remain the last backend result until regeneration, with an explicit stale notice.
- Undo only restores future eligibility; it does not reinsert the meal into the current displayed menu.
- Pin, Remove, and Undo never auto-submit. The user controls when regeneration occurs.
- Rejection can legitimately leave fewer meals than requested. The existing planner warning/failure behavior is preserved rather than overriding the user's exclusion.
- Headless Chromium covered interaction and responsive geometry; subjective visual review on physical mobile devices remains a manual check.
