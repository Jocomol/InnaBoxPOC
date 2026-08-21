package ch.inabox.catering.service

import ch.inabox.catering.model.ResolvePlanRequest
import ch.inabox.catering.model.ShoppingPlan
import ch.inabox.catering.repository.EventTemplateRepository
import ch.inabox.catering.repository.MealRepository
import ch.inabox.catering.repository.ProductRepository
import org.springframework.stereotype.Service

@Service
class PlanningService(
    private val eventTemplateRepository: EventTemplateRepository,
    private val mealRepository: MealRepository,
    private val productRepository: ProductRepository,
    private val plannerEngine: PlannerEngine,
) {
    fun resolve(request: ResolvePlanRequest): ShoppingPlan {
        val template = eventTemplateRepository.findByTemplateId(request.templateId)
            ?: throw TemplateNotFoundException(request.templateId)
        return plannerEngine.resolve(
            template = template,
            meals = mealRepository.findAll(),
            products = productRepository.findAll(),
            request = request,
        )
    }
}
