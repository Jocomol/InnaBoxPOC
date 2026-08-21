package ch.inabox.catering.service

import ch.inabox.catering.model.CustomerPreferences
import ch.inabox.catering.model.EventTemplate
import ch.inabox.catering.model.HardConstraints
import ch.inabox.catering.model.Ingredient
import ch.inabox.catering.model.InventoryItem
import ch.inabox.catering.model.Meal
import ch.inabox.catering.model.Money
import ch.inabox.catering.model.PackageInfo
import ch.inabox.catering.model.Product
import ch.inabox.catering.model.ProductConversion
import ch.inabox.catering.model.RequirementTarget
import ch.inabox.catering.model.ResolvePlanRequest
import ch.inabox.catering.model.ServingInfo
import ch.inabox.catering.model.TemplateRequirement
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class PlannerEngineTest {
    private val engine = PlannerEngine()

    @Test
    fun `resolves meal shares, inventory, package rounding, and totals`() {
        val template = EventTemplate(
            templateId = "apero",
            name = "Apéro",
            description = "Test",
            requirements = listOf(
                requirement("savory", "meal", setOf("savory", "finger-food", "apero"), 5.0, "pieces-per-guest"),
                TemplateRequirement(
                    requirementId = "vegetarian",
                    type = "meal",
                    requiredCapabilities = setOf("vegetarian", "finger-food", "apero"),
                    target = RequirementTarget(share = 0.25),
                ),
                requirement("drinks", "product", setOf("non-alcoholic-drink"), 0.5, "liter-per-guest"),
            ),
            weights = mapOf("price" to 1.0),
        )
        val meals = listOf(
            meal("savory-bites", setOf("savory", "finger-food", "apero"), "savory-bite", 0.9),
            meal("veg-bites", setOf("vegetarian", "finger-food", "apero"), "veg-bite", 0.8),
        )
        val products = listOf(
            product("savory-product", "savory-bite", 20.0, "piece", 10.0),
            product("veg-product", "veg-bite", 25.0, "piece", 8.0),
            product("water-product", "water", 9.0, "liter", 9.0, setOf("non-alcoholic-drink")),
        )

        val plan = engine.resolve(
            template,
            meals,
            products,
            ResolvePlanRequest(
                templateId = "apero",
                guestCount = 40,
                budget = 200.0,
                availableInventory = listOf(InventoryItem("savory-bite", 40.0, "piece")),
            ),
        )

        assertEquals(listOf("savory-bites", "veg-bites"), plan.selectedMeals.map { it.mealId })
        assertEquals(200.0, plan.selectedMeals[0].targetQuantity.amount)
        assertEquals(50.0, plan.selectedMeals[1].targetQuantity.amount)

        val savory = plan.shoppingItems.single { it.productId == "savory-product" }
        assertEquals(200.0, savory.requiredQuantity.amount)
        assertEquals(40.0, savory.inventoryUsed.amount)
        assertEquals(8, savory.packageCount)
        assertEquals(0.0, savory.overbuyQuantity.amount)

        val water = plan.shoppingItems.single { it.productId == "water-product" }
        assertEquals(3, water.packageCount)
        assertEquals(7.0, water.overbuyQuantity.amount)
        assertEquals(123.0, plan.totals.totalCost.amount)
        assertEquals(3.08, plan.totals.costPerGuest.amount)
        assertEquals("UNDER_BUDGET", plan.totals.budgetStatus)
    }

    @Test
    fun `fully covered inventory returns zero packages`() {
        val template = productOnlyTemplate(
            requirement("drinks", "product", setOf("water"), 1.0, "liter-per-guest"),
        )
        val water = product("water-product", "water", 9.0, "liter", 9.0, setOf("water"))

        val plan = engine.resolve(
            template,
            emptyList(),
            listOf(water),
            ResolvePlanRequest(
                templateId = template.templateId,
                guestCount = 10,
                budget = 100.0,
                availableInventory = listOf(InventoryItem("water", 12.0, "liter")),
            ),
        )

        assertEquals(0, plan.shoppingItems.single().packageCount)
        assertEquals(10.0, plan.shoppingItems.single().inventoryUsed.amount)
        assertEquals(0.0, plan.totals.totalCost.amount)
        assertEquals(2.0, plan.unusedExistingInventory.single().quantity.amount)
    }

    @Test
    fun `uses serving conversion for coffee`() {
        val template = productOnlyTemplate(
            requirement("coffee", "product", setOf("coffee"), 2.0, "cups-per-guest"),
        )
        val coffee = product(
            id = "coffee",
            concept = "coffee-beans",
            packageAmount = 1_000.0,
            packageUnit = "g",
            price = 21.9,
            capabilities = setOf("coffee"),
            conversion = ProductConversion(8.0, "cup", "g"),
        )

        val plan = engine.resolve(
            template,
            emptyList(),
            listOf(coffee),
            ResolvePlanRequest(templateId = template.templateId, guestCount = 40, budget = 100.0),
        )

        val item = plan.shoppingItems.single()
        assertEquals(640.0, item.requiredQuantity.amount)
        assertEquals("g", item.requiredQuantity.unit)
        assertEquals(1, item.packageCount)
        assertEquals(360.0, item.overbuyQuantity.amount)
    }

    @Test
    fun `hard constraints filter before scoring`() {
        val template = EventTemplate(
            templateId = "meal",
            name = "Meal",
            description = "Test",
            requirements = listOf(requirement("savory", "meal", setOf("savory"), 1.0, "servings-per-guest")),
            weights = mapOf("price" to 1.0),
        )
        val nonVegan = meal("non-vegan", setOf("savory"), "food", 1.0)

        val exception = assertThrows<PlanResolutionException> {
            engine.resolve(
                template,
                listOf(nonVegan),
                listOf(product("food", "food", 10.0, "piece", 5.0)),
                ResolvePlanRequest(
                    templateId = template.templateId,
                    guestCount = 10,
                    budget = 100.0,
                    hardConstraints = HardConstraints(requiredCapabilities = setOf("vegan")),
                ),
            )
        }

        assertTrue(exception.message!!.contains("vegan"))
    }

    @Test
    fun `same inputs and tied scores select by stable id`() {
        val template = EventTemplate(
            templateId = "stable",
            name = "Stable",
            description = "Test",
            requirements = listOf(requirement("meal", "meal", setOf("savory"), 1.0, "servings-per-guest")),
            weights = mapOf("price" to 1.0),
        )
        val meals = listOf(
            meal("z-meal", setOf("savory"), "z-food", 0.5),
            meal("a-meal", setOf("savory"), "a-food", 0.5),
        )
        val products = listOf(
            product("z-food", "z-food", 10.0, "piece", 5.0),
            product("a-food", "a-food", 10.0, "piece", 5.0),
        )
        val request = ResolvePlanRequest(templateId = template.templateId, guestCount = 10, budget = 100.0)

        val first = engine.resolve(template, meals, products, request)
        val second = engine.resolve(template, meals.reversed(), products.reversed(), request)

        assertEquals("a-meal", first.selectedMeals.single().mealId)
        assertEquals(first, second)
    }

    @Test
    fun `scales combined meal quantity to requested servings per guest`() {
        val template = EventTemplate(
            templateId = "scaled",
            name = "Scaled",
            description = "Test",
            requirements = listOf(
                requirement("warm-meal", "meal", setOf("warm"), 1.0, "servings-per-guest"),
                requirement("cold-meal", "meal", setOf("cold"), 1.0, "servings-per-guest"),
            ),
            weights = mapOf("price" to 1.0),
        )
        val meals = listOf(
            meal("warm-meal", setOf("warm"), "warm-food", 0.8),
            meal("cold-meal", setOf("cold"), "cold-food", 0.8),
        )
        val products = listOf(
            product("warm-food", "warm-food", 10.0, "piece", 5.0),
            product("cold-food", "cold-food", 10.0, "piece", 5.0),
        )

        val plan = engine.resolve(
            template,
            meals,
            products,
            ResolvePlanRequest(
                templateId = template.templateId,
                guestCount = 10,
                budget = 100.0,
                servingsPerGuest = 3,
            ),
        )

        assertEquals(3, plan.event.servingsPerGuest)
        assertEquals(listOf(15, 15), plan.selectedMeals.map { it.servings })
        assertEquals(30, plan.selectedMeals.sumOf { it.servings })
        assertEquals(listOf(3, 3), plan.shoppingItems.map { it.packageCount })
    }

    @Test
    fun `rejects more than ten servings per guest`() {
        val template = productOnlyTemplate(
            requirement("water", "product", setOf("water"), 1.0, "liter-per-guest"),
        )

        val exception = assertThrows<IllegalArgumentException> {
            engine.resolve(
                template,
                emptyList(),
                listOf(product("water", "water", 10.0, "liter", 5.0, setOf("water"))),
                ResolvePlanRequest(
                    templateId = template.templateId,
                    guestCount = 10,
                    budget = 100.0,
                    servingsPerGuest = 11,
                ),
            )
        }

        assertTrue(exception.message!!.contains("between 1 and 10"))
    }

    @Test
    fun `required meal wins a compatible template slot regardless of score`() {
        val template = EventTemplate(
            templateId = "required-slot",
            name = "Required slot",
            description = "Test",
            requirements = listOf(requirement("savory", "meal", setOf("savory"), 1.0, "servings-per-guest")),
            weights = mapOf("price" to 1.0),
        )
        val meals = listOf(
            meal("highest-score", setOf("savory"), "highest-food", 1.0),
            meal("must-have-quiche", setOf("savory"), "quiche-food", 0.1),
        )
        val products = listOf(
            product("highest-food", "highest-food", 10.0, "piece", 5.0),
            product("quiche-food", "quiche-food", 10.0, "piece", 5.0),
        )

        val plan = engine.resolve(
            template,
            meals,
            products,
            ResolvePlanRequest(
                templateId = template.templateId,
                guestCount = 10,
                budget = 100.0,
                requiredMealIds = setOf("must-have-quiche"),
            ),
        )

        assertEquals("must-have-quiche", plan.selectedMeals.single().mealId)
        assertEquals(setOf("must-have-quiche"), plan.event.requiredMealIds)
    }

    @Test
    fun `required meal without a compatible slot is added to the menu`() {
        val template = EventTemplate(
            templateId = "required-extra",
            name = "Required extra",
            description = "Test",
            requirements = listOf(requirement("savory", "meal", setOf("savory"), 1.0, "servings-per-guest")),
            weights = mapOf("price" to 1.0),
        )
        val meals = listOf(
            meal("savory-meal", setOf("savory"), "savory-food", 0.8),
            meal("required-dessert", setOf("sweet"), "sweet-food", 0.7),
        )
        val products = listOf(
            product("savory-food", "savory-food", 10.0, "piece", 5.0),
            product("sweet-food", "sweet-food", 10.0, "piece", 5.0),
        )

        val plan = engine.resolve(
            template,
            meals,
            products,
            ResolvePlanRequest(
                templateId = template.templateId,
                guestCount = 10,
                budget = 100.0,
                servingsPerGuest = 3,
                requiredMealIds = setOf("required-dessert"),
            ),
        )

        assertEquals(listOf("savory-meal", "required-dessert"), plan.selectedMeals.map { it.mealId })
        assertEquals(30, plan.selectedMeals.sumOf { it.servings })
        assertTrue(plan.fulfilledRequirements.any { it.requirementId == "guaranteed-required-dessert" })
    }

    @Test
    fun `required meal conflicting with hard constraints is rejected`() {
        val template = EventTemplate(
            templateId = "required-conflict",
            name = "Required conflict",
            description = "Test",
            requirements = listOf(requirement("savory", "meal", setOf("savory"), 1.0, "servings-per-guest")),
            weights = mapOf("price" to 1.0),
        )
        val meatMeal = meal("meat-quiche", setOf("savory"), "quiche-food", 0.8)

        val exception = assertThrows<PlanResolutionException> {
            engine.resolve(
                template,
                listOf(meatMeal),
                listOf(product("quiche-food", "quiche-food", 10.0, "piece", 5.0)),
                ResolvePlanRequest(
                    templateId = template.templateId,
                    guestCount = 10,
                    budget = 100.0,
                    requiredMealIds = setOf("meat-quiche"),
                    hardConstraints = HardConstraints(requiredCapabilities = setOf("vegan")),
                ),
            )
        }

        assertTrue(exception.message!!.contains("does not satisfy hard capabilities"))
    }

    private fun requirement(
        id: String,
        type: String,
        capabilities: Set<String>,
        amount: Double,
        unit: String,
    ) = TemplateRequirement(
        requirementId = id,
        type = type,
        requiredCapabilities = capabilities,
        target = RequirementTarget(amount = amount, unit = unit),
    )

    private fun meal(
        id: String,
        capabilities: Set<String>,
        ingredientConcept: String,
        priceScore: Double,
    ) = Meal(
        mealId = id,
        name = id,
        capabilities = capabilities,
        serving = ServingInfo(2.0),
        ingredients = listOf(Ingredient(ingredientConcept, 2.0, "piece")),
        scores = mapOf("price" to priceScore),
    )

    private fun product(
        id: String,
        concept: String,
        packageAmount: Double,
        packageUnit: String,
        price: Double,
        capabilities: Set<String> = emptySet(),
        conversion: ProductConversion? = null,
    ) = Product(
        productId = id,
        sku = id.uppercase(),
        name = id,
        concept = concept,
        packageInfo = PackageInfo(packageAmount, packageUnit),
        price = Money(price),
        capabilities = capabilities,
        scores = mapOf("price" to 1.0),
        conversion = conversion,
    )

    private fun productOnlyTemplate(requirement: TemplateRequirement) = EventTemplate(
        templateId = "product-only",
        name = "Product only",
        description = "Test",
        requirements = listOf(requirement),
        weights = mapOf("price" to 1.0),
    )
}
