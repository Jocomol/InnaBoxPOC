package ch.inabox.catering.service

import ch.inabox.catering.model.HardConstraints
import ch.inabox.catering.model.ResolvePlanRequest
import ch.inabox.catering.model.ShoppingPlan
import ch.inabox.catering.repository.DietaryConstraintRepository
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
    private val dietaryConstraintRepository: DietaryConstraintRepository,
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

        val constraintDefinitions = dietaryConstraintRepository.findAll()
        val constraintsById = constraintDefinitions.associateBy { it.constraintId.lowercase() }
        val requestedConstraintIds = request.selectedConstraintIds
            .map { it.trim().lowercase() }
            .filter { it.isNotBlank() }
            .toSortedSet()
        val unknownConstraintIds = requestedConstraintIds.filter { it !in constraintsById }
        if (unknownConstraintIds.isNotEmpty()) {
            throw IllegalArgumentException("Unknown dietary constraints: ${unknownConstraintIds.joinToString()}")
        }
        val selectedConstraints = requestedConstraintIds.map { constraintsById.getValue(it) }

        val derivedConstraints = HardConstraints(
            requiredCapabilities = selectedConstraints.flatMap { it.requiredCapabilities }.toSortedSet(),
            excludedCapabilities = selectedConstraints.flatMap { it.excludedCapabilities }.toSortedSet(),
            excludedConcepts = selectedConstraints.flatMap { it.excludedConcepts }.toSortedSet(),
        )
        val effectiveRequest = request.copy(
            selectedConstraintIds = selectedConstraints.map { it.constraintId }.toSortedSet(),
            hardConstraints = mergeConstraints(request.hardConstraints, derivedConstraints),
        )

        return plannerEngine.resolve(
            template = effectiveTemplate,
            meals = mealRepository.findAll(),
            products = productRepository.findAll(),
            selectedConstraints = selectedConstraints,
            request = effectiveRequest,
        )
    }

    private fun mergeConstraints(first: HardConstraints, second: HardConstraints) = HardConstraints(
        requiredCapabilities = first.requiredCapabilities + second.requiredCapabilities,
        excludedCapabilities = first.excludedCapabilities + second.excludedCapabilities,
        excludedConcepts = first.excludedConcepts + second.excludedConcepts,
    )
}
