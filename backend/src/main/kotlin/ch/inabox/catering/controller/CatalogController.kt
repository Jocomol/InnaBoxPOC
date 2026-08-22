package ch.inabox.catering.controller

import ch.inabox.catering.model.DietaryConstraintDefinition
import ch.inabox.catering.model.EventTemplate
import ch.inabox.catering.model.Meal
import ch.inabox.catering.model.MealCategory
import ch.inabox.catering.model.PlanningPriority
import ch.inabox.catering.model.Product
import ch.inabox.catering.repository.DietaryConstraintRepository
import ch.inabox.catering.repository.EventTemplateRepository
import ch.inabox.catering.repository.MealCategoryRepository
import ch.inabox.catering.repository.MealRepository
import ch.inabox.catering.repository.PlanningPriorityRepository
import ch.inabox.catering.repository.ProductRepository
import ch.inabox.catering.service.MealCatalogService
import ch.inabox.catering.service.TemplateNotFoundException
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
class CatalogController(
    private val eventTemplateRepository: EventTemplateRepository,
    private val mealRepository: MealRepository,
    private val productRepository: ProductRepository,
    private val planningPriorityRepository: PlanningPriorityRepository,
    private val dietaryConstraintRepository: DietaryConstraintRepository,
    private val mealCategoryRepository: MealCategoryRepository,
    private val mealCatalogService: MealCatalogService,
) {
    @GetMapping("/templates")
    fun templates(): List<EventTemplate> = eventTemplateRepository.findAll().sortedBy { it.templateId }

    @GetMapping("/templates/{id}")
    fun template(@PathVariable id: String): EventTemplate =
        eventTemplateRepository.findByTemplateId(id) ?: throw TemplateNotFoundException(id)

    @GetMapping("/meals")
    fun meals(): List<Meal> = mealRepository.findAll().sortedBy { it.mealId }

    @GetMapping("/meals/search")
    fun searchMeals(
        @RequestParam(required = false) query: String?,
        @RequestParam(required = false) categoryId: String?,
        @RequestParam(defaultValue = "40") limit: Int,
    ): List<Meal> = mealCatalogService.search(query, categoryId, limit)

    @GetMapping("/meal-categories")
    fun mealCategories(): List<MealCategory> =
        mealCategoryRepository.findAll().sortedWith(compareBy(MealCategory::displayOrder, MealCategory::categoryId))

    @GetMapping("/dietary-constraints")
    fun dietaryConstraints(): List<DietaryConstraintDefinition> =
        dietaryConstraintRepository.findAll()
            .sortedWith(compareBy(DietaryConstraintDefinition::displayOrder, DietaryConstraintDefinition::constraintId))

    @GetMapping("/products")
    fun products(): List<Product> = productRepository.findAll().sortedBy { it.productId }

    @GetMapping("/priorities")
    fun priorities(): List<PlanningPriority> =
        planningPriorityRepository.findAll().sortedWith(compareBy(PlanningPriority::displayOrder, PlanningPriority::priorityId))
}
