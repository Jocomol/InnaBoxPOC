# Planner Pipeline Change Requirements

## Goal

Extend the existing catering planner with:

1. A configurable number of distinct meals to offer.
2. Dynamic capability-share requirements such as vegetarian or halal percentages.
3. Correct allocation of total servings across the selected meals.

The change must remain small and compatible with the existing database model.

---

## Scope Constraints

- Do **not** redesign the existing `Meal` or `Product` database models.
- Keep using the existing `capabilities` field on meals/products.
- Do **not** introduce enums for dietary capabilities.
- Capability names must remain dynamic strings sourced from the database/UI.
- Do **not** add dietary/capability shares to event templates.
- Reuse the existing template `defaults` map for the default meal count.
- Preserve existing planner behavior where these new request fields are not provided.

---

# 1. API Changes

Add two optional fields to `ResolvePlanRequest`.

```kotlin
val mealCount: Int? = null
val capabilityShares: Map<String, Double> = emptyMap()
```

Example request:

```json
{
  "templateId": "business-apero",
  "guestCount": 100,
  "servingsPerGuest": 4,
  "mealCount": 5,
  "capabilityShares": {
    "vegetarian": 0.30,
    "halal": 0.20
  }
}
```

## 1.1 `mealCount`

Meaning:

- Desired number of **distinct meals** in the generated plan.
- If supplied in the request, it overrides the template default.
- Must be greater than `0`.

Resolution order:

```text
request.mealCount
    -> template.defaults["mealCount"]
    -> existing/fallback planner behavior
```

The existing `defaults` map should be reused. Do not add a dedicated template field unless technically necessary.

Example template:

```json
{
  "templateId": "business-apero",
  "defaults": {
    "mealCount": 5
  }
}
```

## 1.2 `capabilityShares`

Meaning:

- Maps an existing capability name to the minimum requested share of total servings.
- Capability names are arbitrary strings.
- Examples: `vegetarian`, `vegan`, `halal`.
- The planner must not hardcode a fixed list of dietary capabilities.

Example:

```json
"capabilityShares": {
  "vegetarian": 0.30,
  "halal": 0.20
}
```

Validation:

- Every share must be `>= 0.0` and `<= 1.0`.
- Capability shares do **not** need to sum to `1.0`.
- Different capability shares may overlap.

Example:

A meal with capabilities:

```json
["vegetarian", "halal"]
```

may count toward both the vegetarian and halal targets.

---

# 2. No Changes to Meal/Product JSON

Existing meal/product documents remain compatible.

Example meal:

```json
{
  "mealId": "meal-1",
  "capabilities": [
    "vegetarian",
    "halal"
  ]
}
```

No new dietary fields are required.

The enriched database can add more capability strings without requiring planner model changes.

---

# 3. Meal Selection

The planner must support selecting multiple distinct meals.

If the resolved `mealCount` is `N`:

- Select up to `N` distinct suitable meals.
- Do not select the same `mealId` more than once.
- Existing hard filters and scoring still apply.
- Required meals from the existing request logic must still be respected.
- Required meals count toward `mealCount`.
- Do not add a new complex diversity system for this change.

If there are not enough valid distinct meals:

- Do not silently duplicate meals.
- Return the best valid plan possible and add a clear warning, unless existing planner semantics require an exception for mandatory requirements.

---

# 4. Serving Quantity Rules

The planner must separate:

1. Total quantity of food required.
2. Number of different meals offered.

Increasing `mealCount` must **not** multiply total food quantity.

Total target servings:

```text
totalServings = guestCount * servingsPerGuest
```

Example:

```text
100 guests
4 servings per guest
5 meals
```

means:

```text
400 total servings distributed across 5 meals
```

It does **not** mean 400 servings of each meal.

The planner must distribute the total serving target across the selected meals.

---

# 5. Capability Share Enforcement

A capability share applies to **servings**, not to the number of meal types.

For capability `C`:

```text
requiredCapabilityServings =
    ceil(totalServings * capabilityShare[C])
```

Example:

```text
100 guests
1 serving per guest
vegetarian = 0.30
```

requires at least:

```text
30 vegetarian servings
```

Example:

```text
100 guests
4 servings per guest
vegetarian = 0.30
```

requires at least:

```text
120 vegetarian servings out of 400
```

A serving counts toward a capability when its selected meal contains that capability.

A meal may satisfy several capability shares simultaneously.

---

# 6. Meal-Like vs Snack-Like Planning

Use `servingsPerGuest` to interpret the serving structure.

## 6.1 1-2 servings per guest

Treat as meal-like.

Capability-share requirements must be enforced strictly.

Example:

```text
100 guests
1 serving/person
30% vegetarian
```

The resulting allocation must contain at least 30 vegetarian servings.

Example:

```text
100 guests
2 servings/person
30% vegetarian
```

There are 200 total servings and at least 60 must be vegetarian.

Do not reduce the requested dietary share because the selected meal count is small.

## 6.2 3+ servings per guest

Treat as snack/apero-like.

The same minimum capability-share requirement still applies, but the required servings may be distributed across multiple selected meals.

Example:

```text
100 guests
4 servings/person
30% vegetarian
5 selected meals
```

Valid result:

```text
Vegetarian wrap     70
Bruschetta          50
Mini burger        150
Chicken skewer     100
Cheese bite         30
----------------------
Total              400
Vegetarian         120
```

The exact allocation algorithm may vary, provided all required invariants are met.

---

# 7. Impossible Capability Shares

The planner must detect when a requested capability share cannot be fulfilled with the available valid meals.

Example:

```text
vegetarian = 0.50
```

but no valid vegetarian meal exists.

The planner must not silently pretend the requirement was fulfilled.

Required behavior:

- Add a clear warning describing the unmet capability and requested share.
- The final plan/result must make the shortfall visible.
- Do not select an incompatible meal and label it as satisfying the capability.

For meal-like plans (`servingsPerGuest <= 2`), inability to fulfill a requested dietary share should be treated as a significant planning failure. Prefer throwing the same planner/domain exception style already used for impossible mandatory requirements if this can be implemented cleanly.

For snack-like plans, returning the best possible plan with a warning is acceptable.

---

# 8. Interaction With Existing Constraints

Existing hard constraints, exclusions, required meals, scoring, inventory, ingredient expansion, product selection, package rounding, and cost calculation must continue to work.

Order of planning should conceptually be:

```text
Request + Event Template
    ->
Resolve mealCount
    ->
Filter valid meal candidates
    ->
Respect required meals
    ->
Select distinct meals
    ->
Allocate total servings
    ->
Enforce capabilityShares
    ->
Expand selected meals into ingredients
    ->
Resolve products
    ->
Apply inventory
    ->
Round packages
    ->
Calculate cost
    ->
Return ShoppingPlan
```

Capability-share logic belongs to meal selection/serving allocation.

It must not require a database schema redesign.

---

# 9. Product-Level Capabilities

Do not implement a large capability-model refactor as part of this task.

Products keep their existing `capabilities`.

The current product filtering/scoring behavior should remain compatible.

A future task may distinguish meal-level and product-level semantics more precisely, but that is outside this change unless required to prevent an obvious correctness bug.

---

# 10. REST Response

No new response transport mechanism is needed.

`PlannerEngine` continues to produce the existing `ShoppingPlan` Kotlin object.

The REST controller continues returning that object, and Spring/Jackson serializes it to JSON.

Existing clients must continue to receive a normal JSON `ShoppingPlan`.

New warning information should use the existing `warnings` field where possible.

---

# 11. Backwards Compatibility

These requests must still work:

```json
{
  "templateId": "business-apero",
  "guestCount": 100
}
```

If `mealCount` is absent:

- use `template.defaults["mealCount"]` if available;
- otherwise retain the existing fallback behavior.

If `capabilityShares` is absent or empty:

- do not apply capability-share allocation;
- retain existing meal-selection semantics as closely as possible.

---

# 12. Required Tests

This is a hackathon implementation. Do not build a large test suite.

Add a small set of strong tests covering the new invariants.

Minimum tests:

1. **Meal count**
   - `mealCount = 5`
   - planner selects 5 distinct meals when enough valid meals exist.

2. **Quantity preservation**
   - Increasing `mealCount` does not increase total servings.
   - Example: 100 guests x 4 servings always remains 400 total servings.

3. **Strict dietary share for meal-like plan**
   - 100 guests, 1 serving/person, vegetarian 30%.
   - At least 30 servings are assigned to vegetarian-capable meals.

4. **Dietary share for snack-like plan**
   - 100 guests, 4 servings/person, vegetarian 30%.
   - At least 120 of 400 servings are vegetarian.

5. **Overlapping capabilities**
   - A meal with `vegetarian` + `halal` can contribute to both requested shares.

6. **Impossible share**
   - Requested capability cannot be fulfilled.
   - Planner produces the required warning/failure behavior rather than silently violating the request.

7. **Backward compatibility**
   - Existing request without `mealCount` or `capabilityShares` still resolves successfully.

Existing tests for inventory, package rounding, unit conversion, scoring, totals, and deterministic tie-breaking should remain passing.

---

# 13. Non-Goals

Do **not** implement the following as part of this task:

- Redesigning the Meal/Product database schema.
- Creating enums for dietary restrictions.
- Capability shares inside event templates.
- AI-based menu generation.
- Complex semantic menu-diversity logic.
- Global optimization across every possible meal/product combination.
- A large repository/database refactor.
- A comprehensive production-grade test suite.
- Changing the REST response format.

---

# Acceptance Criteria

The change is complete when all of the following are true:

- `ResolvePlanRequest` accepts optional `mealCount`.
- `ResolvePlanRequest` accepts optional dynamic `capabilityShares`.
- Event templates can define the default meal count using `defaults["mealCount"]`.
- Capability shares remain request-only.
- Existing meal/product documents require no schema changes.
- The planner selects multiple distinct meals.
- Total servings remain `guestCount * servingsPerGuest` regardless of meal count.
- Capability shares are enforced against serving quantities.
- 1-2 servings/person are handled strictly as meal-like plans.
- 3+ servings/person support distributed snack/apero allocation.
- Overlapping capabilities are supported.
- Impossible dietary shares are clearly surfaced.
- Existing planner behavior remains compatible when the new fields are omitted.
- The focused tests above pass.
