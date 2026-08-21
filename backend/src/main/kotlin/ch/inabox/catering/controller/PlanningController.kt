package ch.inabox.catering.controller

import ch.inabox.catering.model.ResolvePlanRequest
import ch.inabox.catering.model.ShoppingPlan
import ch.inabox.catering.service.PlanningService
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/plans")
class PlanningController(private val planningService: PlanningService) {
    @PostMapping("/resolve")
    @ResponseStatus(HttpStatus.OK)
    fun resolve(@Valid @RequestBody request: ResolvePlanRequest): ShoppingPlan = planningService.resolve(request)
}
