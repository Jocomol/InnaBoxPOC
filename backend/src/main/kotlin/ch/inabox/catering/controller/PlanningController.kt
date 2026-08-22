package ch.inabox.catering.controller

import ch.inabox.catering.model.ApiProblem
import ch.inabox.catering.model.ResolvePlanRequest
import ch.inabox.catering.model.ShoppingPlan
import ch.inabox.catering.service.PlanningService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.ExampleObject
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.parameters.RequestBody as OpenApiRequestBody
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/plans")
@Tag(name = "Planning")
class PlanningController(private val planningService: PlanningService) {
    @PostMapping("/resolve")
    @ResponseStatus(HttpStatus.OK)
    @Operation(
        operationId = "resolvePlan",
        summary = "Resolve a catering plan",
        description = """Builds a deterministic plan from the selected template and the current catalog.

Resolution loads the template and scoring-priority defaults, resolves the requested or template-default dish count, applies event/menu hard constraints, ranks valid candidates, and allocates exact total servings across the selected meals. Dietary coverage is evaluated separately through `dietaryShares`, so a dietary request does not become a global hard filter on every dish. Overlapping dietary shares are supported and do not need to sum to 1.

`requiredMealIds` pins dishes into the next result. `excludedMealIds` removes individual dishes from both legacy and enhanced automatic selection before scoring. IDs are matched case-insensitively, must exist in the meal catalog, and cannot appear in both fields.

The canonical `dietaryShares` field wins whenever it is present, including `{}`. If it is omitted, the resolver falls back to deprecated `capabilityShares`, then legacy `selectedConstraintIds` and `preferences.vegetarianShare`. A dietary shortfall makes a meal-like plan (at most two servings per guest) unresolvable; snack-style plans return the best allocation with a warning.

Selected meals are expanded into ingredient needs, excluded concepts are enforced while products are selected, compatible inventory is consumed, remaining needs are rounded to whole product packages, and budget totals are calculated. Repeating the request against an unchanged catalog returns the same selections.

The budget is informational: an over-budget result is returned with a warning and `totals.budgetStatus` set to `OVER_BUDGET`.""",
    )
    @ApiResponses(
        value = [
            ApiResponse(
                responseCode = "200",
                description = "Plan resolved successfully, including plans that exceed the requested budget.",
                content = [Content(mediaType = "application/json", schema = Schema(implementation = ShoppingPlan::class))],
            ),
            ApiResponse(
                responseCode = "400",
                description = "The JSON body, bean-validation constraints, required/excluded meal combination, meal count, dietary share values, hard-constraint combination, priority IDs, or weight values are invalid.",
                content = [
                    Content(
                        mediaType = "application/problem+json",
                        schema = Schema(implementation = ApiProblem::class),
                        examples = [
                            ExampleObject(
                                name = "Validation error",
                                value = """{"type":"about:blank","title":"Request validation failed","status":400,"detail":"guestCount: must be greater than or equal to 1","instance":"/api/plans/resolve"}""",
                            ),
                            ExampleObject(
                                name = "Malformed JSON",
                                value = """{"type":"about:blank","title":"Malformed request body","status":400,"detail":"Request body is missing, malformed, or contains a value of the wrong type","instance":"/api/plans/resolve"}""",
                            ),
                            ExampleObject(
                                name = "Required/excluded meal conflict",
                                value = """{"type":"about:blank","title":"Invalid planning request","status":400,"detail":"Meal IDs cannot be both required and excluded: falafel-bites","instance":"/api/plans/resolve"}""",
                            ),
                        ],
                    ),
                ],
            ),
            ApiResponse(
                responseCode = "404",
                description = "No event template has the requested `templateId`.",
                content = [
                    Content(
                        mediaType = "application/problem+json",
                        schema = Schema(implementation = ApiProblem::class),
                        examples = [
                            ExampleObject(
                                name = "Unknown template",
                                value = """{"type":"about:blank","title":"Template not found","status":404,"detail":"Event template 'unknown' was not found","instance":"/api/plans/resolve"}""",
                            ),
                        ],
                    ),
                ],
            ),
            ApiResponse(
                responseCode = "422",
                description = "The request is valid, but an unknown required/excluded meal ID, required meals, hard constraints, mandatory template requirements, a meal-like dietary shortfall, or purchasable products make the plan impossible to resolve.",
                content = [
                    Content(
                        mediaType = "application/problem+json",
                        schema = Schema(implementation = ApiProblem::class),
                        examples = [
                            ExampleObject(
                                name = "Unresolvable plan",
                                value = """{"type":"about:blank","title":"Plan cannot be resolved","status":422,"detail":"Unknown required meal IDs: unknown-meal","instance":"/api/plans/resolve"}""",
                            ),
                            ExampleObject(
                                name = "Unknown excluded meal",
                                value = """{"type":"about:blank","title":"Plan cannot be resolved","status":422,"detail":"Unknown excluded meal IDs: unknown-meal","instance":"/api/plans/resolve"}""",
                            ),
                        ],
                    ),
                ],
            ),
        ],
    )
    fun resolve(
        @Valid
        @OpenApiRequestBody(
            description = "Event inputs and optional overrides. Only `templateId`, `guestCount`, and `budget` are required. Prefer `dietaryShares` over deprecated compatibility fields.",
            required = true,
            content = [
                Content(
                    mediaType = "application/json",
                    schema = Schema(implementation = ResolvePlanRequest::class),
                    examples = [
                        ExampleObject(
                            name = "Mixed-dietary team lunch",
                            summary = "Canonical dish-count and dietary-share request using the seeded catalog",
                            value = """{
  "templateId": "team-lunch-buffet",
  "guestCount": 40,
  "budget": 1600,
  "servingsPerGuest": 1,
  "mealCount": 3,
  "dietaryShares": {
    "vegetarian": 0.25,
    "halal": 0.15,
    "gluten-free": 0.1
  },
  "preferences": {
    "preferredCapabilities": ["prepare-ahead"]
  },
  "weights": {
    "price": 0.3,
    "swiss": 0.25,
    "presentation": 0.2,
    "prepEase": 0.15,
    "sustainability": 0.1
  },
  "availableInventory": [
    {"concept": "rice", "amount": 1000, "unit": "g"}
  ],
  "hardConstraints": {
    "requiredCapabilities": [],
    "excludedCapabilities": [],
    "excludedConcepts": []
  }
}""",
                        ),
                        ExampleObject(
                            name = "Business apéro",
                            summary = "Minimal request with a guaranteed seeded dish",
                            value = """{
  "templateId": "business-apero",
  "guestCount": 40,
  "budget": 800,
  "servingsPerGuest": 4,
  "mealCount": 5,
  "requiredMealIds": ["mini-spinach-quiche"],
  "excludedMealIds": ["falafel-bites"]
}""",
                        ),
                    ],
                ),
            ],
        )
        @RequestBody request: ResolvePlanRequest,
    ): ShoppingPlan = planningService.resolve(request)
}
