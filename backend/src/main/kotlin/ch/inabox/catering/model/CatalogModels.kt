package ch.inabox.catering.model

import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.annotation.JsonProperty
import org.bson.types.ObjectId
import org.springframework.data.annotation.Id
import org.springframework.data.mongodb.core.mapping.Document
import org.springframework.data.mongodb.core.mapping.Field

data class RequirementTarget(
    val amount: Double? = null,
    val unit: String? = null,
    val share: Double? = null,
)

data class TemplateRequirement(
    @Field("id") @get:JsonProperty("id") val requirementId: String,
    val type: String,
    val requiredCapabilities: Set<String> = emptySet(),
    val target: RequirementTarget = RequirementTarget(),
    val required: Boolean = true,
)

@Document("eventTemplates")
data class EventTemplate(
    @Id @get:JsonIgnore val mongoId: ObjectId? = null,
    @Field("id") @get:JsonProperty("id") val templateId: String,
    val name: String,
    val description: String,
    val defaults: Map<String, Double> = emptyMap(),
    val requirements: List<TemplateRequirement> = emptyList(),
    val weights: Map<String, Double> = emptyMap(),
)

data class ServingInfo(
    val piecesPerServing: Double = 1.0,
)

data class Ingredient(
    val concept: String,
    val amountPerServing: Double,
    val unit: String,
)

@Document("meals")
data class Meal(
    @Id @get:JsonIgnore val mongoId: ObjectId? = null,
    @Field("id") @get:JsonProperty("id") val mealId: String,
    val name: String,
    val capabilities: Set<String> = emptySet(),
    val serving: ServingInfo = ServingInfo(),
    val ingredients: List<Ingredient> = emptyList(),
    val scores: Map<String, Double> = emptyMap(),
)

data class PackageInfo(
    val amount: Double,
    val unit: String,
)

data class Money(
    val amount: Double,
    val currency: String = "CHF",
)

data class ProductConversion(
    val amountPerServing: Double,
    val servingUnit: String,
    val sourceUnit: String,
)

@Document("products")
data class Product(
    @Id @get:JsonIgnore val mongoId: ObjectId? = null,
    @Field("id") @get:JsonProperty("id") val productId: String,
    val sku: String,
    val name: String,
    val concept: String,
    @Field("package") @get:JsonProperty("package") val packageInfo: PackageInfo,
    val price: Money,
    val capabilities: Set<String> = emptySet(),
    val scores: Map<String, Double> = emptyMap(),
    val conversion: ProductConversion? = null,
)
