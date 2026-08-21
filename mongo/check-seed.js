db = db.getSiblingDB("catering");

print("Templates: " + db.eventTemplates.countDocuments());
print("Meals:     " + db.meals.countDocuments());
print("Products:  " + db.products.countDocuments());

print("");
print("Vegetarian apéro meals:");
db.meals.find({
  capabilities: { $all: ["vegetarian", "finger-food", "apero"] }
}).forEach(meal => print(" - " + meal.name));

print("");
print("Products providing mozzarella:");
db.products.find({ concept: "mozzarella" }).forEach(product => {
  print(` - ${product.name}: CHF ${product.price.amount}`);
});
