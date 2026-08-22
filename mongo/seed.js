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
db.meals.createIndex({ dietaryCapabilities: 1 });
db.products.createIndex({ id: 1 }, { unique: true });
db.products.createIndex({ sku: 1 }, { unique: true });
db.products.createIndex({ concept: 1 });
db.products.createIndex({ capabilities: 1 });
db.products.createIndex({ dietaryCapabilities: 1 });
db.planningPriorities.createIndex({ id: 1 }, { unique: true });
db.dietaryConstraints.createIndex({ id: 1 }, { unique: true });
db.mealCategories.createIndex({ id: 1 }, { unique: true });
db.meals.createIndex({ categoryIds: 1 });

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

const dietaryConstraints = [
  {
    id: "vegetarian",
    label: "Vegetarian",
    description: "Allocate enough vegetarian-compatible servings for the entered guest count.",
    displayOrder: 10,
    dietaryCapability: "vegetarian",
    requiredCapabilities: ["vegetarian"],
    excludedCapabilities: [],
    excludedConcepts: []
  },
  {
    id: "vegan",
    label: "Vegan",
    description: "Allocate enough vegan-compatible servings for the entered guest count.",
    displayOrder: 20,
    dietaryCapability: "vegan",
    requiredCapabilities: ["vegan"],
    excludedCapabilities: [],
    excludedConcepts: []
  },
  {
    id: "halal",
    label: "Halal",
    description: "Allocate enough halal-compatible servings for the entered guest count.",
    displayOrder: 30,
    dietaryCapability: "halal",
    requiredCapabilities: ["halal"],
    excludedCapabilities: [],
    excludedConcepts: []
  },
  {
    id: "gluten-free",
    label: "Gluten-free",
    description: "Allocate enough gluten-free-compatible servings for the entered guest count.",
    displayOrder: 40,
    dietaryCapability: "gluten-free",
    requiredCapabilities: ["gluten-free"],
    excludedCapabilities: [],
    excludedConcepts: []
  }
];

const mealCategories = [
  { id: "fruit", label: "Fruit", description: "Fruit cups, salads, skewers, and fruit-forward dishes.", displayOrder: 10 },
  { id: "bakery", label: "Bakery & Pastries", description: "Croissants, quiches, baked bites, and pastry-based dishes.", displayOrder: 20 },
  { id: "meat", label: "Meat", description: "Dishes that contain meat or meat-based components.", displayOrder: 30 },
  { id: "plant-based", label: "Vegetarian & Plant-based", description: "Vegetarian and vegan dishes.", displayOrder: 40 },
  { id: "breakfast", label: "Breakfast & Brunch", description: "Breakfast, brunch, and coffee-break dishes.", displayOrder: 50 },
  { id: "lunch", label: "Lunch & Buffet", description: "Hearty lunch and buffet dishes.", displayOrder: 60 },
  { id: "reception", label: "Apéro & Reception", description: "Finger food and reception-friendly bites.", displayOrder: 70 }
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
        requiredCapabilities: ["savory", "finger-food", "reception"],
        target: { amount: 4, unit: "pieces-per-guest" },
        required: true
      },
      {
        id: "vegan-sweet-bites",
        type: "meal",
        requiredCapabilities: ["sweet", "finger-food", "reception"],
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
    categoryIds: ["plant-based", "reception"],
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
    categoryIds: ["bakery", "plant-based", "reception"],
    name: "Mini Spinach Quiche",
    capabilities: ["vegetarian", "savory", "finger-food", "warm", "apero"],
    serving: { piecesPerServing: 2 },
    ingredients: [{ concept: "mini-spinach-quiche", amountPerServing: 2, unit: "piece" }],
    scores: { price: 0.75, swiss: 1.00, presentation: 0.75, prepEase: 0.90, sustainability: 0.70 }
  },
  {
    id: "falafel-bites",
    categoryIds: ["plant-based", "reception"],
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
    categoryIds: ["bakery", "meat", "reception"],
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
    categoryIds: ["breakfast", "plant-based"],
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
    categoryIds: ["breakfast", "plant-based"],
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
    categoryIds: ["fruit", "breakfast", "plant-based"],
    name: "Fruit Salad",
    capabilities: ["vegan", "vegetarian", "halal", "sweet", "cold", "brunch", "prepare-ahead"],
    serving: { piecesPerServing: 1 },
    ingredients: [{ concept: "mixed-fruit", amountPerServing: 180, unit: "g" }],
    scores: { price: 0.65, swiss: 0.00, presentation: 0.85, prepEase: 0.70, sustainability: 0.70 }
  },
  {
    id: "apple-yogurt-parfaits",
    categoryIds: ["breakfast", "plant-based"],
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
    categoryIds: ["fruit", "breakfast", "plant-based"],
    name: "Fresh Fruit Cups",
    capabilities: ["vegan", "vegetarian", "halal", "sweet", "cold", "coffee-break", "prepare-ahead"],
    serving: { piecesPerServing: 1 },
    ingredients: [{ concept: "mixed-fruit", amountPerServing: 150, unit: "g" }],
    scores: { price: 0.70, swiss: 0.00, presentation: 0.90, prepEase: 0.85, sustainability: 0.80 }
  },
  {
    id: "mini-quiche-break-bites",
    categoryIds: ["bakery", "breakfast", "plant-based"],
    name: "Mini Quiche Break Bites",
    capabilities: ["vegetarian", "savory", "warm", "finger-food", "coffee-break"],
    serving: { piecesPerServing: 2 },
    ingredients: [{ concept: "mini-spinach-quiche", amountPerServing: 2, unit: "piece" }],
    scores: { price: 0.75, swiss: 1.00, presentation: 0.80, prepEase: 0.92, sustainability: 0.72 }
  },
  {
    id: "ham-croissant-break-bites",
    categoryIds: ["bakery", "meat", "breakfast"],
    name: "Ham Croissant Break Bites",
    capabilities: ["savory", "warm", "finger-food", "coffee-break"],
    serving: { piecesPerServing: 2 },
    ingredients: [{ concept: "mini-ham-croissant", amountPerServing: 2, unit: "piece" }],
    scores: { price: 0.70, swiss: 1.00, presentation: 0.78, prepEase: 0.90, sustainability: 0.50 }
  },
  {
    id: "ham-quiche-lunch-platter",
    categoryIds: ["bakery", "meat", "lunch"],
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
    categoryIds: ["plant-based", "lunch"],
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
    categoryIds: ["plant-based", "lunch"],
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
    categoryIds: ["plant-based", "reception"],
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
    categoryIds: ["plant-based", "reception"],
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
    categoryIds: ["fruit", "plant-based", "reception"],
    name: "Fresh Fruit Skewers",
    capabilities: ["vegan", "vegetarian", "halal", "sweet", "finger-food", "cold", "reception", "prepare-ahead"],
    serving: { piecesPerServing: 2 },
    ingredients: [{ concept: "mixed-fruit", amountPerServing: 140, unit: "g" }],
    scores: { price: 0.68, swiss: 0.00, presentation: 0.94, prepEase: 0.76, sustainability: 0.78 }
  },
  {
    id: "swiss-cheese-omelette",
    categoryIds: ["breakfast", "plant-based"],
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
    categoryIds: ["breakfast", "plant-based"],
    name: "Swiss Apple Bircher Jars",
    capabilities: ["vegetarian", "sweet", "cold", "breakfast", "prepare-ahead"],
    serving: { piecesPerServing: 1 },
    ingredients: [
      { concept: "muesli", amountPerServing: 75, unit: "g" },
      { concept: "yogurt", amountPerServing: 125, unit: "g" },
      { concept: "apple", amountPerServing: 90, unit: "g" }
    ],
    scores: { price: 0.84, swiss: 1.00, presentation: 0.86, prepEase: 0.78, sustainability: 0.88 }
  },
  {
    id: "gluten-free-tomato-frittata",
    categoryIds: ["breakfast", "plant-based", "lunch"],
    name: "Gluten-Free Tomato Frittata",
    capabilities: ["vegetarian", "gluten-free", "savory", "warm", "brunch", "breakfast", "lunch", "buffet"],
    serving: { piecesPerServing: 1 },
    ingredients: [
      { concept: "egg", amountPerServing: 2, unit: "piece" },
      { concept: "mozzarella", amountPerServing: 35, unit: "g" },
      { concept: "cherry-tomato", amountPerServing: 70, unit: "g" },
      { concept: "basil", amountPerServing: 3, unit: "g" }
    ],
    scores: { price: 0.74, swiss: 1.00, presentation: 0.84, prepEase: 0.68, sustainability: 0.78 }
  }
];

const products = [
  {
    id: "mozzarella-1kg", sku: "MOCK-001", name: "Swiss Mozzarella 1 kg", concept: "mozzarella", originCountry: "CH",
    package: { amount: 1000, unit: "g" }, price: { amount: 9.80, currency: "CHF" },
    capabilities: ["vegetarian", "gluten-free"], scores: { price: 0.80, swiss: 1.00, sustainability: 0.70 }
  },
  {
    id: "cherry-tomatoes-500g", sku: "MOCK-002", name: "Swiss Cherry Tomatoes 500 g", concept: "cherry-tomato", originCountry: "CH",
    package: { amount: 500, unit: "g" }, price: { amount: 4.20, currency: "CHF" },
    capabilities: ["vegetarian", "vegan", "halal", "gluten-free"], scores: { price: 0.75, swiss: 1.00, sustainability: 0.80 }
  },
  {
    id: "basil-100g", sku: "MOCK-003", name: "Swiss Fresh Basil 100 g", concept: "basil", originCountry: "CH",
    package: { amount: 100, unit: "g" }, price: { amount: 3.90, currency: "CHF" },
    capabilities: ["vegetarian", "vegan", "halal", "gluten-free"], scores: { price: 0.60, swiss: 1.00, sustainability: 0.75 }
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
    capabilities: ["vegetarian", "gluten-free"], scores: { price: 0.85, swiss: 1.00, sustainability: 0.75 }
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

const dietaryCapabilityNames = new Set(["vegetarian", "vegan", "halal", "gluten-free"]);

function withSeparatedDietaryCapabilities(documents) {
  return documents.map(document => {
    const capabilities = document.capabilities || [];
    const dietaryCapabilities = [...new Set([
      ...(document.dietaryCapabilities || []),
      ...capabilities.filter(capability => dietaryCapabilityNames.has(capability))
    ])];
    return {
      ...document,
      capabilities: capabilities.filter(capability => !dietaryCapabilityNames.has(capability)),
      dietaryCapabilities
    };
  });
}

upsertMany("eventTemplates", eventTemplates);
upsertMany("meals", withSeparatedDietaryCapabilities(meals));
upsertMany("products", withSeparatedDietaryCapabilities(products));
upsertMany("planningPriorities", planningPriorities);
upsertMany("dietaryConstraints", dietaryConstraints);
upsertMany("mealCategories", mealCategories);

print("------------------------------------------------");
print("Catering planner seed completed.");
print("------------------------------------------------");
