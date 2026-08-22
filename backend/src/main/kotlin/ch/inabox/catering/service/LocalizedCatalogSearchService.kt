package ch.inabox.catering.service

import ch.inabox.catering.model.Meal
import org.springframework.stereotype.Service

@Service
class LocalizedCatalogSearchService(
    private val mealCatalogService: MealCatalogService,
    private val inventoryCatalogService: InventoryCatalogService,
    private val translationService: TranslationService,
) {
    fun searchMeals(
        queryText: String?,
        categoryId: String?,
        capability: String?,
        language: String,
        limit: Int,
    ): List<Meal> {
        val safeLimit = limit.coerceIn(1, 100)
        val variants = translationService.searchVariants(queryText, language)
        if (variants == listOf("")) return mealCatalogService.search(null, categoryId, capability, safeLimit)

        val merged = linkedMapOf<String, Meal>()
        variants.forEach { query ->
            if (merged.size >= safeLimit) return@forEach
            mealCatalogService.search(query, categoryId, capability, safeLimit)
                .forEach { meal -> merged.putIfAbsent(meal.mealId, meal) }
        }
        return merged.values
            .sortedWith(compareBy<Meal> { it.name.lowercase() }.thenBy { it.mealId })
            .take(safeLimit)
    }

    fun searchInventory(queryText: String?, language: String, limit: Int): List<InventoryConceptOption> {
        val safeLimit = limit.coerceIn(1, 100)
        val variants = translationService.searchVariants(queryText, language)
        if (variants == listOf("")) return inventoryCatalogService.search(null, safeLimit)

        val merged = linkedMapOf<String, InventoryConceptOption>()
        variants.forEach { query ->
            if (merged.size >= safeLimit) return@forEach
            inventoryCatalogService.search(query, safeLimit)
                .forEach { option -> merged.putIfAbsent(option.concept.lowercase(), option) }
        }
        return merged.values
            .sortedWith(compareBy<InventoryConceptOption> { it.label.lowercase() }.thenBy { it.concept })
            .take(safeLimit)
    }
}
