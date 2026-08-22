package ch.inabox.catering.service

import ch.inabox.catering.model.Meal
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.stereotype.Service
import java.util.regex.Pattern

@Service
class MealCatalogService(private val mongoTemplate: MongoTemplate) {
    fun search(queryText: String?, categoryId: String?, capability: String?, limit: Int): List<Meal> {
        val criteria = mutableListOf<Criteria>()

        val normalizedCategory = categoryId?.trim()?.lowercase().orEmpty()
        if (normalizedCategory.isNotBlank()) {
            criteria += categoryCriteria(normalizedCategory)
        }

        val normalizedCapability = capability?.trim()?.lowercase().orEmpty()
        if (normalizedCapability.isNotBlank()) {
            criteria += Criteria.where("capabilities").`is`(normalizedCapability)
        }

        val normalizedQuery = queryText?.trim().orEmpty()
        if (normalizedQuery.isNotBlank()) {
            val regex = Pattern.compile(Pattern.quote(normalizedQuery), Pattern.CASE_INSENSITIVE)
            criteria += Criteria().orOperator(
                Criteria.where("name").regex(regex),
                Criteria.where("id").regex(regex),
                Criteria.where("capabilities").regex(regex),
                Criteria.where("ingredients.concept").regex(regex),
            )
        }

        val query = Query()
        when (criteria.size) {
            1 -> query.addCriteria(criteria.first())
            in 2..Int.MAX_VALUE -> query.addCriteria(Criteria().andOperator(*criteria.toTypedArray()))
        }

        query.with(Sort.by(Sort.Direction.ASC, "name"))
        query.limit(limit.coerceIn(1, 100))
        return mongoTemplate.find(query, Meal::class.java)
    }

    fun capabilities(): List<String> = mongoTemplate
        .findDistinct(Query(), "capabilities", Meal::class.java, String::class.java)
        .map { it.trim().lowercase() }
        .filter { it.isNotBlank() }
        .distinct()
        .sorted()

    private fun categoryCriteria(categoryId: String): Criteria {
        val categoryIdMatch = Criteria.where("categoryIds").`is`(categoryId)
        val legacyMatch = legacyCategoryCriteria(categoryId) ?: return categoryIdMatch
        return Criteria().orOperator(categoryIdMatch, legacyMatch)
    }

    /**
     * Compatibility for databases created before meals had categoryIds.
     * Once categoryIds are present, the first branch above is what matches.
     */
    private fun legacyCategoryCriteria(categoryId: String): Criteria? = when (categoryId) {
        "fruit" -> textMatch("fruit|apple")
        "bakery" -> textMatch("croissant|quiche|pastry|bread|bakery")
        "meat" -> textMatch("ham|meat|beef|chicken|pork|salami")
        "plant-based" -> Criteria.where("capabilities").`in`("vegetarian", "vegan")
        "breakfast" -> Criteria.where("capabilities").`in`("breakfast", "brunch", "coffee-break")
        "lunch" -> Criteria.where("capabilities").`in`("lunch", "buffet")
        "reception" -> Criteria.where("capabilities").`in`("apero", "reception", "finger-food")
        else -> null
    }

    private fun textMatch(pattern: String): Criteria {
        val regex = Pattern.compile(pattern, Pattern.CASE_INSENSITIVE)
        return Criteria().orOperator(
            Criteria.where("name").regex(regex),
            Criteria.where("ingredients.concept").regex(regex),
        )
    }
}
