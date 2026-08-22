package ch.inabox.catering.service

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.core.env.Environment
import org.springframework.stereotype.Service
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.util.Collections
import java.util.LinkedHashMap
import java.util.Locale
import java.util.concurrent.atomic.AtomicLong


data class TranslationInput(
    val text: String,
    val context: String = "generic",
)

data class TranslationOutput(
    val text: String,
    val context: String,
    val translatedText: String,
    val translated: Boolean,
)

data class TranslationBatchResult(
    val targetLanguage: String,
    val sourceLanguage: String,
    val provider: String,
    val items: List<TranslationOutput>,
)

/**
 * Database-independent translation facade.
 *
 * Static application copy is translated in the browser. Catalog content is sent here in batches.
 * A small culinary terminology layer corrects predictable generic-MT mistakes, while every unknown
 * future catalog value still falls through to the configured translation provider.
 */
@Service
class TranslationService(
    private val objectMapper: ObjectMapper,
    private val environment: Environment,
) {
    private val httpClient: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofMillis(connectTimeoutMs()))
        .build()

    private val cache: MutableMap<String, String> = Collections.synchronizedMap(
        object : LinkedHashMap<String, String>(1024, 0.75f, true) {
            override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, String>?): Boolean =
                size > cacheSize()
        },
    )

    private val unavailableUntil = AtomicLong(0)
    private val lastReadyCheckAt = AtomicLong(0)
    @Volatile private var lastReadyResult = false

    fun providerName(): String = provider()

    fun providerReady(force: Boolean = false): Boolean {
        val provider = provider()
        if (provider == "none") return false

        val now = System.currentTimeMillis()
        if (now < unavailableUntil.get()) return false
        if (!force && now - lastReadyCheckAt.get() < readyCheckCacheMs()) return lastReadyResult

        val ready = try {
            when (provider) {
                "libretranslate", "libre" -> getJson("${libreTranslateBaseUrl()}/languages", providerCheckTimeoutMs()).isArray
                "deepl" -> apiKey().isNotBlank()
                else -> false
            }
        } catch (_: Exception) {
            false
        }

        lastReadyCheckAt.set(now)
        lastReadyResult = ready
        if (!ready) unavailableUntil.set(now + circuitBreakerMs())
        return ready
    }

    fun translate(
        items: List<TranslationInput>,
        targetLanguage: String,
        sourceLanguage: String = "en",
    ): TranslationBatchResult {
        val target = normalizeLanguage(targetLanguage)
        val source = normalizeSourceLanguage(sourceLanguage)
        val safeItems = items.take(maxBatchSize()).map { item ->
            TranslationInput(
                text = item.text.trim().take(maxTextLength()),
                context = item.context.trim().ifBlank { "generic" }.take(80),
            )
        }

        require(target in supportedTargetLanguages()) { "Unsupported target language '$target'" }
        require(source == "auto" || source in supportedSourceLanguages()) { "Unsupported source language '$source'" }

        val provider = provider()
        if (safeItems.isEmpty() || source == target || (target == "en" && source == "en")) {
            return originalResult(target, source, provider, safeItems)
        }

        val outputs = MutableList(safeItems.size) { index ->
            val item = safeItems[index]
            TranslationOutput(item.text, item.context, item.text, false)
        }
        val providerItems = mutableListOf<Pair<Int, TranslationInput>>()

        safeItems.forEachIndexed { index, item ->
            val override = culinaryOverride(item.text, source, target, item.context)
            if (override != null) {
                outputs[index] = TranslationOutput(item.text, item.context, override, true)
                cache[cacheKey(target, source, item)] = override
                return@forEachIndexed
            }
            val cached = cache[cacheKey(target, source, item)]
            if (cached != null) {
                outputs[index] = TranslationOutput(item.text, item.context, cached, true)
            } else {
                providerItems += index to item
            }
        }

        if (providerItems.isEmpty() || provider == "none" || !providerReady()) {
            return TranslationBatchResult(target, source, provider, outputs)
        }

        val translated = when (provider) {
            "libretranslate", "libre" -> translateWithLibreTranslate(providerItems.map { it.second }, target, source)
            "deepl" -> translateWithDeepL(providerItems.map { it.second }, target, source)
            else -> providerItems.map { (_, item) -> TranslationOutput(item.text, item.context, item.text, false) }
        }

        providerItems.forEachIndexed { translatedIndex, (outputIndex, item) ->
            val result = translated.getOrNull(translatedIndex)
                ?: TranslationOutput(item.text, item.context, item.text, false)
            val corrected = if (result.translated) {
                postProcessTranslation(result.translatedText, item.text, source, target, item.context)
            } else {
                result.translatedText
            }
            outputs[outputIndex] = result.copy(translatedText = corrected)
            if (result.translated && corrected.isNotBlank()) {
                cache[cacheKey(target, source, item)] = corrected
            }
        }

        return TranslationBatchResult(target, source, provider, outputs)
    }

    /**
     * Produces English search variants for localized catalog search.
     * Generic machine translation handles future terms; the culinary aliases improve partial-word
     * and food-domain searches such as "Rührei", "gekratzt", "pomodoro", or "œufs brouillés".
     */
    fun searchVariants(query: String?, sourceLanguage: String): List<String> {
        val raw = query?.trim().orEmpty()
        if (raw.isBlank()) return listOf("")
        val source = normalizeLanguage(sourceLanguage)
        val variants = linkedSetOf(raw)
        val culinaryAliases = culinarySearchAliases(raw, source)
        variants += culinaryAliases

        // A known culinary alias is already a high-confidence English search term and avoids
        // adding provider latency on every keypress. Unknown future terms still use MT below.
        if (source != "en" && culinaryAliases.isEmpty()) {
            val translated = translate(
                items = listOf(TranslationInput(raw, "search-query")),
                targetLanguage = "en",
                sourceLanguage = source,
            ).items.firstOrNull()?.translatedText.orEmpty().trim()
            if (translated.isNotBlank()) variants += translated
        }

        return variants.filter { it.isNotBlank() }.take(8)
    }

    private fun translateWithLibreTranslate(
        items: List<TranslationInput>,
        target: String,
        source: String,
    ): List<TranslationOutput> {
        if (items.isEmpty()) return emptyList()
        return try {
            val body = linkedMapOf<String, Any>(
                "q" to items.map { it.text },
                "source" to source,
                "target" to target,
                "format" to "text",
            )
            apiKey().takeIf { it.isNotBlank() }?.let { body["api_key"] = it }

            val response = postJson("${libreTranslateBaseUrl()}/translate", body, requestTimeoutMs())
            val node = response.path("translatedText")
            val translatedTexts = when {
                node.isArray -> node.map { it.asText() }
                items.size == 1 -> listOf(node.asText(items.first().text))
                else -> emptyList()
            }
            if (translatedTexts.size != items.size) {
                throw IllegalStateException("Translation provider returned ${translatedTexts.size} results for ${items.size} inputs")
            }
            markProviderHealthy()
            items.mapIndexed { index, item ->
                val translated = translatedTexts[index].ifBlank { item.text }
                TranslationOutput(item.text, item.context, translated, translated != item.text)
            }
        } catch (_: Exception) {
            markProviderUnavailable()
            items.map { TranslationOutput(it.text, it.context, it.text, false) }
        }
    }

    private fun translateWithDeepL(
        items: List<TranslationInput>,
        target: String,
        source: String,
    ): List<TranslationOutput> {
        if (items.isEmpty()) return emptyList()
        return try {
            val body = linkedMapOf<String, Any>(
                "text" to items.map { it.text },
                "target_lang" to target.uppercase(),
            )
            if (source != "auto") body["source_lang"] = source.uppercase()
            val response = postJson(
                deeplUrl(),
                body,
                requestTimeoutMs(),
                headers = mapOf("Authorization" to "DeepL-Auth-Key ${apiKey()}"),
            )
            val translations = response.path("translations")
            markProviderHealthy()
            items.mapIndexed { index, item ->
                val translated = translations.path(index).path("text").asText(item.text).ifBlank { item.text }
                TranslationOutput(item.text, item.context, translated, translated != item.text)
            }
        } catch (_: Exception) {
            markProviderUnavailable()
            items.map { TranslationOutput(it.text, it.context, it.text, false) }
        }
    }

    private fun culinaryOverride(text: String, source: String, target: String, context: String): String? {
        val normalized = normalizePhrase(text)
        if (source != "en") {
            val english = reverseCulinaryTerms[source]?.get(normalized)
            if (english != null && target == "en") return english
        }
        if (source != "en" || target == "en") return null

        val exact = culinaryTerms[normalized]?.get(target)
        if (exact != null) return exact

        // Preserve conventional names and brands instead of asking MT to invent a literal equivalent.
        if (normalized in preserveTerms) return text
        if (context.contains("sku", ignoreCase = true) || context.contains("id", ignoreCase = true)) return text
        return null
    }

    private fun postProcessTranslation(
        translated: String,
        original: String,
        source: String,
        target: String,
        context: String,
    ): String {
        var value = translated.trim().ifBlank { original }
        if (source == "en" && target == "de") {
            val normalized = normalizePhrase(value)
            value = when {
                normalized in setOf("gekratzte eier", "zerkratzte eier", "kratzte eier", "rühreier") && normalizePhrase(original) == "scrambled eggs" -> "Rührei"
                else -> value
            }
            value = value
                .replace("Finger Essen", "Fingerfood", ignoreCase = true)
                .replace("Finger-Essen", "Fingerfood", ignoreCase = true)
                .replace("vorbereiten im Voraus", "im Voraus vorbereiten", ignoreCase = true)
        }
        if (context.contains("meal-name") && normalizePhrase(original) == "bircher müesli") return "Bircher Müesli"
        return value
    }

    private fun culinarySearchAliases(query: String, language: String): Set<String> {
        val normalized = normalizePhrase(query)
        val aliases = linkedSetOf<String>()

        reverseCulinaryTerms[language]?.forEach { (localized, english) ->
            if (localized.contains(normalized) || normalized.contains(localized)) aliases += english
        }

        val tokenAliases = searchTokenAliases[language].orEmpty()
        val ascii = normalized
            .replace("ä", "ae")
            .replace("ö", "oe")
            .replace("ü", "ue")
            .replace("ß", "ss")
        tokenAliases.forEach { (needle, english) ->
            if (normalized.contains(needle) || ascii.contains(needle)) aliases += english
        }
        return aliases
    }

    private fun normalizePhrase(value: String): String = value
        .trim()
        .lowercase(Locale.ROOT)
        .replace(Regex("\\s+"), " ")
        .trim('.', ',', ':', ';', '!', '?')

    private fun originalResult(
        target: String,
        source: String,
        provider: String,
        items: List<TranslationInput>,
    ) = TranslationBatchResult(
        targetLanguage = target,
        sourceLanguage = source,
        provider = provider,
        items = items.map { TranslationOutput(it.text, it.context, it.text, false) },
    )

    private fun markProviderUnavailable() {
        lastReadyResult = false
        lastReadyCheckAt.set(System.currentTimeMillis())
        unavailableUntil.set(System.currentTimeMillis() + circuitBreakerMs())
    }

    private fun markProviderHealthy() {
        lastReadyResult = true
        lastReadyCheckAt.set(System.currentTimeMillis())
        unavailableUntil.set(0)
    }

    private fun postJson(
        url: String,
        body: Any,
        timeoutMs: Long,
        headers: Map<String, String> = emptyMap(),
    ): JsonNode {
        val requestBuilder = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofMillis(timeoutMs))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
        headers.forEach(requestBuilder::header)
        val response = httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString())
        if (response.statusCode() !in 200..299) {
            throw IllegalStateException("Translation provider returned HTTP ${response.statusCode()}")
        }
        return objectMapper.readTree(response.body())
    }

    private fun getJson(url: String, timeoutMs: Long): JsonNode {
        val request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofMillis(timeoutMs))
            .GET()
            .build()
        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        if (response.statusCode() !in 200..299) {
            throw IllegalStateException("Translation provider returned HTTP ${response.statusCode()}")
        }
        return objectMapper.readTree(response.body())
    }

    private fun cacheKey(target: String, source: String, item: TranslationInput): String =
        "$target|$source|${item.context}|${item.text}"

    private fun normalizeLanguage(value: String): String = value.trim().lowercase().substringBefore('-').ifBlank { "en" }
    private fun normalizeSourceLanguage(value: String): String =
        value.trim().lowercase().let { if (it.isBlank() || it == "auto") "auto" else it.substringBefore('-') }

    private fun provider(): String = setting("TABLEPLAN_TRANSLATION_PROVIDER", "tableplan.translation.provider", "none")
        .trim().lowercase()

    private fun apiKey(): String = setting("TABLEPLAN_TRANSLATION_API_KEY", "tableplan.translation.api-key", "")

    private fun libreTranslateBaseUrl(): String = setting(
        "TABLEPLAN_TRANSLATION_BASE_URL",
        "tableplan.translation.base-url",
        "http://libretranslate:5000",
    ).trimEnd('/').removeSuffix("/translate")

    private fun deeplUrl(): String = setting(
        "TABLEPLAN_TRANSLATION_BASE_URL",
        "tableplan.translation.base-url",
        "https://api-free.deepl.com/v2/translate",
    )

    private fun connectTimeoutMs(): Long = setting(
        "TABLEPLAN_TRANSLATION_CONNECT_TIMEOUT_MS",
        "tableplan.translation.connect-timeout-ms",
        "1200",
    ).toLongOrNull()?.coerceIn(300, 5000) ?: 1200

    private fun providerCheckTimeoutMs(): Long = setting(
        "TABLEPLAN_TRANSLATION_CHECK_TIMEOUT_MS",
        "tableplan.translation.check-timeout-ms",
        "1500",
    ).toLongOrNull()?.coerceIn(300, 5000) ?: 1500

    private fun requestTimeoutMs(): Long = setting(
        "TABLEPLAN_TRANSLATION_TIMEOUT_MS",
        "tableplan.translation.timeout-ms",
        "3500",
    ).toLongOrNull()?.coerceIn(500, 15000) ?: 3500

    private fun circuitBreakerMs(): Long = setting(
        "TABLEPLAN_TRANSLATION_RETRY_MS",
        "tableplan.translation.retry-ms",
        "5000",
    ).toLongOrNull()?.coerceIn(1000, 60000) ?: 5000

    private fun readyCheckCacheMs(): Long = 3000
    private fun cacheSize(): Int = setting("TABLEPLAN_TRANSLATION_CACHE_SIZE", "tableplan.translation.cache-size", "30000")
        .toIntOrNull()?.coerceIn(100, 200000) ?: 30000

    private fun maxBatchSize(): Int = 100
    private fun maxTextLength(): Int = 4000

    private fun supportedTargetLanguages(): Set<String> = setOf("de", "fr", "it", "en")
    private fun supportedSourceLanguages(): Set<String> = supportedTargetLanguages()

    private fun setting(envName: String, propertyName: String, defaultValue: String): String =
        System.getenv(envName)?.takeIf { it.isNotBlank() }
            ?: environment.getProperty(propertyName)?.takeIf { it.isNotBlank() }
            ?: defaultValue

    private val preserveTerms = setOf(
        "bircher müesli",
        "caprese",
        "falafel",
        "hummus",
        "gruyère",
        "cappuccino",
        "espresso",
    )

    private val culinaryTerms = mapOf(
        "scrambled eggs" to mapOf("de" to "Rührei", "fr" to "Œufs brouillés", "it" to "Uova strapazzate"),
        "fruit salad" to mapOf("de" to "Obstsalat", "fr" to "Salade de fruits", "it" to "Macedonia di frutta"),
        "fresh fruit" to mapOf("de" to "Frisches Obst", "fr" to "Fruits frais", "it" to "Frutta fresca"),
        "cherry tomato" to mapOf("de" to "Cherrytomate", "fr" to "Tomate cerise", "it" to "Pomodorino"),
        "cherry tomatoes" to mapOf("de" to "Cherrytomaten", "fr" to "Tomates cerises", "it" to "Pomodorini"),
        "smoked salmon" to mapOf("de" to "Räucherlachs", "fr" to "Saumon fumé", "it" to "Salmone affumicato"),
        "rice paper rolls" to mapOf("de" to "Reispapierrollen", "fr" to "Rouleaux de papier de riz", "it" to "Involtini di carta di riso"),
        "gluten-free" to mapOf("de" to "Glutenfrei", "fr" to "Sans gluten", "it" to "Senza glutine"),
        "lactose-free" to mapOf("de" to "Laktosefrei", "fr" to "Sans lactose", "it" to "Senza lattosio"),
        "nut-free" to mapOf("de" to "Nussfrei", "fr" to "Sans fruits à coque", "it" to "Senza frutta a guscio"),
        "vegetarian" to mapOf("de" to "Vegetarisch", "fr" to "Végétarien", "it" to "Vegetariano"),
        "vegan" to mapOf("de" to "Vegan", "fr" to "Végétalien", "it" to "Vegano"),
        "breakfast" to mapOf("de" to "Frühstück", "fr" to "Petit-déjeuner", "it" to "Colazione"),
        "lunch" to mapOf("de" to "Mittagessen", "fr" to "Déjeuner", "it" to "Pranzo"),
        "bakery & pastries" to mapOf("de" to "Backwaren & Gebäck", "fr" to "Boulangerie & pâtisseries", "it" to "Forno & pasticceria"),
        "vegetarian & plant-based" to mapOf("de" to "Vegetarisch & pflanzlich", "fr" to "Végétarien & végétal", "it" to "Vegetariano & vegetale"),
        "apéro & reception" to mapOf("de" to "Apéro & Empfang", "fr" to "Apéritif & réception", "it" to "Aperitivo & ricevimento"),
        "lunch & buffet" to mapOf("de" to "Mittagessen & Buffet", "fr" to "Déjeuner & buffet", "it" to "Pranzo & buffet"),
        "breakfast & brunch" to mapOf("de" to "Frühstück & Brunch", "fr" to "Petit-déjeuner & brunch", "it" to "Colazione & brunch"),
    )

    private val reverseCulinaryTerms: Map<String, Map<String, String>> = buildMap {
        for (language in listOf("de", "fr", "it")) {
            val values = linkedMapOf<String, String>()
            culinaryTerms.forEach { (english, translations) ->
                translations[language]?.let { values[normalizePhrase(it)] = english }
            }
            if (language == "de") {
                values["gekratzte eier"] = "scrambled eggs"
                values["zerkratzte eier"] = "scrambled eggs"
                values["rühreier"] = "scrambled eggs"
            }
            put(language, values)
        }
    }

    private val searchTokenAliases = mapOf(
        "de" to mapOf(
            "ruehr" to "scrambled eggs", "rühr" to "scrambled eggs", "gekratzt" to "scrambled eggs",
            "obst" to "fruit", "frucht" to "fruit", "apfel" to "apple", "wasser" to "water",
            "kaese" to "cheese", "käse" to "cheese", "schinken" to "ham", "huhn" to "chicken",
            "haehn" to "chicken", "hähn" to "chicken", "lachs" to "salmon", "gurke" to "cucumber",
            "tomat" to "tomato", "fruehst" to "breakfast", "frühst" to "breakfast", "mittag" to "lunch",
            "gebaeck" to "pastry", "gebäck" to "pastry", "nuss" to "nut", "glutenfrei" to "gluten-free",
            "laktosefrei" to "lactose-free",
        ),
        "fr" to mapOf(
            "oeuf" to "egg", "œuf" to "egg", "brouill" to "scrambled eggs", "fruit" to "fruit",
            "pomme" to "apple", "eau" to "water", "fromage" to "cheese", "jambon" to "ham",
            "poulet" to "chicken", "saumon" to "salmon", "concombre" to "cucumber", "tomate" to "tomato",
            "petit-dej" to "breakfast", "déjeun" to "lunch", "sans gluten" to "gluten-free",
        ),
        "it" to mapOf(
            "uov" to "egg", "strapazz" to "scrambled eggs", "frutta" to "fruit", "mela" to "apple",
            "acqua" to "water", "formaggio" to "cheese", "prosciutto" to "ham", "pollo" to "chicken",
            "salmone" to "salmon", "cetriolo" to "cucumber", "pomodor" to "tomato", "colazione" to "breakfast",
            "pranzo" to "lunch", "senza glutine" to "gluten-free",
        ),
    )
}
