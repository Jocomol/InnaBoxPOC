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

print(`Templates: ${templateCount}`);
print(`Meals:     ${mealCount}`);
print(`Products:  ${productCount}`);

if (templateCount < 6 || mealCount < 19 || productCount < 17) {
  throw new Error("Seed catalog is incomplete; expected at least 6 templates, 19 meals, and 17 products.");
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

print("");
print("Available templates:");
db.eventTemplates.find({}, { id: 1, name: 1 }).sort({ id: 1 }).forEach(template => {
  print(` - ${template.name} (${template.id})`);
});

print("");
print("All required capabilities and ingredient concepts are resolvable.");
