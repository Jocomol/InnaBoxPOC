# Catering Planner PoC – Requirements

## 1. Goal

Implement a small proof of concept that converts a structured event request into a generated catering/shopping plan.

The core planning must be deterministic. AI integration, webshop crawling, and production-ready optimization are out of scope for this first PoC.

The PoC should demonstrate that a customer can provide a small number of inputs such as event type, guest count, budget, preferences, existing inventory, and time constraints, and receive an explainable shopping plan with quantities, package counts, total price, and price per guest.

---

## 2. Technology

- Kotlin
- Spring Boot
- MongoDB
- Simple web frontend
- Docker Compose
- JSON REST API

Everything must run with:

```bash
docker compose up --build
```

---

## 3. Containers

Docker Compose must start separate containers for:

```text
frontend
backend
mongodb
```

Responsibilities:

```text
Frontend
   ↓ REST
Backend
   ↓
MongoDB
```

- The backend communicates with MongoDB.
- The frontend communicates only with the backend REST API.
- No service should depend directly on the Transgourmet webshop.
- No live webshop queries are required for the PoC.

---

## 4. Database

MongoDB must contain seeded example data for:

```text
eventTemplates
meals
products
```

The database should be seeded automatically when initialized.

Exact final schemas are not fixed yet. Keep documents simple, readable, and easy to modify.

The seed data should be fake/mock data but internally consistent enough for the resolver to produce complete plans.

---

## 5. Event Templates

At least two event templates must exist:

```text
business-apero
brunch
```

A template contains:

- id
- name
- description
- default values
- requirements
- default scoring weights

Example requirement:

```json
{
  "id": "vegetarian-finger-food",
  "type": "meal",
  "requiredCapabilities": [
    "vegetarian",
    "finger-food",
    "savory"
  ],
  "target": {
    "amount": 2,
    "unit": "pieces-per-guest"
  },
  "required": true
}
```

---

## 6. Meals

Meals must contain:

- id
- name
- capabilities
- score attributes
- ingredients
- serving information

Example capabilities:

```text
vegetarian
vegan
savory
sweet
finger-food
warm
cold
apero
brunch
prepare-ahead
```

Example score attributes:

```text
price
swiss
presentation
prepEase
sustainability
quality
```

All normalized score values should use:

```text
0.0 – 1.0
```

All score values should follow the same semantic direction:

```text
1.0 = desirable
0.0 = undesirable
```

For example, use `prepEase` instead of `prepEffort`, so a high score is always better.

---

## 7. Products

Products represent purchasable items.

Each product must contain at least:

- id
- sku
- name
- concept
- package amount
- package unit
- price
- capabilities
- score attributes

Example:

```json
{
  "id": "mozzarella-1kg",
  "sku": "MOCK-001",
  "name": "Mozzarella 1 kg",
  "concept": "mozzarella",
  "package": {
    "amount": 1000,
    "unit": "g"
  },
  "price": {
    "amount": 9.80,
    "currency": "CHF"
  }
}
```

Use mocked products only.

---

## 8. Event Request

The API must accept an event request containing:

```text
template
guest count
budget
customer preferences
weight overrides
existing inventory
hard constraints
```

Example:

```json
{
  "templateId": "business-apero",
  "guestCount": 40,
  "budget": 800,
  "weights": {
    "price": 0.30,
    "swiss": 0.25,
    "presentation": 0.20,
    "prepEase": 0.15,
    "sustainability": 0.10
  },
  "availableInventory": [
    {
      "concept": "white-wine",
      "amount": 12,
      "unit": "bottle"
    }
  ]
}
```

---

## 9. Resolver

Implement a deterministic `PlanningService` / resolver.

The resolver must:

```text
1. Load the selected event template
2. Apply customer overrides
3. Calculate requirements for the guest count
4. Account for existing inventory
5. Find meals matching required capabilities
6. Reject candidates violating hard constraints
7. Score valid candidates
8. Select suitable meals
9. Convert meals into ingredient requirements
10. Resolve ingredients to products
11. Calculate required package counts
12. Calculate total price and price per guest
13. Return a ShoppingPlan
```

The resolver is application logic, not a MongoDB aggregation pipeline.

MongoDB answers:

```text
"What candidates exist?"
```

The resolver answers:

```text
"What should be selected for this event?"
```

---

## 10. Capability Matching

A candidate satisfies a requirement when it contains all required capabilities.

Example:

```text
Requirement:
vegetarian + finger-food + savory

Caprese:
vegetarian ✓
finger-food ✓
savory ✓

→ candidate
```

---

## 11. Hard Constraints

Hard constraints must filter candidates before scoring.

Do not model hard constraints as large scoring bonuses.

Example:

```text
vegetarian required
+
meat product

→ eliminate candidate
```

Hard constraints may initially be minimal.

---

## 12. Scoring

Use Kotlin maps for flexible scoring.

Example:

```kotlin
val weights = mapOf(
    "price" to 0.30,
    "swiss" to 0.25,
    "presentation" to 0.20,
    "prepEase" to 0.15,
    "sustainability" to 0.10
)
```

Candidate scores use corresponding keys.

Example:

```kotlin
val scores = mapOf(
    "price" to 0.80,
    "swiss" to 1.00,
    "presentation" to 0.70,
    "prepEase" to 0.90,
    "sustainability" to 0.60
)
```

Score:

```kotlin
val score = weights.entries.sumOf { (key, weight) ->
    (scores[key] ?: 0.0) * weight
}
```

Missing values may default to `0.0`.

The final weighted score and component scores should remain available in the generated plan.

---

## 13. Existing Inventory

Existing inventory must reduce purchase requirements.

Example:

```text
Required wine: 18 bottles
Available wine: 12 bottles
Purchase: 6 bottles
```

If existing inventory fully satisfies a requirement:

```text
Required: 18
Available: 20

→ buy nothing
```

---

## 14. Package Calculation

Package calculation can initially be simple:

```text
packages = ceil(requiredAmount / packageAmount)
```

Example:

```text
48 pieces required
20 pieces per package

→ 3 packages
→ 60 pieces purchased
```

Store:

- required quantity
- purchased quantity
- overbuy quantity
- package count

Advanced combinations of different package sizes are out of scope for V0.

---

## 15. Budget

The generated plan must calculate:

- total cost
- cost per guest
- remaining budget or budget overrun

For the first PoC, it is acceptable to return a warning when the selected plan exceeds the budget.

Automatic budget re-optimization is optional.

---

## 16. REST API

Provide at least:

```text
GET  /api/templates
GET  /api/templates/{id}
GET  /api/meals
GET  /api/products

POST /api/plans/resolve
```

`POST /api/plans/resolve` returns the generated shopping plan.

---

## 17. Shopping Plan Result

The result must contain:

- event summary
- selected meals
- fulfilled requirements
- matched capabilities
- score components
- final weighted scores
- ingredient requirements
- shopping items
- package count
- required quantity
- purchased quantity
- overbuy quantity
- total cost
- cost per guest
- budget difference
- used existing inventory
- warnings

---

## 18. Frontend

Keep the frontend minimal.

It should allow the user to:

- select an event template
- enter guest count
- enter budget
- adjust a few weights
- add at least one existing inventory item
- click `Generate Plan`

The result page should show:

```text
Selected menu

Shopping list

Total cost
Cost per guest
Budget difference

Existing stock used
```

No polished design is required.

---

## 19. Example Data

Provide enough seed data to demonstrate the resolver:

```text
2 event templates
7+ meals
15+ products
```

Make sure both templates can successfully produce a plan from the seed data.

---

## 20. Architecture

Keep the implementation straightforward.

```text
Frontend
    ↓ REST
Backend
    │
    ├── PlanningService
    ├── repositories
    └── domain models
         ↓
      MongoDB
```

Suggested backend structure:

```text
controller/
service/
repository/
model/
config/
```

Do not introduce backend microservices for the first PoC.

---

## 21. Explainability

For every selected meal, preserve:

```text
matched capabilities
individual score values
final weighted score
```

The system should be able to explain why an option was selected without requiring AI.

---

## 22. Out of Scope

Do NOT implement yet:

- Transgourmet webshop crawling
- live webshop queries
- external Transgourmet API integration
- LLM integration
- AI agents
- authentication
- customer accounts
- admin interface
- advanced global optimization
- sophisticated package combinations
- production deployment
- complex allergen handling
- payment/order submission

The goal is only:

```text
Event
   ↓
Template
   ↓
Requirements
   ↓
Capability matching
   ↓
Weighted selection
   ↓
Quantity/package calculation
   ↓
Shopping plan
```

---

## 23. Success Criterion

The PoC is successful if this can be demonstrated locally:

```text
1. docker compose up --build
2. Open frontend
3. Select Business Apéro
4. Enter 40 guests and CHF 800
5. Adjust preferences
6. Add existing inventory
7. Generate plan
8. Receive a deterministic menu and shopping list
9. See packages, total CHF, CHF/guest and selection scores
```

---

# 24. MongoDB Seed Setup

The repository should contain:

```text
mongo/
├── seed.js
└── check-seed.js

scripts/
└── reseed.sh
```

The MongoDB container should automatically run `seed.js` when the database is first created.

The seed script must be idempotent by using upserts.

---

## 25. Docker Compose MongoDB Configuration

Example:

```yaml
services:
  mongodb:
    image: mongo:8
    container_name: catering-mongodb
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: catering
    volumes:
      - mongo-data:/data/db
      - ./mongo/seed.js:/docker-entrypoint-initdb.d/01-seed.js:ro

volumes:
  mongo-data:
```

The complete Docker Compose file should additionally contain the backend and frontend services.

---

# 26. MongoDB Seed Script

Create:

```text
mongo/seed.js
```

with:

```javascript
db = db.getSiblingDB("catering");

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function upsertMany(collectionName, documents) {
  const collection = db.getCollection(collectionName);

  for (const document of documents) {
    collection.replaceOne(
      { id: document.id },
      document,
      { upsert: true }
    );
  }

  print(`Seeded ${documents.length} documents into ${collectionName}`);
}

// ---------------------------------------------------------
// Indexes
// ---------------------------------------------------------

db.eventTemplates.createIndex({ id: 1 }, { unique: true });

db.meals.createIndex({ id: 1 }, { unique: true });
db.meals.createIndex({ capabilities: 1 });

db.products.createIndex({ id: 1 }, { unique: true });
db.products.createIndex({ sku: 1 }, { unique: true });
db.products.createIndex({ concept: 1 });
db.products.createIndex({ capabilities: 1 });

// ---------------------------------------------------------
// Event Templates
// ---------------------------------------------------------

const eventTemplates = [
  {
    id: "business-apero",
    name: "Business Apéro",
    description: "Finger food and drinks for a casual business event.",

    defaults: {
      durationMinutes: 120,
      vegetarianShare: 0.30
    },

    requirements: [
      {
        id: "savory-finger-food",
        type: "meal",
        requiredCapabilities: [
          "savory",
          "finger-food",
          "apero"
        ],
        target: {
          amount: 5,
          unit: "pieces-per-guest"
        },
        required: true
      },

      {
        id: "vegetarian-option",
        type: "meal",
        requiredCapabilities: [
          "vegetarian",
          "finger-food",
          "apero"
        ],
        target: {
          share: 0.30
        },
        required: true
      },

      {
        id: "soft-drinks",
        type: "product",
        requiredCapabilities: [
          "non-alcoholic-drink"
        ],
        target: {
          amount: 0.5,
          unit: "liter-per-guest"
        },
        required: true
      },

      {
        id: "napkins",
        type: "product",
        requiredCapabilities: [
          "napkin"
        ],
        target: {
          amount: 3,
          unit: "pieces-per-guest"
        },
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

    defaults: {
      durationMinutes: 180,
      vegetarianShare: 0.40
    },

    requirements: [
      {
        id: "savory-brunch",
        type: "meal",
        requiredCapabilities: [
          "savory",
          "brunch"
        ],
        target: {
          amount: 1,
          unit: "servings-per-guest"
        },
        required: true
      },

      {
        id: "sweet-brunch",
        type: "meal",
        requiredCapabilities: [
          "sweet",
          "brunch"
        ],
        target: {
          amount: 1,
          unit: "servings-per-guest"
        },
        required: true
      },

      {
        id: "coffee",
        type: "product",
        requiredCapabilities: [
          "coffee"
        ],
        target: {
          amount: 2,
          unit: "cups-per-guest"
        },
        required: true
      },

      {
        id: "juice",
        type: "product",
        requiredCapabilities: [
          "juice",
          "non-alcoholic-drink"
        ],
        target: {
          amount: 0.3,
          unit: "liter-per-guest"
        },
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
  }
];

upsertMany("eventTemplates", eventTemplates);

// ---------------------------------------------------------
// Meals
// ---------------------------------------------------------

const meals = [
  {
    id: "caprese-skewers",
    name: "Caprese Skewers",

    capabilities: [
      "vegetarian",
      "savory",
      "finger-food",
      "cold",
      "apero",
      "prepare-ahead"
    ],

    serving: {
      piecesPerServing: 2
    },

    ingredients: [
      {
        concept: "mozzarella",
        amountPerServing: 40,
        unit: "g"
      },
      {
        concept: "cherry-tomato",
        amountPerServing: 50,
        unit: "g"
      },
      {
        concept: "basil",
        amountPerServing: 3,
        unit: "g"
      }
    ],

    scores: {
      price: 0.65,
      swiss: 0.80,
      presentation: 0.90,
      prepEase: 0.60,
      sustainability: 0.75
    }
  },

  {
    id: "mini-spinach-quiche",
    name: "Mini Spinach Quiche",

    capabilities: [
      "vegetarian",
      "savory",
      "finger-food",
      "warm",
      "apero"
    ],

    serving: {
      piecesPerServing: 2
    },

    ingredients: [
      {
        concept: "mini-spinach-quiche",
        amountPerServing: 2,
        unit: "piece"
      }
    ],

    scores: {
      price: 0.75,
      swiss: 0.85,
      presentation: 0.75,
      prepEase: 0.90,
      sustainability: 0.70
    }
  },

  {
    id: "falafel-bites",
    name: "Falafel Bites",

    capabilities: [
      "vegan",
      "vegetarian",
      "savory",
      "finger-food",
      "warm",
      "apero"
    ],

    serving: {
      piecesPerServing: 3
    },

    ingredients: [
      {
        concept: "falafel",
        amountPerServing: 3,
        unit: "piece"
      },
      {
        concept: "hummus",
        amountPerServing: 30,
        unit: "g"
      }
    ],

    scores: {
      price: 0.85,
      swiss: 0.30,
      presentation: 0.70,
      prepEase: 0.85,
      sustainability: 0.90
    }
  },

  {
    id: "ham-croissants",
    name: "Mini Ham Croissants",

    capabilities: [
      "savory",
      "finger-food",
      "warm",
      "apero"
    ],

    serving: {
      piecesPerServing: 2
    },

    ingredients: [
      {
        concept: "mini-ham-croissant",
        amountPerServing: 2,
        unit: "piece"
      }
    ],

    scores: {
      price: 0.70,
      swiss: 0.90,
      presentation: 0.75,
      prepEase: 0.90,
      sustainability: 0.50
    }
  },

  {
    id: "bircher-muesli",
    name: "Bircher Müesli",

    capabilities: [
      "vegetarian",
      "sweet",
      "cold",
      "brunch",
      "swiss"
    ],

    serving: {
      piecesPerServing: 1
    },

    ingredients: [
      {
        concept: "muesli",
        amountPerServing: 80,
        unit: "g"
      },
      {
        concept: "yogurt",
        amountPerServing: 120,
        unit: "g"
      },
      {
        concept: "apple",
        amountPerServing: 80,
        unit: "g"
      }
    ],

    scores: {
      price: 0.85,
      swiss: 1.00,
      presentation: 0.70,
      prepEase: 0.75,
      sustainability: 0.85
    }
  },

  {
    id: "scrambled-eggs",
    name: "Scrambled Eggs",

    capabilities: [
      "vegetarian",
      "savory",
      "warm",
      "brunch"
    ],

    serving: {
      piecesPerServing: 1
    },

    ingredients: [
      {
        concept: "egg",
        amountPerServing: 2,
        unit: "piece"
      },
      {
        concept: "butter",
        amountPerServing: 10,
        unit: "g"
      }
    ],

    scores: {
      price: 0.80,
      swiss: 0.90,
      presentation: 0.65,
      prepEase: 0.55,
      sustainability: 0.70
    }
  },

  {
    id: "fruit-salad",
    name: "Fruit Salad",

    capabilities: [
      "vegan",
      "vegetarian",
      "sweet",
      "cold",
      "brunch",
      "prepare-ahead"
    ],

    serving: {
      piecesPerServing: 1
    },

    ingredients: [
      {
        concept: "mixed-fruit",
        amountPerServing: 180,
        unit: "g"
      }
    ],

    scores: {
      price: 0.65,
      swiss: 0.45,
      presentation: 0.85,
      prepEase: 0.70,
      sustainability: 0.70
    }
  }
];

upsertMany("meals", meals);

// ---------------------------------------------------------
// Products
// ---------------------------------------------------------

const products = [
  {
    id: "mozzarella-1kg",
    sku: "MOCK-001",
    name: "Mozzarella 1 kg",
    concept: "mozzarella",

    package: {
      amount: 1000,
      unit: "g"
    },

    price: {
      amount: 9.80,
      currency: "CHF"
    },

    capabilities: ["vegetarian"],

    scores: {
      price: 0.80,
      swiss: 0.70,
      sustainability: 0.70
    }
  },

  {
    id: "cherry-tomatoes-500g",
    sku: "MOCK-002",
    name: "Cherry Tomatoes 500 g",
    concept: "cherry-tomato",

    package: {
      amount: 500,
      unit: "g"
    },

    price: {
      amount: 4.20,
      currency: "CHF"
    },

    capabilities: ["vegetarian", "vegan"],

    scores: {
      price: 0.75,
      swiss: 0.85,
      sustainability: 0.80
    }
  },

  {
    id: "basil-100g",
    sku: "MOCK-003",
    name: "Fresh Basil 100 g",
    concept: "basil",

    package: {
      amount: 100,
      unit: "g"
    },

    price: {
      amount: 3.90,
      currency: "CHF"
    },

    capabilities: ["vegetarian", "vegan"],

    scores: {
      price: 0.60,
      swiss: 0.60,
      sustainability: 0.75
    }
  },

  {
    id: "spinach-quiche-20",
    sku: "MOCK-004",
    name: "Mini Spinach Quiche 20 pcs",
    concept: "mini-spinach-quiche",

    package: {
      amount: 20,
      unit: "piece"
    },

    price: {
      amount: 18.90,
      currency: "CHF"
    },

    capabilities: [
      "vegetarian",
      "finger-food",
      "ready-to-heat"
    ],

    scores: {
      price: 0.75,
      swiss: 0.85,
      sustainability: 0.70
    }
  },

  {
    id: "falafel-50",
    sku: "MOCK-005",
    name: "Falafel 50 pcs",
    concept: "falafel",

    package: {
      amount: 50,
      unit: "piece"
    },

    price: {
      amount: 21.50,
      currency: "CHF"
    },

    capabilities: [
      "vegan",
      "vegetarian",
      "finger-food"
    ],

    scores: {
      price: 0.90,
      swiss: 0.25,
      sustainability: 0.90
    }
  },

  {
    id: "hummus-1kg",
    sku: "MOCK-006",
    name: "Hummus 1 kg",
    concept: "hummus",

    package: {
      amount: 1000,
      unit: "g"
    },

    price: {
      amount: 10.90,
      currency: "CHF"
    },

    capabilities: [
      "vegan",
      "vegetarian"
    ],

    scores: {
      price: 0.85,
      swiss: 0.30,
      sustainability: 0.85
    }
  },

  {
    id: "ham-croissant-24",
    sku: "MOCK-007",
    name: "Mini Ham Croissants 24 pcs",
    concept: "mini-ham-croissant",

    package: {
      amount: 24,
      unit: "piece"
    },

    price: {
      amount: 22.50,
      currency: "CHF"
    },

    capabilities: [
      "finger-food",
      "ready-to-heat"
    ],

    scores: {
      price: 0.70,
      swiss: 0.90,
      sustainability: 0.45
    }
  },

  {
    id: "muesli-2kg",
    sku: "MOCK-008",
    name: "Müesli 2 kg",
    concept: "muesli",

    package: {
      amount: 2000,
      unit: "g"
    },

    price: {
      amount: 13.50,
      currency: "CHF"
    },

    capabilities: [
      "vegetarian",
      "breakfast"
    ],

    scores: {
      price: 0.90,
      swiss: 0.90,
      sustainability: 0.80
    }
  },

  {
    id: "yogurt-1kg",
    sku: "MOCK-009",
    name: "Natural Yogurt 1 kg",
    concept: "yogurt",

    package: {
      amount: 1000,
      unit: "g"
    },

    price: {
      amount: 5.20,
      currency: "CHF"
    },

    capabilities: ["vegetarian"],

    scores: {
      price: 0.85,
      swiss: 0.95,
      sustainability: 0.80
    }
  },

  {
    id: "apple-2kg",
    sku: "MOCK-010",
    name: "Swiss Apples 2 kg",
    concept: "apple",

    package: {
      amount: 2000,
      unit: "g"
    },

    price: {
      amount: 7.40,
      currency: "CHF"
    },

    capabilities: ["vegan", "vegetarian"],

    scores: {
      price: 0.90,
      swiss: 1.00,
      sustainability: 0.95
    }
  },

  {
    id: "eggs-30",
    sku: "MOCK-011",
    name: "Swiss Eggs 30 pcs",
    concept: "egg",

    package: {
      amount: 30,
      unit: "piece"
    },

    price: {
      amount: 13.90,
      currency: "CHF"
    },

    capabilities: ["vegetarian"],

    scores: {
      price: 0.85,
      swiss: 1.00,
      sustainability: 0.75
    }
  },

  {
    id: "butter-1kg",
    sku: "MOCK-012",
    name: "Swiss Butter 1 kg",
    concept: "butter",

    package: {
      amount: 1000,
      unit: "g"
    },

    price: {
      amount: 12.50,
      currency: "CHF"
    },

    capabilities: ["vegetarian"],

    scores: {
      price: 0.70,
      swiss: 1.00,
      sustainability: 0.65
    }
  },

  {
    id: "mixed-fruit-2kg",
    sku: "MOCK-013",
    name: "Mixed Fresh Fruit 2 kg",
    concept: "mixed-fruit",

    package: {
      amount: 2000,
      unit: "g"
    },

    price: {
      amount: 17.90,
      currency: "CHF"
    },

    capabilities: ["vegan", "vegetarian"],

    scores: {
      price: 0.65,
      swiss: 0.45,
      sustainability: 0.70
    }
  },

  {
    id: "mineral-water-6x15",
    sku: "MOCK-014",
    name: "Mineral Water 6 × 1.5 L",
    concept: "water",

    package: {
      amount: 9,
      unit: "liter"
    },

    price: {
      amount: 8.90,
      currency: "CHF"
    },

    capabilities: [
      "non-alcoholic-drink",
      "water"
    ],

    scores: {
      price: 0.95,
      swiss: 0.90,
      sustainability: 0.70
    }
  },

  {
    id: "apple-juice-6l",
    sku: "MOCK-015",
    name: "Swiss Apple Juice 6 L",
    concept: "apple-juice",

    package: {
      amount: 6,
      unit: "liter"
    },

    price: {
      amount: 14.90,
      currency: "CHF"
    },

    capabilities: [
      "non-alcoholic-drink",
      "juice"
    ],

    scores: {
      price: 0.80,
      swiss: 1.00,
      sustainability: 0.85
    }
  },

  {
    id: "coffee-beans-1kg",
    sku: "MOCK-016",
    name: "Coffee Beans 1 kg",
    concept: "coffee-beans",

    package: {
      amount: 1000,
      unit: "g"
    },

    price: {
      amount: 21.90,
      currency: "CHF"
    },

    capabilities: ["coffee"],

    conversion: {
      amountPerServing: 8,
      servingUnit: "cup",
      sourceUnit: "g"
    },

    scores: {
      price: 0.75,
      swiss: 0.10,
      sustainability: 0.65
    }
  },

  {
    id: "napkins-250",
    sku: "MOCK-017",
    name: "Napkins 250 pcs",
    concept: "napkin",

    package: {
      amount: 250,
      unit: "piece"
    },

    price: {
      amount: 7.50,
      currency: "CHF"
    },

    capabilities: ["napkin"],

    scores: {
      price: 0.90,
      swiss: 0.50,
      sustainability: 0.70
    }
  }
];

upsertMany("products", products);

print("------------------------------------------------");
print("Catering planner seed completed.");
print("------------------------------------------------");
```

---

# 27. Seed Verification Script

Create:

```text
mongo/check-seed.js
```

with:

```javascript
db = db.getSiblingDB("catering");

print("Templates: " + db.eventTemplates.countDocuments());
print("Meals:     " + db.meals.countDocuments());
print("Products:  " + db.products.countDocuments());

print("");
print("Vegetarian apéro meals:");

db.meals.find({
  capabilities: {
    $all: ["vegetarian", "finger-food", "apero"]
  }
}).forEach(meal => {
  print(" - " + meal.name);
});

print("");
print("Products providing mozzarella:");

db.products.find({
  concept: "mozzarella"
}).forEach(product => {
  print(
    ` - ${product.name}: CHF ${product.price.amount}`
  );
});
```

Run with:

```bash
docker compose exec -T mongodb \
  mongosh catering < mongo/check-seed.js
```

---

# 28. Manual Reseed Script

Create:

```text
scripts/reseed.sh
```

with:

```bash
#!/usr/bin/env bash

set -e

echo "Reseeding catering database..."

docker compose exec -T mongodb \
  mongosh catering < mongo/seed.js

echo "Done."
```

Then:

```bash
chmod +x scripts/reseed.sh
./scripts/reseed.sh
```

Because the seed uses upserts, it should be safe to run repeatedly.

For a completely fresh database:

```bash
docker compose down -v
docker compose up --build
```

---

# 29. Expected Project Layout

```text
project/
├── docker-compose.yml
│
├── mongo/
│   ├── seed.js
│   └── check-seed.js
│
├── scripts/
│   └── reseed.sh
│
├── backend/
│
└── frontend/
```

Codex may adjust the internal backend/frontend folder structure where necessary, but the resulting project must remain understandable and runnable with Docker Compose.
