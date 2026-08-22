db = db.getSiblingDB("catering");

function failSeed(message) {
  print(`SEED CHECK FAILED: ${message}`);
  quit(1);
}

const expectedTemplateIds = [
  "business-apero",
  "brunch",
  "coffee-break",
  "team-lunch-buffet",
  "vegan-reception",
  "swiss-breakfast"
];

const expectedDietaryConstraintIds = [
  "vegetarian",
  "vegan",
  "halal",
  "gluten-free",
  "lactose-free",
  "nut-free"
];

const templateCount = db.eventTemplates.countDocuments();
const mealCount = db.meals.countDocuments();
const productCount = db.products.countDocuments();
const priorityCount = db.planningPriorities.countDocuments();
const constraintCount = db.dietaryConstraints.countDocuments();
const categoryCount = db.mealCategories.countDocuments();

print(`Templates:   ${templateCount}`);
print(`Meals:       ${mealCount}`);
print(`Products:    ${productCount}`);
print(`Priorities:  ${priorityCount}`);
print(`Constraints: ${constraintCount}`);
print(`Categories:  ${categoryCount}`);

if (templateCount !== 6 || mealCount !== 27 || productCount !== 30 || priorityCount !== 5 || constraintCount !== 6 || categoryCount !== 7) {
  failSeed("Unexpected seed size; expected exactly 6 templates, 27 meals, 30 products, 5 planning priorities, 6 dietary constraints, and 7 meal categories.");
}

const definedPriorityIds = new Set(db.planningPriorities.find({}, { id: 1 }).toArray().map(priority => priority.id));
const undefinedPriorityReferences = [];

db.eventTemplates.find().forEach(template => {
  Object.keys(template.weights || {}).forEach(priorityId => {
    if (!definedPriorityIds.has(priorityId)) undefinedPriorityReferences.push(`eventTemplates/${template.id}/${priorityId}`);
  });
});

["meals", "products"].forEach(collectionName => {
  db.getCollection(collectionName).find().forEach(document => {
    Object.keys(document.scores || {}).forEach(priorityId => {
      if (!definedPriorityIds.has(priorityId)) undefinedPriorityReferences.push(`${collectionName}/${document.id}/${priorityId}`);
    });
  });
});

if (undefinedPriorityReferences.length > 0) {
  failSeed(`Score or weight keys without planning-priority metadata: ${undefinedPriorityReferences.join(", ")}`);
}

const definedCategoryIds = new Set(db.mealCategories.find({}, { id: 1 }).toArray().map(category => category.id));
const undefinedCategoryReferences = [];
db.meals.find().forEach(meal => {
  (meal.categoryIds || []).forEach(categoryId => {
    if (!definedCategoryIds.has(categoryId)) undefinedCategoryReferences.push(`meals/${meal.id}/${categoryId}`);
  });
});
if (undefinedCategoryReferences.length > 0) {
  throw new Error(`Meal category IDs without category metadata: ${undefinedCategoryReferences.join(", ")}`);
}

const invalidConstraints = [];
db.dietaryConstraints.find().forEach(constraint => {
  const dietaryCapability = (constraint.dietaryCapability || "").trim();
  const ruleCount = (constraint.requiredCapabilities || []).length +
    (constraint.excludedCapabilities || []).length +
    (constraint.excludedConcepts || []).length;
  if (!constraint.id || !constraint.label || !dietaryCapability || ruleCount === 0) {
    invalidConstraints.push(constraint.id || "<missing-id>");
  }
  if (dietaryCapability && !db.meals.findOne({ dietaryCapabilities: dietaryCapability })) {
    invalidConstraints.push(`${constraint.id || "<missing-id>"}/missing-meal-tag:${dietaryCapability}`);
  }
});
if (invalidConstraints.length > 0) {
  throw new Error(`Dietary constraints without usable metadata/rules: ${invalidConstraints.join(", ")}`);
}

const missingDietaryConstraints = expectedDietaryConstraintIds.filter(id => !db.dietaryConstraints.findOne({ id }));
if (missingDietaryConstraints.length > 0) {
  failSeed(`Missing dietary constraints: ${missingDietaryConstraints.join(", ")}`);
}

const missingTemplates = expectedTemplateIds.filter(id => !db.eventTemplates.findOne({ id }));
if (missingTemplates.length > 0) {
  failSeed(`Missing templates: ${missingTemplates.join(", ")}`);
}

const invalidTemplateDefaults = [];
const templateDietaryShares = [];
db.eventTemplates.find().forEach(template => {
  const configuredMealCount = template.defaults?.mealCount;
  if (!Number.isInteger(configuredMealCount) || configuredMealCount <= 0) {
    invalidTemplateDefaults.push(`${template.id}=${configuredMealCount}`);
  }
  if (Object.prototype.hasOwnProperty.call(template.defaults || {}, "vegetarianShare")) {
    templateDietaryShares.push(`${template.id}/defaults.vegetarianShare`);
  }
  (template.requirements || []).forEach(requirement => {
    if (requirement.target?.share !== undefined && requirement.target?.share !== null) {
      templateDietaryShares.push(`${template.id}/${requirement.id}/target.share`);
    }
  });
});

if (invalidTemplateDefaults.length > 0) {
  failSeed(`Templates with invalid defaults.mealCount: ${invalidTemplateDefaults.join(", ")}`);
}

if (templateDietaryShares.length > 0) {
  failSeed(`Dietary shares must not be stored in templates: ${templateDietaryShares.join(", ")}`);
}

const dietaryCapabilityNames = new Set(
  db.dietaryConstraints.find({}, { dietaryCapability: 1 }).toArray().map(constraint => constraint.dietaryCapability)
);
const mixedCatalogCapabilities = [];
const unknownDietaryCapabilities = [];
["meals", "products"].forEach(collectionName => {
  db.getCollection(collectionName).find().forEach(document => {
    if (!Array.isArray(document.dietaryCapabilities)) {
      mixedCatalogCapabilities.push(`${collectionName}/${document.id}/missing-dietaryCapabilities`);
    }
    (document.capabilities || []).forEach(capability => {
      if (dietaryCapabilityNames.has(capability)) {
        mixedCatalogCapabilities.push(`${collectionName}/${document.id}/capabilities.${capability}`);
      }
    });
    (document.dietaryCapabilities || []).forEach(capability => {
      if (!dietaryCapabilityNames.has(capability)) {
        unknownDietaryCapabilities.push(`${collectionName}/${document.id}/dietaryCapabilities.${capability}`);
      }
    });
  });
});
db.eventTemplates.find().forEach(template => {
  (template.requirements || []).filter(requirement => requirement.type === "meal").forEach(requirement => {
    (requirement.requiredCapabilities || []).forEach(capability => {
      if (dietaryCapabilityNames.has(capability)) {
        mixedCatalogCapabilities.push(`eventTemplates/${template.id}/${requirement.id}/requiredCapabilities.${capability}`);
      }
    });
  });
});
if (mixedCatalogCapabilities.length > 0) {
  failSeed(`Dietary capabilities leaked into event/menu or product-function capabilities: ${mixedCatalogCapabilities.join(", ")}`);
}
if (unknownDietaryCapabilities.length > 0) {
  failSeed(`Dietary capabilities without constraint metadata: ${unknownDietaryCapabilities.join(", ")}`);
}

const unresolvedRequirements = [];
db.eventTemplates.find().forEach(template => {
  template.requirements.filter(requirement => requirement.required).forEach(requirement => {
    const collection = requirement.type === "meal" ? db.meals : db.products;
    const candidateCount = collection.countDocuments({
      capabilities: { $all: requirement.requiredCapabilities }
    });
    if (candidateCount === 0) {
      unresolvedRequirements.push(`${template.id}/${requirement.id}`);
    }
  });
});

if (unresolvedRequirements.length > 0) {
  failSeed(`Requirements without candidates: ${unresolvedRequirements.join(", ")}`);
}

const missingIngredientConcepts = [];
db.meals.find().forEach(meal => {
  meal.ingredients.forEach(ingredient => {
    if (!db.products.findOne({ concept: ingredient.concept })) {
      missingIngredientConcepts.push(`${meal.id}/${ingredient.concept}`);
    }
  });
});

if (missingIngredientConcepts.length > 0) {
  failSeed(`Ingredients without products: ${missingIngredientConcepts.join(", ")}`);
}

const invalidSwissScores = [];
["meals", "products"].forEach(collectionName => {
  db.getCollection(collectionName).find({ "scores.swiss": { $nin: [0, 1] } }).forEach(document => {
    invalidSwissScores.push(`${collectionName}/${document.id}=${document.scores.swiss}`);
  });
});

db.products.find().forEach(product => {
  const expectedSwissScore = product.originCountry === "CH" ? 1 : 0;
  if (product.scores.swiss !== expectedSwissScore) {
    invalidSwissScores.push(`products/${product.id}: expected ${expectedSwissScore} for origin ${product.originCountry}`);
  }
});

db.meals.find().forEach(meal => {
  const allIngredientsSwiss = meal.ingredients.every(ingredient => {
    const product = db.products.findOne({ concept: ingredient.concept });
    return product?.originCountry === "CH";
  });
  const expectedSwissScore = allIngredientsSwiss ? 1 : 0;
  if (meal.scores.swiss !== expectedSwissScore) {
    invalidSwissScores.push(`meals/${meal.id}: expected ${expectedSwissScore} from ingredient origins`);
  }
});

if (invalidSwissScores.length > 0) {
  failSeed(`Invalid Swiss scores: ${invalidSwissScores.join(", ")}`);
}

const requiredHalalDocuments = [
  [db.meals, "halal-chicken-skewers"],
  [db.meals, "halal-chicken-rice-bowl"],
  [db.products, "halal-chicken-skewers-40"],
  [db.products, "halal-chicken-rice-bowls-10"]
];
const invalidHalalDocuments = [];
for (const fixture of requiredHalalDocuments) {
  const collection = fixture[0];
  const id = fixture[1];
  const document = collection.findOne({ id: id });
  if (!document || !(document.dietaryCapabilities || []).includes("halal")) invalidHalalDocuments.push(id);
}
if (invalidHalalDocuments.length > 0) {
  failSeed(`Missing or incorrectly tagged halal seed documents: ${invalidHalalDocuments.join(", ")}`);
}

const glutenFreeMeal = db.meals.findOne({ id: "gluten-free-tomato-frittata" });
if (!glutenFreeMeal || !(glutenFreeMeal.dietaryCapabilities || []).includes("gluten-free")) {
  failSeed("Missing or incorrectly tagged gluten-free-tomato-frittata meal.");
}
if ((glutenFreeMeal.capabilities || []).includes("gluten-free")) {
  failSeed("Gluten-free dietary capability leaked into gluten-free-tomato-frittata event capabilities.");
}

const glutenFreeIngredientProducts = ["mozzarella-1kg", "cherry-tomatoes-500g", "basil-100g", "eggs-30"];
const invalidGlutenFreeProducts = glutenFreeIngredientProducts.filter(id => {
  const product = db.products.findOne({ id });
  return !product || !(product.dietaryCapabilities || []).includes("gluten-free");
});
if (invalidGlutenFreeProducts.length > 0) {
  failSeed(`Missing or incorrectly tagged gluten-free ingredient products: ${invalidGlutenFreeProducts.join(", ")}`);
}

const expandedDietaryFixtures = [
  { collectionName: "meals", id: "lentil-quinoa-bowl", capabilities: expectedDietaryConstraintIds },
  { collectionName: "meals", id: "lactose-free-bircher", capabilities: ["lactose-free", "nut-free"] },
  { collectionName: "meals", id: "gluten-free-brownie-bites", capabilities: ["gluten-free"] },
  { collectionName: "meals", id: "smoked-salmon-cucumber-bites", capabilities: ["gluten-free", "lactose-free", "nut-free"] },
  { collectionName: "meals", id: "vegetable-rice-paper-rolls", capabilities: expectedDietaryConstraintIds },
  { collectionName: "products", id: "lactose-free-yogurt-1kg", capabilities: ["gluten-free", "lactose-free", "nut-free"] },
  { collectionName: "products", id: "rice-paper-rolls-30", capabilities: expectedDietaryConstraintIds }
];
const invalidExpandedDietaryFixtures = [];
expandedDietaryFixtures.forEach(fixture => {
  const document = db.getCollection(fixture.collectionName).findOne({ id: fixture.id });
  const missingCapabilities = fixture.capabilities.filter(capability =>
    !(document?.dietaryCapabilities || []).includes(capability)
  );
  if (!document || missingCapabilities.length > 0) {
    invalidExpandedDietaryFixtures.push(
      `${fixture.collectionName}/${fixture.id}${missingCapabilities.length > 0 ? `/missing:${missingCapabilities.join("+")}` : ""}`
    );
  }
});
if (invalidExpandedDietaryFixtures.length > 0) {
  failSeed(`Missing or incorrectly tagged expanded dietary fixtures: ${invalidExpandedDietaryFixtures.join(", ")}`);
}

const missingWaterAlternatives = [];
for (const id of ["mineral-water-6x15", "budget-water-12l"]) {
  const product = db.products.findOne({ id: id });
  const capabilities = product?.capabilities || [];
  if (!product || product.concept !== "water" || !capabilities.includes("water") || !capabilities.includes("non-alcoholic-drink")) {
    missingWaterAlternatives.push(id);
  }
}
if (missingWaterAlternatives.length > 0) {
  failSeed(`Missing water weighting alternatives: ${missingWaterAlternatives.join(", ")}`);
}

print("");
print("Available templates:");
db.eventTemplates.find({}, { id: 1, name: 1 }).sort({ id: 1 }).forEach(template => {
  print(` - ${template.name} (${template.id})`);
});

print("");
print("Dietary constraints:");
db.dietaryConstraints.find({}, { id: 1, label: 1 }).sort({ displayOrder: 1 }).forEach(constraint => {
  print(` - ${constraint.label} (${constraint.id})`);
});

print("");
print("Meal categories:");
db.mealCategories.find({}, { id: 1, label: 1 }).sort({ displayOrder: 1 }).forEach(category => {
  print(` - ${category.label} (${category.id})`);
});

print("");
print("All template defaults, event/dietary capability boundaries, requirements, ingredients, priority metadata, constraints, categories, Swiss scores, dietary fixtures, and water alternatives are valid.");
