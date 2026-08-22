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

Resolution loads the template and scoring-priority defaults, merges and normalizes weight overrides, applies capability constraints, ranks the remaining candidates, expands meals into ingredient needs, enforces concept exclusions while selecting products, consumes compatible inventory, rounds net requirements to whole product packages, and calculates budget totals. Repeating the request against an unchanged catalog returns the same selections.

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
                description = "The JSON body, bean-validation constraints, hard-constraint combination, priority IDs, or weight values are invalid.",
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
                description = "The request is valid, but required meals, hard constraints, template requirements, or purchasable products make the plan impossible to resolve.",
                content = [
                    Content(
                        mediaType = "application/problem+json",
                        schema = Schema(implementation = ApiProblem::class),
                        examples = [
                            ExampleObject(
                                name = "Unresolvable plan",
                                value = """{"type":"about:blank","title":"Plan cannot be resolved","status":422,"detail":"Unknown required meal IDs: unknown-meal","instance":"/api/plans/resolve"}""",
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
            description = "Event inputs and optional overrides. Only `templateId`, `guestCount`, and `budget` are required.",
            required = true,
            content = [
                Content(
                    mediaType = "application/json",
                    schema = Schema(implementation = ResolvePlanRequest::class),
                    examples = [
                        ExampleObject(
                            name = "Business apéro for 40 guests",
                            summary = "Uses only IDs and concepts present in the seeded mock catalog",
                            value = """{
  "templateId": "business-apero",
  "guestCount": 40,
  "budget": 800,
  "servingsPerGuest": 4,
  "requiredMealIds": ["mini-spinach-quiche"],
  "preferences": {
    "vegetarianShare": 0.3,
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
    {"concept": "mini-spinach-quiche", "amount": 40, "unit": "piece"}
  ],
  "hardConstraints": {
    "requiredCapabilities": [],
    "excludedCapabilities": [],
    "excludedConcepts": []
  }
}""",
                        ),
                    ],
                ),
            ],
        )
        @RequestBody request: ResolvePlanRequest,
    ): ShoppingPlan = planningService.resolve(request)
}
