package ch.inabox.catering.model

import io.swagger.v3.oas.annotations.media.Schema

@Schema(description = "A numeric quantity and its canonical display unit.")
data class Quantity(
    @field:Schema(description = "Quantity rounded to at most three decimal places.", example = "200")
    val amount: Double,
    @field:Schema(description = "Canonical unit used for this quantity.", example = "piece")
    val unit: String,
)

@Schema(description = "Dietary metadata corresponding to an effective request share. Unknown ad-hoc share keys have no metadata entry here.")
data class AppliedDietaryConstraint(
    @field:Schema(description = "Stable dietary constraint ID.", example = "gluten-free")
    val id: String,
    @field:Schema(example = "Gluten-free")
    val label: String,
    @field:Schema(description = "Catalog explanation of the dietary allocation option.")
    val description: String,
)

@Schema(description = "Resolved request context and the effective planning inputs used to build the response.")
data class EventSummary(
    @field:Schema(example = "business-apero")
    val templateId: String,
    @field:Schema(example = "Business Apéro")
    val templateName: String,
    @field:Schema(example = "40")
    val guestCount: Int,
    @field:Schema(description = "Requested food servings per guest, or null when template quantities were retained.", example = "4")
    val servingsPerGuest: Int?,
    @field:Schema(description = "Guaranteed meal IDs from the request.", example = "[\"mini-spinach-quiche\"]")
    val requiredMealIds: Set<String>,
    @field:Schema(description = "Catalog dietary definitions corresponding to keys in the effective `dietaryShares` map.")
    val selectedConstraints: List<AppliedDietaryConstraint>,
    val budget: Money,
    @field:Schema(
        description = "Final merged and normalized weights used to score candidates.",
        example = "{\"price\":0.3,\"swiss\":0.25,\"presentation\":0.2,\"prepEase\":0.15,\"sustainability\":0.1}",
    )
    val appliedWeights: Map<String, Double>,
    val preferences: CustomerPreferences,
    val hardConstraints: HardConstraints,
    @field:Schema(
        description = "Effective desired number of distinct dishes after applying the request override or template default. Null means neither supplied a value.",
        example = "3",
        minimum = "1",
    )
    val mealCount: Int? = null,
    @field:Schema(
        description = "Effective dietary share map after compatibility-field precedence, key trimming, lower-casing, and duplicate-key consolidation.",
        example = "{\"vegetarian\":0.2,\"halal\":0.3}",
    )
    val dietaryShares: Map<String, Double> = emptyMap(),
    @field:Schema(
        description = "Normalized meal IDs excluded from automatic selection for this plan.",
        example = "[\"falafel-bites\"]",
    )
    val excludedMealIds: Set<String> = emptySet(),
)

@Schema(description = "Meal selected for one template or guaranteed-meal requirement.")
data class SelectedMeal(
    @field:Schema(description = "Requirement satisfied by this selection.", example = "savory-finger-food")
    val requirementId: String,
    @field:Schema(example = "mini-spinach-quiche")
    val mealId: String,
    @field:Schema(example = "Mini Spinach Quiche")
    val name: String,
    @field:Schema(description = "Number of meal servings planned.", example = "80")
    val servings: Int,
    val targetQuantity: Quantity,
    @field:Schema(description = "Mandatory capabilities shared by the requirement and selected meal.")
    val matchedCapabilities: Set<String>,
    @field:Schema(description = "Soft preferred capabilities present on the selected meal.")
    val preferenceMatches: Set<String>,
    @field:Schema(description = "Raw candidate scores for every effective weighted priority.")
    val scoreComponents: Map<String, Double>,
    @field:Schema(description = "Normalized weighted score used to rank valid candidates.", example = "0.7625", minimum = "0", maximum = "1")
    val finalWeightedScore: Double,
    @field:Schema(description = "True when the dish was explicitly requested through `requiredMealIds`.", example = "false")
    val guaranteed: Boolean = false,
    @field:Schema(
        description = "Requested positive dietary-share keys supported by this meal. This is explanatory; serving coverage is evaluated across the complete allocation.",
        example = "[\"vegetarian\",\"gluten-free\"]",
    )
    val matchedDietaryCapabilities: Set<String> = emptySet(),
)

@Schema(
    description = "Compatibility shape for historical per-meal dietary conflicts. Current planning reports aggregate dietary shortfalls as warnings or a 422 response, so this list is normally empty.",
    deprecated = true,
)
data class ConstraintConflict(
    @field:Schema(example = "mini-spinach-quiche")
    val mealId: String,
    @field:Schema(example = "Mini Spinach Quiche")
    val mealName: String,
    @field:Schema(example = "vegan")
    val constraintId: String,
    @field:Schema(example = "Vegan")
    val constraintLabel: String,
    val guaranteed: Boolean,
    val missingRequiredCapabilities: Set<String> = emptySet(),
    val excludedCapabilities: Set<String> = emptySet(),
    val excludedConcepts: Set<String> = emptySet(),
)

@Schema(description = "Trace record explaining whether and how a template requirement was fulfilled.")
data class FulfilledRequirement(
    @field:Schema(example = "savory-finger-food")
    val requirementId: String,
    @field:Schema(example = "meal", allowableValues = ["meal", "product"])
    val type: String,
    val required: Boolean,
    val requiredCapabilities: Set<String>,
    val matchedCapabilities: Set<String>,
    val targetQuantity: Quantity,
    @field:Schema(description = "Selected meal or product ID. Absent for an unfulfilled optional requirement.")
    val selectedCandidateId: String? = null,
    @field:Schema(description = "Selected meal or product name. Absent for an unfulfilled optional requirement.")
    val selectedCandidateName: String? = null,
    val fulfilled: Boolean,
)

@Schema(description = "Aggregated ingredient need produced by all selected meals using the same concept and unit dimension.")
data class IngredientRequirement(
    @field:Schema(example = "mozzarella")
    val concept: String,
    val requiredQuantity: Quantity,
    @field:Schema(description = "Meals that contributed to this ingredient total.")
    val sourceMealIds: Set<String>,
)

@Schema(description = "Package-level purchase calculation for a selected catalog product.")
data class ShoppingItem(
    @field:Schema(example = "spinach-quiche-20")
    val productId: String,
    @field:Schema(example = "MOCK-004")
    val sku: String,
    @field:Schema(example = "Swiss Mini Spinach Quiche 20 pcs")
    val name: String,
    @field:Schema(example = "mini-spinach-quiche")
    val concept: String,
    @field:Schema(description = "ISO 3166-1 alpha-2 origin country when known.", example = "CH")
    val originCountry: String?,
    val packageSize: Quantity,
    @field:Schema(description = "Whole packages to buy after inventory is consumed.", example = "6")
    val packageCount: Int,
    @field:Schema(description = "Total quantity needed before existing inventory is applied.")
    val requiredQuantity: Quantity,
    @field:Schema(description = "Matching, dimensionally compatible inventory consumed by this line.")
    val inventoryUsed: Quantity,
    @field:Schema(description = "Quantity still needed after inventory is consumed.")
    val netRequiredQuantity: Quantity,
    @field:Schema(description = "Total quantity contained in the whole packages purchased.")
    val purchasedQuantity: Quantity,
    @field:Schema(description = "Purchased quantity above the net requirement due to whole-package rounding.")
    val overbuyQuantity: Quantity,
    val unitPrice: Money,
    val lineTotal: Money,
    @field:Schema(description = "Raw product scores for every effective weighted priority.")
    val scoreComponents: Map<String, Double>,
    @field:Schema(description = "Normalized weighted score used to choose this product.", minimum = "0", maximum = "1")
    val finalWeightedScore: Double,
)

@Schema(description = "Existing stock usage or remainder for one product concept.")
data class InventoryUsage(
    @field:Schema(example = "mini-spinach-quiche")
    val concept: String,
    val quantity: Quantity,
)

@Schema(description = "Cost and budget comparison for the resolved shopping list.")
data class PlanTotals(
    val totalCost: Money,
    val costPerGuest: Money,
    @field:Schema(description = "Budget minus total cost. A negative value is an overrun.")
    val budgetDifference: Money,
    @field:Schema(example = "UNDER_BUDGET", allowableValues = ["UNDER_BUDGET", "ON_BUDGET", "OVER_BUDGET"])
    val budgetStatus: String,
)

@Schema(description = "Explainable result of resolving one event against the current catalog.")
data class ShoppingPlan(
    val event: EventSummary,
    val selectedMeals: List<SelectedMeal>,
    @field:Schema(
        description = "Deprecated per-meal conflict list retained for response compatibility. Aggregate dietary shortfalls are exposed through `warnings` or HTTP 422.",
        deprecated = true,
    )
    val constraintConflicts: List<ConstraintConflict>,
    val fulfilledRequirements: List<FulfilledRequirement>,
    val ingredientRequirements: List<IngredientRequirement>,
    val shoppingItems: List<ShoppingItem>,
    @field:Schema(description = "Existing inventory quantities consumed by shopping lines.")
    val usedExistingInventory: List<InventoryUsage>,
    @field:Schema(description = "Inventory quantities left after all matching requirements are processed.")
    val unusedExistingInventory: List<InventoryUsage>,
    val totals: PlanTotals,
    @field:Schema(description = "Non-fatal issues such as an optional unmet requirement, a snack-style dietary shortfall, an unavailable desired dish count, or a budget overrun.")
    val warnings: List<String>,
)
