package ch.inabox.catering.config

import io.swagger.v3.oas.annotations.OpenAPIDefinition
import io.swagger.v3.oas.annotations.info.Info
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.context.annotation.Configuration

@Configuration
@OpenAPIDefinition(
    info = Info(
        title = "Catering Planner API",
        version = "1.0.0",
        description = """Deterministic catering planning API backed by the MongoDB catalog.

The catalog endpoints expose event templates, meals, purchasable products, browse metadata, dietary options, inventory concepts, and the scoring priorities used by the resolver. Event/menu capabilities are intentionally separate from dietary capabilities: use hard constraints for event suitability and `dietaryShares` for serving coverage.

Plan resolution applies the requested or template-default distinct meal count, merges and normalizes scoring weights, allocates exact food servings across the selected dishes, expands meals into ingredient quantities, enforces excluded concepts while resolving products, consumes compatible existing inventory, rounds remaining needs to purchasable package counts, and returns an explainable shopping plan.

All catalog data in this proof of concept is mocked and seeded from `mongo/seed.js`. No authentication is required.""",
    ),
    tags = [
        Tag(
            name = "Catalog",
            description = "Read and search seeded planning inputs and their UI metadata. Catalog IDs are stable API identifiers, not MongoDB object IDs.",
        ),
        Tag(
            name = "Planning",
            description = "Resolve an event request into dietary-aware meal allocations, ingredient needs, inventory usage, and a package-level shopping list.",
        ),
    ],
)
class OpenApiConfig
