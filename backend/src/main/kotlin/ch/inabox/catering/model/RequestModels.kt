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

@Schema(description = "Soft customer preferences used as scoring tie-breakers. The vegetarian share is retained only as a compatibility alias.")
data class CustomerPreferences(
    @field:DecimalMin("0.0")
    @field:DecimalMax("1.0")
    @field:Schema(
        description = "Deprecated compatibility alias for `dietaryShares.vegetarian`. It is considered only when `dietaryShares` and `capabilityShares` are omitted and no selected dietary constraint already supplies vegetarian coverage.",
        example = "0.3",
        minimum = "0",
        maximum = "1",
        deprecated = true,
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

@Schema(description = "Mandatory event/menu and ingredient filters. Values are trimmed and compared case-insensitively; use `dietaryShares` for dietary coverage.")
data class HardConstraints(
    @field:Schema(
        description = "Every selected meal, including explicitly required meals, must contain all of these event/menu capabilities.",
        example = "[\"prepare-ahead\"]",
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
    @field:Schema(
        description = "Deprecated dietary-constraint IDs from `GET /api/dietary-constraints`. Each selected ID becomes a 100% dietary share when both share-map fields are omitted. Unknown IDs are rejected.",
        example = "[\"vegetarian\"]",
        deprecated = true,
        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
    )
    val selectedConstraintIds: Set<String> = emptySet(),
    @field:Valid
    @field:Schema(requiredMode = Schema.RequiredMode.NOT_REQUIRED)
    val preferences: CustomerPreferences = CustomerPreferences(),
    @field:Schema(
        description = "Per-priority overrides in the range 0.0–1.0. Overrides are merged with database and template defaults, then normalized to sum to 1. Unknown priority IDs are rejected.",
        example = "{\"price\":0.3,\"swiss\":0.25,\"presentation\":0.2,\"prepEase\":0.15,\"sustainability\":0.1}",
        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
    )
    val weights: Map<String, Double> = emptyMap(),
    @field:Valid
    @field:Schema(requiredMode = Schema.RequiredMode.NOT_REQUIRED)
    val availableInventory: List<InventoryItem> = emptyList(),
    @field:Schema(requiredMode = Schema.RequiredMode.NOT_REQUIRED)
    val hardConstraints: HardConstraints = HardConstraints(),
    @field:Positive
    @field:Schema(
        description = "Desired number of distinct dishes. When omitted, the template's `defaults.mealCount` is used. Required meals and mandatory requirements can force more dishes; if fewer valid dishes exist, the available count is returned with a warning.",
        example = "3",
        minimum = "1",
        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
    )
    val mealCount: Int? = null,
    // Null means the canonical field was omitted; an explicitly supplied empty map still overrides aliases.
    @field:Schema(
        description = "Canonical dietary coverage map. Keys are dietary capability IDs and values are independent shares of total food servings in the range 0.0–1.0; overlapping shares do not need to sum to 1. This field takes precedence whenever present, including an explicit empty object.",
        example = "{\"vegetarian\":0.2,\"halal\":0.3,\"gluten-free\":0.1}",
        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
    )
    val dietaryShares: Map<String, Double>? = null,
    // Compatibility alias. dietaryShares takes precedence when both are supplied.
    @field:Schema(
        description = "Deprecated compatibility alias for `dietaryShares`. It is used only when the canonical field is omitted and this map is non-empty.",
        example = "{\"vegetarian\":0.2}",
        deprecated = true,
        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
    )
    val capabilityShares: Map<String, Double> = emptyMap(),
)
