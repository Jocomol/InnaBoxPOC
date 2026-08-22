db = db.getSiblingDB("catering");

function upsertMany(collectionName, documents) {
  const collection = db.getCollection(collectionName);
  for (const document of documents) {
    collection.replaceOne({ id: document.id }, document, { upsert: true });
  }
  print(`Seeded ${documents.length} documents into ${collectionName}`);
}

// Event/menu capabilities and dietary capabilities are intentionally separate.
// - capabilities: event/menu suitability and product function
//   (e.g. lunch, apero, buffet, water)
// - dietaryCapabilities: positive dietary compatibility
//   (e.g. vegetarian, halal, gluten-free)

db.eventTemplates.createIndex({ id: 1 }, { unique: true });
db.meals.createIndex({ id: 1 }, { unique: true });
db.meals.createIndex({ capabilities: 1 });
db.meals.createIndex({ dietaryCapabilities: 1 });
db.meals.createIndex({ categoryIds: 1 });

db.products.createIndex({ id: 1 }, { unique: true });
db.products.createIndex({ sku: 1 }, { unique: true });
db.products.createIndex({ concept: 1 });
db.products.createIndex({ capabilities: 1 });
db.products.createIndex({ dietaryCapabilities: 1 });

db.planningPriorities.createIndex({ id: 1 }, { unique: true });
db.dietaryConstraints.createIndex({ id: 1 }, { unique: true });
db.mealCategories.createIndex({ id: 1 }, { unique: true });

const planningPriorities = [
  {
    id: "price",
    label: "Affordability",
    description:
        "Favors candidates that provide the required quantity at a lower comparable cost.",
    displayOrder: 10,
    defaultWeight: 0.2,
    scale: "continuous",
    lowLabel: "Premium",
    highLabel: "Economical"
  },
  {
    id: "swiss",
    label: "Swiss origin",
    description:
        "Favors Swiss-sourced products and meals whose complete ingredient list is Swiss-sourced.",
    displayOrder: 20,
    defaultWeight: 0.2,
    scale: "binary",
    lowLabel: "Non-Swiss",
    highLabel: "Swiss"
  },
  {
    id: "presentation",
    label: "Presentation",
    description:
        "Favors dishes that are visually suited to serving at the selected event.",
    displayOrder: 30,
    defaultWeight: 0.2,
    scale: "continuous",
    lowLabel: "Practical",
    highLabel: "Showpiece"
  },
  {
    id: "prepEase",
    label: "Preparation ease",
    description:
        "Favors food that needs less hands-on preparation and service-time work.",
    displayOrder: 40,
    defaultWeight: 0.2,
    scale: "continuous",
    lowLabel: "Hands-on",
    highLabel: "Low effort"
  },
  {
    id: "sustainability",
    label: "Sustainability",
    description:
        "Favors the catalog's relative estimate for lower-impact ingredients, packaging, and sourcing.",
    displayOrder: 50,
    defaultWeight: 0.2,
    scale: "continuous",
    lowLabel: "Lower priority",
    highLabel: "Lower impact"
  }
];

const dietaryConstraints = [
  {
    id: "vegetarian",
    label: "Vegetarian",
    description:
        "Allocate enough vegetarian-compatible servings for the entered guest count.",
    displayOrder: 10,
    dietaryCapability: "vegetarian",
    requiredCapabilities: ["vegetarian"],
    excludedCapabilities: [],
    excludedConcepts: []
  },
  {
    id: "vegan",
    label: "Vegan",
    description:
        "Allocate enough vegan-compatible servings for the entered guest count.",
    displayOrder: 20,
    dietaryCapability: "vegan",
    requiredCapabilities: ["vegan"],
    excludedCapabilities: [],
    excludedConcepts: []
  },
  {
    id: "halal",
    label: "Halal",
    description:
        "Allocate enough halal-compatible servings for the entered guest count.",
    displayOrder: 30,
    dietaryCapability: "halal",
    requiredCapabilities: ["halal"],
    excludedCapabilities: [],
    excludedConcepts: []
  },
  {
    id: "gluten-free",
    label: "Gluten-free",
    description:
        "Allocate enough gluten-free-compatible servings for the entered guest count.",
    displayOrder: 40,
    dietaryCapability: "gluten-free",
    requiredCapabilities: ["gluten-free"],
    excludedCapabilities: [],
    excludedConcepts: []
  },
  {
    id: "lactose-free",
    label: "Lactose-free",
    description:
        "Allocate enough lactose-free-compatible servings for the entered guest count.",
    displayOrder: 50,
    dietaryCapability: "lactose-free",
    requiredCapabilities: ["lactose-free"],
    excludedCapabilities: [],
    excludedConcepts: []
  },
  {
    id: "nut-free",
    label: "Nut-free",
    description:
        "Allocate enough nut-free-compatible servings for the entered guest count.",
    displayOrder: 60,
    dietaryCapability: "nut-free",
    requiredCapabilities: ["nut-free"],
    excludedCapabilities: [],
    excludedConcepts: []
  }
];

const mealCategories = [
  {
    id: "fruit",
    label: "Fruit",
    description: "Fruit cups, salads, skewers, and fruit-forward dishes.",
    displayOrder: 10
  },
  {
    id: "bakery",
    label: "Bakery & Pastries",
    description: "Croissants, quiches, baked bites, and pastry-based dishes.",
    displayOrder: 20
  },
  {
    id: "meat",
    label: "Meat",
    description: "Dishes that contain meat or meat-based components.",
    displayOrder: 30
  },
  {
    id: "plant-based",
    label: "Vegetarian & Plant-based",
    description: "Vegetarian and vegan dishes.",
    displayOrder: 40
  },
  {
    id: "breakfast",
    label: "Breakfast & Brunch",
    description: "Breakfast, brunch, and coffee-break dishes.",
    displayOrder: 50
  },
  {
    id: "lunch",
    label: "Lunch & Buffet",
    description: "Hearty lunch and buffet dishes.",
    displayOrder: 60
  },
  {
    id: "reception",
    label: "Apéro & Reception",
    description: "Finger food and reception-friendly bites.",
    displayOrder: 70
  }
];

const eventTemplates = [
  {
    id: "business-apero",
    name: "Business Apéro",
    description: "Finger food and drinks for a casual business event.",
    defaults: {
      durationMinutes: 120,
      mealCount: 5
    },
    requirements: [
      {
        id: "savory-finger-food",
        type: "meal",
        requiredCapabilities: ["savory", "finger-food", "apero"],
        target: {
          amount: 5,
          unit: "pieces-per-guest"
        },
        required: true
      },
      {
        id: "soft-drinks",
        type: "product",
        requiredCapabilities: ["non-alcoholic-drink"],
        target: {
          amount: 0.5,
          unit: "liter-per-guest"
        },
        required: true
      },
      {
        id: "napkins",
        type: "product",
        requiredCapabilities: ["napkin"],
        target: {
          amount: 3,
          unit: "pieces-per-guest"
        },
        required: true
      }
    ],
    weights: {
      price: 0.3,
      swiss: 0.2,
      presentation: 0.2,
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
      mealCount: 3
    },
    requirements: [
      {
        id: "savory-brunch",
        type: "meal",
        requiredCapabilities: ["savory", "brunch"],
        target: {
          amount: 1,
          unit: "servings-per-guest"
        },
        required: true
      },
      {
        id: "sweet-brunch",
        type: "meal",
        requiredCapabilities: ["sweet", "brunch"],
        target: {
          amount: 1,
          unit: "servings-per-guest"
        },
        required: true
      },
      {
        id: "coffee",
        type: "product",
        requiredCapabilities: ["coffee"],
        target: {
          amount: 2,
          unit: "cups-per-guest"
        },
        required: true
      },
      {
        id: "juice",
        type: "product",
        requiredCapabilities: ["juice", "non-alcoholic-drink"],
        target: {
          amount: 0.3,
          unit: "liter-per-guest"
        },
        required: true
      }
    ],
    weights: {
      price: 0.25,
      swiss: 0.2,
      presentation: 0.15,
      prepEase: 0.2,
      sustainability: 0.2
    }
  },

  {
    id: "coffee-break",
    name: "Coffee Break",
    description:
        "A compact sweet-and-savory break for meetings, workshops, and training days.",
    defaults: {
      durationMinutes: 45,
      mealCount: 4
    },
    requirements: [
      {
        id: "sweet-coffee-break",
        type: "meal",
        requiredCapabilities: ["sweet", "coffee-break"],
        target: {
          amount: 1,
          unit: "servings-per-guest"
        },
        required: true
      },
      {
        id: "savory-coffee-break",
        type: "meal",
        requiredCapabilities: ["savory", "coffee-break"],
        target: {
          amount: 1,
          unit: "servings-per-guest"
        },
        required: true
      },
      {
        id: "coffee",
        type: "product",
        requiredCapabilities: ["coffee"],
        target: {
          amount: 1.5,
          unit: "cups-per-guest"
        },
        required: true
      },
      {
        id: "water",
        type: "product",
        requiredCapabilities: ["water", "non-alcoholic-drink"],
        target: {
          amount: 0.3,
          unit: "liter-per-guest"
        },
        required: true
      }
    ],
    weights: {
      price: 0.25,
      swiss: 0.15,
      presentation: 0.2,
      prepEase: 0.25,
      sustainability: 0.15
    }
  },

  {
    id: "team-lunch-buffet",
    name: "Team Lunch Buffet",
    description:
        "A generous buffet with a hearty centerpiece and a substantial vegetarian option.",
    defaults: {
      durationMinutes: 90,
      mealCount: 4
    },
    requirements: [
      {
        id: "lunch-main",
        type: "meal",
        requiredCapabilities: ["savory", "lunch", "buffet"],
        target: {
          amount: 1,
          unit: "servings-per-guest"
        },
        required: true
      },
      {
        id: "buffet-water",
        type: "product",
        requiredCapabilities: ["water", "non-alcoholic-drink"],
        target: {
          amount: 0.4,
          unit: "liter-per-guest"
        },
        required: true
      },
      {
        id: "buffet-juice",
        type: "product",
        requiredCapabilities: ["juice", "non-alcoholic-drink"],
        target: {
          amount: 0.25,
          unit: "liter-per-guest"
        },
        required: true
      },
      {
        id: "buffet-napkins",
        type: "product",
        requiredCapabilities: ["napkin"],
        target: {
          amount: 2.5,
          unit: "pieces-per-guest"
        },
        required: true
      }
    ],
    weights: {
      price: 0.25,
      swiss: 0.2,
      presentation: 0.15,
      prepEase: 0.15,
      sustainability: 0.25
    }
  },

  {
    id: "vegan-reception",
    name: "Vegan Reception",
    description:
        "Colorful plant-based finger food for an elegant standing reception.",
    defaults: {
      durationMinutes: 120,
      mealCount: 3
    },
    requirements: [
      {
        id: "vegan-savory-bites",
        type: "meal",
        requiredCapabilities: ["savory", "finger-food", "reception"],
        target: {
          amount: 4,
          unit: "pieces-per-guest"
        },
        required: true
      },
      {
        id: "vegan-sweet-bites",
        type: "meal",
        requiredCapabilities: ["sweet", "finger-food", "reception"],
        target: {
          amount: 2,
          unit: "pieces-per-guest"
        },
        required: true
      },
      {
        id: "reception-water",
        type: "product",
        requiredCapabilities: ["water", "non-alcoholic-drink"],
        target: {
          amount: 0.5,
          unit: "liter-per-guest"
        },
        required: true
      },
      {
        id: "reception-napkins",
        type: "product",
        requiredCapabilities: ["napkin"],
        target: {
          amount: 3,
          unit: "pieces-per-guest"
        },
        required: true
      }
    ],
    weights: {
      price: 0.2,
      swiss: 0.1,
      presentation: 0.3,
      prepEase: 0.15,
      sustainability: 0.25
    }
  },

  {
    id: "swiss-breakfast",
    name: "Swiss Breakfast",
    description:
        "A warm and cold Swiss-inspired breakfast with coffee and apple juice.",
    defaults: {
      durationMinutes: 90,
      mealCount: 2
    },
    requirements: [
      {
        id: "savory-swiss-breakfast",
        type: "meal",
        requiredCapabilities: ["savory", "breakfast"],
        target: {
          amount: 1,
          unit: "servings-per-guest"
        },
        required: true
      },
      {
        id: "sweet-swiss-breakfast",
        type: "meal",
        requiredCapabilities: ["sweet", "breakfast"],
        target: {
          amount: 1,
          unit: "servings-per-guest"
        },
        required: true
      },
      {
        id: "breakfast-coffee",
        type: "product",
        requiredCapabilities: ["coffee"],
        target: {
          amount: 2,
          unit: "cups-per-guest"
        },
        required: true
      },
      {
        id: "breakfast-juice",
        type: "product",
        requiredCapabilities: ["juice", "non-alcoholic-drink"],
        target: {
          amount: 0.25,
          unit: "liter-per-guest"
        },
        required: true
      }
    ],
    weights: {
      price: 0.2,
      swiss: 0.3,
      presentation: 0.15,
      prepEase: 0.15,
      sustainability: 0.2
    }
  }
];

const meals = [
  {
    id: "caprese-skewers",
    categoryIds: ["plant-based", "reception"],
    name: "Caprese Skewers",
    capabilities: [
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
      swiss: 1,
      presentation: 0.9,
      prepEase: 0.6,
      sustainability: 0.75
    },
    dietaryCapabilities: [
      "vegetarian",
      "gluten-free",
      "nut-free"
    ]
  },

  {
    id: "mini-spinach-quiche",
    categoryIds: ["bakery", "plant-based", "reception"],
    name: "Mini Spinach Quiche",
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
        concept: "mini-spinach-quiche",
        amountPerServing: 2,
        unit: "piece"
      }
    ],
    scores: {
      price: 0.75,
      swiss: 1,
      presentation: 0.75,
      prepEase: 0.9,
      sustainability: 0.7
    },
    dietaryCapabilities: [
      "vegetarian",
      "nut-free"
    ]
  },

  {
    id: "falafel-bites",
    categoryIds: ["plant-based", "reception"],
    name: "Falafel Bites",
    capabilities: [
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
      swiss: 0,
      presentation: 0.7,
      prepEase: 0.85,
      sustainability: 0.9
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "lactose-free",
      "gluten-free",
      "nut-free"
    ]
  },

  {
    id: "ham-croissants",
    categoryIds: ["bakery", "meat", "reception"],
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
      price: 0.7,
      swiss: 1,
      presentation: 0.75,
      prepEase: 0.9,
      sustainability: 0.5
    },
    dietaryCapabilities: [
      "nut-free"
    ]
  },

  {
    id: "halal-chicken-skewers",
    name: "Halal Chicken Skewers",
    categoryIds: ["meat", "reception"],
    capabilities: [
      "savory",
      "finger-food",
      "warm",
      "apero",
      "prepare-ahead"
    ],
    serving: {
      piecesPerServing: 2
    },
    ingredients: [
      {
        concept: "halal-chicken-skewer",
        amountPerServing: 2,
        unit: "piece"
      }
    ],
    scores: {
      price: 0.72,
      swiss: 0,
      presentation: 0.88,
      prepEase: 0.86,
      sustainability: 0.58
    },
    dietaryCapabilities: ["halal"]
  },

  {
    id: "bircher-muesli",
    categoryIds: ["breakfast", "plant-based"],
    name: "Bircher Müesli",
    capabilities: [
      "sweet",
      "cold",
      "brunch"
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
      swiss: 1,
      presentation: 0.7,
      prepEase: 0.75,
      sustainability: 0.85
    },
    dietaryCapabilities: [
      "vegetarian",
      "nut-free"
    ]
  },

  {
    id: "scrambled-eggs",
    categoryIds: ["breakfast", "plant-based"],
    name: "Scrambled Eggs",
    capabilities: [
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
      price: 0.8,
      swiss: 1,
      presentation: 0.65,
      prepEase: 0.55,
      sustainability: 0.7
    },
    dietaryCapabilities: [
      "vegetarian",
      "gluten-free",
      "nut-free"
    ]
  },

  {
    id: "fruit-salad",
    categoryIds: ["fruit", "breakfast", "plant-based"],
    name: "Fruit Salad",
    capabilities: [
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
      swiss: 0,
      presentation: 0.85,
      prepEase: 0.7,
      sustainability: 0.7
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "apple-yogurt-parfaits",
    categoryIds: ["breakfast", "plant-based"],
    name: "Apple Yogurt Parfaits",
    capabilities: [
      "sweet",
      "cold",
      "coffee-break",
      "prepare-ahead"
    ],
    serving: {
      piecesPerServing: 1
    },
    ingredients: [
      {
        concept: "muesli",
        amountPerServing: 30,
        unit: "g"
      },
      {
        concept: "yogurt",
        amountPerServing: 100,
        unit: "g"
      },
      {
        concept: "apple",
        amountPerServing: 60,
        unit: "g"
      }
    ],
    scores: {
      price: 0.8,
      swiss: 1,
      presentation: 0.85,
      prepEase: 0.8,
      sustainability: 0.85
    },
    dietaryCapabilities: [
      "vegetarian",
      "nut-free"
    ]
  },

  {
    id: "fresh-fruit-cups",
    categoryIds: ["fruit", "breakfast", "plant-based"],
    name: "Fresh Fruit Cups",
    capabilities: [
      "sweet",
      "cold",
      "coffee-break",
      "prepare-ahead"
    ],
    serving: {
      piecesPerServing: 1
    },
    ingredients: [
      {
        concept: "mixed-fruit",
        amountPerServing: 150,
        unit: "g"
      }
    ],
    scores: {
      price: 0.7,
      swiss: 0,
      presentation: 0.9,
      prepEase: 0.85,
      sustainability: 0.8
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "mini-quiche-break-bites",
    categoryIds: ["bakery", "breakfast", "plant-based"],
    name: "Mini Quiche Break Bites",
    capabilities: [
      "savory",
      "warm",
      "finger-food",
      "coffee-break"
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
      swiss: 1,
      presentation: 0.8,
      prepEase: 0.92,
      sustainability: 0.72
    },
    dietaryCapabilities: [
      "vegetarian",
      "nut-free"
    ]
  },

  {
    id: "ham-croissant-break-bites",
    categoryIds: ["bakery", "meat", "breakfast"],
    name: "Ham Croissant Break Bites",
    capabilities: [
      "savory",
      "warm",
      "finger-food",
      "coffee-break"
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
      price: 0.7,
      swiss: 1,
      presentation: 0.78,
      prepEase: 0.9,
      sustainability: 0.5
    },
    dietaryCapabilities: ["nut-free"]
  },

  {
    id: "ham-quiche-lunch-platter",
    categoryIds: ["bakery", "meat", "lunch"],
    name: "Ham Croissant & Quiche Lunch Platter",
    capabilities: [
      "savory",
      "warm",
      "lunch",
      "buffet",
      "hearty"
    ],
    serving: {
      piecesPerServing: 3
    },
    ingredients: [
      {
        concept: "mini-ham-croissant",
        amountPerServing: 2,
        unit: "piece"
      },
      {
        concept: "mini-spinach-quiche",
        amountPerServing: 1,
        unit: "piece"
      }
    ],
    scores: {
      price: 0.72,
      swiss: 1,
      presentation: 0.78,
      prepEase: 0.9,
      sustainability: 0.55
    },
    dietaryCapabilities: ["nut-free"]
  },

  {
    id: "mediterranean-falafel-bowl",
    categoryIds: ["plant-based", "lunch"],
    name: "Mediterranean Falafel Bowl",
    capabilities: [
      "savory",
      "warm",
      "lunch",
      "buffet"
    ],
    serving: {
      piecesPerServing: 1
    },
    ingredients: [
      {
        concept: "falafel",
        amountPerServing: 4,
        unit: "piece"
      },
      {
        concept: "hummus",
        amountPerServing: 50,
        unit: "g"
      },
      {
        concept: "cherry-tomato",
        amountPerServing: 80,
        unit: "g"
      }
    ],
    scores: {
      price: 0.82,
      swiss: 0,
      presentation: 0.86,
      prepEase: 0.78,
      sustainability: 0.92
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "lactose-free",
      "gluten-free",
      "nut-free"
    ]
  },

  {
    id: "caprese-lunch-bowl",
    categoryIds: ["plant-based", "lunch"],
    name: "Caprese Lunch Bowl",
    capabilities: [
      "savory",
      "cold",
      "lunch",
      "buffet",
      "prepare-ahead"
    ],
    serving: {
      piecesPerServing: 1
    },
    ingredients: [
      {
        concept: "mozzarella",
        amountPerServing: 80,
        unit: "g"
      },
      {
        concept: "cherry-tomato",
        amountPerServing: 100,
        unit: "g"
      },
      {
        concept: "basil",
        amountPerServing: 4,
        unit: "g"
      }
    ],
    scores: {
      price: 0.68,
      swiss: 1,
      presentation: 0.92,
      prepEase: 0.72,
      sustainability: 0.76
    },
    dietaryCapabilities: [
      "vegetarian",
      "gluten-free",
      "nut-free"
    ]
  },

  {
    id: "halal-chicken-rice-bowl",
    name: "Halal Chicken & Rice Bowl",
    categoryIds: ["meat", "lunch"],
    capabilities: [
      "savory",
      "warm",
      "lunch",
      "buffet",
      "hearty"
    ],
    serving: {
      piecesPerServing: 1
    },
    ingredients: [
      {
        concept: "halal-chicken",
        amountPerServing: 140,
        unit: "g"
      },
      {
        concept: "rice",
        amountPerServing: 90,
        unit: "g"
      },
      {
        concept: "mixed-vegetables",
        amountPerServing: 120,
        unit: "g"
      }
    ],
    scores: {
      price: 0.74,
      swiss: 0,
      presentation: 0.78,
      prepEase: 0.72,
      sustainability: 0.62
    },
    dietaryCapabilities: [
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "falafel-hummus-canapes",
    categoryIds: ["plant-based", "reception"],
    name: "Falafel Hummus Canapés",
    capabilities: [
      "savory",
      "finger-food",
      "reception",
      "apero",
      "prepare-ahead"
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
        amountPerServing: 25,
        unit: "g"
      }
    ],
    scores: {
      price: 0.84,
      swiss: 0,
      presentation: 0.86,
      prepEase: 0.85,
      sustainability: 0.92
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "lactose-free",
      "gluten-free",
      "nut-free"
    ]
  },

  {
    id: "tomato-basil-bites",
    categoryIds: ["plant-based", "reception"],
    name: "Tomato Basil Hummus Bites",
    capabilities: [
      "savory",
      "finger-food",
      "cold",
      "reception",
      "apero",
      "prepare-ahead"
    ],
    serving: {
      piecesPerServing: 2
    },
    ingredients: [
      {
        concept: "cherry-tomato",
        amountPerServing: 80,
        unit: "g"
      },
      {
        concept: "hummus",
        amountPerServing: 20,
        unit: "g"
      },
      {
        concept: "basil",
        amountPerServing: 3,
        unit: "g"
      }
    ],
    scores: {
      price: 0.76,
      swiss: 0,
      presentation: 0.94,
      prepEase: 0.7,
      sustainability: 0.9
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "lactose-free",
      "gluten-free",
      "nut-free"
    ]
  },

  {
    id: "fruit-skewers",
    categoryIds: ["fruit", "plant-based", "reception"],
    name: "Fresh Fruit Skewers",
    capabilities: [
      "sweet",
      "finger-food",
      "cold",
      "reception",
      "prepare-ahead"
    ],
    serving: {
      piecesPerServing: 2
    },
    ingredients: [
      {
        concept: "mixed-fruit",
        amountPerServing: 140,
        unit: "g"
      }
    ],
    scores: {
      price: 0.68,
      swiss: 0,
      presentation: 0.94,
      prepEase: 0.76,
      sustainability: 0.78
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "swiss-cheese-omelette",
    categoryIds: ["breakfast", "plant-based"],
    name: "Swiss Cheese Omelette",
    capabilities: [
      "savory",
      "warm",
      "breakfast"
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
        concept: "mozzarella",
        amountPerServing: 35,
        unit: "g"
      },
      {
        concept: "butter",
        amountPerServing: 10,
        unit: "g"
      }
    ],
    scores: {
      price: 0.76,
      swiss: 1,
      presentation: 0.72,
      prepEase: 0.58,
      sustainability: 0.72
    },
    dietaryCapabilities: [
      "vegetarian",
      "gluten-free",
      "nut-free"
    ]
  },

  {
    id: "apple-bircher-jars",
    categoryIds: ["breakfast", "plant-based"],
    name: "Swiss Apple Bircher Jars",
    capabilities: [
      "sweet",
      "cold",
      "breakfast",
      "prepare-ahead"
    ],
    serving: {
      piecesPerServing: 1
    },
    ingredients: [
      {
        concept: "muesli",
        amountPerServing: 75,
        unit: "g"
      },
      {
        concept: "yogurt",
        amountPerServing: 125,
        unit: "g"
      },
      {
        concept: "apple",
        amountPerServing: 90,
        unit: "g"
      }
    ],
    scores: {
      price: 0.84,
      swiss: 1,
      presentation: 0.86,
      prepEase: 0.78,
      sustainability: 0.88
    },
    dietaryCapabilities: [
      "vegetarian",
      "nut-free"
    ]
  },

  {
    id: "gluten-free-tomato-frittata",
    categoryIds: ["breakfast", "plant-based", "lunch"],
    name: "Gluten-Free Tomato Frittata",
    capabilities: [
      "savory",
      "warm",
      "brunch",
      "breakfast",
      "lunch",
      "buffet"
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
        concept: "mozzarella",
        amountPerServing: 35,
        unit: "g"
      },
      {
        concept: "cherry-tomato",
        amountPerServing: 70,
        unit: "g"
      },
      {
        concept: "basil",
        amountPerServing: 3,
        unit: "g"
      }
    ],
    scores: {
      price: 0.74,
      swiss: 1,
      presentation: 0.84,
      prepEase: 0.68,
      sustainability: 0.78
    },
    dietaryCapabilities: [
      "vegetarian",
      "gluten-free"
    ]
  },

  {
    id: "lentil-quinoa-bowl",
    name: "Lentil Quinoa Bowl",
    categoryIds: ["plant-based", "lunch"],
    capabilities: [
      "savory",
      "cold",
      "lunch",
      "buffet",
      "prepare-ahead"
    ],
    serving: {
      piecesPerServing: 1
    },
    ingredients: [
      {
        concept: "lentil-quinoa-mix",
        amountPerServing: 180,
        unit: "g"
      },
      {
        concept: "mixed-vegetables",
        amountPerServing: 120,
        unit: "g"
      }
    ],
    scores: {
      price: 0.86,
      swiss: 0,
      presentation: 0.84,
      prepEase: 0.8,
      sustainability: 0.95
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "lactose-free-bircher",
    name: "Lactose-Free Apple Bircher",
    categoryIds: ["breakfast", "plant-based"],
    capabilities: [
      "sweet",
      "cold",
      "breakfast",
      "brunch",
      "coffee-break",
      "prepare-ahead"
    ],
    serving: {
      piecesPerServing: 1
    },
    ingredients: [
      {
        concept: "gluten-free-oats",
        amountPerServing: 70,
        unit: "g"
      },
      {
        concept: "lactose-free-yogurt",
        amountPerServing: 125,
        unit: "g"
      },
      {
        concept: "apple",
        amountPerServing: 90,
        unit: "g"
      }
    ],
    scores: {
      price: 0.78,
      swiss: 1,
      presentation: 0.84,
      prepEase: 0.82,
      sustainability: 0.86
    },
    dietaryCapabilities: [
      "vegetarian",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "gluten-free-brownie-bites",
    name: "Gluten-Free Brownie Bites",
    categoryIds: ["bakery", "plant-based", "reception"],
    capabilities: [
      "sweet",
      "finger-food",
      "coffee-break",
      "reception",
      "prepare-ahead"
    ],
    serving: {
      piecesPerServing: 2
    },
    ingredients: [
      {
        concept: "gluten-free-brownie",
        amountPerServing: 2,
        unit: "piece"
      }
    ],
    scores: {
      price: 0.68,
      swiss: 1,
      presentation: 0.82,
      prepEase: 0.95,
      sustainability: 0.66
    },
    dietaryCapabilities: [
      "vegetarian",
      "gluten-free"
    ]
  },

  {
    id: "smoked-salmon-cucumber-bites",
    name: "Smoked Salmon Cucumber Bites",
    categoryIds: ["reception"],
    capabilities: [
      "savory",
      "finger-food",
      "cold",
      "reception",
      "apero",
      "prepare-ahead"
    ],
    serving: {
      piecesPerServing: 2
    },
    ingredients: [
      {
        concept: "smoked-salmon",
        amountPerServing: 45,
        unit: "g"
      },
      {
        concept: "cucumber",
        amountPerServing: 70,
        unit: "g"
      }
    ],
    scores: {
      price: 0.45,
      swiss: 1,
      presentation: 0.96,
      prepEase: 0.75,
      sustainability: 0.52
    },
    dietaryCapabilities: [
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "vegetable-rice-paper-rolls",
    name: "Vegetable Rice Paper Rolls",
    categoryIds: ["plant-based", "reception"],
    capabilities: [
      "savory",
      "finger-food",
      "cold",
      "reception",
      "apero",
      "prepare-ahead"
    ],
    serving: {
      piecesPerServing: 2
    },
    ingredients: [
      {
        concept: "rice-paper-roll",
        amountPerServing: 2,
        unit: "piece"
      },
      {
        concept: "mixed-vegetables",
        amountPerServing: 80,
        unit: "g"
      }
    ],
    scores: {
      price: 0.76,
      swiss: 0,
      presentation: 0.92,
      prepEase: 0.68,
      sustainability: 0.91
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "mini-roesti-bites",
    name: "Swiss Mini Rösti Bites",
    categoryIds: ["plant-based", "reception"],
    capabilities: [
      "savory",
      "finger-food",
      "warm",
      "apero",
      "reception"
    ],
    serving: {
      piecesPerServing: 2
    },
    ingredients: [
      {
        concept: "mini-roesti",
        amountPerServing: 2,
        unit: "piece"
      }
    ],
    scores: {
      price: 0.76,
      swiss: 1,
      presentation: 0.82,
      prepEase: 0.9,
      sustainability: 0.78
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "herbed-polenta-bites",
    name: "Herbed Polenta Bites",
    categoryIds: ["plant-based", "reception"],
    capabilities: [
      "savory",
      "finger-food",
      "warm",
      "apero",
      "reception",
      "prepare-ahead"
    ],
    serving: {
      piecesPerServing: 2
    },
    ingredients: [
      {
        concept: "polenta-bite",
        amountPerServing: 2,
        unit: "piece"
      },
      {
        concept: "basil",
        amountPerServing: 2,
        unit: "g"
      }
    ],
    scores: {
      price: 0.8,
      swiss: 0,
      presentation: 0.87,
      prepEase: 0.88,
      sustainability: 0.9
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "swiss-beef-meatballs",
    name: "Swiss Beef Meatballs",
    categoryIds: ["meat", "reception"],
    capabilities: [
      "savory",
      "finger-food",
      "warm",
      "apero",
      "reception"
    ],
    serving: {
      piecesPerServing: 3
    },
    ingredients: [
      {
        concept: "beef-meatball",
        amountPerServing: 3,
        unit: "piece"
      }
    ],
    scores: {
      price: 0.67,
      swiss: 1,
      presentation: 0.78,
      prepEase: 0.9,
      sustainability: 0.48
    },
    dietaryCapabilities: [
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "gruyere-grape-skewers",
    name: "Gruyère & Grape Skewers",
    categoryIds: ["plant-based", "reception"],
    capabilities: [
      "savory",
      "finger-food",
      "cold",
      "apero",
      "reception",
      "prepare-ahead"
    ],
    serving: {
      piecesPerServing: 2
    },
    ingredients: [
      {
        concept: "gruyere-cube",
        amountPerServing: 45,
        unit: "g"
      },
      {
        concept: "grape",
        amountPerServing: 75,
        unit: "g"
      }
    ],
    scores: {
      price: 0.58,
      swiss: 0,
      presentation: 0.93,
      prepEase: 0.88,
      sustainability: 0.65
    },
    dietaryCapabilities: [
      "vegetarian",
      "gluten-free",
      "nut-free"
    ]
  },

  {
    id: "hummus-stuffed-mini-peppers",
    name: "Hummus-Stuffed Mini Peppers",
    categoryIds: ["plant-based", "reception"],
    capabilities: [
      "savory",
      "finger-food",
      "cold",
      "apero",
      "reception",
      "prepare-ahead"
    ],
    serving: {
      piecesPerServing: 2
    },
    ingredients: [
      {
        concept: "mini-sweet-pepper",
        amountPerServing: 90,
        unit: "g"
      },
      {
        concept: "hummus",
        amountPerServing: 25,
        unit: "g"
      }
    ],
    scores: {
      price: 0.81,
      swiss: 0,
      presentation: 0.92,
      prepEase: 0.72,
      sustainability: 0.9
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "vegetable-antipasti-skewers",
    name: "Swiss Vegetable Antipasti Skewers",
    categoryIds: ["plant-based", "reception"],
    capabilities: [
      "savory",
      "finger-food",
      "cold",
      "apero",
      "reception",
      "prepare-ahead"
    ],
    serving: {
      piecesPerServing: 2
    },
    ingredients: [
      {
        concept: "mixed-vegetables",
        amountPerServing: 110,
        unit: "g"
      },
      {
        concept: "basil",
        amountPerServing: 3,
        unit: "g"
      }
    ],
    scores: {
      price: 0.83,
      swiss: 1,
      presentation: 0.9,
      prepEase: 0.76,
      sustainability: 0.94
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  }
];

const products = [
  {
    id: "mozzarella-1kg",
    sku: "MOCK-001",
    name: "Swiss Mozzarella 1 kg",
    concept: "mozzarella",
    originCountry: "CH",
    package: {
      amount: 1000,
      unit: "g"
    },
    price: {
      amount: 9.8,
      currency: "CHF"
    },
    capabilities: [],
    scores: {
      price: 0.8,
      swiss: 1,
      sustainability: 0.7
    },
    dietaryCapabilities: [
      "vegetarian",
      "gluten-free"
    ]
  },

  {
    id: "cherry-tomatoes-500g",
    sku: "MOCK-002",
    name: "Swiss Cherry Tomatoes 500 g",
    concept: "cherry-tomato",
    originCountry: "CH",
    package: {
      amount: 500,
      unit: "g"
    },
    price: {
      amount: 4.2,
      currency: "CHF"
    },
    capabilities: [],
    scores: {
      price: 0.75,
      swiss: 1,
      sustainability: 0.8
    },
    dietaryCapabilities: [
      "vegetarian",
      "vegan",
      "halal",
      "gluten-free"
    ]
  },

  {
    id: "basil-100g",
    sku: "MOCK-003",
    name: "Swiss Fresh Basil 100 g",
    concept: "basil",
    originCountry: "CH",
    package: {
      amount: 100,
      unit: "g"
    },
    price: {
      amount: 3.9,
      currency: "CHF"
    },
    capabilities: [],
    scores: {
      price: 0.6,
      swiss: 1,
      sustainability: 0.75
    },
    dietaryCapabilities: [
      "vegetarian",
      "vegan",
      "halal",
      "gluten-free"
    ]
  },

  {
    id: "spinach-quiche-20",
    sku: "MOCK-004",
    name: "Swiss Mini Spinach Quiche 20 pcs",
    concept: "mini-spinach-quiche",
    originCountry: "CH",
    package: {
      amount: 20,
      unit: "piece"
    },
    price: {
      amount: 18.9,
      currency: "CHF"
    },
    capabilities: [
      "finger-food",
      "ready-to-heat"
    ],
    scores: {
      price: 0.75,
      swiss: 1,
      sustainability: 0.7
    },
    dietaryCapabilities: ["vegetarian"]
  },

  {
    id: "falafel-50",
    sku: "MOCK-005",
    name: "Falafel 50 pcs",
    concept: "falafel",
    originCountry: "NL",
    package: {
      amount: 50,
      unit: "piece"
    },
    price: {
      amount: 21.5,
      currency: "CHF"
    },
    capabilities: ["finger-food"],
    scores: {
      price: 0.9,
      swiss: 0,
      sustainability: 0.9
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal"
    ]
  },

  {
    id: "hummus-1kg",
    sku: "MOCK-006",
    name: "Hummus 1 kg",
    concept: "hummus",
    originCountry: "DE",
    package: {
      amount: 1000,
      unit: "g"
    },
    price: {
      amount: 10.9,
      currency: "CHF"
    },
    capabilities: [],
    scores: {
      price: 0.85,
      swiss: 0,
      sustainability: 0.85
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal"
    ]
  },

  {
    id: "ham-croissant-24",
    sku: "MOCK-007",
    name: "Swiss Mini Ham Croissants 24 pcs",
    concept: "mini-ham-croissant",
    originCountry: "CH",
    package: {
      amount: 24,
      unit: "piece"
    },
    price: {
      amount: 22.5,
      currency: "CHF"
    },
    capabilities: [
      "finger-food",
      "ready-to-heat"
    ],
    scores: {
      price: 0.7,
      swiss: 1,
      sustainability: 0.45
    },
    dietaryCapabilities: []
  },

  {
    id: "muesli-2kg",
    sku: "MOCK-008",
    name: "Swiss Müesli 2 kg",
    concept: "muesli",
    originCountry: "CH",
    package: {
      amount: 2000,
      unit: "g"
    },
    price: {
      amount: 13.5,
      currency: "CHF"
    },
    capabilities: ["breakfast"],
    scores: {
      price: 0.9,
      swiss: 1,
      sustainability: 0.8
    },
    dietaryCapabilities: ["vegetarian"]
  },

  {
    id: "yogurt-1kg",
    sku: "MOCK-009",
    name: "Swiss Natural Yogurt 1 kg",
    concept: "yogurt",
    originCountry: "CH",
    package: {
      amount: 1000,
      unit: "g"
    },
    price: {
      amount: 5.2,
      currency: "CHF"
    },
    capabilities: [],
    scores: {
      price: 0.85,
      swiss: 1,
      sustainability: 0.8
    },
    dietaryCapabilities: ["vegetarian"]
  },

  {
    id: "apple-2kg",
    sku: "MOCK-010",
    name: "Swiss Apples 2 kg",
    concept: "apple",
    originCountry: "CH",
    package: {
      amount: 2000,
      unit: "g"
    },
    price: {
      amount: 7.4,
      currency: "CHF"
    },
    capabilities: [],
    scores: {
      price: 0.9,
      swiss: 1,
      sustainability: 0.95
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian"
    ]
  },

  {
    id: "eggs-30",
    sku: "MOCK-011",
    name: "Swiss Eggs 30 pcs",
    concept: "egg",
    originCountry: "CH",
    package: {
      amount: 30,
      unit: "piece"
    },
    price: {
      amount: 13.9,
      currency: "CHF"
    },
    capabilities: [],
    scores: {
      price: 0.85,
      swiss: 1,
      sustainability: 0.75
    },
    dietaryCapabilities: [
      "vegetarian",
      "gluten-free"
    ]
  },

  {
    id: "butter-1kg",
    sku: "MOCK-012",
    name: "Swiss Butter 1 kg",
    concept: "butter",
    originCountry: "CH",
    package: {
      amount: 1000,
      unit: "g"
    },
    price: {
      amount: 12.5,
      currency: "CHF"
    },
    capabilities: [],
    scores: {
      price: 0.7,
      swiss: 1,
      sustainability: 0.65
    },
    dietaryCapabilities: ["vegetarian"]
  },

  {
    id: "mixed-fruit-2kg",
    sku: "MOCK-013",
    name: "Mixed Fresh Fruit 2 kg",
    concept: "mixed-fruit",
    originCountry: null,
    package: {
      amount: 2000,
      unit: "g"
    },
    price: {
      amount: 17.9,
      currency: "CHF"
    },
    capabilities: [],
    scores: {
      price: 0.65,
      swiss: 0,
      sustainability: 0.7
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal"
    ]
  },

  {
    id: "mineral-water-6x15",
    sku: "MOCK-014",
    name: "Swiss Mineral Water 6 × 1.5 L",
    concept: "water",
    originCountry: "CH",
    package: {
      amount: 9,
      unit: "liter"
    },
    price: {
      amount: 8.9,
      currency: "CHF"
    },
    capabilities: [
      "non-alcoholic-drink",
      "water"
    ],
    scores: {
      price: 0.7,
      swiss: 1,
      sustainability: 0.88
    },
    dietaryCapabilities: []
  },

  {
    id: "budget-water-12l",
    sku: "MOCK-018",
    name: "Budget Still Water 12 L",
    concept: "water",
    originCountry: "FR",
    package: {
      amount: 12,
      unit: "liter"
    },
    price: {
      amount: 8.4,
      currency: "CHF"
    },
    capabilities: [
      "non-alcoholic-drink",
      "water"
    ],
    scores: {
      price: 0.98,
      swiss: 0,
      sustainability: 0.55
    },
    dietaryCapabilities: []
  },

  {
    id: "apple-juice-6l",
    sku: "MOCK-015",
    name: "Swiss Apple Juice 6 L",
    concept: "apple-juice",
    originCountry: "CH",
    package: {
      amount: 6,
      unit: "liter"
    },
    price: {
      amount: 14.9,
      currency: "CHF"
    },
    capabilities: [
      "non-alcoholic-drink",
      "juice"
    ],
    scores: {
      price: 0.8,
      swiss: 1,
      sustainability: 0.85
    },
    dietaryCapabilities: []
  },

  {
    id: "coffee-beans-1kg",
    sku: "MOCK-016",
    name: "Coffee Beans 1 kg",
    concept: "coffee-beans",
    originCountry: "BR",
    package: {
      amount: 1000,
      unit: "g"
    },
    price: {
      amount: 21.9,
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
      swiss: 0,
      sustainability: 0.65
    },
    dietaryCapabilities: []
  },

  {
    id: "halal-chicken-skewers-40",
    sku: "MOCK-019",
    name: "Halal Chicken Skewers 40 pcs",
    concept: "halal-chicken-skewer",
    originCountry: "FR",
    package: {
      amount: 40,
      unit: "piece"
    },
    price: {
      amount: 31.9,
      currency: "CHF"
    },
    capabilities: [
      "finger-food",
      "ready-to-heat"
    ],
    scores: {
      price: 0.72,
      swiss: 0,
      sustainability: 0.58
    },
    dietaryCapabilities: ["halal"]
  },

  {
    id: "halal-chicken-rice-bowls-10",
    sku: "MOCK-020",
    name: "Halal Chicken Rice Bowls 10 portions",
    concept: "halal-chicken-rice-bowl",
    originCountry: "FR",
    package: {
      amount: 10,
      unit: "piece"
    },
    price: {
      amount: 69,
      currency: "CHF"
    },
    capabilities: ["ready-to-heat"],
    scores: {
      price: 0.68,
      swiss: 0,
      sustainability: 0.6
    },
    dietaryCapabilities: ["halal"]
  },

  {
    id: "napkins-250",
    sku: "MOCK-017",
    name: "Napkins 250 pcs",
    concept: "napkin",
    originCountry: "DE",
    package: {
      amount: 250,
      unit: "piece"
    },
    price: {
      amount: 7.5,
      currency: "CHF"
    },
    capabilities: ["napkin"],
    scores: {
      price: 0.9,
      swiss: 0,
      sustainability: 0.7
    },
    dietaryCapabilities: []
  },

  {
    id: "halal-chicken-2kg",
    sku: "MOCK-021",
    name: "Certified Halal Chicken 2 kg",
    concept: "halal-chicken",
    originCountry: "FR",
    package: {
      amount: 2000,
      unit: "g"
    },
    price: {
      amount: 29.9,
      currency: "CHF"
    },
    capabilities: [],
    scores: {
      price: 0.72,
      swiss: 0,
      sustainability: 0.55
    },
    dietaryCapabilities: [
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "rice-5kg",
    sku: "MOCK-022",
    name: "Long-Grain Rice 5 kg",
    concept: "rice",
    originCountry: "IT",
    package: {
      amount: 5000,
      unit: "g"
    },
    price: {
      amount: 14.9,
      currency: "CHF"
    },
    capabilities: [],
    scores: {
      price: 0.95,
      swiss: 0,
      sustainability: 0.78
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "mixed-vegetables-2kg",
    sku: "MOCK-023",
    name: "Swiss Mixed Vegetables 2 kg",
    concept: "mixed-vegetables",
    originCountry: "CH",
    package: {
      amount: 2000,
      unit: "g"
    },
    price: {
      amount: 12.9,
      currency: "CHF"
    },
    capabilities: [],
    scores: {
      price: 0.86,
      swiss: 1,
      sustainability: 0.92
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "lentil-quinoa-2kg",
    sku: "MOCK-024",
    name: "Cooked Lentil Quinoa Mix 2 kg",
    concept: "lentil-quinoa-mix",
    originCountry: "DE",
    package: {
      amount: 2000,
      unit: "g"
    },
    price: {
      amount: 16.9,
      currency: "CHF"
    },
    capabilities: [],
    scores: {
      price: 0.84,
      swiss: 0,
      sustainability: 0.94
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "gluten-free-oats-2kg",
    sku: "MOCK-025",
    name: "Swiss Certified Gluten-Free Oats 2 kg",
    concept: "gluten-free-oats",
    originCountry: "CH",
    package: {
      amount: 2000,
      unit: "g"
    },
    price: {
      amount: 15.9,
      currency: "CHF"
    },
    capabilities: [],
    scores: {
      price: 0.78,
      swiss: 1,
      sustainability: 0.88
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "lactose-free-yogurt-1kg",
    sku: "MOCK-026",
    name: "Swiss Lactose-Free Yogurt 1 kg",
    concept: "lactose-free-yogurt",
    originCountry: "CH",
    package: {
      amount: 1000,
      unit: "g"
    },
    price: {
      amount: 6.9,
      currency: "CHF"
    },
    capabilities: [],
    scores: {
      price: 0.76,
      swiss: 1,
      sustainability: 0.78
    },
    dietaryCapabilities: [
      "vegetarian",
      "lactose-free",
      "gluten-free",
      "nut-free"
    ]
  },

  {
    id: "gluten-free-brownies-24",
    sku: "MOCK-027",
    name: "Swiss Gluten-Free Brownie Bites 24 pcs",
    concept: "gluten-free-brownie",
    originCountry: "CH",
    package: {
      amount: 24,
      unit: "piece"
    },
    price: {
      amount: 25.9,
      currency: "CHF"
    },
    capabilities: [],
    scores: {
      price: 0.64,
      swiss: 1,
      sustainability: 0.64
    },
    dietaryCapabilities: [
      "vegetarian",
      "gluten-free"
    ]
  },

  {
    id: "smoked-salmon-500g",
    sku: "MOCK-028",
    name: "Swiss Smoked Salmon 500 g",
    concept: "smoked-salmon",
    originCountry: "CH",
    package: {
      amount: 500,
      unit: "g"
    },
    price: {
      amount: 24.9,
      currency: "CHF"
    },
    capabilities: [],
    scores: {
      price: 0.48,
      swiss: 1,
      sustainability: 0.5
    },
    dietaryCapabilities: [
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "cucumber-1kg",
    sku: "MOCK-029",
    name: "Swiss Cucumbers 1 kg",
    concept: "cucumber",
    originCountry: "CH",
    package: {
      amount: 1000,
      unit: "g"
    },
    price: {
      amount: 4.9,
      currency: "CHF"
    },
    capabilities: [],
    scores: {
      price: 0.88,
      swiss: 1,
      sustainability: 0.9
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "rice-paper-rolls-30",
    sku: "MOCK-030",
    name: "Vegetable Rice Paper Rolls 30 pcs",
    concept: "rice-paper-roll",
    originCountry: "DE",
    package: {
      amount: 30,
      unit: "piece"
    },
    price: {
      amount: 27.9,
      currency: "CHF"
    },
    capabilities: ["finger-food"],
    scores: {
      price: 0.74,
      swiss: 0,
      sustainability: 0.88
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "mini-roesti-40",
    sku: "MOCK-031",
    name: "Swiss Mini Rösti 40 pcs",
    concept: "mini-roesti",
    originCountry: "CH",
    package: {
      amount: 40,
      unit: "piece"
    },
    price: {
      amount: 24.9,
      currency: "CHF"
    },
    capabilities: ["finger-food", "ready-to-heat"],
    scores: {
      price: 0.76,
      swiss: 1,
      sustainability: 0.78
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "polenta-bites-36",
    sku: "MOCK-032",
    name: "Herbed Polenta Bites 36 pcs",
    concept: "polenta-bite",
    originCountry: "IT",
    package: {
      amount: 36,
      unit: "piece"
    },
    price: {
      amount: 20.9,
      currency: "CHF"
    },
    capabilities: ["finger-food", "ready-to-heat"],
    scores: {
      price: 0.82,
      swiss: 0,
      sustainability: 0.9
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "beef-meatballs-40",
    sku: "MOCK-033",
    name: "Swiss Beef Meatballs 40 pcs",
    concept: "beef-meatball",
    originCountry: "CH",
    package: {
      amount: 40,
      unit: "piece"
    },
    price: {
      amount: 29.9,
      currency: "CHF"
    },
    capabilities: ["finger-food", "ready-to-heat"],
    scores: {
      price: 0.67,
      swiss: 1,
      sustainability: 0.48
    },
    dietaryCapabilities: [
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "gruyere-cubes-1kg",
    sku: "MOCK-034",
    name: "Swiss Gruyère Cubes 1 kg",
    concept: "gruyere-cube",
    originCountry: "CH",
    package: {
      amount: 1000,
      unit: "g"
    },
    price: {
      amount: 24.9,
      currency: "CHF"
    },
    capabilities: ["finger-food"],
    scores: {
      price: 0.58,
      swiss: 1,
      sustainability: 0.64
    },
    dietaryCapabilities: [
      "vegetarian",
      "gluten-free",
      "nut-free"
    ]
  },

  {
    id: "grapes-1kg",
    sku: "MOCK-035",
    name: "Table Grapes 1 kg",
    concept: "grape",
    originCountry: "IT",
    package: {
      amount: 1000,
      unit: "g"
    },
    price: {
      amount: 6.9,
      currency: "CHF"
    },
    capabilities: [],
    scores: {
      price: 0.8,
      swiss: 0,
      sustainability: 0.7
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  },

  {
    id: "mini-sweet-peppers-1kg",
    sku: "MOCK-036",
    name: "Mini Sweet Peppers 1 kg",
    concept: "mini-sweet-pepper",
    originCountry: "ES",
    package: {
      amount: 1000,
      unit: "g"
    },
    price: {
      amount: 7.9,
      currency: "CHF"
    },
    capabilities: [],
    scores: {
      price: 0.84,
      swiss: 0,
      sustainability: 0.86
    },
    dietaryCapabilities: [
      "vegan",
      "vegetarian",
      "halal",
      "gluten-free",
      "lactose-free",
      "nut-free"
    ]
  }
];

upsertMany("eventTemplates", eventTemplates);
upsertMany("meals", meals);
upsertMany("products", products);
upsertMany("planningPriorities", planningPriorities);
upsertMany("dietaryConstraints", dietaryConstraints);
upsertMany("mealCategories", mealCategories);

print("------------------------------------------------");
print("Catering planner seed completed.");
print(
    `Templates: ${eventTemplates.length}, ` +
    `Meals: ${meals.length}, ` +
    `Products: ${products.length}, ` +
    `Priorities: ${planningPriorities.length}, ` +
    `Dietary options: ${dietaryConstraints.length}, ` +
    `Categories: ${mealCategories.length}`
);
