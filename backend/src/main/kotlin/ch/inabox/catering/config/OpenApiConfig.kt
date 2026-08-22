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

The catalog endpoints expose event templates, meals, purchasable products, and the scoring priorities used by the resolver. Plan resolution applies capability constraints before scoring, normalizes the effective scoring weights, expands selected meals into ingredient quantities, enforces excluded concepts while resolving products, consumes compatible existing inventory, rounds remaining needs to purchasable package counts, and returns an explainable shopping plan.

All catalog data in this proof of concept is mocked and seeded from `mongo/seed.js`. No authentication is required.""",
    ),
    tags = [
        Tag(
            name = "Catalog",
            description = "Read the seeded planning inputs. Catalog IDs are stable API identifiers, not MongoDB object IDs.",
        ),
        Tag(
            name = "Planning",
            description = "Resolve an event request into selected meals, ingredient needs, inventory usage, and a package-level shopping list.",
        ),
    ],
)
class OpenApiConfig
