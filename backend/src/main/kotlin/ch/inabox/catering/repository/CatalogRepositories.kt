package ch.inabox.catering.repository

import ch.inabox.catering.model.EventTemplate
import ch.inabox.catering.model.Meal
import ch.inabox.catering.model.PlanningPriority
import ch.inabox.catering.model.Product
import org.bson.types.ObjectId
import org.springframework.data.mongodb.repository.MongoRepository
import org.springframework.data.mongodb.repository.Query

interface EventTemplateRepository : MongoRepository<EventTemplate, ObjectId> {
    @Query("{ 'id': ?0 }")
    fun findByTemplateId(templateId: String): EventTemplate?
}

interface MealRepository : MongoRepository<Meal, ObjectId>

interface ProductRepository : MongoRepository<Product, ObjectId>

interface PlanningPriorityRepository : MongoRepository<PlanningPriority, ObjectId>
