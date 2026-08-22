# Pipeline Weighting Validation — Complete Codex Handoff

This single file contains everything needed for the task:

1. Implementation and validation requirements
2. The enriched MongoDB seed that should replace/adapt `mongo/seed.js`
3. The realistic validation scenarios and expected outcomes

Codex should follow the requirements first, use the supplied seed as the intended test database, execute/implement the scenarios, fix only issues that violate the requirements, and write the requested validation report.

---

# PART 1 — REQUIREMENTS

# Pipeline Weighting + Enriched Seed Validation Requirements

## Target

Repository/branch:

```text
https://github.com/Jocomol/InnaBoxPOC/tree/feat/pipeline_improvements
```

This task is a **POC validation/refinement task**, not a redesign.

The goal is to verify that the existing weighting/scoring pipeline behaves predictably with a database that looks more like an enriched catalog, while also exercising the recently added `mealCount` and `capabilityShares` behavior.

Use the provided files as authoritative test inputs:

```text
seed_weighting_enriched.js
pipeline_weighting_test_scenarios.json
```

Replace/adapt the repository's current `mongo/seed.js` from the provided enriched seed. Do not invent a significantly larger catalog.

---

# 1. Preserve the Existing Data Model

Do **not** redesign `Meal`, `Product`, `EventTemplate`, `PlanningPriority`, or `ResolvePlanRequest`.

Keep these existing concepts:

```text
Meal.capabilities
Product.capabilities
Meal.scores
Product.scores
EventTemplate.weights
PlanningPriority.defaultWeight
ResolvePlanRequest.weights
ResolvePlanRequest.mealCount
ResolvePlanRequest.capabilityShares
```

Capabilities remain dynamic strings. Do not introduce dietary enums.

The enriched seed deliberately uses capabilities such as:

```text
vegetarian
vegan
halal
savory
finger-food
apero
lunch
buffet
```

No schema change is required for these.

---

# 2. Dietary Shares Are Request Data, Not Template Data

The new canonical behavior is:

```json
"capabilityShares": {
  "vegetarian": 0.20,
  "halal": 0.30
}
```

These shares belong to the plan request because they describe the actual guests of an event.

The provided seed therefore intentionally:

- removes `vegetarianShare` from template defaults;
- removes dietary `target.share` requirements from the Business Apéro and Team Lunch templates;
- keeps event/template requirements focused on event suitability;
- adds `mealCount` to template defaults.

Do not reintroduce template-level dietary percentages.

Legacy support in Kotlin may remain for backwards compatibility. This task does **not** require deleting old model fields or old code paths unless they directly break the new behavior.

---

# 3. Template Meal Counts

The provided seed defines these defaults:

```text
business-apero      5
brunch              3
coffee-break        4
team-lunch-buffet   4
vegan-reception     3
swiss-breakfast     2
```

`request.mealCount` still overrides `template.defaults["mealCount"]`.

Changing the number of meals must not multiply the total number of servings.

---

# 4. Weight Resolution Semantics

The intended weight flow is:

```text
planningPriorities.defaultWeight
        overridden by
EventTemplate.weights
        overridden by
ResolvePlanRequest.weights
        then normalized so the final sum = 1.0
```

Keep this behavior unless a test proves the current implementation differs from it.

For every final weight `w_i` and candidate score `s_i`:

```text
weightedScore = Σ(w_i * s_i)
```

Candidate scores are expected to be in the range:

```text
0.0 .. 1.0
```

The final normalized weights must also be returned in `ShoppingPlan.event.appliedWeights` as they are today.

When the request explicitly supplies **all priority keys**, it must be possible to isolate a single priority by setting one to `1.0` and the rest to `0.0`.

Example:

```json
"weights": {
  "price": 1.0,
  "swiss": 0.0,
  "presentation": 0.0,
  "prepEase": 0.0,
  "sustainability": 0.0
}
```

must make candidate ranking depend on the `price` score only, after hard eligibility rules.

---

# 5. Scoring Must Never Override Eligibility

Scoring is a ranking mechanism, not an eligibility mechanism.

Required precedence:

```text
1. hard constraints / mandatory template compatibility
2. capability-share feasibility and coverage
3. weighted score
4. preferred-capability tie break (existing behavior)
5. deterministic candidate ID tie break
```

A high-scoring incompatible candidate must never beat a lower-scoring candidate that is required to satisfy a dietary share.

Example from the supplied scenarios:

```text
100% halal requested
Swiss weight = 100%
```

The planner must select a halal-compatible meal even if a non-halal Swiss meal has a higher Swiss score.

---

# 6. Capability Shares

Keep the current dynamic capability-share behavior.

For total meal servings `T` and requested share `p`:

```text
minimum required servings = ceil(T * p)
```

Shares are minimums, not exact targets.

Capabilities may overlap.

A serving from a meal with:

```json
["vegetarian", "halal"]
```

counts toward both requested shares.

For meal-like plans (`servingsPerGuest <= 2`) a shortfall must remain a planning failure.

For snack-like plans (`servingsPerGuest >= 3`) the existing warning behavior may remain.

---

# 7. Important Enhanced-Selection Correctness Rule

When `mealCount` or `capabilityShares` causes the planner to add extra meals, it must **not choose unrelated meals from another event type simply because they score highly**.

Automatically selected meals must remain compatible with the selected event template.

For this POC, define event compatibility as:

> An automatically selected meal must satisfy the full `requiredCapabilities` set of at least one `type = "meal"` requirement in the selected template.

Examples:

```text
Business Apéro extra meals
→ must match savory + finger-food + apero

Team Lunch Buffet extra meals
→ must match savory + lunch + buffet

Coffee Break extra meals
→ must match either the sweet coffee-break requirement or the savory coffee-break requirement
```

Explicit `requiredMealIds` are the exception: preserve the existing behavior that a user-requested meal can be added as an explicit guaranteed dish if it passes hard constraints.

Implement this with the smallest reasonable change inside the current planner. Do not add a new template schema field solely for this.

---

# 8. Swiss Semantics

For this POC, `swiss` is primarily a **planning score / product-origin property**, not a dietary capability.

The enriched seed intentionally removes the `swiss` capability requirement from the Swiss Breakfast meals/template while retaining `scores.swiss`.

Product rule remains:

```text
originCountry == "CH" -> scores.swiss = 1.0
otherwise              -> scores.swiss = 0.0
```

For seeded meals, the existing seed-validation convention may remain:

```text
meal scores.swiss = 1.0 only when all seeded ingredient concepts resolve to Swiss-origin products
```

Do not require a meal to contain capability `"swiss"` just so Swiss weighting can work.

---

# 9. Halal Seed Semantics

The supplied seed adds a small amount of halal-capable data without redesigning the database.

Existing plant-based meals that are treated as halal-suitable in this POC are tagged with `halal`.

Two explicit non-vegetarian halal choices are added:

```text
halal-chicken-skewers
halal-chicken-rice-bowl
```

and matching products:

```text
halal-chicken-skewers-40
halal-chicken-rice-bowls-10
```

This seed is test data, not a claim that the POC implements real certification/compliance logic.

Do not build a certification subsystem as part of this task.

---

# 10. Product Weighting Test Data

The seed intentionally contains two water products that satisfy the same direct template requirement:

```text
mineral-water-6x15
- Swiss
- less favorable affordability score
- better sustainability score

budget-water-12l
- imported
- better affordability score
- lower sustainability score
```

This exists specifically so product weighting can be validated.

Expected behavior:

```text
100% price weight -> budget-water-12l
100% Swiss weight -> mineral-water-6x15
```

Do not special-case water or these product IDs in production code.

---

# 11. Missing Score Behavior

The current planner treats a missing score component as `0.0`.

For this hackathon task:

- preserve this behavior unless it causes a supplied acceptance scenario to fail;
- add at least one focused test documenting the behavior;
- mention it explicitly in the final report as a modeling assumption/limitation.

Do not design an uncertainty/imputation system.

---

# 12. Budget Is Not an Optimizer

Do not turn this task into a budget optimizer.

Current expected behavior remains:

```text
weights can prefer affordability
final plan cost is calculated
budget status/warning is reported afterward
```

The planner is **not** required to search alternative combinations until it finds a plan under budget.

Document this limitation in the validation report.

---

# 13. Database Seed Work

Use `seed_weighting_enriched.js` as the intended replacement content for `mongo/seed.js`.

The enriched catalog should remain small:

```text
6 event templates
5 planning priorities
21 meals
20 products
```

Do not significantly expand it.

Update `mongo/check-seed.js` so it verifies at least the following:

1. All six templates exist.
2. Every template has a positive whole-number `defaults.mealCount`.
3. No template default contains `vegetarianShare`.
4. No supplied template uses a dietary `target.share` requirement.
5. All required template requirements have at least one candidate.
6. Every ingredient concept resolves to a product.
7. Every score/weight key has matching planning-priority metadata.
8. Product Swiss scores match `originCountry`.
9. Seeded meal Swiss scores still pass the existing ingredient-origin rule.
10. The added halal meals/products exist and carry `halal` capability.
11. Both seeded water alternatives exist.

---

# 14. Required Validation Scenarios

Use `pipeline_weighting_test_scenarios.json` as the acceptance-scenario source.

Do not rewrite the expected outcomes simply to match the current implementation.

If a scenario fails:

1. determine whether the seed, test assumption, or planner is wrong;
2. make the smallest justified correction;
3. document the reason in the report.

The scenarios cover:

- realistic lunch with 2/10 vegetarian and 3/10 halal guests;
- price-only meal selection;
- presentation-only meal selection;
- sustainability-only meal selection;
- normalization of a partial-total weight vector;
- dietary share taking precedence over Swiss scoring;
- price-driven water selection;
- Swiss-driven water selection.

---

# 15. Tests to Add

Keep testing focused. This is a hackathon POC.

Add only the tests needed to establish the important invariants.

At minimum verify:

### Weight math

- request override values are normalized;
- final score equals the weighted sum of score components;
- a pure priority changes winner as expected;
- tied scores remain deterministic.

### Precedence

- hard filtering happens before scoring;
- capability-share requirements beat a conflicting score preference.

### Meal count / event compatibility

- automatically added meals stay within the current event/template candidate space;
- `mealCount` is respected when enough compatible meals exist;
- total meal servings remain `guestCount * servingsPerGuest` when `servingsPerGuest` is provided.

### Product weighting

- price-only selects `budget-water-12l` for the coffee-break water requirement;
- Swiss-only selects `mineral-water-6x15`.

### Seed

- updated `mongo/check-seed.js` passes.

Do not create a large generic test framework.

---

# 16. How to Validate

Run the existing backend tests:

```bash
cd backend
mvn test
```

Then validate the seeded application using the repository's existing Docker workflow.

At minimum:

```bash
docker compose up --build -d
./scripts/reseed.sh
docker compose exec -T mongodb mongosh catering < mongo/check-seed.js
```

Execute all requests from `pipeline_weighting_test_scenarios.json` against:

```text
POST /api/plans/resolve
```

Use a small script or direct HTTP calls. Keep the harness simple.

After validation, stop containers if appropriate.

---

# 17. Required Report

Create:

```text
specdrive/PIPELINE_WEIGHTING_VALIDATION_REPORT.md
```

The report must contain:

## A. Summary

- whether the existing weighting formula was correct;
- whether any production-code change was necessary;
- concise explanation of what was changed.

## B. Weight Resolution

Show the actual precedence:

```text
database defaults -> template -> request -> normalization
```

and include one concrete numeric weighted-score example from the seeded catalog.

## C. Scenario Results

For every scenario from `pipeline_weighting_test_scenarios.json`, record:

```text
PASS / FAIL
selected meals
allocated servings
relevant capability counts
relevant selected product(s)
applied weights
warnings
```

Do not paste the complete REST response unless needed to explain a failure.

## D. Database Changes

Summarize:

- template `mealCount` defaults;
- removal of template dietary shares;
- halal capability enrichment;
- added halal meals/products;
- water tradeoff products;
- Swiss capability/score cleanup.

## E. Bugs Found

Document any real behavioral bugs found during the scenario runs, especially if enhanced `mealCount` selection previously allowed unrelated event meals.

## F. Known POC Limitations

At minimum discuss:

- scores are curated/enriched input data rather than calculated universally by the planner;
- missing score components currently count as zero;
- capability shares permit overlap;
- halal is modeled as a capability, not a certification/compliance system;
- budget is checked after planning rather than globally optimized;
- the planner still loads the whole meal/product collections for the POC.

## G. Commands and Test Result

List the exact commands run and whether they passed.

---

# 18. Non-Goals

Do not implement:

- Mongo query optimization;
- a new catalog schema;
- dietary enums;
- a certification subsystem;
- AI-generated recipes;
- global combinatorial optimization;
- automatic score generation;
- a full budget optimizer;
- UI work;
- a large test suite.

---

# Acceptance Criteria

The task is complete when:

- the provided enriched seed is integrated;
- `mongo/check-seed.js` passes;
- existing backend tests still pass;
- focused new weighting tests pass;
- all acceptance scenarios are executed and documented;
- pure priority weights demonstrably change candidate selection as expected;
- normalized applied weights are correct;
- dietary capability shares take precedence over weighting;
- extra meals selected for `mealCount` remain event-compatible;
- product weighting selects the expected water alternative for price vs Swiss priority;
- no template-level dietary percentage is required for the new behavior;
- a validation report is written to `specdrive/PIPELINE_WEIGHTING_VALIDATION_REPORT.md`.


---

# PART 2 — ENRICHED MONGODB SEED

Save/adapt the following as `mongo/seed.js` in the target branch.

```javascript
db = db.getSiblingDB("catering");

function upsertMany(collectionName, documents) {
  const collection = db.getCollection(collectionName);
  for (const document of documents) {
    collection.replaceOne({ id: document.id }, document, { upsert: true });
  }
  print(`Seeded ${documents.length} documents into ${collectionName}`);
}

db.eventTemplates.createIndex({ id: 1 }, { unique: true });
db.meals.createIndex({ id: 1 }, { unique: true });
db.meals.createIndex({ capabilities: 1 });
db.products.createIndex({ id: 1 }, { unique: true });
db.products.createIndex({ sku: 1 }, { unique: true });
db.products.createIndex({ concept: 1 });
db.products.createIndex({ capabilities: 1 });
db.planningPriorities.createIndex({ id: 1 }, { unique: true });

const planningPriorities = [
  {
    id: "price",
    label: "Affordability",
    description: "Favors candidates that provide the required quantity at a lower comparable cost.",
    displayOrder: 10,
    defaultWeight: 0.20,
    scale: "continuous",
    lowLabel: "Premium",
    highLabel: "Economical"
  },
  {
    id: "swiss",
    label: "Swiss origin",
    description: "Favors Swiss-sourced products and meals whose complete ingredient list is Swiss-sourced.",
    displayOrder: 20,
    defaultWeight: 0.20,
    scale: "binary",
    lowLabel: "Non-Swiss",
    highLabel: "Swiss"
  },
  {
    id: "presentation",
    label: "Presentation",
    description: "Favors dishes that are visually suited to serving at the selected event.",
    displayOrder: 30,
    defaultWeight: 0.20,
    scale: "continuous",
    lowLabel: "Practical",
    highLabel: "Showpiece"
  },
  {
    id: "prepEase",
    label: "Preparation ease",
    description: "Favors food that needs less hands-on preparation and service-time work.",
    displayOrder: 40,
    defaultWeight: 0.20,
    scale: "continuous",
    lowLabel: "Hands-on",
    highLabel: "Low effort"
  },
  {
    id: "sustainability",
    label: "Sustainability",
    description: "Favors the catalog's relative estimate for lower-impact ingredients, packaging, and sourcing.",
    displayOrder: 50,
    defaultWeight: 0.20,
    scale: "continuous",
    lowLabel: "Lower priority",
    highLabel: "Lower impact"
  }
];

const eventTemplates = [
  {
    id: "business-apero",
    name: "Business Apéro",
    description: "Finger food and drinks for a casual business event.",
    defaults: { durationMinutes: 120, mealCount: 5 },
    requirements: [
      {
        id: "savory-finger-food",
        type: "meal",
        requiredCapabilities: ["savory", "finger-food", "apero"],
        target: { amount: 5, unit: "pieces-per-guest" },
        required: true
      },
      {
        id: "soft-drinks",
        type: "product",
        requiredCapabilities: ["non-alcoholic-drink"],
        target: { amount: 0.5, unit: "liter-per-guest" },
        required: true
      },
      {
        id: "napkins",
        type: "product",
        requiredCapabilities: ["napkin"],
        target: { amount: 3, unit: "pieces-per-guest" },
        required: true
      }
    ],
    weights: {
      price: 0.30,
      swiss: 0.20,
      presentation: 0.20,
      prepEase: 0.15,
      sustainability: 0.15
    }
  },
  {
    id: "brunch",
    name: "Brunch",
    description: "Breakfast and lunch-style food for a relaxed brunch.",
    defaults: { durationMinutes: 180, mealCount: 3 },
    requirements: [
      {
        id: "savory-brunch",
        type: "meal",
        requiredCapabilities: ["savory", "brunch"],
        target: { amount: 1, unit: "servings-per-guest" },
        required: true
      },
      {
        id: "sweet-brunch",
        type: "meal",
        requiredCapabilities: ["sweet", "brunch"],
        target: { amount: 1, unit: "servings-per-guest" },
        required: true
      },
      {
        id: "coffee",
        type: "product",
        requiredCapabilities: ["coffee"],
        target: { amount: 2, unit: "cups-per-guest" },
        required: true
      },
      {
        id: "juice",
        type: "product",
        requiredCapabilities: ["juice", "non-alcoholic-drink"],
        target: { amount: 0.3, unit: "liter-per-guest" },
        required: true
      }
    ],
    weights: {
      price: 0.25,
      swiss: 0.20,
      presentation: 0.15,
      prepEase: 0.20,
      sustainability: 0.20
    }
  },
  {
    id: "coffee-break",
    name: "Coffee Break",
    description: "A compact sweet-and-savory break for meetings, workshops, and training days.",
    defaults: { durationMinutes: 45, mealCount: 4 },
    requirements: [
      {
        id: "sweet-coffee-break",
        type: "meal",
        requiredCapabilities: ["sweet", "coffee-break"],
        target: { amount: 1, unit: "servings-per-guest" },
        required: true
      },
      {
        id: "savory-coffee-break",
        type: "meal",
        requiredCapabilities: ["savory", "coffee-break"],
        target: { amount: 1, unit: "servings-per-guest" },
        required: true
      },
      {
        id: "coffee",
        type: "product",
        requiredCapabilities: ["coffee"],
        target: { amount: 1.5, unit: "cups-per-guest" },
        required: true
      },
      {
        id: "water",
        type: "product",
        requiredCapabilities: ["water", "non-alcoholic-drink"],
        target: { amount: 0.3, unit: "liter-per-guest" },
        required: true
      }
    ],
    weights: {
      price: 0.25,
      swiss: 0.15,
      presentation: 0.20,
      prepEase: 0.25,
      sustainability: 0.15
    }
  },
  {
    id: "team-lunch-buffet",
    name: "Team Lunch Buffet",
    description: "A generous buffet with a hearty centerpiece and a substantial vegetarian option.",
    defaults: { durationMinutes: 90, mealCount: 4 },
    requirements: [
      {
        id: "lunch-main",
        type: "meal",
        requiredCapabilities: ["savory", "lunch", "buffet"],
        target: { amount: 1, unit: "servings-per-guest" },
        required: true
      },
      {
        id: "buffet-water",
        type: "product",
        requiredCapabilities: ["water", "non-alcoholic-drink"],
        target: { amount: 0.4, unit: "liter-per-guest" },
        required: true
      },
      {
        id: "buffet-juice",
        type: "product",
        requiredCapabilities: ["juice", "non-alcoholic-drink"],
        target: { amount: 0.25, unit: "liter-per-guest" },
        required: true
      },
      {
        id: "buffet-napkins",
        type: "product",
        requiredCapabilities: ["napkin"],
        target: { amount: 2.5, unit: "pieces-per-guest" },
        required: true
      }
    ],
    weights: {
      price: 0.25,
      swiss: 0.20,
      presentation: 0.15,
      prepEase: 0.15,
      sustainability: 0.25
    }
  },
  {
    id: "vegan-reception",
    name: "Vegan Reception",
    description: "Colorful plant-based finger food for an elegant standing reception.",
    defaults: { durationMinutes: 120, mealCount: 3 },
    requirements: [
      {
        id: "vegan-savory-bites",
        type: "meal",
        requiredCapabilities: ["vegan", "savory", "finger-food", "reception"],
        target: { amount: 4, unit: "pieces-per-guest" },
        required: true
      },
      {
        id: "vegan-sweet-bites",
        type: "meal",
        requiredCapabilities: ["vegan", "sweet", "finger-food", "reception"],
        target: { amount: 2, unit: "pieces-per-guest" },
        required: true
      },
      {
        id: "reception-water",
        type: "product",
        requiredCapabilities: ["water", "non-alcoholic-drink"],
        target: { amount: 0.5, unit: "liter-per-guest" },
        required: true
      },
      {
        id: "reception-napkins",
        type: "product",
        requiredCapabilities: ["napkin"],
        target: { amount: 3, unit: "pieces-per-guest" },
        required: true
      }
    ],
    weights: {
      price: 0.20,
      swiss: 0.10,
      presentation: 0.30,
      prepEase: 0.15,
      sustainability: 0.25
    }
  },
  {
    id: "swiss-breakfast",
    name: "Swiss Breakfast",
    description: "A warm and cold Swiss-inspired breakfast with coffee and apple juice.",
    defaults: { durationMinutes: 90, mealCount: 2 },
    requirements: [
      {
        id: "savory-swiss-breakfast",
        type: "meal",
        requiredCapabilities: ["savory", "breakfast"],
        target: { amount: 1, unit: "servings-per-guest" },
        required: true
      },
      {
        id: "sweet-swiss-breakfast",
        type: "meal",
        requiredCapabilities: ["sweet", "breakfast"],
        target: { amount: 1, unit: "servings-per-guest" },
        required: true
      },
      {
        id: "breakfast-coffee",
        type: "product",
        requiredCapabilities: ["coffee"],
        target: { amount: 2, unit: "cups-per-guest" },
        required: true
      },
      {
        id: "breakfast-juice",
        type: "product",
        requiredCapabilities: ["juice", "non-alcoholic-drink"],
        target: { amount: 0.25, unit: "liter-per-guest" },
        required: true
      }
    ],
    weights: {
      price: 0.20,
      swiss: 0.30,
      presentation: 0.15,
      prepEase: 0.15,
      sustainability: 0.20
    }
  }
];

const meals = [
  {
    id: "caprese-skewers",
    name: "Caprese Skewers",
    capabilities: ["vegetarian", "savory", "finger-food", "cold", "apero", "prepare-ahead"],
    serving: { piecesPerServing: 2 },
    ingredients: [
      { concept: "mozzarella", amountPerServing: 40, unit: "g" },
      { concept: "cherry-tomato", amountPerServing: 50, unit: "g" },
      { concept: "basil", amountPerServing: 3, unit: "g" }
    ],
    scores: { price: 0.65, swiss: 1.00, presentation: 0.90, prepEase: 0.60, sustainability: 0.75 }
  },
  {
    id: "mini-spinach-quiche",
    name: "Mini Spinach Quiche",
    capabilities: ["vegetarian", "savory", "finger-food", "warm", "apero"],
    serving: { piecesPerServing: 2 },
    ingredients: [{ concept: "mini-spinach-quiche", amountPerServing: 2, unit: "piece" }],
    scores: { price: 0.75, swiss: 1.00, presentation: 0.75, prepEase: 0.90, sustainability: 0.70 }
  },
  {
    id: "falafel-bites",
    name: "Falafel Bites",
    capabilities: ["vegan", "vegetarian", "halal", "savory", "finger-food", "warm", "apero"],
    serving: { piecesPerServing: 3 },
    ingredients: [
      { concept: "falafel", amountPerServing: 3, unit: "piece" },
      { concept: "hummus", amountPerServing: 30, unit: "g" }
    ],
    scores: { price: 0.85, swiss: 0.00, presentation: 0.70, prepEase: 0.85, sustainability: 0.90 }
  },
  {
    id: "ham-croissants",
    name: "Mini Ham Croissants",
    capabilities: ["savory", "finger-food", "warm", "apero"],
    serving: { piecesPerServing: 2 },
    ingredients: [{ concept: "mini-ham-croissant", amountPerServing: 2, unit: "piece" }],
    scores: { price: 0.70, swiss: 1.00, presentation: 0.75, prepEase: 0.90, sustainability: 0.50 }
  },
  {
    id: "halal-chicken-skewers",
    name: "Halal Chicken Skewers",
    capabilities: ["halal", "savory", "finger-food", "warm", "apero", "prepare-ahead"],
    serving: { piecesPerServing: 2 },
    ingredients: [{ concept: "halal-chicken-skewer", amountPerServing: 2, unit: "piece" }],
    scores: { price: 0.72, swiss: 0.00, presentation: 0.88, prepEase: 0.86, sustainability: 0.58 }
  },
  {
    id: "bircher-muesli",
    name: "Bircher Müesli",
    capabilities: ["vegetarian", "sweet", "cold", "brunch"],
    serving: { piecesPerServing: 1 },
    ingredients: [
      { concept: "muesli", amountPerServing: 80, unit: "g" },
      { concept: "yogurt", amountPerServing: 120, unit: "g" },
      { concept: "apple", amountPerServing: 80, unit: "g" }
    ],
    scores: { price: 0.85, swiss: 1.00, presentation: 0.70, prepEase: 0.75, sustainability: 0.85 }
  },
  {
    id: "scrambled-eggs",
    name: "Scrambled Eggs",
    capabilities: ["vegetarian", "savory", "warm", "brunch"],
    serving: { piecesPerServing: 1 },
    ingredients: [
      { concept: "egg", amountPerServing: 2, unit: "piece" },
      { concept: "butter", amountPerServing: 10, unit: "g" }
    ],
    scores: { price: 0.80, swiss: 1.00, presentation: 0.65, prepEase: 0.55, sustainability: 0.70 }
  },
  {
    id: "fruit-salad",
    name: "Fruit Salad",
    capabilities: ["vegan", "vegetarian", "halal", "sweet", "cold", "brunch", "prepare-ahead"],
    serving: { piecesPerServing: 1 },
    ingredients: [{ concept: "mixed-fruit", amountPerServing: 180, unit: "g" }],
    scores: { price: 0.65, swiss: 0.00, presentation: 0.85, prepEase: 0.70, sustainability: 0.70 }
  },
  {
    id: "apple-yogurt-parfaits",
    name: "Apple Yogurt Parfaits",
    capabilities: ["vegetarian", "sweet", "cold", "coffee-break", "prepare-ahead"],
    serving: { piecesPerServing: 1 },
    ingredients: [
      { concept: "muesli", amountPerServing: 30, unit: "g" },
      { concept: "yogurt", amountPerServing: 100, unit: "g" },
      { concept: "apple", amountPerServing: 60, unit: "g" }
    ],
    scores: { price: 0.80, swiss: 1.00, presentation: 0.85, prepEase: 0.80, sustainability: 0.85 }
  },
  {
    id: "fresh-fruit-cups",
    name: "Fresh Fruit Cups",
    capabilities: ["vegan", "vegetarian", "halal", "sweet", "cold", "coffee-break", "prepare-ahead"],
    serving: { piecesPerServing: 1 },
    ingredients: [{ concept: "mixed-fruit", amountPerServing: 150, unit: "g" }],
    scores: { price: 0.70, swiss: 0.00, presentation: 0.90, prepEase: 0.85, sustainability: 0.80 }
  },
  {
    id: "mini-quiche-break-bites",
    name: "Mini Quiche Break Bites",
    capabilities: ["vegetarian", "savory", "warm", "finger-food", "coffee-break"],
    serving: { piecesPerServing: 2 },
    ingredients: [{ concept: "mini-spinach-quiche", amountPerServing: 2, unit: "piece" }],
    scores: { price: 0.75, swiss: 1.00, presentation: 0.80, prepEase: 0.92, sustainability: 0.72 }
  },
  {
    id: "ham-croissant-break-bites",
    name: "Ham Croissant Break Bites",
    capabilities: ["savory", "warm", "finger-food", "coffee-break"],
    serving: { piecesPerServing: 2 },
    ingredients: [{ concept: "mini-ham-croissant", amountPerServing: 2, unit: "piece" }],
    scores: { price: 0.70, swiss: 1.00, presentation: 0.78, prepEase: 0.90, sustainability: 0.50 }
  },
  {
    id: "ham-quiche-lunch-platter",
    name: "Ham Croissant & Quiche Lunch Platter",
    capabilities: ["savory", "warm", "lunch", "buffet", "hearty"],
    serving: { piecesPerServing: 3 },
    ingredients: [
      { concept: "mini-ham-croissant", amountPerServing: 2, unit: "piece" },
      { concept: "mini-spinach-quiche", amountPerServing: 1, unit: "piece" }
    ],
    scores: { price: 0.72, swiss: 1.00, presentation: 0.78, prepEase: 0.90, sustainability: 0.55 }
  },
  {
    id: "mediterranean-falafel-bowl",
    name: "Mediterranean Falafel Bowl",
    capabilities: ["vegan", "vegetarian", "halal", "savory", "warm", "lunch", "buffet"],
    serving: { piecesPerServing: 1 },
    ingredients: [
      { concept: "falafel", amountPerServing: 4, unit: "piece" },
      { concept: "hummus", amountPerServing: 50, unit: "g" },
      { concept: "cherry-tomato", amountPerServing: 80, unit: "g" }
    ],
    scores: { price: 0.82, swiss: 0.00, presentation: 0.86, prepEase: 0.78, sustainability: 0.92 }
  },
  {
    id: "caprese-lunch-bowl",
    name: "Caprese Lunch Bowl",
    capabilities: ["vegetarian", "savory", "cold", "lunch", "buffet", "prepare-ahead"],
    serving: { piecesPerServing: 1 },
    ingredients: [
      { concept: "mozzarella", amountPerServing: 80, unit: "g" },
      { concept: "cherry-tomato", amountPerServing: 100, unit: "g" },
      { concept: "basil", amountPerServing: 4, unit: "g" }
    ],
    scores: { price: 0.68, swiss: 1.00, presentation: 0.92, prepEase: 0.72, sustainability: 0.76 }
  },
  {
    id: "halal-chicken-rice-bowl",
    name: "Halal Chicken Rice Bowl",
    capabilities: ["halal", "savory", "warm", "lunch", "buffet", "hearty"],
    serving: { piecesPerServing: 1 },
    ingredients: [{ concept: "halal-chicken-rice-bowl", amountPerServing: 1, unit: "piece" }],
    scores: { price: 0.70, swiss: 0.00, presentation: 0.80, prepEase: 0.92, sustainability: 0.60 }
  },
  {
    id: "falafel-hummus-canapes",
    name: "Falafel Hummus Canapés",
    capabilities: ["vegan", "vegetarian", "halal", "savory", "finger-food", "reception", "prepare-ahead"],
    serving: { piecesPerServing: 3 },
    ingredients: [
      { concept: "falafel", amountPerServing: 3, unit: "piece" },
      { concept: "hummus", amountPerServing: 25, unit: "g" }
    ],
    scores: { price: 0.84, swiss: 0.00, presentation: 0.86, prepEase: 0.85, sustainability: 0.92 }
  },
  {
    id: "tomato-basil-bites",
    name: "Tomato Basil Hummus Bites",
    capabilities: ["vegan", "vegetarian", "halal", "savory", "finger-food", "cold", "reception", "prepare-ahead"],
    serving: { piecesPerServing: 2 },
    ingredients: [
      { concept: "cherry-tomato", amountPerServing: 80, unit: "g" },
      { concept: "hummus", amountPerServing: 20, unit: "g" },
      { concept: "basil", amountPerServing: 3, unit: "g" }
    ],
    scores: { price: 0.76, swiss: 0.00, presentation: 0.94, prepEase: 0.70, sustainability: 0.90 }
  },
  {
    id: "fruit-skewers",
    name: "Fresh Fruit Skewers",
    capabilities: ["vegan", "vegetarian", "halal", "sweet", "finger-food", "cold", "reception", "prepare-ahead"],
    serving: { piecesPerServing: 2 },
    ingredients: [{ concept: "mixed-fruit", amountPerServing: 140, unit: "g" }],
    scores: { price: 0.68, swiss: 0.00, presentation: 0.94, prepEase: 0.76, sustainability: 0.78 }
  },
  {
    id: "swiss-cheese-omelette",
    name: "Swiss Cheese Omelette",
    capabilities: ["vegetarian", "savory", "warm", "breakfast"],
    serving: { piecesPerServing: 1 },
    ingredients: [
      { concept: "egg", amountPerServing: 2, unit: "piece" },
      { concept: "mozzarella", amountPerServing: 35, unit: "g" },
      { concept: "butter", amountPerServing: 10, unit: "g" }
    ],
    scores: { price: 0.76, swiss: 1.00, presentation: 0.72, prepEase: 0.58, sustainability: 0.72 }
  },
  {
    id: "apple-bircher-jars",
    name: "Swiss Apple Bircher Jars",
    capabilities: ["vegetarian", "sweet", "cold", "breakfast", "prepare-ahead"],
    serving: { piecesPerServing: 1 },
    ingredients: [
      { concept: "muesli", amountPerServing: 75, unit: "g" },
      { concept: "yogurt", amountPerServing: 125, unit: "g" },
      { concept: "apple", amountPerServing: 90, unit: "g" }
    ],
    scores: { price: 0.84, swiss: 1.00, presentation: 0.86, prepEase: 0.78, sustainability: 0.88 }
  }
];

const products = [
  {
    id: "mozzarella-1kg", sku: "MOCK-001", name: "Swiss Mozzarella 1 kg", concept: "mozzarella", originCountry: "CH",
    package: { amount: 1000, unit: "g" }, price: { amount: 9.80, currency: "CHF" },
    capabilities: ["vegetarian"], scores: { price: 0.80, swiss: 1.00, sustainability: 0.70 }
  },
  {
    id: "cherry-tomatoes-500g", sku: "MOCK-002", name: "Swiss Cherry Tomatoes 500 g", concept: "cherry-tomato", originCountry: "CH",
    package: { amount: 500, unit: "g" }, price: { amount: 4.20, currency: "CHF" },
    capabilities: ["vegetarian", "vegan", "halal"], scores: { price: 0.75, swiss: 1.00, sustainability: 0.80 }
  },
  {
    id: "basil-100g", sku: "MOCK-003", name: "Swiss Fresh Basil 100 g", concept: "basil", originCountry: "CH",
    package: { amount: 100, unit: "g" }, price: { amount: 3.90, currency: "CHF" },
    capabilities: ["vegetarian", "vegan", "halal"], scores: { price: 0.60, swiss: 1.00, sustainability: 0.75 }
  },
  {
    id: "spinach-quiche-20", sku: "MOCK-004", name: "Swiss Mini Spinach Quiche 20 pcs", concept: "mini-spinach-quiche", originCountry: "CH",
    package: { amount: 20, unit: "piece" }, price: { amount: 18.90, currency: "CHF" },
    capabilities: ["vegetarian", "finger-food", "ready-to-heat"], scores: { price: 0.75, swiss: 1.00, sustainability: 0.70 }
  },
  {
    id: "falafel-50", sku: "MOCK-005", name: "Falafel 50 pcs", concept: "falafel", originCountry: "NL",
    package: { amount: 50, unit: "piece" }, price: { amount: 21.50, currency: "CHF" },
    capabilities: ["vegan", "vegetarian", "halal", "finger-food"], scores: { price: 0.90, swiss: 0.00, sustainability: 0.90 }
  },
  {
    id: "hummus-1kg", sku: "MOCK-006", name: "Hummus 1 kg", concept: "hummus", originCountry: "DE",
    package: { amount: 1000, unit: "g" }, price: { amount: 10.90, currency: "CHF" },
    capabilities: ["vegan", "vegetarian", "halal"], scores: { price: 0.85, swiss: 0.00, sustainability: 0.85 }
  },
  {
    id: "ham-croissant-24", sku: "MOCK-007", name: "Swiss Mini Ham Croissants 24 pcs", concept: "mini-ham-croissant", originCountry: "CH",
    package: { amount: 24, unit: "piece" }, price: { amount: 22.50, currency: "CHF" },
    capabilities: ["finger-food", "ready-to-heat"], scores: { price: 0.70, swiss: 1.00, sustainability: 0.45 }
  },
  {
    id: "muesli-2kg", sku: "MOCK-008", name: "Swiss Müesli 2 kg", concept: "muesli", originCountry: "CH",
    package: { amount: 2000, unit: "g" }, price: { amount: 13.50, currency: "CHF" },
    capabilities: ["vegetarian", "breakfast"], scores: { price: 0.90, swiss: 1.00, sustainability: 0.80 }
  },
  {
    id: "yogurt-1kg", sku: "MOCK-009", name: "Swiss Natural Yogurt 1 kg", concept: "yogurt", originCountry: "CH",
    package: { amount: 1000, unit: "g" }, price: { amount: 5.20, currency: "CHF" },
    capabilities: ["vegetarian"], scores: { price: 0.85, swiss: 1.00, sustainability: 0.80 }
  },
  {
    id: "apple-2kg", sku: "MOCK-010", name: "Swiss Apples 2 kg", concept: "apple", originCountry: "CH",
    package: { amount: 2000, unit: "g" }, price: { amount: 7.40, currency: "CHF" },
    capabilities: ["vegan", "vegetarian"], scores: { price: 0.90, swiss: 1.00, sustainability: 0.95 }
  },
  {
    id: "eggs-30", sku: "MOCK-011", name: "Swiss Eggs 30 pcs", concept: "egg", originCountry: "CH",
    package: { amount: 30, unit: "piece" }, price: { amount: 13.90, currency: "CHF" },
    capabilities: ["vegetarian"], scores: { price: 0.85, swiss: 1.00, sustainability: 0.75 }
  },
  {
    id: "butter-1kg", sku: "MOCK-012", name: "Swiss Butter 1 kg", concept: "butter", originCountry: "CH",
    package: { amount: 1000, unit: "g" }, price: { amount: 12.50, currency: "CHF" },
    capabilities: ["vegetarian"], scores: { price: 0.70, swiss: 1.00, sustainability: 0.65 }
  },
  {
    id: "mixed-fruit-2kg", sku: "MOCK-013", name: "Mixed Fresh Fruit 2 kg", concept: "mixed-fruit", originCountry: null,
    package: { amount: 2000, unit: "g" }, price: { amount: 17.90, currency: "CHF" },
    capabilities: ["vegan", "vegetarian", "halal"], scores: { price: 0.65, swiss: 0.00, sustainability: 0.70 }
  },
  {
    id: "mineral-water-6x15", sku: "MOCK-014", name: "Swiss Mineral Water 6 × 1.5 L", concept: "water", originCountry: "CH",
    package: { amount: 9, unit: "liter" }, price: { amount: 8.90, currency: "CHF" },
    capabilities: ["non-alcoholic-drink", "water"], scores: { price: 0.70, swiss: 1.00, sustainability: 0.88 }
  },
  {
    id: "budget-water-12l", sku: "MOCK-018", name: "Budget Still Water 12 L", concept: "water", originCountry: "FR",
    package: { amount: 12, unit: "liter" }, price: { amount: 8.40, currency: "CHF" },
    capabilities: ["non-alcoholic-drink", "water"], scores: { price: 0.98, swiss: 0.00, sustainability: 0.55 }
  },
  {
    id: "apple-juice-6l", sku: "MOCK-015", name: "Swiss Apple Juice 6 L", concept: "apple-juice", originCountry: "CH",
    package: { amount: 6, unit: "liter" }, price: { amount: 14.90, currency: "CHF" },
    capabilities: ["non-alcoholic-drink", "juice"], scores: { price: 0.80, swiss: 1.00, sustainability: 0.85 }
  },
  {
    id: "coffee-beans-1kg", sku: "MOCK-016", name: "Coffee Beans 1 kg", concept: "coffee-beans", originCountry: "BR",
    package: { amount: 1000, unit: "g" }, price: { amount: 21.90, currency: "CHF" },
    capabilities: ["coffee"], conversion: { amountPerServing: 8, servingUnit: "cup", sourceUnit: "g" },
    scores: { price: 0.75, swiss: 0.00, sustainability: 0.65 }
  },
  {
    id: "halal-chicken-skewers-40", sku: "MOCK-019", name: "Halal Chicken Skewers 40 pcs", concept: "halal-chicken-skewer", originCountry: "FR",
    package: { amount: 40, unit: "piece" }, price: { amount: 31.90, currency: "CHF" },
    capabilities: ["halal", "finger-food", "ready-to-heat"], scores: { price: 0.72, swiss: 0.00, sustainability: 0.58 }
  },
  {
    id: "halal-chicken-rice-bowls-10", sku: "MOCK-020", name: "Halal Chicken Rice Bowls 10 portions", concept: "halal-chicken-rice-bowl", originCountry: "FR",
    package: { amount: 10, unit: "piece" }, price: { amount: 69.00, currency: "CHF" },
    capabilities: ["halal", "ready-to-heat"], scores: { price: 0.68, swiss: 0.00, sustainability: 0.60 }
  },
  {
    id: "napkins-250", sku: "MOCK-017", name: "Napkins 250 pcs", concept: "napkin", originCountry: "DE",
    package: { amount: 250, unit: "piece" }, price: { amount: 7.50, currency: "CHF" },
    capabilities: ["napkin"], scores: { price: 0.90, swiss: 0.00, sustainability: 0.70 }
  }
];

upsertMany("eventTemplates", eventTemplates);
upsertMany("meals", meals);
upsertMany("products", products);
upsertMany("planningPriorities", planningPriorities);

print("------------------------------------------------");
print("Catering planner seed completed.");
print("------------------------------------------------");

```

---

# PART 3 — VALIDATION SCENARIOS + EXPECTED RESULTS

Use these scenarios as the authoritative behavioral validation cases.

```json
{
  "dataset": "seed_weighting_enriched.js",
  "notes": [
    "Expected dietary shares are minimum shares of allocated servings, not exact shares.",
    "Capability shares may overlap. A serving from a meal tagged both vegetarian and halal counts toward both targets.",
    "For weighting isolation scenarios, every planning-priority key is sent so template/database defaults cannot influence the result.",
    "Exact total cost is not asserted in the weighting scenarios because package rounding and unrelated template product requirements can legitimately affect it."
  ],
  "scenarios": [
    {
      "id": "lunch-10-guests-mixed-dietary",
      "purpose": "Realistic meal-like allocation: 10 lunch guests, 2 vegetarian and 3 halal/Muslim guests.",
      "request": {
        "templateId": "team-lunch-buffet",
        "guestCount": 10,
        "budget": 500.0,
        "servingsPerGuest": 1,
        "mealCount": 3,
        "capabilityShares": {
          "vegetarian": 0.20,
          "halal": 0.30
        }
      },
      "expect": {
        "status": 200,
        "selectedMealCount": 3,
        "totalMealServings": 10,
        "minimumCapabilityServings": {
          "vegetarian": 2,
          "halal": 3
        },
        "allAutomaticallySelectedMealsMustMatchAtLeastOneTemplateMealRequirement": true,
        "requiredMealCapabilitiesForThisTemplate": ["savory", "lunch", "buffet"],
        "noCapabilityShortfallWarning": true
      }
    },
    {
      "id": "apero-price-only",
      "purpose": "Verify meal weighting can be isolated to affordability.",
      "request": {
        "templateId": "business-apero",
        "guestCount": 20,
        "budget": 1000.0,
        "servingsPerGuest": 4,
        "mealCount": 1,
        "weights": {
          "price": 1.0,
          "swiss": 0.0,
          "presentation": 0.0,
          "prepEase": 0.0,
          "sustainability": 0.0
        }
      },
      "expect": {
        "status": 200,
        "selectedMealIds": ["falafel-bites"],
        "totalMealServings": 80,
        "selectedMealFinalWeightedScore": 0.85
      }
    },
    {
      "id": "apero-presentation-only",
      "purpose": "Verify presentation weight changes meal selection.",
      "request": {
        "templateId": "business-apero",
        "guestCount": 20,
        "budget": 1000.0,
        "servingsPerGuest": 4,
        "mealCount": 1,
        "weights": {
          "price": 0.0,
          "swiss": 0.0,
          "presentation": 1.0,
          "prepEase": 0.0,
          "sustainability": 0.0
        }
      },
      "expect": {
        "status": 200,
        "selectedMealIds": ["caprese-skewers"],
        "selectedMealFinalWeightedScore": 0.90
      }
    },
    {
      "id": "apero-sustainability-only",
      "purpose": "Verify sustainability weight changes meal selection.",
      "request": {
        "templateId": "business-apero",
        "guestCount": 20,
        "budget": 1000.0,
        "servingsPerGuest": 4,
        "mealCount": 1,
        "weights": {
          "price": 0.0,
          "swiss": 0.0,
          "presentation": 0.0,
          "prepEase": 0.0,
          "sustainability": 1.0
        }
      },
      "expect": {
        "status": 200,
        "selectedMealIds": ["falafel-bites"],
        "selectedMealFinalWeightedScore": 0.90
      }
    },
    {
      "id": "apero-normalized-mixed-weights",
      "purpose": "Verify request weights are normalized and a balanced candidate can win.",
      "request": {
        "templateId": "business-apero",
        "guestCount": 20,
        "budget": 1000.0,
        "servingsPerGuest": 4,
        "mealCount": 1,
        "weights": {
          "price": 0.15,
          "swiss": 0.0,
          "presentation": 0.35,
          "prepEase": 0.0,
          "sustainability": 0.0
        }
      },
      "expect": {
        "status": 200,
        "appliedWeights": {
          "price": 0.30,
          "swiss": 0.0,
          "presentation": 0.70,
          "prepEase": 0.0,
          "sustainability": 0.0
        },
        "selectedMealIds": ["halal-chicken-skewers"],
        "selectedMealFinalWeightedScore": 0.832
      }
    },
    {
      "id": "halal-share-beats-swiss-preference",
      "purpose": "Verify a required dietary share takes precedence over a conflicting scoring priority.",
      "request": {
        "templateId": "business-apero",
        "guestCount": 10,
        "budget": 1000.0,
        "servingsPerGuest": 1,
        "mealCount": 1,
        "capabilityShares": {
          "halal": 1.0
        },
        "weights": {
          "price": 0.0,
          "swiss": 1.0,
          "presentation": 0.0,
          "prepEase": 0.0,
          "sustainability": 0.0
        }
      },
      "expect": {
        "status": 200,
        "selectedMealIds": ["falafel-bites"],
        "totalMealServings": 10,
        "minimumCapabilityServings": {
          "halal": 10
        },
        "selectedMealMayHaveLowerSwissScoreThanRejectedCandidates": true,
        "noCapabilityShortfallWarning": true
      }
    },
    {
      "id": "water-price-priority",
      "purpose": "Verify weighting also affects direct product selection when multiple products satisfy the same requirement.",
      "request": {
        "templateId": "coffee-break",
        "guestCount": 20,
        "budget": 1000.0,
        "servingsPerGuest": 2,
        "mealCount": 2,
        "weights": {
          "price": 1.0,
          "swiss": 0.0,
          "presentation": 0.0,
          "prepEase": 0.0,
          "sustainability": 0.0
        }
      },
      "expect": {
        "status": 200,
        "productForRequirement": {
          "requirementId": "water",
          "productId": "budget-water-12l"
        }
      }
    },
    {
      "id": "water-swiss-priority",
      "purpose": "Verify Swiss-origin priority can reverse the direct product decision.",
      "request": {
        "templateId": "coffee-break",
        "guestCount": 20,
        "budget": 1000.0,
        "servingsPerGuest": 2,
        "mealCount": 2,
        "weights": {
          "price": 0.0,
          "swiss": 1.0,
          "presentation": 0.0,
          "prepEase": 0.0,
          "sustainability": 0.0
        }
      },
      "expect": {
        "status": 200,
        "productForRequirement": {
          "requirementId": "water",
          "productId": "mineral-water-6x15"
        }
      }
    }
  ]
}

```

---

# FINAL CODEX DELIVERABLES

After implementation and testing:

- Keep the changes minimal and POC-oriented.
- Update the repository seed to reflect the enriched dataset above.
- Update seed validation/check tooling if necessary.
- Add only focused automated tests needed to protect the tested behavior.
- Run the relevant automated tests.
- Run or reproduce the supplied realistic scenarios against the planner/REST API where practical.
- Fix pipeline behavior only where the implementation violates these requirements.
- Do not redesign the domain model.
- Do not add MongoDB query optimizations as part of this task.
- Do not invent a substantially larger catalog.
- Write a report at:

```text
specdrive/PIPELINE_WEIGHTING_VALIDATION_REPORT.md
```

The report must contain:

- files changed;
- tests executed and results;
- scenario-by-scenario observed results;
- whether each expected result was met;
- bugs discovered;
- fixes applied;
- remaining limitations;
- any assumptions Codex had to make.
