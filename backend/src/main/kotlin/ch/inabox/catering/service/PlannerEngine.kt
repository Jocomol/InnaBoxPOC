package ch.inabox.catering.service

import ch.inabox.catering.model.CustomerPreferences
import ch.inabox.catering.model.EventSummary
import ch.inabox.catering.model.EventTemplate
import ch.inabox.catering.model.FulfilledRequirement
import ch.inabox.catering.model.HardConstraints
import ch.inabox.catering.model.IngredientRequirement
import ch.inabox.catering.model.InventoryItem
import ch.inabox.catering.model.InventoryUsage
import ch.inabox.catering.model.Meal
import ch.inabox.catering.model.Money
import ch.inabox.catering.model.PlanTotals
import ch.inabox.catering.model.Product
import ch.inabox.catering.model.Quantity
import ch.inabox.catering.model.RequirementTarget
import ch.inabox.catering.model.ResolvePlanRequest
import ch.inabox.catering.model.SelectedMeal
import ch.inabox.catering.model.ShoppingItem
import ch.inabox.catering.model.ShoppingPlan
import ch.inabox.catering.model.TemplateRequirement
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.math.RoundingMode
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

@Component
class PlannerEngine {
    fun resolve(
        template: EventTemplate,
        meals: List<Meal>,
        products: List<Product>,
        request: ResolvePlanRequest,
    ): ShoppingPlan {
        validateRequest(request)

        val constraints = normalized(request.hardConstraints)
        val preferences = request.preferences.copy(
            preferredCapabilities = normalizeCapabilities(request.preferences.preferredCapabilities),
        )
        val weights = resolveWeights(template.weights, request.weights)
        val capabilityShares = normalizeCapabilityShares(request.capabilityShares)
        val desiredMealCount = resolveMealCount(template, request.mealCount)
        val requiredMeals = resolveRequiredMeals(request.requiredMealIds, meals, constraints)
        val requiredMealsById = requiredMeals.associateBy { it.mealId }
        val warnings = mutableListOf<String>()
        val selectedMeals = mutableListOf<SelectedMeal>()
        val fulfilledRequirements = mutableListOf<FulfilledRequirement>()
        val ingredientNeeds = linkedMapOf<Pair<String, String>, IngredientAccumulator>()
        val productNeeds = linkedMapOf<String, ProductAccumulator>()

        val enhancedMealPlanning = desiredMealCount != null || capabilityShares.isNotEmpty()
        val selectionOutcome = if (enhancedMealPlanning) {
            selectEnhancedMeals(
                template = template,
                meals = meals,
                requiredMeals = requiredMeals,
                desiredMealCount = desiredMealCount,
                capabilityShares = capabilityShares,
                constraints = constraints,
                preferences = preferences,
                weights = weights,
                request = request,
                warnings = warnings,
                fulfilledRequirements = fulfilledRequirements,
            )
        } else {
            selectLegacyMeals(
                template = template,
                meals = meals,
                requiredMeals = requiredMeals,
                constraints = constraints,
                preferences = preferences,
                weights = weights,
                guestCount = request.guestCount,
                warnings = warnings,
                fulfilledRequirements = fulfilledRequirements,
            )
        }
        val mealSelections = selectionOutcome.selections
        val mealTargets = if (enhancedMealPlanning) {
            allocateEnhancedMealTargets(
                selections = mealSelections,
                totalServings = selectionOutcome.totalServings,
                guestCount = request.guestCount,
                servingsPerGuest = request.servingsPerGuest,
                capabilityShares = capabilityShares,
                warnings = warnings,
            )
        } else {
            applyServingsOverride(mealSelections, request.guestCount, request.servingsPerGuest)
        }
        val targetByMealId = mealSelections.zip(mealTargets).associate { (selection, target) ->
            selection.scored.candidate.mealId to target
        }
        mealSelections.zip(mealTargets).forEach { (selection, target) ->
            val requirement = selection.requirement
            val scored = selection.scored
            val requiredCapabilities = selection.requiredCapabilities
            val mealCapabilities = normalizeCapabilities(scored.candidate.capabilities)
            val matchedRequirementCapabilities = requiredCapabilities.intersect(mealCapabilities).toSortedSet()
            val matchedSelectionCapabilities = (requiredCapabilities + capabilityShares.keys)
                .intersect(mealCapabilities)
                .toSortedSet()
            selectedMeals += SelectedMeal(
                requirementId = requirement.requirementId,
                mealId = scored.candidate.mealId,
                name = scored.candidate.name,
                servings = target.servings,
                targetQuantity = target.quantity,
                matchedCapabilities = matchedSelectionCapabilities,
                preferenceMatches = scored.preferenceMatches,
                scoreComponents = scored.components,
                finalWeightedScore = decimal(scored.weightedScore, 4),
            )
            fulfilledRequirements += FulfilledRequirement(
                requirementId = requirement.requirementId,
                type = "meal",
                required = requirement.required,
                requiredCapabilities = normalizeCapabilities(requirement.requiredCapabilities).toSortedSet(),
                matchedCapabilities = matchedRequirementCapabilities,
                targetQuantity = target.quantity,
                selectedCandidateId = scored.candidate.mealId,
                selectedCandidateName = scored.candidate.name,
                fulfilled = true,
            )

            scored.candidate.ingredients.forEach { ingredient ->
                val base = UnitConverter.toBase(ingredient.amountPerServing * target.servings, ingredient.unit)
                val key = ingredient.concept to base.dimension
                val accumulator = ingredientNeeds.getOrPut(key) {
                    IngredientAccumulator(ingredient.concept, base.dimension, base.baseUnit)
                }
                accumulator.amountBase += base.amount
                accumulator.sourceMealIds += scored.candidate.mealId
            }
        }

        selectionOutcome.additionalRequirementMatches.forEach { match ->
            val selection = mealSelections.single { it.scored.candidate.mealId == match.mealId }
            val meal = selection.scored.candidate
            val target = targetByMealId.getValue(match.mealId)
            val matchedCapabilities = match.requiredCapabilities
                .intersect(normalizeCapabilities(meal.capabilities))
                .toSortedSet()
            fulfilledRequirements += FulfilledRequirement(
                requirementId = match.requirement.requirementId,
                type = "meal",
                required = match.requirement.required,
                requiredCapabilities = normalizeCapabilities(match.requirement.requiredCapabilities).toSortedSet(),
                matchedCapabilities = matchedCapabilities,
                targetQuantity = target.quantity,
                selectedCandidateId = meal.mealId,
                selectedCandidateName = meal.name,
                fulfilled = true,
            )
        }

        val productRequirements = template.requirements.filter { it.type.equals("product", ignoreCase = true) }
        productRequirements.forEach { requirement ->
            val target = scaledTarget(requirement, request.guestCount)
            val requiredCapabilities = normalizeCapabilities(requirement.requiredCapabilities)
            val candidates = products.asSequence()
                .filter { normalizeCapabilities(it.capabilities).containsAll(requiredCapabilities) }
                .filter { productAllowed(it, constraints) }
                .filter { canConvert(target, it) }
                .toList()
            val scored = selectProduct(candidates, weights, preferences)

            if (scored == null) {
                handleMissingRequirement(requirement, requiredCapabilities, request.guestCount, warnings, fulfilledRequirements)
                return@forEach
            }

            val productAmount = convertTargetToPackageUnit(target, scored.candidate)
            addProductNeed(productNeeds, scored, productAmount)
            fulfilledRequirements += FulfilledRequirement(
                requirementId = requirement.requirementId,
                type = "product",
                required = requirement.required,
                requiredCapabilities = requiredCapabilities.toSortedSet(),
                matchedCapabilities = requiredCapabilities.intersect(normalizeCapabilities(scored.candidate.capabilities)).toSortedSet(),
                targetQuantity = target,
                selectedCandidateId = scored.candidate.productId,
                selectedCandidateName = scored.candidate.name,
                fulfilled = true,
            )
        }

        ingredientNeeds.values.forEach { need ->
            val candidates = products.asSequence()
                .filter { it.concept == need.concept }
                .filter { productAllowed(it, constraints) }
                .filter { UnitConverter.dimension(it.packageInfo.unit) == need.dimension }
                .toList()
            val scored = selectProduct(candidates, weights, preferences)
                ?: throw PlanResolutionException("No purchasable product can satisfy ingredient '${need.concept}'")
            val amountInPackageUnit = UnitConverter.fromBase(need.amountBase, scored.candidate.packageInfo.unit)
            addProductNeed(productNeeds, scored, amountInPackageUnit)
        }

        val ledger = InventoryLedger(request.availableInventory)
        val shoppingItems = productNeeds.values.sortedBy { it.product.productId }.map { need ->
            buildShoppingItem(need, ledger)
        }
        val usedInventory = shoppingItems.asSequence()
            .filter { it.inventoryUsed.amount > 0.0 }
            .map { InventoryUsage(it.concept, it.inventoryUsed) }
            .toList()
        val unusedInventory = ledger.unused()

        val totalCost = money(shoppingItems.sumOf { it.lineTotal.amount })
        val costPerGuest = money(totalCost / request.guestCount)
        val budgetDifference = money(request.budget - totalCost)
        val budgetStatus = when {
            budgetDifference > 0.0 -> "UNDER_BUDGET"
            budgetDifference < 0.0 -> "OVER_BUDGET"
            else -> "ON_BUDGET"
        }
        if (budgetDifference < 0.0) {
            warnings += "Plan exceeds the budget by CHF ${money(-budgetDifference).formatMoney()}."
        }

        val ingredientRequirements = ingredientNeeds.values.sortedBy { it.concept }.map {
            IngredientRequirement(
                concept = it.concept,
                requiredQuantity = Quantity(decimal(it.amountBase), it.baseUnit),
                sourceMealIds = it.sourceMealIds.toSortedSet(),
            )
        }

        return ShoppingPlan(
            event = EventSummary(
                templateId = template.templateId,
                templateName = template.name,
                guestCount = request.guestCount,
                servingsPerGuest = request.servingsPerGuest,
                requiredMealIds = requiredMealsById.keys.toSortedSet(),
                budget = Money(money(request.budget)),
                appliedWeights = weights.mapValues { decimal(it.value, 4) },
                preferences = preferences,
                hardConstraints = constraints,
            ),
            selectedMeals = selectedMeals,
            fulfilledRequirements = fulfilledRequirements,
            ingredientRequirements = ingredientRequirements,
            shoppingItems = shoppingItems,
            usedExistingInventory = usedInventory,
            unusedExistingInventory = unusedInventory,
            totals = PlanTotals(
                totalCost = Money(totalCost),
                costPerGuest = Money(costPerGuest),
                budgetDifference = Money(budgetDifference),
                budgetStatus = budgetStatus,
            ),
            warnings = warnings,
        )
    }

    private fun validateRequest(request: ResolvePlanRequest) {
        if (!request.budget.isFinite() || request.budget < 0.0) {
            throw IllegalArgumentException("Budget must be a finite, non-negative number")
        }
        if (request.servingsPerGuest != null && request.servingsPerGuest !in 1..10) {
            throw IllegalArgumentException("Servings per guest must be between 1 and 10")
        }
        if (request.mealCount != null && request.mealCount <= 0) {
            throw IllegalArgumentException("Meal count must be greater than zero")
        }
        request.capabilityShares.toSortedMap().forEach { (capability, share) ->
            if (capability.isBlank()) {
                throw IllegalArgumentException("Capability share names must not be blank")
            }
            if (!share.isFinite() || share !in 0.0..1.0) {
                throw IllegalArgumentException("Capability share '$capability' must be between 0.0 and 1.0")
            }
        }
        if (request.requiredMealIds.any { it.isBlank() }) {
            throw IllegalArgumentException("Required meal IDs must not be blank")
        }
        val overlap = normalizeCapabilities(request.hardConstraints.requiredCapabilities)
            .intersect(normalizeCapabilities(request.hardConstraints.excludedCapabilities))
        if (overlap.isNotEmpty()) {
            throw IllegalArgumentException("Capabilities cannot be both required and excluded: ${overlap.sorted().joinToString()}")
        }
    }

    private fun normalizeCapabilityShares(shares: Map<String, Double>): Map<String, Double> {
        val normalized = sortedMapOf<String, Double>()
        shares.entries.sortedBy { it.key }.forEach { (capability, share) ->
            val key = capability.trim().lowercase()
            normalized[key] = max(normalized[key] ?: 0.0, share)
        }
        return normalized
    }

    private fun resolveMealCount(template: EventTemplate, requestMealCount: Int?): Int? {
        requestMealCount?.let { return it }
        val configured = template.defaults["mealCount"] ?: return null
        if (!configured.isFinite() || configured <= 0.0 || configured > Int.MAX_VALUE || configured % 1.0 != 0.0) {
            throw PlanResolutionException(
                "Template '${template.templateId}' default mealCount must be a positive whole number",
            )
        }
        return configured.toInt()
    }

    private fun selectLegacyMeals(
        template: EventTemplate,
        meals: List<Meal>,
        requiredMeals: List<Meal>,
        constraints: HardConstraints,
        preferences: CustomerPreferences,
        weights: Map<String, Double>,
        guestCount: Int,
        warnings: MutableList<String>,
        fulfilledRequirements: MutableList<FulfilledRequirement>,
    ): MealSelectionOutcome {
        val requiredMealsById = requiredMeals.associateBy { it.mealId }
        val unassignedRequiredMealIds = requiredMealsById.keys.toSortedSet()
        val assignedMealIds = mutableSetOf<String>()
        val selections = template.requirements
            .filter { it.type.equals("meal", ignoreCase = true) }
            .mapNotNull { requirement ->
                val requiredCapabilities = normalizeCapabilities(requirement.requiredCapabilities) + constraints.requiredCapabilities
                val candidates = meals.asSequence()
                    .filter { normalizeCapabilities(it.capabilities).containsAll(requiredCapabilities) }
                    .filter { normalizeCapabilities(it.capabilities).intersect(constraints.excludedCapabilities).isEmpty() }
                    .toList()

                val forcedCandidates = candidates.filter { it.mealId in unassignedRequiredMealIds }
                val unusedCandidates = candidates.filter { it.mealId !in assignedMealIds }
                val selectionCandidates = when {
                    forcedCandidates.isNotEmpty() -> forcedCandidates
                    unusedCandidates.isNotEmpty() -> unusedCandidates
                    else -> candidates
                }
                val scored = selectMeal(selectionCandidates, weights, preferences)
                if (scored == null) {
                    handleMissingRequirement(requirement, requiredCapabilities, guestCount, warnings, fulfilledRequirements)
                    return@mapNotNull null
                }
                assignedMealIds += scored.candidate.mealId
                unassignedRequiredMealIds -= scored.candidate.mealId
                val target = mealTarget(requirement, template, guestCount, scored.candidate, preferences)

                MealSelection(
                    requirement = requirement,
                    requiredCapabilities = requiredCapabilities,
                    scored = scored,
                    target = target,
                    allocationWeight = target.servings.coerceAtLeast(1).toDouble(),
                )
            }
            .toMutableList()

        unassignedRequiredMealIds.forEach { mealId ->
            val meal = requiredMealsById.getValue(mealId)
            val requirement = guaranteedMealRequirement(mealId, constraints)
            val target = mealTarget(requirement, template, guestCount, meal, preferences)
            selections += MealSelection(
                requirement = requirement,
                requiredCapabilities = constraints.requiredCapabilities,
                scored = selectMeal(listOf(meal), weights, preferences)!!,
                target = target,
                allocationWeight = target.servings.coerceAtLeast(1).toDouble(),
            )
        }

        return MealSelectionOutcome(selections = selections)
    }

    private fun selectEnhancedMeals(
        template: EventTemplate,
        meals: List<Meal>,
        requiredMeals: List<Meal>,
        desiredMealCount: Int?,
        capabilityShares: Map<String, Double>,
        constraints: HardConstraints,
        preferences: CustomerPreferences,
        weights: Map<String, Double>,
        request: ResolvePlanRequest,
        warnings: MutableList<String>,
        fulfilledRequirements: MutableList<FulfilledRequirement>,
    ): MealSelectionOutcome {
        val validMeals = meals.asSequence()
            .distinctBy { it.mealId }
            .filter { mealAllowed(it, constraints) }
            .sortedBy { it.mealId }
            .toList()
        val templateMealCapabilitySets = template.requirements.asSequence()
            .filter { it.type.equals("meal", ignoreCase = true) }
            .map { normalizeCapabilities(it.requiredCapabilities) }
            .toList()
        val automaticallySelectableMeals = validMeals.filter { meal ->
            val capabilities = normalizeCapabilities(meal.capabilities)
            templateMealCapabilitySets.any { capabilities.containsAll(it) }
        }
        val requiredMealsById = requiredMeals.associateBy { it.mealId }
        val unassignedRequiredMealIds = requiredMealsById.keys.toSortedSet()
        val selectedById = linkedMapOf<String, MealSelection>()
        val additionalMatches = mutableListOf<RequirementMatch>()
        var baselineTotalServings = 0

        fun missingShares(): Map<String, Double> {
            val represented = selectedById.values.asSequence()
                .flatMap { normalizeCapabilities(it.scored.candidate.capabilities).asSequence() }
                .toSet()
            return capabilityShares.filter { (capability, share) -> share > 0.0 && capability !in represented }
        }

        fun addSelection(
            scored: ScoredCandidate<Meal>,
            requirement: TemplateRequirement,
            requiredCapabilities: Set<String>,
            target: MealTarget,
            contributesToBaseline: Boolean,
        ) {
            selectedById[scored.candidate.mealId] = MealSelection(
                requirement = requirement,
                requiredCapabilities = requiredCapabilities,
                scored = scored,
                target = target,
                allocationWeight = if (contributesToBaseline) target.servings.coerceAtLeast(1).toDouble() else 0.0,
            )
        }

        template.requirements.filter { it.type.equals("meal", ignoreCase = true) }.forEach { requirement ->
            val requiredCapabilities = normalizeCapabilities(requirement.requiredCapabilities) + constraints.requiredCapabilities
            val candidates = validMeals.filter { meal ->
                normalizeCapabilities(meal.capabilities).containsAll(requiredCapabilities)
            }
            val forcedCandidates = candidates.filter { it.mealId in unassignedRequiredMealIds }
            val unusedCandidates = candidates.filter { it.mealId !in selectedById }
            val alreadySelectedCandidates = candidates.filter { it.mealId in selectedById }
            val hasCapacity = desiredMealCount == null || selectedById.size < desiredMealCount
            val chosen = when {
                forcedCandidates.isNotEmpty() ->
                    selectMealForCapabilities(forcedCandidates, missingShares(), capabilityShares, weights, preferences)
                unusedCandidates.isNotEmpty() && hasCapacity ->
                    selectMealForCapabilities(unusedCandidates, missingShares(), capabilityShares, weights, preferences)
                alreadySelectedCandidates.isNotEmpty() ->
                    selectMealForCapabilities(alreadySelectedCandidates, missingShares(), capabilityShares, weights, preferences)
                requirement.required && unusedCandidates.isNotEmpty() ->
                    selectMealForCapabilities(unusedCandidates, missingShares(), capabilityShares, weights, preferences)
                else -> null
            }
            if (chosen == null) {
                handleMissingRequirement(
                    requirement,
                    requiredCapabilities,
                    request.guestCount,
                    warnings,
                    fulfilledRequirements,
                )
                return@forEach
            }

            val target = mealTarget(requirement, template, request.guestCount, chosen.candidate, preferences)
            baselineTotalServings += target.servings
            val existing = selectedById[chosen.candidate.mealId]
            if (existing == null) {
                addSelection(chosen, requirement, requiredCapabilities, target, contributesToBaseline = true)
            } else {
                existing.allocationWeight += target.servings.coerceAtLeast(1)
                additionalMatches += RequirementMatch(requirement, requiredCapabilities, chosen.candidate.mealId)
            }
            unassignedRequiredMealIds -= chosen.candidate.mealId
        }

        unassignedRequiredMealIds.forEach { mealId ->
            val meal = requiredMealsById.getValue(mealId)
            val requirement = guaranteedMealRequirement(mealId, constraints)
            val target = mealTarget(requirement, template, request.guestCount, meal, preferences)
            baselineTotalServings += target.servings
            addSelection(
                scored = selectMeal(listOf(meal), weights, preferences)!!,
                requirement = requirement,
                requiredCapabilities = constraints.requiredCapabilities,
                target = target,
                contributesToBaseline = true,
            )
        }

        val totalServings = request.servingsPerGuest
            ?.let { request.guestCount * it }
            ?: baselineTotalServings.takeIf { it > 0 }
            ?: request.guestCount
        if (selectedById.size > totalServings) {
            throw PlanResolutionException(
                "Cannot allocate $totalServings total servings across ${selectedById.size} required distinct meals",
            )
        }

        val selectionLimit = desiredMealCount?.coerceAtMost(totalServings) ?: totalServings
        if (desiredMealCount != null && desiredMealCount > totalServings) {
            warnings += "Requested $desiredMealCount distinct meals, but $totalServings total servings allow at most $totalServings meals."
        }

        while (missingShares().isNotEmpty() && selectedById.size < selectionLimit) {
            val missing = missingShares()
            val candidates = automaticallySelectableMeals.filter { meal ->
                meal.mealId !in selectedById &&
                    normalizeCapabilities(meal.capabilities).any { it in missing }
            }
            val chosen = selectMealForCapabilities(candidates, missing, capabilityShares, weights, preferences) ?: break
            val requirement = additionalMealRequirement(chosen.candidate.mealId, constraints)
            addSelection(
                scored = chosen,
                requirement = requirement,
                requiredCapabilities = constraints.requiredCapabilities,
                target = MealTarget(Quantity(1.0, "serving"), 1),
                contributesToBaseline = false,
            )
        }

        while (desiredMealCount != null && selectedById.size < selectionLimit) {
            val candidates = automaticallySelectableMeals.filter { it.mealId !in selectedById }
            val chosen = selectMealForCapabilities(
                candidates,
                emptyMap(),
                capabilityShares,
                weights,
                preferences,
            ) ?: break
            val requirement = additionalMealRequirement(chosen.candidate.mealId, constraints)
            addSelection(
                scored = chosen,
                requirement = requirement,
                requiredCapabilities = constraints.requiredCapabilities,
                target = MealTarget(Quantity(1.0, "serving"), 1),
                contributesToBaseline = false,
            )
        }

        if (desiredMealCount != null && selectedById.size > desiredMealCount) {
            warnings += "Requested $desiredMealCount distinct meals, but ${selectedById.size} are needed to preserve required meals and mandatory template requirements."
        }
        val attainableGoal = desiredMealCount?.coerceAtMost(totalServings)
        if (attainableGoal != null && selectedById.size < attainableGoal) {
            warnings += "Requested $desiredMealCount distinct meals, but only ${selectedById.size} valid distinct meals were available."
        }

        val fallbackWeight = selectedById.values
            .map { it.allocationWeight }
            .filter { it > 0.0 }
            .average()
            .takeIf { it.isFinite() }
            ?: 1.0
        selectedById.values.filter { it.allocationWeight <= 0.0 }.forEach {
            it.allocationWeight = fallbackWeight
        }

        return MealSelectionOutcome(
            selections = selectedById.values.toMutableList(),
            additionalRequirementMatches = additionalMatches,
            totalServings = totalServings,
        )
    }

    private fun guaranteedMealRequirement(mealId: String, constraints: HardConstraints) = TemplateRequirement(
        requirementId = "guaranteed-$mealId",
        type = "meal",
        requiredCapabilities = constraints.requiredCapabilities,
        target = RequirementTarget(amount = 1.0, unit = "servings-per-guest"),
        required = true,
    )

    private fun additionalMealRequirement(mealId: String, constraints: HardConstraints) = TemplateRequirement(
        requirementId = "additional-$mealId",
        type = "meal",
        requiredCapabilities = constraints.requiredCapabilities,
        required = false,
    )

    private fun resolveRequiredMeals(
        requestedIds: Set<String>,
        meals: List<Meal>,
        constraints: HardConstraints,
    ): List<Meal> {
        if (requestedIds.isEmpty()) return emptyList()

        val mealsByNormalizedId = meals.associateBy { it.mealId.lowercase() }
        val normalizedIds = requestedIds.map { it.trim().lowercase() }.toSortedSet()
        val missingIds = normalizedIds.filter { it !in mealsByNormalizedId }
        if (missingIds.isNotEmpty()) {
            throw PlanResolutionException("Unknown required meal IDs: ${missingIds.joinToString()}")
        }

        return normalizedIds.map { mealsByNormalizedId.getValue(it) }.distinctBy { it.mealId }.sortedBy { it.mealId }.onEach { meal ->
            val capabilities = normalizeCapabilities(meal.capabilities)
            val missingCapabilities = constraints.requiredCapabilities - capabilities
            if (missingCapabilities.isNotEmpty()) {
                throw PlanResolutionException(
                    "Required meal '${meal.mealId}' does not satisfy hard capabilities ${missingCapabilities.sorted()}",
                )
            }
            val excludedCapabilities = capabilities.intersect(constraints.excludedCapabilities)
            if (excludedCapabilities.isNotEmpty()) {
                throw PlanResolutionException(
                    "Required meal '${meal.mealId}' has excluded capabilities ${excludedCapabilities.sorted()}",
                )
            }
            val excludedIngredients = meal.ingredients.map { it.concept.trim().lowercase() }
                .intersect(constraints.excludedConcepts)
            if (excludedIngredients.isNotEmpty()) {
                throw PlanResolutionException(
                    "Required meal '${meal.mealId}' uses excluded ingredients ${excludedIngredients.sorted()}",
                )
            }
        }
    }

    private fun resolveWeights(defaults: Map<String, Double>, overrides: Map<String, Double>): Map<String, Double> {
        val merged = linkedMapOf<String, Double>()
        defaults.toSortedMap().forEach { (key, value) -> merged[key] = value }
        overrides.toSortedMap().forEach { (key, value) -> merged[key] = value }
        if (merged.isEmpty()) throw IllegalArgumentException("At least one scoring weight is required")
        merged.forEach { (key, value) ->
            if (key.isBlank() || !value.isFinite() || value !in 0.0..1.0) {
                throw IllegalArgumentException("Weight '$key' must be between 0.0 and 1.0")
            }
        }
        val total = merged.values.sum()
        if (total <= 0.0) throw IllegalArgumentException("At least one scoring weight must be greater than zero")
        return merged.mapValuesTo(linkedMapOf()) { (_, value) -> value / total }
    }

    private fun normalized(constraints: HardConstraints) = HardConstraints(
        requiredCapabilities = normalizeCapabilities(constraints.requiredCapabilities),
        excludedCapabilities = normalizeCapabilities(constraints.excludedCapabilities),
        excludedConcepts = constraints.excludedConcepts.map { it.trim().lowercase() }.filter { it.isNotBlank() }.toSortedSet(),
    )

    private fun normalizeCapabilities(capabilities: Collection<String>): Set<String> =
        capabilities.map { it.trim().lowercase() }.filter { it.isNotBlank() }.toSortedSet()

    private fun mealAllowed(meal: Meal, constraints: HardConstraints): Boolean {
        val capabilities = normalizeCapabilities(meal.capabilities)
        val ingredientConcepts = meal.ingredients.map { it.concept.trim().lowercase() }.toSet()
        return capabilities.containsAll(constraints.requiredCapabilities) &&
            capabilities.intersect(constraints.excludedCapabilities).isEmpty() &&
            ingredientConcepts.intersect(constraints.excludedConcepts).isEmpty()
    }

    private fun productAllowed(product: Product, constraints: HardConstraints): Boolean =
        product.concept.lowercase() !in constraints.excludedConcepts &&
            normalizeCapabilities(product.capabilities).intersect(constraints.excludedCapabilities).isEmpty()

    private fun selectMeal(
        candidates: List<Meal>,
        weights: Map<String, Double>,
        preferences: CustomerPreferences,
    ): ScoredCandidate<Meal>? = candidates.map { candidate ->
        score(candidate, candidate.mealId, candidate.scores, candidate.capabilities, weights, preferences)
    }.sortedWith(scoredComparator()).firstOrNull()

    private fun selectMealForCapabilities(
        candidates: List<Meal>,
        priorityCapabilityShares: Map<String, Double>,
        allCapabilityShares: Map<String, Double>,
        weights: Map<String, Double>,
        preferences: CustomerPreferences,
    ): ScoredCandidate<Meal>? = candidates.map { candidate ->
        score(candidate, candidate.mealId, candidate.scores, candidate.capabilities, weights, preferences)
    }.sortedWith(
        compareByDescending<ScoredCandidate<Meal>> { scored ->
            val capabilities = normalizeCapabilities(scored.candidate.capabilities)
            priorityCapabilityShares.filterKeys { it in capabilities }.values.sum()
        }.thenByDescending { scored ->
            val capabilities = normalizeCapabilities(scored.candidate.capabilities)
            priorityCapabilityShares.keys.count { it in capabilities }
        }.thenByDescending { scored ->
            val capabilities = normalizeCapabilities(scored.candidate.capabilities)
            allCapabilityShares.filterKeys { it in capabilities }.values.sum()
        }.thenByDescending { scored ->
            val capabilities = normalizeCapabilities(scored.candidate.capabilities)
            allCapabilityShares.keys.count { it in capabilities }
        }.thenByDescending { it.weightedScore }
            .thenByDescending { it.preferenceMatches.size }
            .thenBy { it.id },
    ).firstOrNull()

    private fun selectProduct(
        candidates: List<Product>,
        weights: Map<String, Double>,
        preferences: CustomerPreferences,
    ): ScoredCandidate<Product>? = candidates.map { candidate ->
        score(candidate, candidate.productId, candidate.scores, candidate.capabilities, weights, preferences)
    }.sortedWith(scoredComparator()).firstOrNull()

    private fun <T> score(
        candidate: T,
        id: String,
        rawScores: Map<String, Double>,
        capabilities: Set<String>,
        weights: Map<String, Double>,
        preferences: CustomerPreferences,
    ): ScoredCandidate<T> {
        val components = weights.keys.associateWithTo(linkedMapOf()) { key ->
            (rawScores[key] ?: 0.0).coerceIn(0.0, 1.0)
        }
        val score = weights.entries.sumOf { (key, weight) -> (components[key] ?: 0.0) * weight }
        val preferenceMatches = normalizeCapabilities(capabilities)
            .intersect(preferences.preferredCapabilities)
            .toSortedSet()
        return ScoredCandidate(candidate, id, components, score, preferenceMatches)
    }

    private fun <T> scoredComparator(): Comparator<ScoredCandidate<T>> =
        compareByDescending<ScoredCandidate<T>> { it.weightedScore }
            .thenByDescending { it.preferenceMatches.size }
            .thenBy { it.id }

    private fun allocateEnhancedMealTargets(
        selections: List<MealSelection>,
        totalServings: Int,
        guestCount: Int,
        servingsPerGuest: Int?,
        capabilityShares: Map<String, Double>,
        warnings: MutableList<String>,
    ): List<MealTarget> {
        if (selections.isEmpty()) {
            val positiveShares = capabilityShares.filterValues { it > 0.0 }
            if (positiveShares.isNotEmpty()) {
                handleCapabilityShortfalls(
                    requiredServings = positiveShares.mapValues { (_, share) -> ceil(totalServings * share).toInt() },
                    providedServings = positiveShares.mapValues { 0 },
                    totalServings = totalServings,
                    guestCount = guestCount,
                    servingsPerGuest = servingsPerGuest,
                    capabilityShares = positiveShares,
                    warnings = warnings,
                )
            }
            return emptyList()
        }
        if (selections.size > totalServings) {
            throw PlanResolutionException(
                "Cannot allocate $totalServings total servings across ${selections.size} distinct meals",
            )
        }

        val mealCapabilities = selections.map { normalizeCapabilities(it.scored.candidate.capabilities) }
        val allocations = IntArray(selections.size) { 1 }
        val requiredServings = capabilityShares
            .filterValues { it > 0.0 }
            .mapValues { (_, share) -> ceil(totalServings * share).toInt() }
        val providedServings = requiredServings.keys.associateWithTo(linkedMapOf()) { capability ->
            allocations.indices.sumOf { index ->
                if (capability in mealCapabilities[index]) allocations[index] else 0
            }
        }
        var remaining = totalServings - allocations.sum()

        while (remaining > 0 && requiredServings.any { (capability, target) ->
                providedServings.getValue(capability) < target
            }
        ) {
            var bestIndex = -1
            var bestUtility = 0.0
            var bestCoverage = 0
            for (index in selections.indices) {
                var utility = 0.0
                var coverage = 0
                requiredServings.forEach { (capability, target) ->
                    val deficit = target - providedServings.getValue(capability)
                    if (deficit > 0 && capability in mealCapabilities[index]) {
                        utility += deficit.toDouble() / target
                        coverage += 1
                    }
                }
                val currentBest = bestIndex.takeIf { it >= 0 }?.let { selections[it] }
                val selection = selections[index]
                val isBetter = utility > bestUtility + 0.000_000_1 ||
                    (kotlin.math.abs(utility - bestUtility) <= 0.000_000_1 && coverage > bestCoverage) ||
                    (kotlin.math.abs(utility - bestUtility) <= 0.000_000_1 && coverage == bestCoverage &&
                        currentBest != null && selection.scored.weightedScore > currentBest.scored.weightedScore) ||
                    (kotlin.math.abs(utility - bestUtility) <= 0.000_000_1 && coverage == bestCoverage &&
                        currentBest != null && selection.scored.weightedScore == currentBest.scored.weightedScore &&
                        selection.scored.candidate.mealId < currentBest.scored.candidate.mealId)
                if (isBetter) {
                    bestIndex = index
                    bestUtility = utility
                    bestCoverage = coverage
                }
            }
            if (bestIndex < 0 || bestUtility <= 0.0) break
            allocations[bestIndex] += 1
            remaining -= 1
            requiredServings.keys.forEach { capability ->
                if (capability in mealCapabilities[bestIndex]) {
                    providedServings[capability] = providedServings.getValue(capability) + 1
                }
            }
        }

        if (remaining > 0) {
            val rawWeights = selections.map { it.allocationWeight.coerceAtLeast(0.0) }
            val effectiveWeights = if (rawWeights.sum() > 0.0) rawWeights else selections.map { 1.0 }
            val weightTotal = effectiveWeights.sum()
            val rawExtras = effectiveWeights.map { it / weightTotal * remaining }
            rawExtras.forEachIndexed { index, raw -> allocations[index] += floor(raw).toInt() }
            var remainder = totalServings - allocations.sum()
            val remainderOrder = selections.indices.sortedWith(
                compareByDescending<Int> { rawExtras[it] - floor(rawExtras[it]) }
                    .thenBy { selections[it].scored.candidate.mealId },
            )
            var orderIndex = 0
            while (remainder > 0) {
                allocations[remainderOrder[orderIndex % remainderOrder.size]] += 1
                orderIndex += 1
                remainder -= 1
            }
        }

        val finalProvidedServings = requiredServings.keys.associateWith { capability ->
            allocations.indices.sumOf { index ->
                if (capability in mealCapabilities[index]) allocations[index] else 0
            }
        }
        handleCapabilityShortfalls(
            requiredServings = requiredServings,
            providedServings = finalProvidedServings,
            totalServings = totalServings,
            guestCount = guestCount,
            servingsPerGuest = servingsPerGuest,
            capabilityShares = capabilityShares,
            warnings = warnings,
        )

        return selections.mapIndexed { index, selection ->
            resizeMealTarget(selection.target, selection.scored.candidate, allocations[index])
        }
    }

    private fun handleCapabilityShortfalls(
        requiredServings: Map<String, Int>,
        providedServings: Map<String, Int>,
        totalServings: Int,
        guestCount: Int,
        servingsPerGuest: Int?,
        capabilityShares: Map<String, Double>,
        warnings: MutableList<String>,
    ) {
        val shortfalls = requiredServings.toSortedMap().mapNotNull { (capability, required) ->
            val provided = providedServings[capability] ?: 0
            if (provided >= required) return@mapNotNull null
            val requestedShare = capabilityShares.getValue(capability)
            "Capability '$capability' requires ${formatPercent(requestedShare)} " +
                "($required of $totalServings servings), but only $provided servings " +
                "(${formatPercent(provided.toDouble() / totalServings)}) can be provided."
        }
        if (shortfalls.isEmpty()) return

        val effectiveServingsPerGuest = servingsPerGuest
            ?: ceil(totalServings.toDouble() / guestCount).toInt().coerceAtLeast(1)
        if (effectiveServingsPerGuest <= 2) {
            throw PlanResolutionException(
                "Cannot fulfill capability shares for a meal-like plan: ${shortfalls.joinToString(" ")}",
            )
        }
        warnings += shortfalls
    }

    private fun formatPercent(share: Double): String =
        String.format(java.util.Locale.ROOT, "%.1f%%", share * 100.0)

    private fun applyServingsOverride(
        selections: List<MealSelection>,
        guestCount: Int,
        servingsPerGuest: Int?,
    ): List<MealTarget> {
        if (servingsPerGuest == null || selections.isEmpty()) return selections.map { it.target }

        val minimums = selections.map { if (it.requirement.required) 1 else 0 }
        val requestedTotal = guestCount * servingsPerGuest
        val totalToAllocate = max(requestedTotal, minimums.sum())
        val remaining = totalToAllocate - minimums.sum()
        val baselineWeights = selections.map { it.target.servings.coerceAtLeast(1).toDouble() }
        val baselineTotal = baselineWeights.sum()
        val rawExtras = baselineWeights.map { it / baselineTotal * remaining }
        val allocations = rawExtras.mapIndexed { index, raw -> minimums[index] + floor(raw).toInt() }.toMutableList()

        var remainder = totalToAllocate - allocations.sum()
        val remainderOrder = selections.indices.sortedWith(
            compareByDescending<Int> { rawExtras[it] - floor(rawExtras[it]) }
                .thenBy { selections[it].requirement.requirementId },
        )
        var orderIndex = 0
        while (remainder > 0) {
            allocations[remainderOrder[orderIndex % remainderOrder.size]] += 1
            orderIndex += 1
            remainder -= 1
        }

        return selections.mapIndexed { index, selection ->
            resizeMealTarget(selection.target, selection.scored.candidate, allocations[index])
        }
    }

    private fun resizeMealTarget(target: MealTarget, meal: Meal, servings: Int): MealTarget {
        val amount = when (UnitConverter.dimension(target.quantity.unit)) {
            "piece" -> servings * meal.serving.piecesPerServing.coerceAtLeast(1.0)
            "serving" -> servings.toDouble()
            else -> target.quantity.amount * servings / target.servings.coerceAtLeast(1)
        }
        return MealTarget(Quantity(decimal(amount), target.quantity.unit), servings)
    }

    private fun mealTarget(
        requirement: TemplateRequirement,
        template: EventTemplate,
        guestCount: Int,
        meal: Meal,
        preferences: CustomerPreferences,
    ): MealTarget {
        requirement.target.amount?.let {
            val quantity = scaledTarget(requirement, guestCount)
            val servings = when (UnitConverter.dimension(quantity.unit)) {
                "piece" -> ceil(quantity.amount / meal.serving.piecesPerServing.coerceAtLeast(1.0)).toInt()
                "serving" -> ceil(quantity.amount).toInt()
                else -> ceil(quantity.amount).toInt()
            }
            return MealTarget(quantity, servings)
        }

        requirement.target.share?.let { templateShare ->
            val share = if ("vegetarian" in normalizeCapabilities(requirement.requiredCapabilities)) {
                preferences.vegetarianShare ?: templateShare
            } else {
                templateShare
            }
            if (!share.isFinite() || share !in 0.0..1.0) {
                throw IllegalArgumentException("Share for requirement '${requirement.requirementId}' must be between 0.0 and 1.0")
            }
            val pieceBaseline = template.requirements.firstOrNull {
                it.type.equals("meal", true) && it.target.amount != null &&
                    it.target.unit?.lowercase()?.startsWith("piece") == true
            }
            if (pieceBaseline != null) {
                val pieces = (pieceBaseline.target.amount ?: 0.0) * guestCount * share
                return MealTarget(
                    Quantity(decimal(pieces), "piece"),
                    ceil(pieces / meal.serving.piecesPerServing.coerceAtLeast(1.0)).toInt(),
                )
            }
            val servings = ceil(guestCount * share).toInt()
            return MealTarget(Quantity(servings.toDouble(), "serving"), servings)
        }

        return MealTarget(Quantity(guestCount.toDouble(), "serving"), guestCount)
    }

    private fun scaledTarget(requirement: TemplateRequirement, guestCount: Int): Quantity {
        val amount = requirement.target.amount
            ?: throw PlanResolutionException("Requirement '${requirement.requirementId}' has no amount target")
        val rawUnit = requirement.target.unit
            ?: throw PlanResolutionException("Requirement '${requirement.requirementId}' has no target unit")
        val perGuest = rawUnit.lowercase().endsWith("-per-guest")
        val unit = if (perGuest) rawUnit.dropLast("-per-guest".length) else rawUnit
        val scaledAmount = amount * if (perGuest) guestCount else 1
        return Quantity(decimal(scaledAmount), UnitConverter.canonical(unit))
    }

    private fun canConvert(target: Quantity, product: Product): Boolean {
        if (UnitConverter.areCompatible(target.unit, product.packageInfo.unit)) return true
        val conversion = product.conversion ?: return false
        return UnitConverter.areCompatible(target.unit, conversion.servingUnit) &&
            UnitConverter.areCompatible(conversion.sourceUnit, product.packageInfo.unit)
    }

    private fun convertTargetToPackageUnit(target: Quantity, product: Product): Double {
        if (UnitConverter.areCompatible(target.unit, product.packageInfo.unit)) {
            val base = UnitConverter.toBase(target.amount, target.unit)
            return UnitConverter.fromBase(base.amount, product.packageInfo.unit)
        }
        val conversion = product.conversion
            ?: throw PlanResolutionException("Product '${product.productId}' cannot convert ${target.unit} to ${product.packageInfo.unit}")
        if (!UnitConverter.areCompatible(target.unit, conversion.servingUnit) ||
            !UnitConverter.areCompatible(conversion.sourceUnit, product.packageInfo.unit)
        ) {
            throw PlanResolutionException("Product '${product.productId}' has an incompatible serving conversion")
        }
        val source = UnitConverter.toBase(target.amount * conversion.amountPerServing, conversion.sourceUnit)
        return UnitConverter.fromBase(source.amount, product.packageInfo.unit)
    }

    private fun addProductNeed(
        productNeeds: MutableMap<String, ProductAccumulator>,
        scored: ScoredCandidate<Product>,
        amountInPackageUnit: Double,
    ) {
        val product = scored.candidate
        val amountBase = UnitConverter.toBase(amountInPackageUnit, product.packageInfo.unit).amount
        val accumulator = productNeeds.getOrPut(product.productId) {
            ProductAccumulator(product, scored.components, scored.weightedScore)
        }
        accumulator.amountBase += amountBase
    }

    private fun buildShoppingItem(need: ProductAccumulator, ledger: InventoryLedger): ShoppingItem {
        val product = need.product
        val packageBase = UnitConverter.toBase(product.packageInfo.amount, product.packageInfo.unit).amount
        if (packageBase <= 0.0) throw PlanResolutionException("Product '${product.productId}' has an invalid package size")
        val dimension = UnitConverter.dimension(product.packageInfo.unit)
        val usedBase = ledger.consume(product.concept, dimension, need.amountBase)
        val netBase = max(0.0, need.amountBase - usedBase)
        val packageCount = if (UnitConverter.nearlyZero(netBase)) 0 else ceil(netBase / packageBase).toInt()
        val purchasedBase = packageCount * packageBase
        val overbuyBase = max(0.0, purchasedBase - netBase)
        val unit = UnitConverter.canonical(product.packageInfo.unit)
        val lineTotal = money(packageCount * product.price.amount)

        fun display(baseAmount: Double) = Quantity(
            decimal(UnitConverter.fromBase(baseAmount, product.packageInfo.unit)),
            unit,
        )

        return ShoppingItem(
            productId = product.productId,
            sku = product.sku,
            name = product.name,
            concept = product.concept,
            originCountry = product.originCountry,
            packageSize = Quantity(decimal(product.packageInfo.amount), unit),
            packageCount = packageCount,
            requiredQuantity = display(need.amountBase),
            inventoryUsed = display(usedBase),
            netRequiredQuantity = display(netBase),
            purchasedQuantity = display(purchasedBase),
            overbuyQuantity = display(overbuyBase),
            unitPrice = Money(money(product.price.amount), product.price.currency),
            lineTotal = Money(lineTotal, product.price.currency),
            scoreComponents = need.scoreComponents,
            finalWeightedScore = decimal(need.weightedScore, 4),
        )
    }

    private fun handleMissingRequirement(
        requirement: TemplateRequirement,
        requiredCapabilities: Set<String>,
        guestCount: Int,
        warnings: MutableList<String>,
        fulfilledRequirements: MutableList<FulfilledRequirement>,
    ) {
        if (requirement.required) {
            throw PlanResolutionException(
                "No candidate satisfies required requirement '${requirement.requirementId}' with capabilities ${requiredCapabilities.sorted()}",
            )
        }
        val target = runCatching { scaledTarget(requirement, guestCount) }
            .getOrElse { Quantity(0.0, "unspecified") }
        warnings += "Optional requirement '${requirement.requirementId}' could not be fulfilled."
        fulfilledRequirements += FulfilledRequirement(
            requirementId = requirement.requirementId,
            type = requirement.type,
            required = false,
            requiredCapabilities = requiredCapabilities.toSortedSet(),
            matchedCapabilities = emptySet(),
            targetQuantity = target,
            fulfilled = false,
        )
    }

    private fun decimal(value: Double, scale: Int = 3): Double =
        BigDecimal.valueOf(value).setScale(scale, RoundingMode.HALF_UP).stripTrailingZeros().toDouble()

    private fun money(value: Double): Double =
        BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).toDouble()

    private fun Double.formatMoney(): String = String.format(java.util.Locale.ROOT, "%.2f", this)

    private data class MealTarget(val quantity: Quantity, val servings: Int)

    private data class MealSelection(
        val requirement: TemplateRequirement,
        val requiredCapabilities: Set<String>,
        val scored: ScoredCandidate<Meal>,
        val target: MealTarget,
        var allocationWeight: Double,
    )

    private data class MealSelectionOutcome(
        val selections: MutableList<MealSelection>,
        val additionalRequirementMatches: List<RequirementMatch> = emptyList(),
        val totalServings: Int = 0,
    )

    private data class RequirementMatch(
        val requirement: TemplateRequirement,
        val requiredCapabilities: Set<String>,
        val mealId: String,
    )

    private data class ScoredCandidate<T>(
        val candidate: T,
        val id: String,
        val components: Map<String, Double>,
        val weightedScore: Double,
        val preferenceMatches: Set<String>,
    )

    private data class IngredientAccumulator(
        val concept: String,
        val dimension: String,
        val baseUnit: String,
        var amountBase: Double = 0.0,
        val sourceMealIds: MutableSet<String> = sortedSetOf(),
    )

    private data class ProductAccumulator(
        val product: Product,
        val scoreComponents: Map<String, Double>,
        val weightedScore: Double,
        var amountBase: Double = 0.0,
    )

    private class InventoryLedger(items: List<InventoryItem>) {
        private val stocks = items.map { item ->
            val base = UnitConverter.toBase(item.amount, item.unit)
            Stock(item.concept.trim().lowercase(), item.unit, base.dimension, base.amount)
        }.toMutableList()

        fun consume(concept: String, dimension: String, requestedBase: Double): Double {
            var remaining = requestedBase
            var used = 0.0
            stocks.asSequence()
                .filter { it.concept == concept.lowercase() && it.dimension == dimension }
                .forEach { stock ->
                    if (remaining <= 0.0) return@forEach
                    val amount = min(stock.remainingBase, remaining)
                    stock.remainingBase -= amount
                    remaining -= amount
                    used += amount
                }
            return used
        }

        fun unused(): List<InventoryUsage> = stocks.asSequence()
            .filter { it.remainingBase > 0.000_000_1 }
            .map {
                InventoryUsage(
                    concept = it.concept,
                    quantity = Quantity(
                        BigDecimal.valueOf(UnitConverter.fromBase(it.remainingBase, it.originalUnit))
                            .setScale(3, RoundingMode.HALF_UP).stripTrailingZeros().toDouble(),
                        UnitConverter.canonical(it.originalUnit),
                    ),
                )
            }
            .sortedWith(compareBy<InventoryUsage> { it.concept }.thenBy { it.quantity.unit })
            .toList()

        private data class Stock(
            val concept: String,
            val originalUnit: String,
            val dimension: String,
            var remainingBase: Double,
        )
    }
}
