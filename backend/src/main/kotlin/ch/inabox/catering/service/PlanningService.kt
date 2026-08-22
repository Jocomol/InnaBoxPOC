package ch.inabox.catering.service

import ch.inabox.catering.model.DietaryConstraintDefinition
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
    private val catalogMetadataService: CatalogMetadataService,
    private val plannerEngine: PlannerEngine,
) {
    fun resolve(request: ResolvePlanRequest): ShoppingPlan {
        val template = eventTemplateRepository.findByTemplateId(request.templateId)
            ?: throw TemplateNotFoundException(request.templateId)

        val priorities = effectivePlanningPriorities(planningPriorityRepository.findAll())
        val priorityIds = priorities.map { it.priorityId }.toSet()
        val unknownPriorityIds = (template.weights.keys + request.weights.keys) - priorityIds
        if (unknownPriorityIds.isNotEmpty()) {
            throw IllegalArgumentException("Unknown planning priorities: ${unknownPriorityIds.sorted().joinToString()}")
        }
        val databaseDefaults = priorities
            .sortedWith(compareBy({ it.displayOrder }, { it.priorityId }))
            .associateTo(linkedMapOf()) { it.priorityId to it.defaultWeight }
        val effectiveTemplate = template.copy(weights = databaseDefaults + template.weights)

        val constraintDefinitions = catalogMetadataService.dietaryConstraints()
        val constraintsById = constraintDefinitions.associateBy { it.constraintId.lowercase() }
        val requestedConstraintIds = request.selectedConstraintIds
            .map { it.trim().lowercase() }
            .filter { it.isNotBlank() }
            .toSortedSet()
        val unknownConstraintIds = requestedConstraintIds.filter { it !in constraintsById }
        if (unknownConstraintIds.isNotEmpty()) {
            throw IllegalArgumentException("Unknown dietary constraints: ${unknownConstraintIds.joinToString()}")
        }
        val explicitlySelectedConstraints = requestedConstraintIds.map { constraintsById.getValue(it) }
        val effectiveDietaryShares = when {
            request.dietaryShares != null -> request.dietaryShares
            request.capabilityShares.isNotEmpty() -> request.capabilityShares
            else -> buildMap {
                explicitlySelectedConstraints.forEach { definition ->
                    dietaryCapability(definition)?.let { put(it, 1.0) }
                }
                request.preferences.vegetarianShare?.let { share ->
                    if ("vegetarian" !in this) put("vegetarian", share)
                }
            }
        }
        val effectiveDietaryCapabilities = effectiveDietaryShares.keys
            .map { it.trim().lowercase() }
            .toSet()
        val selectedConstraints = constraintDefinitions.filter { definition ->
            dietaryCapability(definition) in effectiveDietaryCapabilities
        }
        val effectiveRequest = request.copy(
            selectedConstraintIds = selectedConstraints.map { it.constraintId }.toSortedSet(),
            dietaryShares = effectiveDietaryShares,
        )

        return plannerEngine.resolve(
            template = effectiveTemplate,
            meals = mealRepository.findAll(),
            products = productRepository.findAll(),
            selectedConstraints = selectedConstraints,
            request = effectiveRequest,
        )
    }

    private fun dietaryCapability(definition: DietaryConstraintDefinition): String? =
        definition.dietaryCapability
            ?.trim()
            ?.lowercase()
            ?.takeIf { it.isNotBlank() }
            ?: definition.requiredCapabilities
                .map { it.trim().lowercase() }
                .firstOrNull { it.isNotBlank() }
}
