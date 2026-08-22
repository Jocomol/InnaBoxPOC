package ch.inabox.catering.model

import io.swagger.v3.oas.annotations.media.Schema

@Schema(description = "RFC 9457 problem detail returned for a documented API error.")
data class ApiProblem(
    @field:Schema(description = "URI identifying the problem type.", example = "about:blank")
    val type: String = "about:blank",
    @field:Schema(description = "Short, stable summary of the error.", example = "Request validation failed")
    val title: String,
    @field:Schema(description = "HTTP status code.", example = "400")
    val status: Int,
    @field:Schema(
        description = "Request-specific explanation. Validation errors are sorted by field and separated with semicolons.",
        example = "guestCount: must be greater than or equal to 1",
    )
    val detail: String,
    @field:Schema(description = "Request URI supplied by the web framework.", example = "/api/plans/resolve")
    val instance: String,
)
