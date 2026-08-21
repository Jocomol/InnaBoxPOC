package ch.inabox.catering.controller

import ch.inabox.catering.model.EventTemplate
import ch.inabox.catering.model.Meal
import ch.inabox.catering.model.Product
import ch.inabox.catering.repository.EventTemplateRepository
import ch.inabox.catering.repository.MealRepository
import ch.inabox.catering.repository.ProductRepository
import ch.inabox.catering.service.TemplateNotFoundException
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
class CatalogController(
    private val eventTemplateRepository: EventTemplateRepository,
    private val mealRepository: MealRepository,
    private val productRepository: ProductRepository,
) {
    @GetMapping("/templates")
    fun templates(): List<EventTemplate> = eventTemplateRepository.findAll().sortedBy { it.templateId }

    @GetMapping("/templates/{id}")
    fun template(@PathVariable id: String): EventTemplate =
        eventTemplateRepository.findByTemplateId(id) ?: throw TemplateNotFoundException(id)

    @GetMapping("/meals")
    fun meals(): List<Meal> = mealRepository.findAll().sortedBy { it.mealId }

    @GetMapping("/products")
    fun products(): List<Product> = productRepository.findAll().sortedBy { it.productId }
}
