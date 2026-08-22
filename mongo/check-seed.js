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

const templateCount = db.eventTemplates.countDocuments();
const mealCount = db.meals.countDocuments();
const productCount = db.products.countDocuments();
const priorityCount = db.planningPriorities.countDocuments();

print(`Templates: ${templateCount}`);
print(`Meals:     ${mealCount}`);
print(`Products:  ${productCount}`);
print(`Priorities:${priorityCount.toString().padStart(3, " ")}`);

if (templateCount !== 6 || mealCount !== 21 || productCount !== 20 || priorityCount !== 5) {
  failSeed("Unexpected seed size; expected exactly 6 templates, 21 meals, 20 products, and 5 planning priorities.");
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
  if (!document || !(document.capabilities || []).includes("halal")) invalidHalalDocuments.push(id);
}
if (invalidHalalDocuments.length > 0) {
  failSeed(`Missing or incorrectly tagged halal seed documents: ${invalidHalalDocuments.join(", ")}`);
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
print("All template defaults, requirements, ingredients, priority metadata, Swiss scores, halal fixtures, and water alternatives are valid.");
