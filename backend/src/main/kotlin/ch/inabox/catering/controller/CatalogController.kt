package ch.inabox.catering.controller

import ch.inabox.catering.model.DietaryConstraintDefinition
import ch.inabox.catering.model.ApiProblem
import ch.inabox.catering.model.EventTemplate
import ch.inabox.catering.model.Meal
import ch.inabox.catering.model.MealCategory
import ch.inabox.catering.model.PlanningPriority
import ch.inabox.catering.model.Product
import ch.inabox.catering.repository.EventTemplateRepository
import ch.inabox.catering.repository.MealRepository
import ch.inabox.catering.repository.PlanningPriorityRepository
import ch.inabox.catering.repository.ProductRepository
import ch.inabox.catering.service.CatalogMetadataService
import ch.inabox.catering.service.InventoryCatalogService
import ch.inabox.catering.service.MealCatalogService
import ch.inabox.catering.service.effectivePlanningPriorities
import ch.inabox.catering.service.TemplateNotFoundException
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.Parameter
import io.swagger.v3.oas.annotations.media.ArraySchema
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.ExampleObject
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
@Tag(name = "Catalog")
class CatalogController(
    private val eventTemplateRepository: EventTemplateRepository,
    private val mealRepository: MealRepository,
    private val productRepository: ProductRepository,
    private val planningPriorityRepository: PlanningPriorityRepository,
    private val mealCatalogService: MealCatalogService,
    private val inventoryCatalogService: InventoryCatalogService,
    private val catalogMetadataService: CatalogMetadataService,
) {
    @GetMapping("/templates")
    @Operation(
        operationId = "listTemplates",
        summary = "List event templates",
        description = "Returns every seeded event template ordered by `id`. A template defines requirements, numeric defaults, and template-specific scoring weights.",
    )
    @ApiResponse(
        responseCode = "200",
        description = "Templates ordered by ID.",
        content = [Content(mediaType = "application/json", array = ArraySchema(schema = Schema(implementation = EventTemplate::class)))],
    )
    fun templates(): List<EventTemplate> = eventTemplateRepository.findAll().sortedBy { it.templateId }

    @GetMapping("/templates/{id}")
    @Operation(
        operationId = "getTemplate",
        summary = "Get an event template",
        description = "Returns one template by its stable catalog ID.",
    )
    @ApiResponses(
        value = [
            ApiResponse(
                responseCode = "200",
                description = "The matching template.",
                content = [Content(mediaType = "application/json", schema = Schema(implementation = EventTemplate::class))],
            ),
            ApiResponse(
                responseCode = "404",
                description = "No template has this ID.",
                content = [
                    Content(
                        mediaType = "application/problem+json",
                        schema = Schema(implementation = ApiProblem::class),
                        examples = [
                            ExampleObject(
                                name = "Unknown template",
                                value = """{"type":"about:blank","title":"Template not found","status":404,"detail":"Event template 'unknown' was not found","instance":"/api/templates/unknown"}""",
                            ),
                        ],
                    ),
                ],
            ),
        ],
    )
    fun template(
        @Parameter(description = "Stable template ID.", example = "business-apero", required = true)
        @PathVariable id: String,
    ): EventTemplate =
        eventTemplateRepository.findByTemplateId(id) ?: throw TemplateNotFoundException(id)

    @GetMapping("/meals")
    @Operation(
        operationId = "listMeals",
        summary = "List meals",
        description = "Returns every seeded meal ordered by `id`, including matching capabilities, serving size, ingredient recipe, and normalized planning scores.",
    )
    @ApiResponse(
        responseCode = "200",
        description = "Meals ordered by ID.",
        content = [Content(mediaType = "application/json", array = ArraySchema(schema = Schema(implementation = Meal::class)))],
    )
    fun meals(): List<Meal> = mealRepository.findAll().sortedBy { it.mealId }

    @GetMapping("/meals/search")
    fun searchMeals(
        @RequestParam(required = false) query: String?,
        @RequestParam(required = false) categoryId: String?,
        @RequestParam(required = false) capability: String?,
        @RequestParam(defaultValue = "40") limit: Int,
    ): List<Meal> = mealCatalogService.search(query, categoryId, capability, limit)

    @GetMapping("/meal-categories")
    fun mealCategories(): List<MealCategory> = catalogMetadataService.mealCategories()

    @GetMapping("/meal-capabilities")
    fun mealCapabilities(): List<String> = mealCatalogService.capabilities()

    @GetMapping("/dietary-constraints")
    fun dietaryConstraints(): List<DietaryConstraintDefinition> = catalogMetadataService.dietaryConstraints()

    @GetMapping("/products")
    @Operation(
        operationId = "listProducts",
        summary = "List products",
        description = "Returns every seeded purchasable product ordered by `id`, including package size, price, origin, capabilities, scores, and any serving conversion.",
    )
    @ApiResponse(
        responseCode = "200",
        description = "Products ordered by ID.",
        content = [Content(mediaType = "application/json", array = ArraySchema(schema = Schema(implementation = Product::class)))],
    )
    fun products(): List<Product> = productRepository.findAll().sortedBy { it.productId }

    @GetMapping("/inventory-concepts/search")
    fun inventoryConcepts(
        @RequestParam(required = false) query: String?,
        @RequestParam(defaultValue = "40") limit: Int,
    ) = inventoryCatalogService.search(query, limit)

    @GetMapping("/priorities")
    @Operation(
        operationId = "listPriorities",
        summary = "List planning priorities",
        description = "Returns scoring definitions in configured display order. IDs from this endpoint are the only valid keys for request weight overrides.",
    )
    @ApiResponse(
        responseCode = "200",
        description = "Planning priorities in display order, then ID order.",
        content = [Content(mediaType = "application/json", array = ArraySchema(schema = Schema(implementation = PlanningPriority::class)))],
    )
    fun priorities(): List<PlanningPriority> =
        effectivePlanningPriorities(planningPriorityRepository.findAll())
}
