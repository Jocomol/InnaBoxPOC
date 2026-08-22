package ch.inabox.catering.controller

import ch.inabox.catering.service.TranslationBatchResult
import ch.inabox.catering.service.TranslationInput
import ch.inabox.catering.service.TranslationService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController


data class TranslationBatchRequest(
    val targetLanguage: String,
    val sourceLanguage: String = "en",
    val items: List<TranslationInput> = emptyList(),
)

data class TranslationStatus(
    val provider: String,
    val ready: Boolean,
    val databaseIndependent: Boolean = true,
    val defaultLanguage: String = "en",
    val supportedLanguages: List<String> = listOf("en", "de", "fr", "it"),
    val localizedSearch: Boolean = true,
)

@RestController
@RequestMapping("/api/i18n")
class TranslationController(private val translationService: TranslationService) {
    @GetMapping("/status")
    fun status() = TranslationStatus(
        provider = translationService.providerName(),
        ready = translationService.providerReady(),
    )

    @PostMapping("/translate")
    fun translate(@RequestBody request: TranslationBatchRequest): TranslationBatchResult =
        translationService.translate(
            items = request.items,
            targetLanguage = request.targetLanguage,
            sourceLanguage = request.sourceLanguage,
        )
}
