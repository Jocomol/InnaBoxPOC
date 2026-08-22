package ch.inabox.catering.model

data class Quantity(
    val amount: Double,
    val unit: String,
)

data class AppliedDietaryConstraint(
    val id: String,
    val label: String,
    val description: String,
)

data class EventSummary(
    val templateId: String,
    val templateName: String,
    val guestCount: Int,
    val servingsPerGuest: Int?,
    val requiredMealIds: Set<String>,
    val selectedConstraints: List<AppliedDietaryConstraint>,
    val budget: Money,
    val appliedWeights: Map<String, Double>,
    val preferences: CustomerPreferences,
    val hardConstraints: HardConstraints,
    val mealCount: Int? = null,
    val dietaryShares: Map<String, Double> = emptyMap(),
)

data class SelectedMeal(
    val requirementId: String,
    val mealId: String,
    val name: String,
    val servings: Int,
    val targetQuantity: Quantity,
    val matchedCapabilities: Set<String>,
    val preferenceMatches: Set<String>,
    val scoreComponents: Map<String, Double>,
    val finalWeightedScore: Double,
    val guaranteed: Boolean = false,
    val matchedDietaryCapabilities: Set<String> = emptySet(),
)

data class ConstraintConflict(
    val mealId: String,
    val mealName: String,
    val constraintId: String,
    val constraintLabel: String,
    val guaranteed: Boolean,
    val missingRequiredCapabilities: Set<String> = emptySet(),
    val excludedCapabilities: Set<String> = emptySet(),
    val excludedConcepts: Set<String> = emptySet(),
)

data class FulfilledRequirement(
    val requirementId: String,
    val type: String,
    val required: Boolean,
    val requiredCapabilities: Set<String>,
    val matchedCapabilities: Set<String>,
    val targetQuantity: Quantity,
    val selectedCandidateId: String? = null,
    val selectedCandidateName: String? = null,
    val fulfilled: Boolean,
)

data class IngredientRequirement(
    val concept: String,
    val requiredQuantity: Quantity,
    val sourceMealIds: Set<String>,
)

data class ShoppingItem(
    val productId: String,
    val sku: String,
    val name: String,
    val concept: String,
    val originCountry: String?,
    val packageSize: Quantity,
    val packageCount: Int,
    val requiredQuantity: Quantity,
    val inventoryUsed: Quantity,
    val netRequiredQuantity: Quantity,
    val purchasedQuantity: Quantity,
    val overbuyQuantity: Quantity,
    val unitPrice: Money,
    val lineTotal: Money,
    val scoreComponents: Map<String, Double>,
    val finalWeightedScore: Double,
)

data class InventoryUsage(
    val concept: String,
    val quantity: Quantity,
)

data class PlanTotals(
    val totalCost: Money,
    val costPerGuest: Money,
    val budgetDifference: Money,
    val budgetStatus: String,
)

data class ShoppingPlan(
    val event: EventSummary,
    val selectedMeals: List<SelectedMeal>,
    val constraintConflicts: List<ConstraintConflict>,
    val fulfilledRequirements: List<FulfilledRequirement>,
    val ingredientRequirements: List<IngredientRequirement>,
    val shoppingItems: List<ShoppingItem>,
    val usedExistingInventory: List<InventoryUsage>,
    val unusedExistingInventory: List<InventoryUsage>,
    val totals: PlanTotals,
    val warnings: List<String>,
)
