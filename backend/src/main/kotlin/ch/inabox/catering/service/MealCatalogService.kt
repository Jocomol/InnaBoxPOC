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
    fun search(queryText: String?, categoryId: String?, limit: Int): List<Meal> {
        val criteria = mutableListOf<Criteria>()
        val normalizedCategory = categoryId?.trim()?.lowercase().orEmpty()
        if (normalizedCategory.isNotBlank()) {
            criteria += Criteria.where("categoryIds").`is`(normalizedCategory)
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
        if (criteria.size == 1) {
            query.addCriteria(criteria.first())
        } else if (criteria.size > 1) {
            query.addCriteria(Criteria().andOperator(*criteria.toTypedArray()))
        }

        query.with(Sort.by(Sort.Direction.ASC, "name"))
        query.limit(limit.coerceIn(1, 100))
        return mongoTemplate.find(query, Meal::class.java)
    }
}
