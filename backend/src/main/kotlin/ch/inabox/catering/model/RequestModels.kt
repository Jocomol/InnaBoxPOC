package ch.inabox.catering.model

import io.swagger.v3.oas.annotations.media.Schema
import jakarta.validation.Valid
import jakarta.validation.constraints.DecimalMax
import jakarta.validation.constraints.DecimalMin
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Positive
import jakarta.validation.constraints.PositiveOrZero

@Schema(description = "Soft customer preferences used as scoring tie-breakers or template-share overrides.")
data class CustomerPreferences(
    @field:DecimalMin("0.0")
    @field:DecimalMax("1.0")
    @field:Schema(
        description = "Preferred vegetarian share for template requirements that define a vegetarian share. Null keeps the template value.",
        example = "0.3",
        minimum = "0",
        maximum = "1",
        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
    )
    val vegetarianShare: Double? = null,
    @field:Schema(
        description = "Capabilities that are preferred but not mandatory. Matching candidates win score ties.",
        example = "[\"prepare-ahead\"]",
        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
    )
    val preferredCapabilities: Set<String> = emptySet(),
)

@Schema(description = "Existing stock that can reduce the quantity purchased for a matching product concept.")
data class InventoryItem(
    @field:NotBlank
    @field:Schema(
        description = "Catalog product concept to match, case-insensitively.",
        example = "mini-spinach-quiche",
        requiredMode = Schema.RequiredMode.REQUIRED,
    )
    val concept: String,
    @field:Positive
    @field:Schema(
        description = "Available quantity. Must be greater than zero.",
        example = "40",
        exclusiveMinimum = true,
        minimum = "0",
        requiredMode = Schema.RequiredMode.REQUIRED,
    )
    val amount: Double,
    @field:NotBlank
    @field:Schema(
        description = "Quantity unit. Common mass, volume, count, cup, bottle, and serving aliases are normalized; custom units match only the same custom unit.",
        example = "piece",
        requiredMode = Schema.RequiredMode.REQUIRED,
    )
    val unit: String,
)

@Schema(description = "Mandatory filters. Capability and concept values are trimmed and compared case-insensitively.")
data class HardConstraints(
    @field:Schema(
        description = "Every selected meal must contain all of these capabilities.",
        example = "[\"vegan\"]",
        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
    )
    val requiredCapabilities: Set<String> = emptySet(),
    @field:Schema(
        description = "Meals and products containing any of these capabilities are rejected.",
        example = "[\"warm\"]",
        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
    )
    val excludedCapabilities: Set<String> = emptySet(),
    @field:Schema(
        description = "Ingredient or product concepts that must not appear in a resolvable plan.",
        example = "[\"peanut\"]",
        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
    )
    val excludedConcepts: Set<String> = emptySet(),
)

@Schema(description = "Inputs for deterministic plan resolution.")
data class ResolvePlanRequest(
    @field:NotBlank
    @field:Schema(
        description = "ID of an event template returned by `GET /api/templates`.",
        example = "business-apero",
        requiredMode = Schema.RequiredMode.REQUIRED,
    )
    val templateId: String,
    @field:Min(1)
    @field:Max(10_000)
    @field:Schema(
        description = "Number of event guests.",
        example = "40",
        minimum = "1",
        maximum = "10000",
        requiredMode = Schema.RequiredMode.REQUIRED,
    )
    val guestCount: Int,
    @field:PositiveOrZero
    @field:Schema(
        description = "Planning budget in CHF. The budget is reported against the result; exceeding it does not make a plan unresolvable.",
        example = "800",
        minimum = "0",
        requiredMode = Schema.RequiredMode.REQUIRED,
    )
    val budget: Double,
    @field:Min(1)
    @field:Max(10)
    @field:Schema(
        description = "Optional total food servings per guest. When present, meal quantities are proportionally rescaled while drinks and supplies remain unchanged.",
        example = "4",
        minimum = "1",
        maximum = "10",
        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
    )
    val servingsPerGuest: Int? = null,
    @field:Schema(
        description = "Meal IDs that must appear in the menu, matched case-insensitively. A compatible meal occupies a template slot; otherwise it is added as another dish.",
        example = "[\"mini-spinach-quiche\"]",
        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
    )
    val requiredMealIds: Set<String> = emptySet(),
    val selectedConstraintIds: Set<String> = emptySet(),
    @field:Valid val preferences: CustomerPreferences = CustomerPreferences(),
    val weights: Map<String, Double> = emptyMap(),
    @field:Valid
    @field:Schema(requiredMode = Schema.RequiredMode.NOT_REQUIRED)
    val availableInventory: List<InventoryItem> = emptyList(),
    @field:Schema(requiredMode = Schema.RequiredMode.NOT_REQUIRED)
    val hardConstraints: HardConstraints = HardConstraints(),
    @field:Positive val mealCount: Int? = null,
    // Null means the canonical field was omitted; an explicitly supplied empty map still overrides aliases.
    val dietaryShares: Map<String, Double>? = null,
    // Compatibility alias. dietaryShares takes precedence when both are supplied.
    val capabilityShares: Map<String, Double> = emptyMap(),
)
