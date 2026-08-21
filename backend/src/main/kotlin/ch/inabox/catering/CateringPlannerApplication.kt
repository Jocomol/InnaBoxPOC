package ch.inabox.catering

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class CateringPlannerApplication

fun main(args: Array<String>) {
    runApplication<CateringPlannerApplication>(*args)
}
