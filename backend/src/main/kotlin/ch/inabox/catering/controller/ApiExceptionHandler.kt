package ch.inabox.catering.controller

import ch.inabox.catering.service.PlanResolutionException
import ch.inabox.catering.service.TemplateNotFoundException
import org.springframework.http.HttpStatus
import org.springframework.http.ProblemDetail
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(TemplateNotFoundException::class)
    fun notFound(exception: TemplateNotFoundException): ProblemDetail =
        problem(HttpStatus.NOT_FOUND, "Template not found", exception.message)

    @ExceptionHandler(PlanResolutionException::class)
    fun unresolvable(exception: PlanResolutionException): ProblemDetail =
        problem(HttpStatus.UNPROCESSABLE_ENTITY, "Plan cannot be resolved", exception.message)

    @ExceptionHandler(IllegalArgumentException::class)
    fun invalidArgument(exception: IllegalArgumentException): ProblemDetail =
        problem(HttpStatus.BAD_REQUEST, "Invalid planning request", exception.message)

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun validation(exception: MethodArgumentNotValidException): ProblemDetail {
        val details = exception.bindingResult.fieldErrors
            .sortedBy { it.field }
            .joinToString("; ") { "${it.field}: ${it.defaultMessage}" }
        return problem(HttpStatus.BAD_REQUEST, "Request validation failed", details)
    }

    private fun problem(status: HttpStatus, title: String, detail: String?): ProblemDetail =
        ProblemDetail.forStatusAndDetail(status, detail ?: title).also { it.title = title }
}
