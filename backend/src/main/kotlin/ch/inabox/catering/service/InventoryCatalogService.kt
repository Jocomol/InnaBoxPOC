package ch.inabox.catering.service

import ch.inabox.catering.model.Product
import io.swagger.v3.oas.annotations.media.Schema
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.stereotype.Service
import java.util.regex.Pattern

@Schema(description = "Distinct product concept offered as an existing-inventory input option.")
data class InventoryConceptOption(
    @field:Schema(description = "Canonical concept value accepted by `availableInventory[].concept`.", example = "mini-spinach-quiche")
    val concept: String,
    @field:Schema(description = "Human-readable label derived from the concept.", example = "Mini Spinach Quiche")
    val label: String,
    @field:Schema(description = "Package unit suggested for the inventory amount.", example = "piece")
    val suggestedUnit: String,
)

@Service
class InventoryCatalogService(private val mongoTemplate: MongoTemplate) {
    fun search(queryText: String?, limit: Int): List<InventoryConceptOption> {
        val safeLimit = limit.coerceIn(1, 100)
        val query = Query()
        val normalizedQuery = queryText?.trim().orEmpty()

        if (normalizedQuery.isNotBlank()) {
            val regex = Pattern.compile(Pattern.quote(normalizedQuery), Pattern.CASE_INSENSITIVE)
            query.addCriteria(
                Criteria().orOperator(
                    Criteria.where("concept").regex(regex),
                    Criteria.where("name").regex(regex),
                    Criteria.where("sku").regex(regex),
                ),
            )
        }

        query.with(Sort.by(Sort.Direction.ASC, "concept", "name"))
        query.limit((safeLimit * 8).coerceAtMost(500))

        return mongoTemplate.find(query, Product::class.java)
            .asSequence()
            .filter { it.concept.isNotBlank() }
            .distinctBy { it.concept.trim().lowercase() }
            .take(safeLimit)
            .map { product ->
                InventoryConceptOption(
                    concept = product.concept,
                    label = humanize(product.concept),
                    suggestedUnit = product.packageInfo.unit,
                )
            }
            .toList()
    }

    private fun humanize(value: String): String = value
        .replace('-', ' ')
        .replace('_', ' ')
        .split(' ')
        .filter { it.isNotBlank() }
        .joinToString(" ") { word -> word.replaceFirstChar { it.uppercase() } }
}
