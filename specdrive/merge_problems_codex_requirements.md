# Codex Requirements — Merge `feat/pipeline_improvements` into `fix/merge_problems`

## Context

You are working on a new branch:

```text
fix/merge_problems
```

This branch contains the UI-side work from `feat-ui` (or was created from that state). The planner/pipeline work lives on:

```text
feat/pipeline_improvements
```

Your task is to merge `feat/pipeline_improvements` into the current `fix/merge_problems` branch, resolve the conflicts deliberately, preserve both teams' useful work, and fix the semantic mismatch between the UI's dietary model and the newer planner pipeline.

Do **not** solve conflicts by blindly accepting one side of `PlannerEngine.kt`, `PlanningService.kt`, request models, seed files, or tests.

The final result should preserve:

- the newer planner behavior from `feat/pipeline_improvements`;
- the useful UI/catalog/search functionality from `feat-ui`;
- the weighting validation behavior already proven by the pipeline tests;
- a clean separation between event/menu capabilities and dietary restrictions.

---

# 1. Git / Merge Procedure

Stay on:

```text
fix/merge_problems
```

Verify the current branch before changing anything.

Merge the pipeline branch into it:

```bash
git merge feat/pipeline_improvements
```

Do not reset or replace the branch with another branch.

Do not rebase away either branch's history unless explicitly necessary and documented.

Resolve merge conflicts manually and semantically.

The general conflict-resolution rule is:

```text
Planner semantics / serving allocation / weighting:
    feat/pipeline_improvements wins as the base

UI / catalog browsing / search / presentation:
    feat-ui wins as the base

Shared models / API / seed:
    merge both intentionally according to this document
```

---

# 2. Main Problem to Fix

The two branches currently use `capabilities` for different concepts.

The planner branch uses capabilities for meal matching and dietary-share allocation.

The UI branch introduced dietary selection in a way that can turn a dietary choice such as `vegetarian` into a global hard capability requirement.

That is conceptually wrong for the desired behavior.

Example:

```text
10 guests
2 vegetarian guests
3 halal guests
```

does **not** mean:

```text
every selected meal must be vegetarian
every selected meal must be halal
```

It means the plan must allocate enough servings so that the requested dietary groups are covered.

At the same time, capabilities such as:

```text
lunch
apero
buffet
finger-food
savory
sweet
```

describe whether a meal belongs in an event/menu context.

These are different concepts and must no longer share the same field.

---

# 3. Separate Event Capabilities from Dietary Capabilities

## 3.1 Meal model

Keep:

```kotlin
capabilities
```

for event/menu suitability.

Examples:

```text
lunch
apero
buffet
finger-food
savory
sweet
breakfast
```

Add a new dynamic string collection:

```kotlin
dietaryCapabilities
```

Suggested type:

```kotlin
Set<String>
```

or the closest type consistent with the existing model style.

Examples:

```text
vegetarian
vegan
halal
gluten-free
```

Do not introduce enums.

The database remains dynamic and can add new dietary capability strings later.

Example meal JSON:

```json
{
  "mealId": "halal-chicken-rice-bowl",
  "capabilities": [
    "lunch",
    "savory",
    "buffet"
  ],
  "dietaryCapabilities": [
    "halal"
  ]
}
```

Example vegetarian/halal meal:

```json
{
  "mealId": "mediterranean-falafel-bowl",
  "capabilities": [
    "lunch",
    "savory",
    "buffet"
  ],
  "dietaryCapabilities": [
    "vegetarian",
    "vegan",
    "halal"
  ]
}
```

## 3.2 Product model

Do not build a new halal certification/compliance subsystem in this merge task.

If the UI branch or seed already contains dietary-like tags on products, it is acceptable to add the same optional:

```kotlin
dietaryCapabilities
```

field to `Product` for schema consistency.

However:

- do not make this merge depend on full product-level dietary certification logic;
- do not redesign product selection;
- do not change the validated weighting behavior unnecessarily.

The core requirement of this task is that **meal event matching and dietary serving allocation no longer use the same capability field**.

---

# 4. Request API

The current pipeline uses:

```kotlin
capabilityShares
```

for dietary serving shares.

Rename this concept to:

```kotlin
dietaryShares
```

Suggested request field:

```kotlin
val dietaryShares: Map<String, Double> = emptyMap()
```

The keys remain arbitrary strings.

Example:

```json
{
  "templateId": "team-lunch",
  "guestCount": 10,
  "servingsPerGuest": 1,
  "mealCount": 3,
  "dietaryShares": {
    "vegetarian": 0.20,
    "halal": 0.30
  }
}
```

Meaning:

```text
10 total servings
at least 2 vegetarian-compatible servings
at least 3 halal-compatible servings
```

A serving from a meal with both dietary capabilities may count toward both minimums.

Do **not** interpret `dietaryShares` as global hard filters.

Do **not** add dietary shares to templates.

Template defaults may still contain:

```text
mealCount
```

because number of offered meals is an event/template property.

---

# 5. Backward Compatibility During the Merge

This is a POC, but the existing tests and UI branch may still reference old names.

Prefer a clean final API, but avoid breaking the merge unnecessarily.

### Canonical final API

Use:

```text
mealCount
dietaryShares
```

### Legacy fields

The old:

```text
capabilityShares
preferences.vegetarianShare
selectedConstraintIds
```

must not remain the canonical path for dietary allocation.

If retaining one temporarily is the simplest way to preserve old tests or callers:

- clearly mark it as compatibility behavior;
- convert it internally into `dietaryShares`;
- do not let it become a global hard constraint;
- document it in the merge report.

Do not keep multiple competing dietary semantics without documenting exactly which one wins.

If both the canonical and legacy form are provided, the canonical:

```text
dietaryShares
```

must take precedence.

---

# 6. UI Dietary Behavior

Keep the UI's useful dynamic dietary selector/catalog metadata functionality.

Change what it sends to the planner.

The UI should construct dietary shares instead of global hard constraints.

Example:

```text
10 guests
2 vegetarian
3 halal
```

should become approximately:

```json
"dietaryShares": {
  "vegetarian": 0.2,
  "halal": 0.3
}
```

The UI may internally collect guest counts and convert them into shares:

```text
share = dietaryGuestCount / guestCount
```

Do not send these dietary choices through:

```text
hardConstraints.requiredCapabilities
```

Do not require all meals to satisfy the dietary restriction.

If `selectedConstraintIds` currently drives this global-hard-constraint behavior, change or remove that mapping.

Keep unrelated hard constraints working as they did before.

---

# 7. Planner Semantics

Use the current `feat/pipeline_improvements` planner as the base.

Do not replace it with the older `feat-ui` planner implementation.

Preserve the validated pipeline behavior:

```text
resolve meal count
    ->
select event-compatible distinct meals
    ->
allocate total servings
    ->
enforce dietary serving shares
    ->
expand ingredients
    ->
select products using weights
    ->
inventory subtraction
    ->
package rounding
    ->
cost calculation
    ->
ShoppingPlan
```

## 7.1 Event compatibility

Automatic meal selection must use:

```text
Meal.capabilities
```

against template meal requirements.

This preserves the bug fix from the weighting validation:

> Extra meals added to satisfy `mealCount` must not come from unrelated event types.

Example:

An Apéro plan must not automatically fill its remaining meal slots with a lunch-only or breakfast-only meal just because that meal has a high score.

Explicit user-required meals may keep the existing pipeline exception behavior after normal safety/hard checks.

## 7.2 Dietary allocation

Dietary share enforcement must use:

```text
Meal.dietaryCapabilities
```

and **not** `Meal.capabilities`.

For:

```json
"dietaryShares": {
  "vegetarian": 0.2,
  "halal": 0.3
}
```

calculate minimum dietary servings from the total serving quantity.

Preserve the existing serving rules from `feat/pipeline_improvements`.

### 1–2 servings per guest

Treat as meal-like.

Dietary minimums must be satisfied strictly.

If the requested share cannot be satisfied, use the existing planner/domain failure behavior.

### 3+ servings per guest

Treat as snack/apero-like.

Dietary minimums still apply to total servings, but can be distributed across multiple selected meals.

If the exact requested share cannot be satisfied, retain the existing best-plan + warning behavior from the pipeline branch.

## 7.3 Overlap

A meal may contribute to more than one dietary share.

Example:

```text
dietaryCapabilities = ["vegetarian", "halal"]
```

A serving of that meal counts toward both requested minimums.

---

# 8. `mealCount`

Preserve the current pipeline behavior.

Resolution order remains:

```text
request.mealCount
    ->
template.defaults["mealCount"]
    ->
legacy/fallback planner behavior
```

`mealCount` means number of distinct meals offered.

It must not multiply total food quantity.

Example:

```text
100 guests
4 servings/person
mealCount = 5
```

means:

```text
400 total servings distributed over 5 distinct meals
```

not:

```text
400 servings per meal
```

---

# 9. Weighting

Do not rewrite the weighting mechanism unless required to resolve a concrete merge regression.

The pipeline weighting validation already established the expected behavior:

```text
planningPriorities.defaultWeight
    ->
EventTemplate.weights override
    ->
ResolvePlanRequest.weights override
    ->
normalize final vector to sum to 1.0
```

Candidate score remains:

```text
sum(scoreComponent[key] * normalizedWeight[key])
```

Preserve:

- deterministic tie-breaking;
- missing score component = `0.0`;
- direct-product weighting;
- meal weighting;
- normalized `ShoppingPlan.event.appliedWeights`.

Dietary fulfillment must take precedence over a preference score.

A higher-scoring meal may not be used to violate a required dietary share.

---

# 10. Seed Merge

Merge the newer enriched pipeline seed with any UI metadata/category/search additions.

Do not simply choose one seed file wholesale.

The final seed should preserve:

- the enriched weighting test catalog;
- halal fixtures;
- vegetarian/vegan/halal dietary examples;
- water alternatives used to validate Swiss vs price weighting;
- template `defaults.mealCount`;
- UI category/search metadata that remains useful.

Update meal records so dietary values move to:

```text
dietaryCapabilities
```

and event/menu values remain in:

```text
capabilities
```

Examples:

Before:

```json
"capabilities": [
  "lunch",
  "savory",
  "buffet",
  "vegetarian",
  "halal"
]
```

After:

```json
"capabilities": [
  "lunch",
  "savory",
  "buffet"
],
"dietaryCapabilities": [
  "vegetarian",
  "halal"
]
```

Update:

```text
mongo/check-seed.js
```

so it validates the new separation.

At minimum check:

- meal IDs remain unique;
- event capabilities are present where required;
- dietary fixtures use `dietaryCapabilities`;
- dietary tags used by planner tests exist in the seed;
- no dietary share defaults are reintroduced into templates;
- `mealCount` defaults remain present;
- existing weighting seed invariants still pass.

---

# 11. Merge `PlanModels` / Conflict Reporting Carefully

The UI branch may contain useful `ConstraintConflict` or conflict-reporting additions.

Preserve useful response/reporting information where it still makes sense.

However, rewrite dietary conflicts in terms of the new model.

Do not report:

```text
vegetarian was selected, therefore every meal had to be vegetarian
```

because that is no longer the desired semantics.

Valid dietary conflict examples are:

```text
Requested 30% halal servings but only 20% could be allocated.
```

or, for strict meal-like plans, the appropriate planner exception.

Use existing `warnings` / conflict structures where practical instead of inventing a second response system.

---

# 12. Tests to Preserve and Run

The purpose is not to create a huge new suite.

First merge the existing tests from both branches.

Then update only what is necessary for the renamed/separated dietary model.

The authoritative planner tests from the pipeline branch must continue to pass conceptually.

Required behavior to verify:

1. `mealCount` selects the expected number of distinct meals.
2. Increasing `mealCount` does not increase total servings.
3. Meal-like dietary shares are strict.
4. Snack-like dietary shares are allocated against total servings.
5. Overlapping dietary capabilities count toward both shares.
6. Impossible dietary shares produce the established failure/warning behavior.
7. Automatic meal-count expansion remains event-compatible.
8. Weight normalization remains correct.
9. Request weights can change meal winners.
10. Request weights can change product winners.
11. Dietary minimums beat preference weighting.
12. Existing requests without the new fields still behave sensibly or via documented compatibility behavior.

---

# 13. Required Test Commands

Run the backend test suite:

```bash
cd backend
mvn -B test
```

Run the enriched seed check:

```bash
docker compose up --build -d mongodb backend
./scripts/reseed.sh
docker compose exec -T mongodb mongosh catering < mongo/check-seed.js
```

Run the pipeline weighting scenarios:

```bash
./scripts/test-pipeline-weighting.sh
```

Run the existing planner pipeline regression script:

```bash
./scripts/test-planner-pipeline.sh
```

Run static checks used by the previous validation where applicable:

```bash
bash -n scripts/test-pipeline-weighting.sh
jq -e . specdrive/pipeline/pipeline_weighting_test_scenarios.json
git diff --check
```

If paths changed during the merge, adapt the commands while preserving the intent.

Do not claim a test passed unless it was actually executed successfully.

---

# 14. Specific Realistic Scenario to Preserve

At minimum verify a lunch case equivalent to:

```text
10 guests
1 serving per guest
2 vegetarian guests
3 halal guests
```

Canonical request semantics:

```json
{
  "guestCount": 10,
  "servingsPerGuest": 1,
  "dietaryShares": {
    "vegetarian": 0.20,
    "halal": 0.30
  }
}
```

Expected invariant:

```text
total servings = 10
vegetarian-compatible servings >= 2
halal-compatible servings >= 3
```

The entire menu does not need to be vegetarian or halal.

A meal that satisfies both may count toward both minimums.

The selected meals must still fit the lunch template's event capabilities.

---

# 15. What NOT to Do

Do not:

- replace the new pipeline with the older UI planner;
- turn dietary selections into global `requiredCapabilities`;
- use meal event capabilities to calculate dietary shares;
- add dietary percentages to templates;
- implement Mongo query optimization during this merge;
- redesign the whole domain model;
- introduce dietary enums;
- implement halal certification/compliance logic;
- implement a complex global optimizer;
- rewrite the weighting algorithm without evidence that it is broken;
- silently remove UI catalog/search functionality;
- silently remove the pipeline tests;
- resolve `mongo/seed.js` by accepting one side wholesale without reconciling it.

---

# 16. Manual UI Testing Boundary

Codex is responsible for:

- the merge;
- backend/API semantics;
- adapting the UI request payload to the new API;
- automated backend and integration tests;
- making sure the frontend still loads/builds insofar as automated tooling permits.

The human owner will perform the final UI/UX plausibility test.

Do **not** spend substantial time redesigning the UI.

After automated tests pass, leave the branch in a state where the human can run the application and judge:

- whether the dietary controls make sense;
- whether entering guest dietary counts produces sensible shares;
- whether selected meals look sensible;
- whether meal count controls feel sensible;
- whether the returned plan presentation is understandable.

---

# 17. Required Merge Report

After all changes and tests, write:

```text
specdrive/MERGE_PROBLEMS_REPORT.md
```

The report must contain:

## A. Merge Summary

- source branch merged;
- target branch;
- files with conflicts;
- how each important conflict was resolved.

## B. Final Data/API Model

Clearly document:

```text
Meal.capabilities
Meal.dietaryCapabilities
ResolvePlanRequest.mealCount
ResolvePlanRequest.dietaryShares
```

Also document any temporary compatibility aliases retained.

## C. Planner Semantics

Explain:

- event compatibility;
- dietary share allocation;
- meal-count behavior;
- weight precedence.

## D. Seed Changes

Explain how dietary tags were moved and how UI metadata and enriched weighting fixtures were combined.

## E. Tests

List every command actually run and its exact result.

## F. Regressions / Bugs Found

Describe any bug encountered during the merge and how it was fixed.

## G. Remaining Limitations

Especially note:

- dietary values are catalog metadata, not certification logic;
- product-level dietary compliance is not fully modeled unless explicitly implemented;
- budget remains post-plan evaluation rather than global optimization;
- full collections may still be loaded by the POC.

## H. Manual UI Test Handoff

End with a short list of things the human should manually verify in the UI.

---

# 18. Acceptance Criteria

The merge is complete when:

- `feat/pipeline_improvements` has been merged into `fix/merge_problems`;
- useful UI/catalog/search functionality is preserved;
- `PlannerEngine` is based on the newer pipeline implementation;
- event/menu capabilities and dietary capabilities are separate;
- automatic event compatibility uses `Meal.capabilities`;
- dietary serving allocation uses `Meal.dietaryCapabilities`;
- the canonical request field is `dietaryShares`;
- dietary selections are not converted to global hard capability requirements;
- `mealCount` behavior remains intact;
- weighting behavior remains intact;
- the enriched seed and UI metadata are reconciled;
- seed validation passes;
- backend tests pass;
- pipeline weighting scenarios pass;
- planner pipeline regression scenarios pass;
- `specdrive/MERGE_PROBLEMS_REPORT.md` exists and accurately describes the result;
- the branch is ready for the human owner to manually test the UI.
