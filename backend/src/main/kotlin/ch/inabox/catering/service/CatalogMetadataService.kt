package ch.inabox.catering.service

import ch.inabox.catering.model.DietaryConstraintDefinition
import ch.inabox.catering.model.MealCategory
import ch.inabox.catering.repository.DietaryConstraintRepository
import ch.inabox.catering.repository.MealCategoryRepository
import ch.inabox.catering.repository.MealRepository
import org.springframework.stereotype.Service

/**
 * Provides user-facing catalog metadata.
 *
 * Configured MongoDB metadata is always authoritative. The fallbacks only keep an
 * existing pre-metadata Mongo volume usable until the idempotent seed is rerun.
 */
@Service
class CatalogMetadataService(
    private val dietaryConstraintRepository: DietaryConstraintRepository,
    private val mealCategoryRepository: MealCategoryRepository,
    private val mealRepository: MealRepository,
) {
    fun dietaryConstraints(): List<DietaryConstraintDefinition> {
        val configured = dietaryConstraintRepository.findAll()
        if (configured.isNotEmpty()) return configured.sortedWith(constraintOrder)

        val capabilities = mealRepository.findAll()
            .flatMap { it.capabilities }
            .map { it.trim().lowercase() }
            .toSet()

        return buildList {
            if ("vegetarian" in capabilities) {
                add(
                    DietaryConstraintDefinition(
                        constraintId = "vegetarian",
                        label = "Vegetarian",
                        description = "Only select meals that are marked as vegetarian.",
                        displayOrder = 10,
                        requiredCapabilities = setOf("vegetarian"),
                    ),
                )
            }
            if ("vegan" in capabilities) {
                add(
                    DietaryConstraintDefinition(
                        constraintId = "vegan",
                        label = "Vegan",
                        description = "Only select meals that are marked as vegan.",
                        displayOrder = 20,
                        requiredCapabilities = setOf("vegan"),
                    ),
                )
            }
        }.sortedWith(constraintOrder)
    }

    fun mealCategories(): List<MealCategory> {
        val configured = mealCategoryRepository.findAll()
        if (configured.isNotEmpty()) return configured.sortedWith(categoryOrder)

        val configuredOnMeals = mealRepository.findAll()
            .flatMap { it.categoryIds }
            .map { it.trim().lowercase() }
            .filter { it.isNotBlank() }
            .toSortedSet()

        if (configuredOnMeals.isNotEmpty()) {
            return configuredOnMeals.mapIndexed { index, id ->
                MealCategory(
                    categoryId = id,
                    label = humanize(id),
                    description = "Catalog category",
                    displayOrder = (index + 1) * 10,
                )
            }
        }

        // Legacy-volume browse categories. MealCatalogService knows how to map
        // these to the old capability/ingredient data until categoryIds are seeded.
        return listOf(
            MealCategory(categoryId = "fruit", label = "Fruit", description = "Fruit cups, salads, skewers, and fruit-forward dishes.", displayOrder = 10),
            MealCategory(categoryId = "bakery", label = "Bakery & Pastries", description = "Croissants, quiches, baked bites, and pastry-based dishes.", displayOrder = 20),
            MealCategory(categoryId = "meat", label = "Meat", description = "Dishes that contain meat or meat-based components.", displayOrder = 30),
            MealCategory(categoryId = "plant-based", label = "Vegetarian & Plant-based", description = "Vegetarian and vegan dishes.", displayOrder = 40),
            MealCategory(categoryId = "breakfast", label = "Breakfast & Brunch", description = "Breakfast, brunch, and coffee-break dishes.", displayOrder = 50),
            MealCategory(categoryId = "lunch", label = "Lunch & Buffet", description = "Hearty lunch and buffet dishes.", displayOrder = 60),
            MealCategory(categoryId = "reception", label = "Apéro & Reception", description = "Finger food and reception-friendly bites.", displayOrder = 70),
        )
    }

    private fun humanize(value: String): String = value
        .replace('-', ' ')
        .split(' ')
        .filter { it.isNotBlank() }
        .joinToString(" ") { word -> word.replaceFirstChar { it.uppercase() } }

    private val constraintOrder = compareBy<DietaryConstraintDefinition>({ it.displayOrder }, { it.constraintId })
    private val categoryOrder = compareBy<MealCategory>({ it.displayOrder }, { it.categoryId })
}
