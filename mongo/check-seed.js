db = db.getSiblingDB("catering");

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

if (templateCount < 6 || mealCount < 19 || productCount < 17 || priorityCount < 5) {
  throw new Error("Seed catalog is incomplete; expected at least 6 templates, 19 meals, 17 products, and 5 planning priorities.");
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
  throw new Error(`Score or weight keys without planning-priority metadata: ${undefinedPriorityReferences.join(", ")}`);
}

const missingTemplates = expectedTemplateIds.filter(id => !db.eventTemplates.findOne({ id }));
if (missingTemplates.length > 0) {
  throw new Error(`Missing templates: ${missingTemplates.join(", ")}`);
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
  throw new Error(`Requirements without candidates: ${unresolvedRequirements.join(", ")}`);
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
  throw new Error(`Ingredients without products: ${missingIngredientConcepts.join(", ")}`);
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
  throw new Error(`Invalid Swiss scores: ${invalidSwissScores.join(", ")}`);
}

print("");
print("Available templates:");
db.eventTemplates.find({}, { id: 1, name: 1 }).sort({ id: 1 }).forEach(template => {
  print(` - ${template.name} (${template.id})`);
});

print("");
print("All requirements, ingredients, and priority metadata resolve; Swiss scores match origin data.");
