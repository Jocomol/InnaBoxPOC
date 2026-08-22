# Codex Requirements — Pin / Reject Meals and Regenerate

## Goal

Give the user direct control over an automatically generated menu.

After a plan is generated, every selected meal card must allow the user to:

1. **Pin** the meal  
   The meal becomes required and must remain in subsequent generations.

2. **Remove / reject** the meal  
   The meal disappears from the current menu and is added to an exclusion list so it is not selected again in subsequent generations.

The user can then run the planner again with the same event inputs.

The new generation must:

```text
keep pinned meals
+
never select rejected meals
+
regenerate all remaining menu slots normally
```

This is intended as a human-in-the-loop planning workflow:

```text
Generate
    ↓
Review menu
    ↓
Pin dishes I like
Reject dishes I dislike
    ↓
Generate again
    ↓
Keep good choices + receive new alternatives
```

The implementation should remain small and consistent with the current planner architecture.

Do **not** redesign meal scoring, dietary allocation, weighting, inventory, product selection, or the database schema for this feature.

---

# 1. Current State

The application already supports:

```kotlin
requiredMealIds
```

in `ResolvePlanRequest`.

The frontend already maintains:

```javascript
state.requiredMeals
```

and sends:

```javascript
requiredMealIds: [...state.requiredMeals.keys()].sort()
```

when resolving a plan.

This already provides most of the backend semantics needed for **Pin**.

What is missing is the opposite concept:

```text
excludedMealIds
```

There is currently no request-level way to say:

> This specific meal must not be selected.

Existing:

```text
hardConstraints.excludedCapabilities
hardConstraints.excludedConcepts
```

are broader filtering tools and should **not** be abused for this feature.

Rejecting:

```text
falafel-bites
```

must reject only that meal, not all meals with the same ingredients or capabilities.

---

# 2. User Experience

Each meal card in the generated **Selected menu** section must gain two controls:

```text
[ Pin ]    [ Remove ]
```

Icons are acceptable, but they must have text/accessible labels.

Suggested visual language:

```text
📌 Pin
× Remove
```

or equivalent icons matching the existing UI style.

The buttons should fit naturally into the current meal-card layout and remain usable on mobile.

Do not make the controls visually dominant over:

- meal name;
- serving count;
- score;
- dietary coverage;
- "Why this was selected".

They are secondary actions.

---

# 3. Pin Semantics

When the user presses **Pin** on a generated meal:

```text
meal ID
    ↓
added to required meals
    ↓
included in requiredMealIds next generation
```

Example:

Current generated plan:

```text
Mini Spinach Quiche
Caprese Skewers
Mini Ham Croissants
Falafel Bites
Halal Chicken Skewers
```

User pins:

```text
Caprese Skewers
Halal Chicken Skewers
```

Next request includes:

```json
{
  "requiredMealIds": [
    "caprese-skewers",
    "halal-chicken-skewers"
  ]
}
```

The planner must preserve those meals in the next generated menu.

The existing required-meal planner semantics should remain authoritative.

Pinned meals:

- count toward `mealCount`;
- retain their normal serving allocation behavior;
- participate in dietary coverage;
- still must pass existing explicit hard constraints;
- may force the final menu above `mealCount` if current required-meal semantics already permit this.

Do not create a second "pinned meal" backend concept.

**Pinning is simply a UI representation of `requiredMealIds`.**

---

# 4. Pin Toggle Behavior

Pin must behave as a toggle.

### Unpinned generated meal

Button:

```text
Pin
```

Click:

```text
add meal to state.requiredMeals
```

Card immediately changes to a pinned state.

Suggested label:

```text
Pinned
```

or:

```text
Unpin
```

with `aria-pressed="true"`.

### Already pinned meal

Clicking the pin control again:

```text
removes meal from state.requiredMeals
```

but does **not** remove it from the current visible plan.

It simply means:

> This dish is no longer guaranteed in the next generation.

The current plan does not need to be recalculated immediately.

The user explicitly triggers the next generation using the existing Generate button.

---

# 5. Remove / Reject Semantics

When the user presses **Remove**:

1. add the meal ID to the rejected/excluded meal set;
2. remove it from the pinned/required set if present;
3. remove the card from the currently displayed menu;
4. ensure it is sent in `excludedMealIds` on the next generation.

Example:

```text
User dislikes Falafel Bites
```

State becomes:

```javascript
requiredMeals = [
  "caprese-skewers"
]

excludedMealIds = [
  "falafel-bites"
]
```

Next request:

```json
{
  "requiredMealIds": [
    "caprese-skewers"
  ],
  "excludedMealIds": [
    "falafel-bites"
  ]
}
```

The planner may choose another valid meal for the available slot, but it must never choose `falafel-bites`.

---

# 6. Important Difference Between Unpin and Remove

These are intentionally different actions.

## Unpin

Means:

> I don't require this meal anymore.

The meal remains eligible for future automatic selection.

## Remove

Means:

> I don't want this meal in this planning session.

The meal becomes ineligible for future automatic selection.

This distinction must be maintained.

Example:

```text
Caprese is pinned.
User clicks Unpin.
```

Caprese may still appear in the next generation if it scores highly.

But:

```text
Caprese is removed.
```

Caprese must not appear in the next generation.

---

# 7. Backend API Change

Extend:

```kotlin
ResolvePlanRequest
```

with:

```kotlin
val excludedMealIds: Set<String> = emptySet()
```

Add suitable OpenAPI/Swagger documentation.

Suggested documentation meaning:

> Meal IDs that must not appear in the generated menu. Matching is case-insensitive. Excluded meals are removed from the automatic candidate pool. A meal cannot be both required and excluded.

Example API request:

```json
{
  "templateId": "business-apero",
  "guestCount": 20,
  "budget": 500,
  "servingsPerGuest": 5,
  "mealCount": 5,

  "requiredMealIds": [
    "caprese-skewers",
    "halal-chicken-skewers"
  ],

  "excludedMealIds": [
    "falafel-bites",
    "mini-spinach-quiche"
  ],

  "dietaryShares": {
    "vegetarian": 0.2,
    "halal": 0.25
  }
}
```

---

# 8. Request Validation

Add validation for `excludedMealIds`.

At minimum:

```text
IDs may not be blank
```

Normalize IDs consistently with `requiredMealIds`:

```text
trim
lowercase
case-insensitive comparison
```

---

# 9. Required / Excluded Conflict

The same normalized meal ID must never exist in both:

```text
requiredMealIds
```

and:

```text
excludedMealIds
```

Example invalid request:

```json
{
  "requiredMealIds": ["falafel-bites"],
  "excludedMealIds": ["Falafel-Bites"]
}
```

must fail.

Return the same kind of client-visible validation/planning error already used by the API.

Suggested message:

```text
Meal IDs cannot be both required and excluded: falafel-bites
```

Do not silently choose one side.

---

# 10. Unknown Excluded IDs

For consistency with `requiredMealIds`, validate that excluded meal IDs exist in the loaded catalog.

If an excluded meal ID does not exist:

```text
throw a clear PlanResolutionException / request error
```

Suggested message:

```text
Unknown excluded meal IDs: some-made-up-id
```

This prevents stale or malformed UI state from silently influencing a plan.

---

# 11. Planner Filtering

Excluded meal IDs must be removed **before scoring and selection**.

This should apply to both:

```text
legacy meal selection
enhanced meal selection
```

even if the modern UI normally uses enhanced planning.

Normalize the excluded IDs once near the start of `resolve`.

Conceptually:

```kotlin
val excludedMealIds = normalizeMealIds(request.excludedMealIds)
```

Then candidate selection becomes conceptually:

```kotlin
.filter { it.mealId.lowercase() !in excludedMealIds }
```

The exact implementation may use a helper rather than duplicating this filter.

---

# 12. `selectEnhancedMeals`

This is the most important selector for the current application.

Current logic conceptually begins with:

```text
all meals
→ distinct
→ hard-constraint-valid
→ event-compatible
→ score/select
```

It should become:

```text
all meals
→ distinct
→ NOT explicitly excluded
→ hard-constraint-valid
→ event-compatible
→ score/select
```

Rejected meals must not participate in:

- mandatory requirement candidate selection;
- dietary coverage candidate selection;
- extra `mealCount` filling;
- ranking/tie-breaking;
- automatic fallback selection.

---

# 13. `selectLegacyMeals`

Keep backwards compatibility.

When building candidates for a template requirement:

```text
excluded IDs must be filtered out
```

Do not allow an excluded meal to re-enter through the legacy selector.

---

# 14. Required Meals

Resolve/validate required meals separately as today.

After validating overlap:

```text
required meals are never excluded
```

because a request containing both is rejected before selection.

Do not apply `excludedMealIds` to a required meal and then silently remove it.

The invariant should simply be:

```text
required ∩ excluded = ∅
```

before selection starts.

---

# 15. Dietary Allocation Interaction

The existing dietary system remains unchanged.

Rejected meals are simply unavailable candidates.

Example:

```text
10 guests
3 halal guests
mealCount = 3
```

Suppose the current plan contains:

```text
Halal Chicken Bowl
Falafel Bowl
Caprese Bowl
```

The user rejects:

```text
Halal Chicken Bowl
```

The next generation must attempt to satisfy the halal share using the remaining valid catalog.

If enough halal-compatible meals remain:

```text
generate a valid new menu
```

If not:

```text
preserve the existing strict/warning dietary behavior
```

Do not weaken dietary requirements just because the user excluded a useful meal.

The user's rejection reduces the candidate pool.

That is intentional.

---

# 16. `mealCount` Interaction

Pinned and rejected meals must integrate naturally with existing `mealCount` behavior.

Example:

```text
mealCount = 5
2 pinned meals
2 rejected meals
```

The planner should:

```text
keep the 2 pinned meals
+
select approximately 3 additional distinct valid meals
+
never use the 2 rejected meals
```

Total menu size remains governed by current `mealCount` semantics.

If:

```text
required/pinned meals > mealCount
```

preserve current required-meal behavior rather than removing pinned meals.

If rejecting meals leaves fewer than the requested number of valid candidates:

```text
use the existing warning behavior
```

such as:

```text
Requested 5 distinct meals, but only 4 valid distinct meals were available.
```

Do not reintroduce a rejected meal merely to reach `mealCount`.

---

# 17. Weighting Interaction

Do not modify weighting.

The sequence should effectively remain:

```text
eligibility
    ↓
remove rejected IDs
    ↓
dietary feasibility
    ↓
weighted scoring
    ↓
deterministic tie-break
```

A rejected meal with a perfect score is still rejected.

Example:

```text
Falafel Bites score = 0.95
excludedMealIds = ["falafel-bites"]
```

The planner chooses the next highest valid candidate.

---

# 18. Frontend State

Extend the existing frontend state.

Current state includes:

```javascript
requiredMeals: new Map()
```

Add:

```javascript
excludedMealIds: new Set()
```

or, if meal metadata is useful for UI display:

```javascript
excludedMeals: new Map()
```

A simple `Set<String>` is sufficient if rejected meals do not need to be displayed elsewhere.

Suggested:

```javascript
const state = {
  ...
  requiredMeals: new Map(),
  excludedMealIds: new Set(),
  ...
};
```

---

# 19. State Invariants

Frontend state must maintain:

```text
requiredMealIds ∩ excludedMealIds = ∅
```

Always.

### Pin action

```javascript
state.excludedMealIds.delete(mealId);
state.requiredMeals.set(mealId, mealMetadata);
```

### Remove action

```javascript
state.requiredMeals.delete(mealId);
state.excludedMealIds.add(mealId);
```

### Unpin action

```javascript
state.requiredMeals.delete(mealId);
```

Do not automatically add an unpinned meal to exclusions.

---

# 20. Request Construction

Update the existing request construction.

Current:

```javascript
requiredMealIds: [...state.requiredMeals.keys()].sort(),
```

Add:

```javascript
excludedMealIds: [...state.excludedMealIds].sort(),
```

Result:

```javascript
const request = {
  templateId: ...,
  guestCount: ...,
  budget: ...,
  servingsPerGuest: ...,
  mealCount: ...,
  dietaryShares: dietaryShares(),

  requiredMealIds: [...state.requiredMeals.keys()].sort(),
  excludedMealIds: [...state.excludedMealIds].sort(),

  weights,
  preferences: ...,
  availableInventory,
  hardConstraints: ...
};
```

---

# 21. Selected Menu Card Controls

Modify `renderMeals`.

Each generated meal card should know:

```javascript
const isPinned = state.requiredMeals.has(meal.mealId);
```

Render controls similar to:

```html
<div class="meal-actions">
  <button
    type="button"
    class="meal-pin"
    data-pin-meal-id="caprese-skewers"
    aria-pressed="false"
  >
    Pin
  </button>

  <button
    type="button"
    class="meal-reject"
    data-reject-meal-id="caprese-skewers"
  >
    Remove
  </button>
</div>
```

Exact markup/styles may follow current project conventions.

Do not use inline JavaScript handlers.

Attach listeners after rendering, as the current frontend already does elsewhere.

---

# 22. Pinned Visual State

Pinned cards need a clear but restrained state.

Possible treatments:

```text
📌 Pinned badge
```

or a highlighted Pin button.

The existing:

```text
Guaranteed
```

badge may already be shown for server-returned required meals.

Avoid confusing duplicate terminology.

Preferred UX:

```text
Button says: Pin / Unpin
Badge says: Pinned
```

or reuse:

```text
Guaranteed
```

only if terminology remains clear throughout the interface.

For a user-facing UI, **Pinned** is probably clearer than **Guaranteed**.

The backend field may remain:

```text
guaranteed
```

No backend rename is required.

---

# 23. Remove Visual Behavior

When **Remove** is clicked:

```text
the card should disappear immediately
```

This gives direct feedback that the meal has been rejected.

Do not automatically trigger a backend generation on the click.

The page should enter a "menu modified" state and allow the user to decide when to regenerate.

Suggested small feedback:

```text
Falafel Bites removed. Generate again to fill the menu.
```

This may be:

- an inline status;
- toast;
- small notice above the menu.

Keep it simple.

---

# 24. Regeneration CTA

After the user pins, unpins, or removes a meal, make it obvious that another generation will apply the changes.

The existing Generate button may be reused.

However, when the user is currently looking at the result area, requiring them to scroll all the way back to the form is poor UX.

Add a result-area action such as:

```text
Generate new menu
```

or:

```text
Regenerate menu
```

near the Selected menu heading or below the cards.

This button should submit the same planner form/current inputs.

Do **not** duplicate planner request construction.

Use one shared function/path for generating.

Suggested behavior:

```text
[ Regenerate menu ]
```

becomes the primary next step after pin/remove interactions.

On mobile it should be easy to tap.

---

# 25. Regeneration Must Preserve All Current Form Inputs

When regenerating after meal changes, preserve:

- event template;
- guest count;
- budget;
- servings per guest;
- meal count;
- dietary guest counts/shares;
- priority weights;
- prepare-ahead preference;
- available inventory;
- manually selected required meals;
- newly pinned meals;
- rejected meal IDs.

Do not reset the form between generations.

---

# 26. Interaction With Existing Manual Meal Picker

The existing meal picker already adds meals to:

```text
state.requiredMeals
```

That is compatible with Pin.

Both actions represent the same backend concept:

```text
requiredMealIds
```

Therefore:

```text
meal selected manually in picker
=
meal pinned from generated menu
```

They must stay synchronized.

If a meal is pinned from a result card:

- the manual required-meal area should show it;
- opening the meal picker should show it as selected.

If it is removed from the required-meal area or unpinned:

- both representations update.

Do not create separate:

```text
pickerRequiredMeals
pinnedMeals
```

state.

Use the existing `state.requiredMeals` as the single source of truth.

---

# 27. Interaction Between Rejected Meals and Manual Picker

A rejected meal may later be explicitly selected by the user through the manual recipe picker.

Explicit user intent should win.

Therefore, when the user manually adds a previously rejected meal:

```javascript
state.excludedMealIds.delete(meal.id);
state.requiredMeals.set(meal.id, meal);
```

This allows the user to change their mind.

Likewise, pressing Pin on a meal must remove it from exclusions.

Never send the same meal as both required and excluded.

---

# 28. Optional Rejected-Meals Visibility

Do not build a complex history UI.

However, the user should ideally have some way to undo an accidental rejection before refreshing the page.

A small optional section is sufficient:

```text
Excluded from next generation
• Falafel Bites   [Undo]
• Mini Quiche     [Undo]
```

This can appear near:

```text
Selected menu
```

or near the Regenerate button.

This is recommended but not required if time is limited.

If implemented:

```text
Undo
```

only removes the meal ID from the exclusion set.

It does not automatically pin or add the meal back into the current plan.

---

# 29. Persistence Scope

The feature only needs **planning-session persistence**.

Pin/reject state must survive:

```text
Generate
→ inspect
→ Generate again
→ inspect
→ Generate again
```

within the current loaded page.

Do not add:

- database persistence;
- user accounts;
- cookies;
- server-side planning sessions.

`localStorage` is not required.

A browser refresh may reset the state.

---

# 30. Template Change Behavior

Pin/reject decisions are made in the context of a specific event/template.

To avoid hidden stale exclusions after switching event type:

```text
when templateId changes:
clear excludedMealIds
```

For `requiredMeals`, preserve the existing manual-selection behavior unless doing so creates inconsistency with the current UI.

Recommended minimal behavior:

```text
template change
→ clear rejected meals
→ leave explicitly required meals as current UI does
```

Reason:

- rejection is a response to an automatically generated menu for a particular event;
- manually selected required meals are stronger explicit intent.

If this produces confusing behavior during implementation, document the chosen behavior in the final report.

---

# 31. Current Plan vs Next Plan

The UI should make clear that controls change **the next generation**.

Pinning does not need to call the backend immediately.

Removing can hide the current card immediately, but:

- shopping list;
- totals;
- ingredient list;
- serving allocation;

still represent the previous backend result until regeneration.

This creates a possible temporary inconsistency.

Therefore, when any selected meal is removed, show a clear stale-result indicator:

```text
Menu changed — regenerate to update quantities and costs.
```

Until regeneration:

- do not pretend totals are recalculated;
- do not locally manipulate product quantities or prices.

After successful regeneration:

```text
clear the stale-result indicator
```

This is important.

---

# 32. Failed Regeneration

If regeneration fails because the user excluded too many meals or created an impossible dietary combination:

- keep `state.requiredMeals`;
- keep `state.excludedMealIds`;
- keep the user's form values;
- show the backend error;
- do not silently clear exclusions.

The user can then:

- undo an exclusion;
- unpin a meal;
- adjust dietary counts;
- change mealCount;
- retry.

---

# 33. Backend Response

A response does not strictly need to repeat `excludedMealIds`, because the frontend owns the interaction state.

However, for transparency/debugging it is recommended to add:

```kotlin
excludedMealIds
```

to `EventSummary` beside:

```text
requiredMealIds
```

if doing so is a small change.

Example:

```json
"event": {
  "requiredMealIds": [
    "caprese-skewers"
  ],
  "excludedMealIds": [
    "falafel-bites"
  ]
}
```

This is recommended but not mandatory.

Do not delay the feature if this causes unnecessary response-model churn.

---

# 34. Backend Tests

Add focused tests.

Do not rewrite the entire planner test suite.

At minimum test the following.

## Test 1 — excluded high-scoring meal is not selected

Arrange:

```text
candidate A = highest score
candidate B = second highest
excludedMealIds = [A]
```

Assert:

```text
A not selected
B selected
```

## Test 2 — pinned meal remains selected

Arrange:

```text
requiredMealIds = [meal A]
mealCount = 3
```

Assert:

```text
meal A selected
selected meal count satisfies normal planner behavior
```

Existing required-meal tests may already cover most of this.

## Test 3 — required/excluded overlap rejected

Request:

```json
{
  "requiredMealIds": ["falafel-bites"],
  "excludedMealIds": ["FALAFEL-BITES"]
}
```

Assert:

```text
request fails
```

Case-insensitive overlap must be detected.

## Test 4 — unknown excluded ID rejected

Request:

```json
{
  "excludedMealIds": ["does-not-exist"]
}
```

Assert clear failure.

## Test 5 — excluded meal not used for dietary coverage

Arrange:

```text
halal share requested
highest halal meal excluded
another halal meal available
```

Assert:

```text
excluded halal meal absent
other valid halal option used
dietary minimum still satisfied
```

## Test 6 — impossible after exclusions

Arrange:

```text
strict meal-like dietary share
all viable matching meals excluded
```

Assert:

```text
existing strict failure behavior
```

Do not silently re-add excluded meals.

## Test 7 — mealCount with exclusions

Arrange:

```text
mealCount = 5
one normal winner excluded
at least five other valid candidates exist
```

Assert:

```text
5 distinct meals selected
excluded meal absent
```

## Test 8 — existing weighting behavior unchanged

Existing weighting scenarios should still pass.

The exclusion filter must not alter weighting among remaining candidates.

---

# 35. Frontend Tests / Manual Checks

If no automated browser test framework exists, do not introduce one for this hackathon feature.

Perform syntax/build checks and document manual UI checks.

Minimum manual scenarios:

### Scenario A — Pin one meal

1. Generate a 5-meal plan.
2. Pin Caprese Skewers.
3. Click Regenerate.
4. Confirm Caprese remains.
5. Confirm remaining dishes may change.

### Scenario B — Reject one meal

1. Generate a plan containing Falafel Bites.
2. Remove Falafel Bites.
3. Confirm its card disappears.
4. Confirm stale-plan notice appears.
5. Click Regenerate.
6. Confirm Falafel Bites does not return.
7. Confirm a replacement meal is selected when possible.

### Scenario C — Pin + reject

1. Pin one dish.
2. Reject two other dishes.
3. Regenerate.
4. Confirm pinned dish remains.
5. Confirm rejected dishes are absent.
6. Confirm total meal count remains sensible.

### Scenario D — Change mind

1. Reject a meal.
2. Undo rejection or manually select the same meal.
3. Regenerate.
4. Confirm it is allowed again.

### Scenario E — Dietary interaction

1. Request halal servings.
2. Reject one halal meal.
3. Regenerate.
4. Confirm another halal-compatible meal is selected if available.
5. Confirm dietary coverage remains valid.

### Scenario F — Mobile

On a narrow/mobile viewport:

- Pin and Remove controls remain tappable;
- actions do not overlap score circle;
- meal name remains readable;
- card does not become excessively tall;
- Regenerate button is easy to find.

---

# 36. Styling

Match the existing visual language.

Recommended characteristics:

## Pin

- neutral outline when inactive;
- subtly highlighted when active;
- optional pin icon;
- clearly distinguishable from Remove.

## Remove

- secondary/destructive styling;
- do not use an enormous bright-red button;
- readable text/icon;
- accessible focus state.

Buttons must have:

```text
type="button"
```

so they do not accidentally submit the planner form.

Provide sensible:

```text
aria-label
aria-pressed
title
```

where useful.

---

# 37. Accessibility

Required:

- keyboard accessible buttons;
- visible focus state;
- no icon-only action without accessible name;
- pinned state available through `aria-pressed`;
- removal feedback should be available as normal visible text; an `aria-live` status region is a bonus if easy.

Suggested:

```html
<button
  type="button"
  aria-pressed="true"
  aria-label="Unpin Caprese Skewers"
>
  📌 Pinned
</button>
```

and:

```html
<button
  type="button"
  aria-label="Remove Caprese Skewers from future generations"
>
  Remove
</button>
```

---

# 38. Do Not Change

Do not use this task to change:

- weighting formula;
- weight precedence;
- database score definitions;
- dietary capability model;
- dietary serving allocation;
- `mealCount` semantics;
- ingredient expansion;
- package rounding;
- inventory deduction;
- product scoring;
- budget calculation;
- Mongo query architecture;
- catalog schema.

This feature is:

```text
one request field
+
candidate filtering
+
frontend state/actions
+
focused tests
```

Keep it that way.

---

# 39. Suggested Implementation Shape

A small backend helper is preferable to scattered string handling.

Conceptually:

```kotlin
private fun normalizedMealIds(ids: Set<String>): Set<String> =
    ids.map { it.trim().lowercase() }
        .filter { it.isNotEmpty() }
        .toSet()
```

At start of resolve:

```kotlin
val requiredIds = normalizedMealIds(request.requiredMealIds)
val excludedIds = normalizedMealIds(request.excludedMealIds)

val overlap = requiredIds intersect excludedIds

if (overlap.isNotEmpty()) {
    throw IllegalArgumentException(
        "Meal IDs cannot be both required and excluded: ${overlap.sorted().joinToString()}"
    )
}
```

Then use an exclusion-aware meal filter.

Do not copy this pseudo-code blindly if existing helpers already normalize IDs.

Follow current code conventions.

---

# 40. Example Full Workflow

Initial request:

```json
{
  "templateId": "business-apero",
  "guestCount": 20,
  "budget": 500,
  "servingsPerGuest": 5,
  "mealCount": 5,
  "dietaryShares": {
    "halal": 0.2
  },
  "requiredMealIds": [],
  "excludedMealIds": []
}
```

Planner returns:

```text
Mini Spinach Quiche
Caprese Skewers
Mini Ham Croissants
Falafel Bites
Halal Chicken Skewers
```

User:

```text
PIN:
Caprese Skewers
Halal Chicken Skewers

REMOVE:
Mini Ham Croissants
Falafel Bites
```

Frontend state:

```text
requiredMealIds:
- caprese-skewers
- halal-chicken-skewers

excludedMealIds:
- ham-croissants
- falafel-bites
```

Next generation:

```json
{
  "templateId": "business-apero",
  "guestCount": 20,
  "budget": 500,
  "servingsPerGuest": 5,
  "mealCount": 5,

  "requiredMealIds": [
    "caprese-skewers",
    "halal-chicken-skewers"
  ],

  "excludedMealIds": [
    "ham-croissants",
    "falafel-bites"
  ],

  "dietaryShares": {
    "halal": 0.2
  }
}
```

Expected result:

```text
Caprese Skewers              ← still there
Halal Chicken Skewers        ← still there
New valid meal A
New valid meal B
New valid meal C
```

Must not contain:

```text
Mini Ham Croissants
Falafel Bites
```

---

# 41. Acceptance Criteria

The feature is complete when all of the following are true:

- `ResolvePlanRequest` contains `excludedMealIds`.
- Required/excluded overlap is rejected case-insensitively.
- Unknown excluded IDs produce a clear error.
- Excluded meals are filtered before automatic selection.
- Exclusions apply in both legacy and enhanced selectors.
- Excluded meals cannot be reintroduced to satisfy `mealCount`.
- Excluded meals cannot be reintroduced for dietary coverage.
- Existing required-meal behavior remains intact.
- Every generated meal card has Pin and Remove controls.
- Pin adds the meal to the existing `state.requiredMeals`.
- Unpin removes it from required meals but does not exclude it.
- Remove deletes it from required meals and adds it to the excluded set.
- Removed cards disappear immediately.
- The UI warns that quantities/costs are stale until regeneration.
- A Regenerate action is accessible near the generated menu.
- Regeneration sends both `requiredMealIds` and `excludedMealIds`.
- Pinned meals remain in the next plan.
- Rejected meals do not return.
- Manually selecting a rejected meal removes it from exclusions.
- Form inputs are preserved across regenerations.
- Existing weighting tests pass.
- Existing dietary/planner tests pass.
- New exclusion-focused backend tests pass.
- Frontend JavaScript syntax/build checks pass.
- The workflow is usable on mobile.

---

# 42. Required Report

After implementation, create:

```text
specdrive/PIN_REJECT_REGENERATE_REPORT.md
```

Include:

## A. Changed files

List all changed files.

## B. API

Document:

```text
requiredMealIds
excludedMealIds
```

and their interaction.

## C. Planner behavior

Explain exactly where exclusions are filtered.

## D. Frontend state

Explain how:

```text
state.requiredMeals
state.excludedMealIds
```

are maintained.

## E. Tests

List each command actually run and its result.

## F. Manual test checklist

Provide the exact browser steps for:

- Pin;
- Unpin;
- Remove;
- Regenerate;
- Pin + remove together;
- dietary interaction;
- mobile viewport.

## G. Remaining limitations

Document any intentionally deferred behavior.

Do not claim a command/test passed unless it was actually executed successfully.
