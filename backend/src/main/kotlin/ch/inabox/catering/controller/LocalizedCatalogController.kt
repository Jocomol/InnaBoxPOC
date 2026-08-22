package ch.inabox.catering.controller

import ch.inabox.catering.model.Meal
import ch.inabox.catering.service.InventoryConceptOption
import ch.inabox.catering.service.LocalizedCatalogSearchService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/i18n")
class LocalizedCatalogController(
    private val localizedCatalogSearchService: LocalizedCatalogSearchService,
) {
    @GetMapping("/meals/search")
    fun searchMeals(
        @RequestParam(required = false) query: String?,
        @RequestParam(required = false) categoryId: String?,
        @RequestParam(required = false) capability: String?,
        @RequestParam(defaultValue = "en") language: String,
        @RequestParam(defaultValue = "40") limit: Int,
    ): List<Meal> = localizedCatalogSearchService.searchMeals(query, categoryId, capability, language, limit)

    @GetMapping("/inventory-concepts/search")
    fun searchInventoryConcepts(
        @RequestParam(required = false) query: String?,
        @RequestParam(defaultValue = "en") language: String,
        @RequestParam(defaultValue = "40") limit: Int,
    ): List<InventoryConceptOption> = localizedCatalogSearchService.searchInventory(query, language, limit)
}
