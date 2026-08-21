package ch.inabox.catering.service

import ch.inabox.catering.model.ResolvePlanRequest
import ch.inabox.catering.model.ShoppingPlan
import ch.inabox.catering.repository.EventTemplateRepository
import ch.inabox.catering.repository.MealRepository
import ch.inabox.catering.repository.PlanningPriorityRepository
import ch.inabox.catering.repository.ProductRepository
import org.springframework.stereotype.Service

@Service
class PlanningService(
    private val eventTemplateRepository: EventTemplateRepository,
    private val mealRepository: MealRepository,
    private val productRepository: ProductRepository,
    private val planningPriorityRepository: PlanningPriorityRepository,
    private val plannerEngine: PlannerEngine,
) {
    fun resolve(request: ResolvePlanRequest): ShoppingPlan {
        val template = eventTemplateRepository.findByTemplateId(request.templateId)
            ?: throw TemplateNotFoundException(request.templateId)
        val priorities = planningPriorityRepository.findAll()
        val priorityIds = priorities.map { it.priorityId }.toSet()
        val unknownPriorityIds = (template.weights.keys + request.weights.keys) - priorityIds
        if (unknownPriorityIds.isNotEmpty()) {
            throw IllegalArgumentException("Unknown planning priorities: ${unknownPriorityIds.sorted().joinToString()}")
        }
        val databaseDefaults = priorities
            .sortedWith(compareBy({ it.displayOrder }, { it.priorityId }))
            .associateTo(linkedMapOf()) { it.priorityId to it.defaultWeight }
        val effectiveTemplate = template.copy(weights = databaseDefaults + template.weights)
        return plannerEngine.resolve(
            template = effectiveTemplate,
            meals = mealRepository.findAll(),
            products = productRepository.findAll(),
            request = request,
        )
    }
}
