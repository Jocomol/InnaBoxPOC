package ch.inabox.catering.service

import kotlin.math.abs

internal data class BaseQuantity(
    val amount: Double,
    val dimension: String,
    val baseUnit: String,
)

internal object UnitConverter {
    private data class UnitDefinition(
        val canonical: String,
        val dimension: String,
        val factorToBase: Double,
        val baseUnit: String,
    )

    private val aliases = mapOf(
        "g" to UnitDefinition("g", "mass", 1.0, "g"),
        "gram" to UnitDefinition("g", "mass", 1.0, "g"),
        "grams" to UnitDefinition("g", "mass", 1.0, "g"),
        "kg" to UnitDefinition("kg", "mass", 1_000.0, "g"),
        "kilogram" to UnitDefinition("kg", "mass", 1_000.0, "g"),
        "kilograms" to UnitDefinition("kg", "mass", 1_000.0, "g"),
        "ml" to UnitDefinition("ml", "volume", 0.001, "liter"),
        "milliliter" to UnitDefinition("ml", "volume", 0.001, "liter"),
        "milliliters" to UnitDefinition("ml", "volume", 0.001, "liter"),
        "l" to UnitDefinition("liter", "volume", 1.0, "liter"),
        "liter" to UnitDefinition("liter", "volume", 1.0, "liter"),
        "liters" to UnitDefinition("liter", "volume", 1.0, "liter"),
        "litre" to UnitDefinition("liter", "volume", 1.0, "liter"),
        "litres" to UnitDefinition("liter", "volume", 1.0, "liter"),
        "piece" to UnitDefinition("piece", "piece", 1.0, "piece"),
        "pieces" to UnitDefinition("piece", "piece", 1.0, "piece"),
        "pcs" to UnitDefinition("piece", "piece", 1.0, "piece"),
        "pc" to UnitDefinition("piece", "piece", 1.0, "piece"),
        "cup" to UnitDefinition("cup", "cup", 1.0, "cup"),
        "cups" to UnitDefinition("cup", "cup", 1.0, "cup"),
        "bottle" to UnitDefinition("bottle", "bottle", 1.0, "bottle"),
        "bottles" to UnitDefinition("bottle", "bottle", 1.0, "bottle"),
        "serving" to UnitDefinition("serving", "serving", 1.0, "serving"),
        "servings" to UnitDefinition("serving", "serving", 1.0, "serving"),
    )

    fun toBase(amount: Double, unit: String): BaseQuantity {
        val definition = definition(unit)
        return BaseQuantity(amount * definition.factorToBase, definition.dimension, definition.baseUnit)
    }

    fun fromBase(amount: Double, unit: String): Double {
        val definition = definition(unit)
        return amount / definition.factorToBase
    }

    fun dimension(unit: String): String = definition(unit).dimension

    fun canonical(unit: String): String = definition(unit).canonical

    fun areCompatible(first: String, second: String): Boolean = dimension(first) == dimension(second)

    fun nearlyZero(value: Double): Boolean = abs(value) < 0.000_000_1

    private fun definition(unit: String): UnitDefinition {
        val normalized = unit.trim().lowercase()
        return aliases[normalized]
            ?: UnitDefinition(normalized, "custom:$normalized", 1.0, normalized)
    }
}
