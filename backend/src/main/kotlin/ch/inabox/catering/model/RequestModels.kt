package ch.inabox.catering.model

import jakarta.validation.Valid
import jakarta.validation.constraints.DecimalMax
import jakarta.validation.constraints.DecimalMin
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Positive
import jakarta.validation.constraints.PositiveOrZero

data class CustomerPreferences(
    @field:DecimalMin("0.0")
    @field:DecimalMax("1.0")
    val vegetarianShare: Double? = null,
    val preferredCapabilities: Set<String> = emptySet(),
)

data class InventoryItem(
    @field:NotBlank val concept: String,
    @field:Positive val amount: Double,
    @field:NotBlank val unit: String,
)

data class HardConstraints(
    val requiredCapabilities: Set<String> = emptySet(),
    val excludedCapabilities: Set<String> = emptySet(),
    val excludedConcepts: Set<String> = emptySet(),
)

data class ResolvePlanRequest(
    @field:NotBlank val templateId: String,
    @field:Min(1) @field:Max(10_000) val guestCount: Int,
    @field:PositiveOrZero val budget: Double,
    @field:Min(1) @field:Max(10) val servingsPerGuest: Int? = null,
    val requiredMealIds: Set<String> = emptySet(),
    val selectedConstraintIds: Set<String> = emptySet(),
    @field:Valid val preferences: CustomerPreferences = CustomerPreferences(),
    val weights: Map<String, Double> = emptyMap(),
    @field:Valid val availableInventory: List<InventoryItem> = emptyList(),
    val hardConstraints: HardConstraints = HardConstraints(),
)
