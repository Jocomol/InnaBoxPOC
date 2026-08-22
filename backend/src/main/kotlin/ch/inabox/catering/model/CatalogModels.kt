package ch.inabox.catering.model

import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.annotation.JsonProperty
import io.swagger.v3.oas.annotations.media.Schema
import org.bson.types.ObjectId
import org.springframework.data.annotation.Id
import org.springframework.data.mongodb.core.mapping.Document
import org.springframework.data.mongodb.core.mapping.Field

@Schema(description = "Quantity or proportional share configured for a template requirement.")
data class RequirementTarget(
    @field:Schema(description = "Absolute target, optionally scaled per guest according to `unit`.", example = "5")
    val amount: Double? = null,
    @field:Schema(
        description = "Target unit. A `-per-guest` suffix causes the amount to be multiplied by the guest count.",
        example = "pieces-per-guest",
    )
    val unit: String? = null,
    @field:Schema(description = "Fraction of guests for whom this meal requirement is planned.", example = "0.3", minimum = "0", maximum = "1")
    val share: Double? = null,
)

@Schema(description = "One meal or direct-product requirement within an event template.")
data class TemplateRequirement(
    @Field("id")
    @get:JsonProperty("id")
    @field:Schema(description = "Stable requirement ID within its template.", example = "savory-finger-food")
    val requirementId: String,
    @field:Schema(description = "Candidate domain used to satisfy the requirement.", example = "meal", allowableValues = ["meal", "product"])
    val type: String,
    @field:Schema(
        description = "Capabilities that a candidate must contain in full.",
        example = "[\"savory\",\"finger-food\",\"apero\"]",
    )
    val requiredCapabilities: Set<String> = emptySet(),
    val target: RequirementTarget = RequirementTarget(),
    @field:Schema(description = "Whether resolution fails when no candidate is available.", example = "true")
    val required: Boolean = true,
)

@Document("planningPriorities")
@Schema(description = "Catalog-defined scoring dimension and its UI metadata.")
data class PlanningPriority(
    @Id @get:JsonIgnore val mongoId: ObjectId? = null,
    @Field("id")
    @get:JsonProperty("id")
    @field:Schema(description = "Stable key used in weight and score maps.", example = "price")
    val priorityId: String,
    @field:Schema(description = "Human-readable priority name.", example = "Affordability")
    val label: String,
    @field:Schema(description = "Meaning of a high score for this priority.")
    val description: String,
    @field:Schema(description = "Ascending UI display order.", example = "10")
    val displayOrder: Int = 0,
    @field:Schema(description = "Fallback weight used before template and request overrides.", example = "0.2", minimum = "0", maximum = "1")
    val defaultWeight: Double = 0.0,
    @field:Schema(description = "How catalog scores should be interpreted.", example = "continuous", allowableValues = ["continuous", "binary"])
    val scale: String = "continuous",
    @field:Schema(description = "Label for the 0.0 end of the score scale.", example = "Premium")
    val lowLabel: String? = null,
    @field:Schema(description = "Label for the 1.0 end of the score scale.", example = "Economical")
    val highLabel: String? = null,
)

@Document("dietaryConstraints")
@Schema(description = "User-facing dietary option that maps a stable constraint ID to the meal dietary capability used for serving allocation.")
data class DietaryConstraintDefinition(
    @Id @get:JsonIgnore val mongoId: ObjectId? = null,
    @Field("id")
    @get:JsonProperty("id")
    @field:Schema(description = "Stable ID used by legacy `selectedConstraintIds` requests.", example = "gluten-free")
    val constraintId: String,
    @field:Schema(description = "Human-readable dietary option.", example = "Gluten-free")
    val label: String,
    @field:Schema(description = "Explanation shown alongside the dietary guest-count input.")
    val description: String,
    @field:Schema(description = "Ascending UI display order.", example = "40")
    val displayOrder: Int = 0,
    // Legacy metadata retained while existing Mongo volumes are upgraded.
    @field:Schema(description = "Legacy capability mapping retained for older catalog volumes.", deprecated = true)
    val requiredCapabilities: Set<String> = emptySet(),
    @field:Schema(description = "Legacy exclusion metadata retained for compatibility.", deprecated = true)
    val excludedCapabilities: Set<String> = emptySet(),
    @field:Schema(description = "Legacy concept-exclusion metadata retained for compatibility.", deprecated = true)
    val excludedConcepts: Set<String> = emptySet(),
    @field:Schema(
        description = "Canonical key used in `dietaryShares` and matched against `Meal.dietaryCapabilities`. Seeded definitions always provide it; null supports older catalog volumes.",
        example = "gluten-free",
    )
    val dietaryCapability: String? = null,
    @field:Schema(description = "Optional short visual marker rendered by clients, for example an emoji or compact text badge.", example = "GF")
    val icon: String? = null,
)

@Document("mealCategories")
@Schema(description = "Browse category used by meal catalog search and the frontend picker.")
data class MealCategory(
    @Id @get:JsonIgnore val mongoId: ObjectId? = null,
    @Field("id")
    @get:JsonProperty("id")
    @field:Schema(description = "Stable category ID accepted by the meal-search `categoryId` parameter.", example = "lunch")
    val categoryId: String,
    @field:Schema(example = "Lunch & Buffet")
    val label: String,
    @field:Schema(description = "Short explanation of the meals grouped under this category.")
    val description: String = "",
    @field:Schema(description = "Ascending UI display order.", example = "60")
    val displayOrder: Int = 0,
    @field:Schema(description = "Optional short visual marker rendered by clients, for example an emoji or compact text badge.", example = "🍽️")
    val icon: String? = null,
)

@Document("eventTemplates")
@Schema(description = "Reusable event definition containing default values, requirements, and scoring weights.")
data class EventTemplate(
    @Id @get:JsonIgnore val mongoId: ObjectId? = null,
    @Field("id")
    @get:JsonProperty("id")
    @field:Schema(description = "Stable template identifier used when resolving a plan.", example = "business-apero")
    val templateId: String,
    @field:Schema(description = "Human-readable template name.", example = "Business Apéro")
    val name: String,
    @field:Schema(description = "Short description of the event format.")
    val description: String,
    @field:Schema(
        description = "Template-specific numeric defaults. The seeded templates provide `durationMinutes` and `mealCount`; dietary shares are request-specific and are not stored here.",
        example = "{\"durationMinutes\":120,\"mealCount\":5}",
    )
    val defaults: Map<String, Double> = emptyMap(),
    val requirements: List<TemplateRequirement> = emptyList(),
    @field:Schema(
        description = "Relative priority weights. The resolver fills missing values from priority defaults and normalizes the effective map.",
        example = "{\"price\":0.3,\"swiss\":0.2,\"presentation\":0.2,\"prepEase\":0.15,\"sustainability\":0.15}",
    )
    val weights: Map<String, Double> = emptyMap(),
    @field:Schema(description = "Optional short visual marker rendered by clients, for example an emoji.", example = "🥂")
    val icon: String? = null,
)

@Schema(description = "How many physical pieces make one serving of a meal.")
data class ServingInfo(
    @field:Schema(description = "Pieces represented by one serving.", example = "2")
    val piecesPerServing: Double = 1.0,
)

@Schema(description = "Ingredient quantity consumed by one meal serving.")
data class Ingredient(
    @field:Schema(description = "Catalog concept used to locate a purchasable product.", example = "mozzarella")
    val concept: String,
    @field:Schema(description = "Ingredient amount required per serving.", example = "40")
    val amountPerServing: Double,
    @field:Schema(description = "Unit for the per-serving amount.", example = "g")
    val unit: String,
)

@Document("meals")
@Schema(description = "Catalog meal that can satisfy a template meal requirement.")
data class Meal(
    @Id @get:JsonIgnore val mongoId: ObjectId? = null,
    @Field("id")
    @get:JsonProperty("id")
    @field:Schema(description = "Stable meal identifier.", example = "caprese-skewers")
    val mealId: String,
    @field:Schema(description = "Human-readable dish name.", example = "Caprese Skewers")
    val name: String,
    @field:Schema(description = "Browse-category IDs from `GET /api/meal-categories`.", example = "[\"plant-based\",\"reception\"]")
    val categoryIds: Set<String> = emptySet(),
    @field:Schema(
        description = "Event/menu traits used for template matching, hard filtering, and preference tie-breaking. Dietary compatibility is kept separately in `dietaryCapabilities`.",
        example = "[\"savory\",\"finger-food\",\"cold\",\"apero\",\"prepare-ahead\"]",
    )
    val capabilities: Set<String> = emptySet(),
    val serving: ServingInfo = ServingInfo(),
    val ingredients: List<Ingredient> = emptyList(),
    @field:Schema(
        description = "Normalized desirability scores keyed by planning-priority ID; 1.0 is always most desirable.",
        example = "{\"price\":0.65,\"swiss\":1,\"presentation\":0.9,\"prepEase\":0.6,\"sustainability\":0.75}",
    )
    val scores: Map<String, Double> = emptyMap(),
    @field:Schema(
        description = "Positive dietary compatibility tags used to allocate requested serving shares.",
        example = "[\"vegetarian\",\"gluten-free\"]",
    )
    val dietaryCapabilities: Set<String> = emptySet(),
)

@Schema(description = "Quantity contained in one purchasable product package.")
data class PackageInfo(
    @field:Schema(description = "Amount in one package.", example = "1000")
    val amount: Double,
    @field:Schema(description = "Package quantity unit.", example = "g")
    val unit: String,
)

@Schema(description = "Monetary amount. The seeded catalog uses CHF.")
data class Money(
    @field:Schema(description = "Amount rounded to two decimal places for calculated totals.", example = "9.8")
    val amount: Double,
    @field:Schema(description = "ISO 4217 currency code.", example = "CHF")
    val currency: String = "CHF",
)

@Schema(description = "Conversion from a serving-based requirement to the product's physical source quantity.")
data class ProductConversion(
    @field:Schema(description = "Source quantity consumed for one serving.", example = "8")
    val amountPerServing: Double,
    @field:Schema(description = "Serving unit accepted by the template target.", example = "cup")
    val servingUnit: String,
    @field:Schema(description = "Physical unit represented by `amountPerServing`.", example = "g")
    val sourceUnit: String,
)

@Document("products")
@Schema(description = "Purchasable mock catalog item used directly or to fulfill meal ingredient needs.")
data class Product(
    @Id @get:JsonIgnore val mongoId: ObjectId? = null,
    @Field("id")
    @get:JsonProperty("id")
    @field:Schema(description = "Stable product identifier.", example = "mozzarella-1kg")
    val productId: String,
    @field:Schema(description = "Mock stock-keeping unit.", example = "MOCK-001")
    val sku: String,
    @field:Schema(description = "Human-readable package name.", example = "Swiss Mozzarella 1 kg")
    val name: String,
    @field:Schema(description = "Ingredient or supply concept fulfilled by this product.", example = "mozzarella")
    val concept: String,
    @field:Schema(description = "ISO 3166-1 alpha-2 origin country when known.", example = "CH")
    val originCountry: String? = null,
    @Field("package") @get:JsonProperty("package") val packageInfo: PackageInfo,
    val price: Money,
    @field:Schema(
        description = "Product-function traits used for direct template requirements and hard filtering. Dietary compatibility is kept separately in `dietaryCapabilities`.",
        example = "[\"finger-food\",\"ready-to-heat\"]",
    )
    val capabilities: Set<String> = emptySet(),
    @field:Schema(
        description = "Normalized desirability scores keyed by planning-priority ID; 1.0 is always most desirable.",
        example = "{\"price\":0.8,\"swiss\":1,\"sustainability\":0.7}",
    )
    val scores: Map<String, Double> = emptyMap(),
    @field:Schema(description = "Optional conversion used when a requirement is expressed in servings rather than the package unit.")
    val conversion: ProductConversion? = null,
    @field:Schema(
        description = "Positive dietary compatibility tags carried by this product fixture.",
        example = "[\"vegetarian\",\"gluten-free\"]",
    )
    val dietaryCapabilities: Set<String> = emptySet(),
)
