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

const eventTemplates = [
  {
    id: "business-apero",
    name: "Business Apéro",
    description: "Finger food and drinks for a casual business event.",
    defaults: { durationMinutes: 120, vegetarianShare: 0.30 },
    requirements: [
      {
        id: "savory-finger-food",
        type: "meal",
        requiredCapabilities: ["savory", "finger-food", "apero"],
        target: { amount: 5, unit: "pieces-per-guest" },
        required: true
      },
      {
        id: "vegetarian-option",
        type: "meal",
        requiredCapabilities: ["vegetarian", "finger-food", "apero"],
        target: { share: 0.30 },
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
    defaults: { durationMinutes: 180, vegetarianShare: 0.40 },
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
    defaults: { durationMinutes: 45, vegetarianShare: 0.50 },
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
    defaults: { durationMinutes: 90, vegetarianShare: 0.35 },
    requirements: [
      {
        id: "hearty-lunch",
        type: "meal",
        requiredCapabilities: ["savory", "lunch", "buffet", "hearty"],
        target: { amount: 1, unit: "servings-per-guest" },
        required: true
      },
      {
        id: "vegetarian-lunch",
        type: "meal",
        requiredCapabilities: ["vegetarian", "lunch", "buffet"],
        target: { share: 0.35 },
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
    defaults: { durationMinutes: 120, vegetarianShare: 1.00 },
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
    defaults: { durationMinutes: 90, vegetarianShare: 1.00 },
    requirements: [
      {
        id: "savory-swiss-breakfast",
        type: "meal",
        requiredCapabilities: ["savory", "breakfast", "swiss"],
        target: { amount: 1, unit: "servings-per-guest" },
        required: true
      },
      {
        id: "sweet-swiss-breakfast",
        type: "meal",
        requiredCapabilities: ["sweet", "breakfast", "swiss"],
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
    scores: { price: 0.65, swiss: 0.80, presentation: 0.90, prepEase: 0.60, sustainability: 0.75 }
  },
  {
    id: "mini-spinach-quiche",
    name: "Mini Spinach Quiche",
    capabilities: ["vegetarian", "savory", "finger-food", "warm", "apero"],
    serving: { piecesPerServing: 2 },
    ingredients: [{ concept: "mini-spinach-quiche", amountPerServing: 2, unit: "piece" }],
    scores: { price: 0.75, swiss: 0.85, presentation: 0.75, prepEase: 0.90, sustainability: 0.70 }
  },
  {
    id: "falafel-bites",
    name: "Falafel Bites",
    capabilities: ["vegan", "vegetarian", "savory", "finger-food", "warm", "apero"],
    serving: { piecesPerServing: 3 },
    ingredients: [
      { concept: "falafel", amountPerServing: 3, unit: "piece" },
      { concept: "hummus", amountPerServing: 30, unit: "g" }
    ],
    scores: { price: 0.85, swiss: 0.30, presentation: 0.70, prepEase: 0.85, sustainability: 0.90 }
  },
  {
    id: "ham-croissants",
    name: "Mini Ham Croissants",
    capabilities: ["savory", "finger-food", "warm", "apero"],
    serving: { piecesPerServing: 2 },
    ingredients: [{ concept: "mini-ham-croissant", amountPerServing: 2, unit: "piece" }],
    scores: { price: 0.70, swiss: 0.90, presentation: 0.75, prepEase: 0.90, sustainability: 0.50 }
  },
  {
    id: "bircher-muesli",
    name: "Bircher Müesli",
    capabilities: ["vegetarian", "sweet", "cold", "brunch", "swiss"],
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
    scores: { price: 0.80, swiss: 0.90, presentation: 0.65, prepEase: 0.55, sustainability: 0.70 }
  },
  {
    id: "fruit-salad",
    name: "Fruit Salad",
    capabilities: ["vegan", "vegetarian", "sweet", "cold", "brunch", "prepare-ahead"],
    serving: { piecesPerServing: 1 },
    ingredients: [{ concept: "mixed-fruit", amountPerServing: 180, unit: "g" }],
    scores: { price: 0.65, swiss: 0.45, presentation: 0.85, prepEase: 0.70, sustainability: 0.70 }
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
    scores: { price: 0.80, swiss: 0.95, presentation: 0.85, prepEase: 0.80, sustainability: 0.85 }
  },
  {
    id: "fresh-fruit-cups",
    name: "Fresh Fruit Cups",
    capabilities: ["vegan", "vegetarian", "sweet", "cold", "coffee-break", "prepare-ahead"],
    serving: { piecesPerServing: 1 },
    ingredients: [{ concept: "mixed-fruit", amountPerServing: 150, unit: "g" }],
    scores: { price: 0.70, swiss: 0.50, presentation: 0.90, prepEase: 0.85, sustainability: 0.80 }
  },
  {
    id: "mini-quiche-break-bites",
    name: "Mini Quiche Break Bites",
    capabilities: ["vegetarian", "savory", "warm", "finger-food", "coffee-break"],
    serving: { piecesPerServing: 2 },
    ingredients: [{ concept: "mini-spinach-quiche", amountPerServing: 2, unit: "piece" }],
    scores: { price: 0.75, swiss: 0.85, presentation: 0.80, prepEase: 0.92, sustainability: 0.72 }
  },
  {
    id: "ham-croissant-break-bites",
    name: "Ham Croissant Break Bites",
    capabilities: ["savory", "warm", "finger-food", "coffee-break"],
    serving: { piecesPerServing: 2 },
    ingredients: [{ concept: "mini-ham-croissant", amountPerServing: 2, unit: "piece" }],
    scores: { price: 0.70, swiss: 0.90, presentation: 0.78, prepEase: 0.90, sustainability: 0.50 }
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
    scores: { price: 0.72, swiss: 0.90, presentation: 0.78, prepEase: 0.90, sustainability: 0.55 }
  },
  {
    id: "mediterranean-falafel-bowl",
    name: "Mediterranean Falafel Bowl",
    capabilities: ["vegan", "vegetarian", "savory", "warm", "lunch", "buffet"],
    serving: { piecesPerServing: 1 },
    ingredients: [
      { concept: "falafel", amountPerServing: 4, unit: "piece" },
      { concept: "hummus", amountPerServing: 50, unit: "g" },
      { concept: "cherry-tomato", amountPerServing: 80, unit: "g" }
    ],
    scores: { price: 0.82, swiss: 0.35, presentation: 0.86, prepEase: 0.78, sustainability: 0.92 }
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
    scores: { price: 0.68, swiss: 0.78, presentation: 0.92, prepEase: 0.72, sustainability: 0.76 }
  },
  {
    id: "falafel-hummus-canapes",
    name: "Falafel Hummus Canapés",
    capabilities: ["vegan", "vegetarian", "savory", "finger-food", "reception", "prepare-ahead"],
    serving: { piecesPerServing: 3 },
    ingredients: [
      { concept: "falafel", amountPerServing: 3, unit: "piece" },
      { concept: "hummus", amountPerServing: 25, unit: "g" }
    ],
    scores: { price: 0.84, swiss: 0.30, presentation: 0.86, prepEase: 0.85, sustainability: 0.92 }
  },
  {
    id: "tomato-basil-bites",
    name: "Tomato Basil Hummus Bites",
    capabilities: ["vegan", "vegetarian", "savory", "finger-food", "cold", "reception", "prepare-ahead"],
    serving: { piecesPerServing: 2 },
    ingredients: [
      { concept: "cherry-tomato", amountPerServing: 80, unit: "g" },
      { concept: "hummus", amountPerServing: 20, unit: "g" },
      { concept: "basil", amountPerServing: 3, unit: "g" }
    ],
    scores: { price: 0.76, swiss: 0.62, presentation: 0.94, prepEase: 0.70, sustainability: 0.90 }
  },
  {
    id: "fruit-skewers",
    name: "Fresh Fruit Skewers",
    capabilities: ["vegan", "vegetarian", "sweet", "finger-food", "cold", "reception", "prepare-ahead"],
    serving: { piecesPerServing: 2 },
    ingredients: [{ concept: "mixed-fruit", amountPerServing: 140, unit: "g" }],
    scores: { price: 0.68, swiss: 0.48, presentation: 0.94, prepEase: 0.76, sustainability: 0.78 }
  },
  {
    id: "swiss-cheese-omelette",
    name: "Swiss Cheese Omelette",
    capabilities: ["vegetarian", "savory", "warm", "breakfast", "swiss"],
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
    capabilities: ["vegetarian", "sweet", "cold", "breakfast", "swiss", "prepare-ahead"],
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
    id: "mozzarella-1kg", sku: "MOCK-001", name: "Mozzarella 1 kg", concept: "mozzarella",
    package: { amount: 1000, unit: "g" }, price: { amount: 9.80, currency: "CHF" },
    capabilities: ["vegetarian"], scores: { price: 0.80, swiss: 0.70, sustainability: 0.70 }
  },
  {
    id: "cherry-tomatoes-500g", sku: "MOCK-002", name: "Cherry Tomatoes 500 g", concept: "cherry-tomato",
    package: { amount: 500, unit: "g" }, price: { amount: 4.20, currency: "CHF" },
    capabilities: ["vegetarian", "vegan"], scores: { price: 0.75, swiss: 0.85, sustainability: 0.80 }
  },
  {
    id: "basil-100g", sku: "MOCK-003", name: "Fresh Basil 100 g", concept: "basil",
    package: { amount: 100, unit: "g" }, price: { amount: 3.90, currency: "CHF" },
    capabilities: ["vegetarian", "vegan"], scores: { price: 0.60, swiss: 0.60, sustainability: 0.75 }
  },
  {
    id: "spinach-quiche-20", sku: "MOCK-004", name: "Mini Spinach Quiche 20 pcs", concept: "mini-spinach-quiche",
    package: { amount: 20, unit: "piece" }, price: { amount: 18.90, currency: "CHF" },
    capabilities: ["vegetarian", "finger-food", "ready-to-heat"], scores: { price: 0.75, swiss: 0.85, sustainability: 0.70 }
  },
  {
    id: "falafel-50", sku: "MOCK-005", name: "Falafel 50 pcs", concept: "falafel",
    package: { amount: 50, unit: "piece" }, price: { amount: 21.50, currency: "CHF" },
    capabilities: ["vegan", "vegetarian", "finger-food"], scores: { price: 0.90, swiss: 0.25, sustainability: 0.90 }
  },
  {
    id: "hummus-1kg", sku: "MOCK-006", name: "Hummus 1 kg", concept: "hummus",
    package: { amount: 1000, unit: "g" }, price: { amount: 10.90, currency: "CHF" },
    capabilities: ["vegan", "vegetarian"], scores: { price: 0.85, swiss: 0.30, sustainability: 0.85 }
  },
  {
    id: "ham-croissant-24", sku: "MOCK-007", name: "Mini Ham Croissants 24 pcs", concept: "mini-ham-croissant",
    package: { amount: 24, unit: "piece" }, price: { amount: 22.50, currency: "CHF" },
    capabilities: ["finger-food", "ready-to-heat"], scores: { price: 0.70, swiss: 0.90, sustainability: 0.45 }
  },
  {
    id: "muesli-2kg", sku: "MOCK-008", name: "Müesli 2 kg", concept: "muesli",
    package: { amount: 2000, unit: "g" }, price: { amount: 13.50, currency: "CHF" },
    capabilities: ["vegetarian", "breakfast"], scores: { price: 0.90, swiss: 0.90, sustainability: 0.80 }
  },
  {
    id: "yogurt-1kg", sku: "MOCK-009", name: "Natural Yogurt 1 kg", concept: "yogurt",
    package: { amount: 1000, unit: "g" }, price: { amount: 5.20, currency: "CHF" },
    capabilities: ["vegetarian"], scores: { price: 0.85, swiss: 0.95, sustainability: 0.80 }
  },
  {
    id: "apple-2kg", sku: "MOCK-010", name: "Swiss Apples 2 kg", concept: "apple",
    package: { amount: 2000, unit: "g" }, price: { amount: 7.40, currency: "CHF" },
    capabilities: ["vegan", "vegetarian"], scores: { price: 0.90, swiss: 1.00, sustainability: 0.95 }
  },
  {
    id: "eggs-30", sku: "MOCK-011", name: "Swiss Eggs 30 pcs", concept: "egg",
    package: { amount: 30, unit: "piece" }, price: { amount: 13.90, currency: "CHF" },
    capabilities: ["vegetarian"], scores: { price: 0.85, swiss: 1.00, sustainability: 0.75 }
  },
  {
    id: "butter-1kg", sku: "MOCK-012", name: "Swiss Butter 1 kg", concept: "butter",
    package: { amount: 1000, unit: "g" }, price: { amount: 12.50, currency: "CHF" },
    capabilities: ["vegetarian"], scores: { price: 0.70, swiss: 1.00, sustainability: 0.65 }
  },
  {
    id: "mixed-fruit-2kg", sku: "MOCK-013", name: "Mixed Fresh Fruit 2 kg", concept: "mixed-fruit",
    package: { amount: 2000, unit: "g" }, price: { amount: 17.90, currency: "CHF" },
    capabilities: ["vegan", "vegetarian"], scores: { price: 0.65, swiss: 0.45, sustainability: 0.70 }
  },
  {
    id: "mineral-water-6x15", sku: "MOCK-014", name: "Mineral Water 6 × 1.5 L", concept: "water",
    package: { amount: 9, unit: "liter" }, price: { amount: 8.90, currency: "CHF" },
    capabilities: ["non-alcoholic-drink", "water"], scores: { price: 0.95, swiss: 0.90, sustainability: 0.70 }
  },
  {
    id: "apple-juice-6l", sku: "MOCK-015", name: "Swiss Apple Juice 6 L", concept: "apple-juice",
    package: { amount: 6, unit: "liter" }, price: { amount: 14.90, currency: "CHF" },
    capabilities: ["non-alcoholic-drink", "juice"], scores: { price: 0.80, swiss: 1.00, sustainability: 0.85 }
  },
  {
    id: "coffee-beans-1kg", sku: "MOCK-016", name: "Coffee Beans 1 kg", concept: "coffee-beans",
    package: { amount: 1000, unit: "g" }, price: { amount: 21.90, currency: "CHF" },
    capabilities: ["coffee"], conversion: { amountPerServing: 8, servingUnit: "cup", sourceUnit: "g" },
    scores: { price: 0.75, swiss: 0.10, sustainability: 0.65 }
  },
  {
    id: "napkins-250", sku: "MOCK-017", name: "Napkins 250 pcs", concept: "napkin",
    package: { amount: 250, unit: "piece" }, price: { amount: 7.50, currency: "CHF" },
    capabilities: ["napkin"], scores: { price: 0.90, swiss: 0.50, sustainability: 0.70 }
  }
];

upsertMany("eventTemplates", eventTemplates);
upsertMany("meals", meals);
upsertMany("products", products);

print("------------------------------------------------");
print("Catering planner seed completed.");
print("------------------------------------------------");
