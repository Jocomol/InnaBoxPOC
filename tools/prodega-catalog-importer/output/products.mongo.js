db = db.getSiblingDB("catering");

const importedProducts = [
  {
    "id": "prodega-p-mock-1001",
    "sku": "7610001001",
    "name": "Swiss Mozzarella 1 kg",
    "concept": "mozzarella",
    "originCountry": "CH",
    "package": {
      "amount": 1000,
      "unit": "g"
    },
    "price": {
      "amount": 9.8,
      "currency": "CHF"
    },
    "capabilities": [],
    "dietaryCapabilities": [
      "gluten-free",
      "nut-free",
      "vegetarian"
    ],
    "scores": {
      "price": 0.84,
      "swiss": 1,
      "presentation": 0.65,
      "prepEase": 0.85,
      "sustainability": 0.8
    },
    "externalReferences": {
      "provider": "prodega-mock",
      "productId": "P-MOCK-1001"
    }
  },
  {
    "id": "prodega-p-mock-1002",
    "sku": "7610001002",
    "name": "Falafel 50 pieces",
    "concept": "falafel",
    "originCountry": "NL",
    "package": {
      "amount": 50,
      "unit": "piece"
    },
    "price": {
      "amount": 21.5,
      "currency": "CHF"
    },
    "capabilities": [
      "finger-food",
      "ready-to-heat"
    ],
    "dietaryCapabilities": [
      "halal",
      "lactose-free",
      "nut-free",
      "vegan",
      "vegetarian"
    ],
    "scores": {
      "price": 0.64,
      "swiss": 0,
      "presentation": 0.85,
      "prepEase": 0.9,
      "sustainability": 0.95
    },
    "externalReferences": {
      "provider": "prodega-mock",
      "productId": "P-MOCK-1002"
    }
  },
  {
    "id": "prodega-p-mock-1003",
    "sku": "7610001003",
    "name": "Swiss Apple Juice 6 L",
    "concept": "apple-juice",
    "originCountry": "CH",
    "package": {
      "amount": 6,
      "unit": "liter"
    },
    "price": {
      "amount": 14.9,
      "currency": "CHF"
    },
    "capabilities": [
      "juice",
      "non-alcoholic-drink",
      "ready-to-serve"
    ],
    "dietaryCapabilities": [
      "gluten-free",
      "lactose-free",
      "nut-free",
      "vegan",
      "vegetarian"
    ],
    "scores": {
      "price": 0.75,
      "swiss": 1,
      "presentation": 0.65,
      "prepEase": 1,
      "sustainability": 0.95
    },
    "externalReferences": {
      "provider": "prodega-mock",
      "productId": "P-MOCK-1003"
    }
  },
  {
    "id": "prodega-p-mock-1004",
    "sku": "7610001004",
    "name": "Certified Halal Chicken Skewers 40 pieces",
    "concept": "halal-chicken-skewer",
    "originCountry": "FR",
    "package": {
      "amount": 40,
      "unit": "piece"
    },
    "price": {
      "amount": 34.9,
      "currency": "CHF"
    },
    "capabilities": [
      "finger-food",
      "ready-to-heat"
    ],
    "dietaryCapabilities": [
      "gluten-free",
      "halal",
      "lactose-free",
      "nut-free"
    ],
    "scores": {
      "price": 0.42,
      "swiss": 0,
      "presentation": 0.85,
      "prepEase": 0.9,
      "sustainability": 0.65
    },
    "externalReferences": {
      "provider": "prodega-mock",
      "productId": "P-MOCK-1004"
    }
  },
  {
    "id": "prodega-p-mock-1005",
    "sku": "7610001005",
    "name": "Swiss Mineral Water 6 x 1.5 L",
    "concept": "water",
    "originCountry": "CH",
    "package": {
      "amount": 9,
      "unit": "liter"
    },
    "price": {
      "amount": 8.9,
      "currency": "CHF"
    },
    "capabilities": [
      "non-alcoholic-drink",
      "ready-to-serve",
      "water"
    ],
    "dietaryCapabilities": [
      "gluten-free",
      "halal",
      "lactose-free",
      "nut-free",
      "vegan",
      "vegetarian"
    ],
    "scores": {
      "price": 0.85,
      "swiss": 1,
      "presentation": 0.65,
      "prepEase": 1,
      "sustainability": 0.8
    },
    "externalReferences": {
      "provider": "prodega-mock",
      "productId": "P-MOCK-1005"
    }
  }
];

for (const product of importedProducts) {
  db.products.replaceOne({ id: product.id }, product, { upsert: true });
}

print(`Imported ${importedProducts.length} mock Prodega products into catering.products`);
