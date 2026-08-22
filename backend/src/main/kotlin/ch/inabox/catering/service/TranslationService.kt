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
            if (target == "en") {
                reverseCuratedCatalogTerms[source]?.get(normalized)?.let { return it }
                reverseCulinaryTerms[source]?.get(normalized)?.let { return it }
            }
        }
        if (source != "en" || target == "en") return null

        curatedCatalogTermsByNormalized[normalized]?.get(target)?.let { return it }
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

        reverseCuratedCatalogTerms[language]?.forEach { (localized, english) ->
            if (localized.contains(normalized) || normalized.contains(localized)) aliases += english
        }
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

    private val curatedCatalogTerms = mapOf(
        "Business Apéro" to mapOf("de" to "Business-Apéro", "fr" to "Apéritif d’affaires", "it" to "Aperitivo aziendale"),
        "Finger food and drinks for a casual business event." to mapOf("de" to "Fingerfood und Getränke für einen lockeren Geschäftsanlass.", "fr" to "Bouchées et boissons pour un événement professionnel décontracté.", "it" to "Finger food e bevande per un evento aziendale informale."),
        "Brunch" to mapOf("de" to "Brunch", "fr" to "Brunch", "it" to "Brunch"),
        "Breakfast and lunch-style food for a relaxed brunch." to mapOf("de" to "Frühstücks- und Mittagsgerichte für einen entspannten Brunch.", "fr" to "Des plats de petit-déjeuner et de déjeuner pour un brunch détendu.", "it" to "Piatti da colazione e pranzo per un brunch rilassato."),
        "Coffee Break" to mapOf("de" to "Kaffeepause", "fr" to "Pause-café", "it" to "Pausa caffè"),
        "A compact sweet-and-savory break for meetings, workshops, and training days." to mapOf("de" to "Eine kompakte süsse und herzhafte Pause für Sitzungen, Workshops und Schulungstage.", "fr" to "Une pause compacte, sucrée et salée, pour réunions, ateliers et journées de formation.", "it" to "Una pausa compatta, dolce e salata, per riunioni, workshop e giornate di formazione."),
        "Team Lunch Buffet" to mapOf("de" to "Team-Lunch-Buffet", "fr" to "Buffet déjeuner d’équipe", "it" to "Buffet pranzo di squadra"),
        "A generous buffet with a hearty centerpiece and a substantial vegetarian option." to mapOf("de" to "Ein grosszügiges Buffet mit einem sättigenden Hauptgericht und einer vollwertigen vegetarischen Option.", "fr" to "Un buffet généreux avec un plat principal copieux et une véritable option végétarienne.", "it" to "Un buffet ricco con un piatto principale sostanzioso e una valida opzione vegetariana."),
        "Vegan Reception" to mapOf("de" to "Veganer Empfang", "fr" to "Réception végane", "it" to "Ricevimento vegano"),
        "Colorful plant-based finger food for an elegant standing reception." to mapOf("de" to "Farbenfrohes pflanzliches Fingerfood für einen eleganten Stehempfang.", "fr" to "Des bouchées végétales colorées pour une élégante réception debout.", "it" to "Finger food vegetale e colorato per un elegante ricevimento in piedi."),
        "Swiss Breakfast" to mapOf("de" to "Schweizer Frühstück", "fr" to "Petit-déjeuner suisse", "it" to "Colazione svizzera"),
        "A warm and cold Swiss-inspired breakfast with coffee and apple juice." to mapOf("de" to "Ein warmes und kaltes, von der Schweiz inspiriertes Frühstück mit Kaffee und Apfelsaft.", "fr" to "Un petit-déjeuner suisse chaud et froid avec café et jus de pomme.", "it" to "Una colazione d’ispirazione svizzera, calda e fredda, con caffè e succo di mela."),
        "Vegetarian" to mapOf("de" to "Vegetarisch", "fr" to "Végétarien", "it" to "Vegetariano"),
        "Vegan" to mapOf("de" to "Vegan", "fr" to "Végane", "it" to "Vegano"),
        "Halal" to mapOf("de" to "Halal", "fr" to "Halal", "it" to "Halal"),
        "Gluten-free" to mapOf("de" to "Glutenfrei", "fr" to "Sans gluten", "it" to "Senza glutine"),
        "Lactose-free" to mapOf("de" to "Laktosefrei", "fr" to "Sans lactose", "it" to "Senza lattosio"),
        "Nut-free" to mapOf("de" to "Nussfrei", "fr" to "Sans fruits à coque", "it" to "Senza frutta a guscio"),
        "Allocate enough vegetarian-compatible servings for the entered guest count." to mapOf("de" to "Genügend vegetarische Portionen für die angegebene Gästezahl einplanen.", "fr" to "Prévoir suffisamment de portions végétariennes pour le nombre d’invités indiqué.", "it" to "Prevedere abbastanza porzioni vegetariane per il numero di ospiti indicato."),
        "Allocate enough vegan-compatible servings for the entered guest count." to mapOf("de" to "Genügend vegane Portionen für die angegebene Gästezahl einplanen.", "fr" to "Prévoir suffisamment de portions véganes pour le nombre d’invités indiqué.", "it" to "Prevedere abbastanza porzioni vegane per il numero di ospiti indicato."),
        "Allocate enough halal-compatible servings for the entered guest count." to mapOf("de" to "Genügend Halal-Portionen für die angegebene Gästezahl einplanen.", "fr" to "Prévoir suffisamment de portions halal pour le nombre d’invités indiqué.", "it" to "Prevedere abbastanza porzioni halal per il numero di ospiti indicato."),
        "Allocate enough gluten-free-compatible servings for the entered guest count." to mapOf("de" to "Genügend glutenfreie Portionen für die angegebene Gästezahl einplanen.", "fr" to "Prévoir suffisamment de portions sans gluten pour le nombre d’invités indiqué.", "it" to "Prevedere abbastanza porzioni senza glutine per il numero di ospiti indicato."),
        "Allocate enough lactose-free-compatible servings for the entered guest count." to mapOf("de" to "Genügend laktosefreie Portionen für die angegebene Gästezahl einplanen.", "fr" to "Prévoir suffisamment de portions sans lactose pour le nombre d’invités indiqué.", "it" to "Prevedere abbastanza porzioni senza lattosio per il numero di ospiti indicato."),
        "Allocate enough nut-free-compatible servings for the entered guest count." to mapOf("de" to "Genügend nussfreie Portionen für die angegebene Gästezahl einplanen.", "fr" to "Prévoir suffisamment de portions sans fruits à coque pour le nombre d’invités indiqué.", "it" to "Prevedere abbastanza porzioni senza frutta a guscio per il numero di ospiti indicato."),
        "Fruit" to mapOf("de" to "Obst", "fr" to "Fruits", "it" to "Frutta"),
        "Fruit cups, salads, skewers, and fruit-forward dishes." to mapOf("de" to "Obstbecher, Salate, Spiesse und fruchtbetonte Gerichte.", "fr" to "Coupes de fruits, salades, brochettes et plats à dominante fruitée.", "it" to "Coppette di frutta, insalate, spiedini e piatti a base di frutta."),
        "Bakery & Pastries" to mapOf("de" to "Backwaren & Gebäck", "fr" to "Boulangerie & pâtisseries", "it" to "Forno & pasticceria"),
        "Croissants, quiches, baked bites, and pastry-based dishes." to mapOf("de" to "Croissants, Quiches, gebackene Häppchen und Gerichte auf Gebäckbasis.", "fr" to "Croissants, quiches, bouchées cuites au four et plats à base de pâte.", "it" to "Croissant, quiche, bocconcini al forno e piatti a base di pasta sfoglia."),
        "Meat" to mapOf("de" to "Fleisch", "fr" to "Viande", "it" to "Carne"),
        "Dishes that contain meat or meat-based components." to mapOf("de" to "Gerichte mit Fleisch oder fleischhaltigen Bestandteilen.", "fr" to "Plats contenant de la viande ou des composants à base de viande.", "it" to "Piatti che contengono carne o componenti a base di carne."),
        "Vegetarian & Plant-based" to mapOf("de" to "Vegetarisch & pflanzlich", "fr" to "Végétarien & végétal", "it" to "Vegetariano & vegetale"),
        "Vegetarian and vegan dishes." to mapOf("de" to "Vegetarische und vegane Gerichte.", "fr" to "Plats végétariens et véganes.", "it" to "Piatti vegetariani e vegani."),
        "Breakfast & Brunch" to mapOf("de" to "Frühstück & Brunch", "fr" to "Petit-déjeuner & brunch", "it" to "Colazione & brunch"),
        "Breakfast, brunch, and coffee-break dishes." to mapOf("de" to "Gerichte für Frühstück, Brunch und Kaffeepausen.", "fr" to "Plats de petit-déjeuner, brunch et pause-café.", "it" to "Piatti per colazione, brunch e pausa caffè."),
        "Lunch & Buffet" to mapOf("de" to "Mittagessen & Buffet", "fr" to "Déjeuner & buffet", "it" to "Pranzo & buffet"),
        "Hearty lunch and buffet dishes." to mapOf("de" to "Sättigende Mittags- und Buffetgerichte.", "fr" to "Plats copieux pour le déjeuner et le buffet.", "it" to "Piatti sostanziosi per pranzo e buffet."),
        "Apéro & Reception" to mapOf("de" to "Apéro & Empfang", "fr" to "Apéritif & réception", "it" to "Aperitivo & ricevimento"),
        "Finger food and reception-friendly bites." to mapOf("de" to "Fingerfood und Häppchen für Apéro und Empfang.", "fr" to "Bouchées et finger food adaptés aux réceptions.", "it" to "Finger food e bocconcini adatti a aperitivi e ricevimenti."),
        "Affordability" to mapOf("de" to "Preisbewusstsein", "fr" to "Prix avantageux", "it" to "Convenienza"),
        "Favors candidates that provide the required quantity at a lower comparable cost." to mapOf("de" to "Bevorzugt Optionen, die die benötigte Menge zu tieferen vergleichbaren Kosten liefern.", "fr" to "Favorise les options fournissant la quantité requise à un coût comparable plus faible.", "it" to "Favorisce le opzioni che forniscono la quantità richiesta a un costo comparabile inferiore."),
        "Swiss origin" to mapOf("de" to "Schweizer Herkunft", "fr" to "Origine suisse", "it" to "Origine svizzera"),
        "Favors Swiss-sourced products and meals whose complete ingredient list is Swiss-sourced." to mapOf("de" to "Bevorzugt Produkte aus der Schweiz und Gerichte, deren gesamte Zutatenliste aus der Schweiz stammt.", "fr" to "Favorise les produits suisses et les plats dont tous les ingrédients proviennent de Suisse.", "it" to "Favorisce prodotti svizzeri e piatti i cui ingredienti provengono interamente dalla Svizzera."),
        "Presentation" to mapOf("de" to "Präsentation", "fr" to "Présentation", "it" to "Presentazione"),
        "Favors dishes that are visually suited to serving at the selected event." to mapOf("de" to "Bevorzugt Gerichte, die sich optisch gut für den gewählten Anlass eignen.", "fr" to "Favorise les plats visuellement adaptés à l’événement sélectionné.", "it" to "Favorisce piatti visivamente adatti all’evento selezionato."),
        "Preparation ease" to mapOf("de" to "Einfache Vorbereitung", "fr" to "Facilité de préparation", "it" to "Facilità di preparazione"),
        "Favors food that needs less hands-on preparation and service-time work." to mapOf("de" to "Bevorzugt Speisen mit weniger aktivem Vorbereitungs- und Serviceaufwand.", "fr" to "Favorise les plats nécessitant moins de préparation manuelle et de travail au moment du service.", "it" to "Favorisce cibi che richiedono meno preparazione manuale e lavoro al momento del servizio."),
        "Sustainability" to mapOf("de" to "Nachhaltigkeit", "fr" to "Durabilité", "it" to "Sostenibilità"),
        "Favors the catalog's relative estimate for lower-impact ingredients, packaging, and sourcing." to mapOf("de" to "Bevorzugt gemäss Katalogbewertung Zutaten, Verpackungen und Beschaffung mit geringerer Umweltbelastung.", "fr" to "Favorise, selon l’estimation du catalogue, les ingrédients, emballages et approvisionnements à moindre impact.", "it" to "Favorisce, secondo la stima del catalogo, ingredienti, imballaggi e approvvigionamento a minor impatto."),
        "Premium" to mapOf("de" to "Premium", "fr" to "Premium", "it" to "Premium"),
        "Economical" to mapOf("de" to "Preiswert", "fr" to "Économique", "it" to "Economico"),
        "Non-Swiss" to mapOf("de" to "Nicht schweizerisch", "fr" to "Non suisse", "it" to "Non svizzero"),
        "Swiss" to mapOf("de" to "Schweizerisch", "fr" to "Suisse", "it" to "Svizzero"),
        "Practical" to mapOf("de" to "Praktisch", "fr" to "Pratique", "it" to "Pratico"),
        "Showpiece" to mapOf("de" to "Blickfang", "fr" to "Spectaculaire", "it" to "D’effetto"),
        "Hands-on" to mapOf("de" to "Aufwendig", "fr" to "Plus de travail", "it" to "Impegnativo"),
        "Low effort" to mapOf("de" to "Wenig Aufwand", "fr" to "Peu d’effort", "it" to "Poco impegno"),
        "Lower priority" to mapOf("de" to "Geringere Priorität", "fr" to "Priorité moindre", "it" to "Priorità minore"),
        "Lower impact" to mapOf("de" to "Geringere Belastung", "fr" to "Impact réduit", "it" to "Impatto minore"),
        "Apero" to mapOf("de" to "Apéro", "fr" to "Apéritif", "it" to "Aperitivo"),
        "Breakfast" to mapOf("de" to "Frühstück", "fr" to "Petit-déjeuner", "it" to "Colazione"),
        "Buffet" to mapOf("de" to "Buffet", "fr" to "Buffet", "it" to "Buffet"),
        "Coffee" to mapOf("de" to "Kaffee", "fr" to "Café", "it" to "Caffè"),
        "Cold" to mapOf("de" to "Kalt serviert", "fr" to "Servi froid", "it" to "Servito freddo"),
        "Finger Food" to mapOf("de" to "Fingerfood", "fr" to "Bouchées", "it" to "Finger food"),
        "Hearty" to mapOf("de" to "Sättigend", "fr" to "Copieux", "it" to "Sostanzioso"),
        "Juice" to mapOf("de" to "Saft", "fr" to "Jus", "it" to "Succo"),
        "Lunch" to mapOf("de" to "Mittagessen", "fr" to "Déjeuner", "it" to "Pranzo"),
        "Napkin" to mapOf("de" to "Serviette", "fr" to "Serviette", "it" to "Tovagliolo"),
        "Non Alcoholic Drink" to mapOf("de" to "Alkoholfreies Getränk", "fr" to "Boisson sans alcool", "it" to "Bevanda analcolica"),
        "Prepare Ahead" to mapOf("de" to "Gut vorzubereiten", "fr" to "Préparable à l’avance", "it" to "Preparabile in anticipo"),
        "Ready To Heat" to mapOf("de" to "Aufwärmfertig", "fr" to "Prêt à réchauffer", "it" to "Pronto da riscaldare"),
        "Reception" to mapOf("de" to "Empfang", "fr" to "Réception", "it" to "Ricevimento"),
        "Savory" to mapOf("de" to "Herzhaft", "fr" to "Salé", "it" to "Salato"),
        "Sweet" to mapOf("de" to "Süss", "fr" to "Sucré", "it" to "Dolce"),
        "Warm" to mapOf("de" to "Warm serviert", "fr" to "Servi chaud", "it" to "Servito caldo"),
        "Water" to mapOf("de" to "Wasser", "fr" to "Eau", "it" to "Acqua"),
        "Gluten Free" to mapOf("de" to "Glutenfrei", "fr" to "Sans gluten", "it" to "Senza glutine"),
        "Lactose Free" to mapOf("de" to "Laktosefrei", "fr" to "Sans lactose", "it" to "Senza lattosio"),
        "Nut Free" to mapOf("de" to "Nussfrei", "fr" to "Sans fruits à coque", "it" to "Senza frutta a guscio"),
        "Caprese Skewers" to mapOf("de" to "Caprese-Spiesse", "fr" to "Brochettes caprese", "it" to "Spiedini caprese"),
        "Mini Spinach Quiche" to mapOf("de" to "Mini-Spinatquiche", "fr" to "Mini-quiche aux épinards", "it" to "Mini quiche agli spinaci"),
        "Falafel Bites" to mapOf("de" to "Falafel-Häppchen", "fr" to "Bouchées de falafel", "it" to "Bocconcini di falafel"),
        "Mini Ham Croissants" to mapOf("de" to "Mini-Schinkengipfeli", "fr" to "Mini-croissants au jambon", "it" to "Mini croissant al prosciutto"),
        "Halal Chicken Skewers" to mapOf("de" to "Halal-Hähnchenspiesse", "fr" to "Brochettes de poulet halal", "it" to "Spiedini di pollo halal"),
        "Bircher Müesli" to mapOf("de" to "Bircher Müesli", "fr" to "Bircher Müesli", "it" to "Bircher Müesli"),
        "Scrambled Eggs" to mapOf("de" to "Rührei", "fr" to "Œufs brouillés", "it" to "Uova strapazzate"),
        "Fruit Salad" to mapOf("de" to "Obstsalat", "fr" to "Salade de fruits", "it" to "Macedonia di frutta"),
        "Apple Yogurt Parfaits" to mapOf("de" to "Apfel-Joghurt-Parfaits", "fr" to "Parfaits pomme-yaourt", "it" to "Parfait mela e yogurt"),
        "Fresh Fruit Cups" to mapOf("de" to "Becher mit frischem Obst", "fr" to "Coupes de fruits frais", "it" to "Coppette di frutta fresca"),
        "Mini Quiche Break Bites" to mapOf("de" to "Mini-Quiche-Häppchen", "fr" to "Bouchées de mini-quiche", "it" to "Bocconcini di mini quiche"),
        "Ham Croissant Break Bites" to mapOf("de" to "Schinkengipfeli-Häppchen", "fr" to "Bouchées de croissants au jambon", "it" to "Bocconcini di croissant al prosciutto"),
        "Ham Croissant & Quiche Lunch Platter" to mapOf("de" to "Platte mit Schinkengipfeli & Quiche", "fr" to "Plateau croissants au jambon & quiche", "it" to "Vassoio croissant al prosciutto e quiche"),
        "Mediterranean Falafel Bowl" to mapOf("de" to "Mediterrane Falafel-Bowl", "fr" to "Bowl méditerranéen au falafel", "it" to "Bowl mediterranea con falafel"),
        "Caprese Lunch Bowl" to mapOf("de" to "Caprese-Lunch-Bowl", "fr" to "Bowl caprese pour déjeuner", "it" to "Bowl caprese per pranzo"),
        "Halal Chicken & Rice Bowl" to mapOf("de" to "Halal-Hähnchen-Reis-Bowl", "fr" to "Bowl poulet halal & riz", "it" to "Bowl pollo halal e riso"),
        "Falafel Hummus Canapés" to mapOf("de" to "Falafel-Hummus-Canapés", "fr" to "Canapés falafel-houmous", "it" to "Canapé falafel e hummus"),
        "Tomato Basil Hummus Bites" to mapOf("de" to "Tomaten-Basilikum-Hummus-Häppchen", "fr" to "Bouchées tomate-basilic-houmous", "it" to "Bocconcini pomodoro-basilico-hummus"),
        "Fresh Fruit Skewers" to mapOf("de" to "Frische Obstspiesse", "fr" to "Brochettes de fruits frais", "it" to "Spiedini di frutta fresca"),
        "Swiss Cheese Omelette" to mapOf("de" to "Schweizer Käseomelett", "fr" to "Omelette au fromage suisse", "it" to "Omelette al formaggio svizzero"),
        "Swiss Apple Bircher Jars" to mapOf("de" to "Schweizer Apfel-Bircher im Glas", "fr" to "Bircher suisse à la pomme en verrine", "it" to "Bircher svizzero alla mela in vasetto"),
        "Gluten-Free Tomato Frittata" to mapOf("de" to "Glutenfreie Tomaten-Frittata", "fr" to "Frittata tomate sans gluten", "it" to "Frittata al pomodoro senza glutine"),
        "Lentil Quinoa Bowl" to mapOf("de" to "Linsen-Quinoa-Bowl", "fr" to "Bowl lentilles-quinoa", "it" to "Bowl lenticchie e quinoa"),
        "Lactose-Free Apple Bircher" to mapOf("de" to "Laktosefreies Apfel-Bircher", "fr" to "Bircher pomme sans lactose", "it" to "Bircher alla mela senza lattosio"),
        "Gluten-Free Brownie Bites" to mapOf("de" to "Glutenfreie Brownie-Häppchen", "fr" to "Bouchées de brownie sans gluten", "it" to "Bocconcini di brownie senza glutine"),
        "Smoked Salmon Cucumber Bites" to mapOf("de" to "Räucherlachs-Gurken-Häppchen", "fr" to "Bouchées saumon fumé-concombre", "it" to "Bocconcini salmone affumicato e cetriolo"),
        "Vegetable Rice Paper Rolls" to mapOf("de" to "Gemüse-Reispapierrollen", "fr" to "Rouleaux de légumes en feuille de riz", "it" to "Involtini di verdure in carta di riso"),
        "Swiss Mini Rösti Bites" to mapOf("de" to "Schweizer Mini-Rösti-Häppchen", "fr" to "Bouchées de mini-rösti suisses", "it" to "Bocconcini di mini rösti svizzeri"),
        "Herbed Polenta Bites" to mapOf("de" to "Kräuter-Polenta-Häppchen", "fr" to "Bouchées de polenta aux herbes", "it" to "Bocconcini di polenta alle erbe"),
        "Swiss Beef Meatballs" to mapOf("de" to "Schweizer Rindfleischbällchen", "fr" to "Boulettes de bœuf suisses", "it" to "Polpette di manzo svizzere"),
        "Gruyère & Grape Skewers" to mapOf("de" to "Gruyère-Trauben-Spiesse", "fr" to "Brochettes gruyère-raisin", "it" to "Spiedini gruyère e uva"),
        "Hummus-Stuffed Mini Peppers" to mapOf("de" to "Mini-Peperoni mit Hummusfüllung", "fr" to "Mini-poivrons farcis au houmous", "it" to "Mini peperoni ripieni di hummus"),
        "Swiss Vegetable Antipasti Skewers" to mapOf("de" to "Schweizer Gemüse-Antipasti-Spiesse", "fr" to "Brochettes d’antipasti de légumes suisses", "it" to "Spiedini di antipasti di verdure svizzere"),
        "Apple" to mapOf("de" to "Apfel", "fr" to "Pomme", "it" to "Mela"),
        "Apple Juice" to mapOf("de" to "Apfelsaft", "fr" to "Jus de pomme", "it" to "Succo di mela"),
        "Basil" to mapOf("de" to "Basilikum", "fr" to "Basilic", "it" to "Basilico"),
        "Beef Meatball" to mapOf("de" to "Rindfleischbällchen", "fr" to "Boulette de bœuf", "it" to "Polpetta di manzo"),
        "Butter" to mapOf("de" to "Butter", "fr" to "Beurre", "it" to "Burro"),
        "Cherry Tomato" to mapOf("de" to "Cherrytomate", "fr" to "Tomate cerise", "it" to "Pomodorino"),
        "Coffee Beans" to mapOf("de" to "Kaffeebohnen", "fr" to "Grains de café", "it" to "Chicchi di caffè"),
        "Cucumber" to mapOf("de" to "Gurke", "fr" to "Concombre", "it" to "Cetriolo"),
        "Egg" to mapOf("de" to "Ei", "fr" to "Œuf", "it" to "Uovo"),
        "Falafel" to mapOf("de" to "Falafel", "fr" to "Falafel", "it" to "Falafel"),
        "Gluten Free Brownie" to mapOf("de" to "Glutenfreier Brownie", "fr" to "Brownie sans gluten", "it" to "Brownie senza glutine"),
        "Gluten Free Oats" to mapOf("de" to "Glutenfreie Haferflocken", "fr" to "Flocons d’avoine sans gluten", "it" to "Fiocchi d’avena senza glutine"),
        "Grape" to mapOf("de" to "Traube", "fr" to "Raisin", "it" to "Uva"),
        "Gruyere Cube" to mapOf("de" to "Gruyère-Würfel", "fr" to "Cube de gruyère", "it" to "Cubetto di gruyère"),
        "Halal Chicken" to mapOf("de" to "Halal-Hähnchen", "fr" to "Poulet halal", "it" to "Pollo halal"),
        "Halal Chicken Rice Bowl" to mapOf("de" to "Halal-Hähnchen-Reis-Bowl", "fr" to "Bowl poulet halal et riz", "it" to "Bowl pollo halal e riso"),
        "Halal Chicken Skewer" to mapOf("de" to "Halal-Hähnchenspiess", "fr" to "Brochette de poulet halal", "it" to "Spiedino di pollo halal"),
        "Hummus" to mapOf("de" to "Hummus", "fr" to "Houmous", "it" to "Hummus"),
        "Lactose Free Yogurt" to mapOf("de" to "Laktosefreier Joghurt", "fr" to "Yaourt sans lactose", "it" to "Yogurt senza lattosio"),
        "Lentil Quinoa Mix" to mapOf("de" to "Linsen-Quinoa-Mischung", "fr" to "Mélange lentilles-quinoa", "it" to "Mix lenticchie-quinoa"),
        "Mini Ham Croissant" to mapOf("de" to "Mini-Schinkengipfeli", "fr" to "Mini-croissant au jambon", "it" to "Mini croissant al prosciutto"),
        "Mini Roesti" to mapOf("de" to "Mini-Rösti", "fr" to "Mini-rösti", "it" to "Mini rösti"),
        "Mini Sweet Pepper" to mapOf("de" to "Mini-Peperoni", "fr" to "Mini-poivron doux", "it" to "Mini peperone dolce"),
        "Mixed Fruit" to mapOf("de" to "Gemischtes Obst", "fr" to "Fruits mélangés", "it" to "Frutta mista"),
        "Mixed Vegetables" to mapOf("de" to "Gemischtes Gemüse", "fr" to "Légumes mélangés", "it" to "Verdure miste"),
        "Mozzarella" to mapOf("de" to "Mozzarella", "fr" to "Mozzarella", "it" to "Mozzarella"),
        "Muesli" to mapOf("de" to "Müesli", "fr" to "Müesli", "it" to "Müesli"),
        "Polenta Bite" to mapOf("de" to "Polenta-Häppchen", "fr" to "Bouchée de polenta", "it" to "Bocconcino di polenta"),
        "Rice" to mapOf("de" to "Reis", "fr" to "Riz", "it" to "Riso"),
        "Rice Paper Roll" to mapOf("de" to "Reispapierrolle", "fr" to "Rouleau de papier de riz", "it" to "Involtino di carta di riso"),
        "Smoked Salmon" to mapOf("de" to "Räucherlachs", "fr" to "Saumon fumé", "it" to "Salmone affumicato"),
        "Yogurt" to mapOf("de" to "Joghurt", "fr" to "Yaourt", "it" to "Yogurt"),
        "Swiss Mozzarella 1 kg" to mapOf("de" to "Schweizer Mozzarella 1 kg", "fr" to "Mozzarella suisse 1 kg", "it" to "Mozzarella svizzera 1 kg"),
        "Swiss Cherry Tomatoes 500 g" to mapOf("de" to "Schweizer Cherrytomaten 500 g", "fr" to "Tomates cerises suisses 500 g", "it" to "Pomodorini svizzeri 500 g"),
        "Swiss Fresh Basil 100 g" to mapOf("de" to "Frischer Schweizer Basilikum 100 g", "fr" to "Basilic frais suisse 100 g", "it" to "Basilico fresco svizzero 100 g"),
        "Swiss Mini Spinach Quiche 20 pcs" to mapOf("de" to "Schweizer Mini-Spinatquiche 20 Stk.", "fr" to "Mini-quiches suisses aux épinards 20 pcs", "it" to "Mini quiche svizzere agli spinaci 20 pz"),
        "Falafel 50 pcs" to mapOf("de" to "Falafel 50 Stk.", "fr" to "Falafels 50 pcs", "it" to "Falafel 50 pz"),
        "Hummus 1 kg" to mapOf("de" to "Hummus 1 kg", "fr" to "Houmous 1 kg", "it" to "Hummus 1 kg"),
        "Swiss Mini Ham Croissants 24 pcs" to mapOf("de" to "Schweizer Mini-Schinkengipfeli 24 Stk.", "fr" to "Mini-croissants suisses au jambon 24 pcs", "it" to "Mini croissant svizzeri al prosciutto 24 pz"),
        "Swiss Müesli 2 kg" to mapOf("de" to "Schweizer Müesli 2 kg", "fr" to "Müesli suisse 2 kg", "it" to "Müesli svizzero 2 kg"),
        "Swiss Natural Yogurt 1 kg" to mapOf("de" to "Schweizer Naturjoghurt 1 kg", "fr" to "Yaourt nature suisse 1 kg", "it" to "Yogurt naturale svizzero 1 kg"),
        "Swiss Apples 2 kg" to mapOf("de" to "Schweizer Äpfel 2 kg", "fr" to "Pommes suisses 2 kg", "it" to "Mele svizzere 2 kg"),
        "Swiss Eggs 30 pcs" to mapOf("de" to "Schweizer Eier 30 Stk.", "fr" to "Œufs suisses 30 pcs", "it" to "Uova svizzere 30 pz"),
        "Swiss Butter 1 kg" to mapOf("de" to "Schweizer Butter 1 kg", "fr" to "Beurre suisse 1 kg", "it" to "Burro svizzero 1 kg"),
        "Mixed Fresh Fruit 2 kg" to mapOf("de" to "Gemischtes frisches Obst 2 kg", "fr" to "Fruits frais mélangés 2 kg", "it" to "Frutta fresca mista 2 kg"),
        "Swiss Mineral Water 6 × 1.5 L" to mapOf("de" to "Schweizer Mineralwasser 6 × 1,5 L", "fr" to "Eau minérale suisse 6 × 1,5 L", "it" to "Acqua minerale svizzera 6 × 1,5 L"),
        "Budget Still Water 12 L" to mapOf("de" to "Preiswertes stilles Wasser 12 L", "fr" to "Eau plate économique 12 L", "it" to "Acqua naturale economica 12 L"),
        "Swiss Apple Juice 6 L" to mapOf("de" to "Schweizer Apfelsaft 6 L", "fr" to "Jus de pomme suisse 6 L", "it" to "Succo di mela svizzero 6 L"),
        "Coffee Beans 1 kg" to mapOf("de" to "Kaffeebohnen 1 kg", "fr" to "Grains de café 1 kg", "it" to "Chicchi di caffè 1 kg"),
        "Halal Chicken Skewers 40 pcs" to mapOf("de" to "Halal-Hähnchenspiesse 40 Stk.", "fr" to "Brochettes de poulet halal 40 pcs", "it" to "Spiedini di pollo halal 40 pz"),
        "Halal Chicken Rice Bowls 10 portions" to mapOf("de" to "Halal-Hähnchen-Reis-Bowls 10 Portionen", "fr" to "Bowls poulet halal et riz 10 portions", "it" to "Bowl pollo halal e riso 10 porzioni"),
        "Napkins 250 pcs" to mapOf("de" to "Servietten 250 Stk.", "fr" to "Serviettes 250 pcs", "it" to "Tovaglioli 250 pz"),
        "Certified Halal Chicken 2 kg" to mapOf("de" to "Zertifiziertes Halal-Hähnchen 2 kg", "fr" to "Poulet halal certifié 2 kg", "it" to "Pollo halal certificato 2 kg"),
        "Long-Grain Rice 5 kg" to mapOf("de" to "Langkornreis 5 kg", "fr" to "Riz long grain 5 kg", "it" to "Riso a chicco lungo 5 kg"),
        "Swiss Mixed Vegetables 2 kg" to mapOf("de" to "Schweizer Mischgemüse 2 kg", "fr" to "Légumes suisses mélangés 2 kg", "it" to "Verdure svizzere miste 2 kg"),
        "Cooked Lentil Quinoa Mix 2 kg" to mapOf("de" to "Gekochte Linsen-Quinoa-Mischung 2 kg", "fr" to "Mélange cuit lentilles-quinoa 2 kg", "it" to "Mix cotto lenticchie-quinoa 2 kg"),
        "Swiss Certified Gluten-Free Oats 2 kg" to mapOf("de" to "Zertifizierte glutenfreie Schweizer Haferflocken 2 kg", "fr" to "Flocons d’avoine suisses certifiés sans gluten 2 kg", "it" to "Fiocchi d’avena svizzeri certificati senza glutine 2 kg"),
        "Swiss Lactose-Free Yogurt 1 kg" to mapOf("de" to "Schweizer laktosefreier Joghurt 1 kg", "fr" to "Yaourt suisse sans lactose 1 kg", "it" to "Yogurt svizzero senza lattosio 1 kg"),
        "Swiss Gluten-Free Brownie Bites 24 pcs" to mapOf("de" to "Schweizer glutenfreie Brownie-Häppchen 24 Stk.", "fr" to "Bouchées de brownie suisses sans gluten 24 pcs", "it" to "Bocconcini di brownie svizzeri senza glutine 24 pz"),
        "Swiss Smoked Salmon 500 g" to mapOf("de" to "Schweizer Räucherlachs 500 g", "fr" to "Saumon fumé suisse 500 g", "it" to "Salmone affumicato svizzero 500 g"),
        "Swiss Cucumbers 1 kg" to mapOf("de" to "Schweizer Gurken 1 kg", "fr" to "Concombres suisses 1 kg", "it" to "Cetrioli svizzeri 1 kg"),
        "Vegetable Rice Paper Rolls 30 pcs" to mapOf("de" to "Gemüse-Reispapierrollen 30 Stk.", "fr" to "Rouleaux de légumes en feuille de riz 30 pcs", "it" to "Involtini di verdure in carta di riso 30 pz"),
        "Swiss Mini Rösti 40 pcs" to mapOf("de" to "Schweizer Mini-Rösti 40 Stk.", "fr" to "Mini-rösti suisses 40 pcs", "it" to "Mini rösti svizzeri 40 pz"),
        "Herbed Polenta Bites 36 pcs" to mapOf("de" to "Kräuter-Polenta-Häppchen 36 Stk.", "fr" to "Bouchées de polenta aux herbes 36 pcs", "it" to "Bocconcini di polenta alle erbe 36 pz"),
        "Swiss Beef Meatballs 40 pcs" to mapOf("de" to "Schweizer Rindfleischbällchen 40 Stk.", "fr" to "Boulettes de bœuf suisses 40 pcs", "it" to "Polpette di manzo svizzere 40 pz"),
        "Swiss Gruyère Cubes 1 kg" to mapOf("de" to "Schweizer Gruyère-Würfel 1 kg", "fr" to "Cubes de gruyère suisse 1 kg", "it" to "Cubetti di gruyère svizzero 1 kg"),
        "Table Grapes 1 kg" to mapOf("de" to "Tafeltrauben 1 kg", "fr" to "Raisins de table 1 kg", "it" to "Uva da tavola 1 kg"),
        "Mini Sweet Peppers 1 kg" to mapOf("de" to "Mini-Peperoni 1 kg", "fr" to "Mini-poivrons doux 1 kg", "it" to "Mini peperoni dolci 1 kg"),
        "Breakfast Coffee" to mapOf("de" to "Frühstückskaffee", "fr" to "Café du petit-déjeuner", "it" to "Caffè della colazione"),
        "Breakfast Juice" to mapOf("de" to "Frühstückssaft", "fr" to "Jus du petit-déjeuner", "it" to "Succo della colazione"),
        "Buffet Juice" to mapOf("de" to "Buffet-Saft", "fr" to "Jus du buffet", "it" to "Succo del buffet"),
        "Buffet Napkins" to mapOf("de" to "Buffet-Servietten", "fr" to "Serviettes du buffet", "it" to "Tovaglioli del buffet"),
        "Buffet Water" to mapOf("de" to "Buffet-Wasser", "fr" to "Eau du buffet", "it" to "Acqua del buffet"),
        "Lunch Main" to mapOf("de" to "Hauptgericht Mittagessen", "fr" to "Plat principal du déjeuner", "it" to "Piatto principale del pranzo"),
        "Reception Napkins" to mapOf("de" to "Servietten Empfang", "fr" to "Serviettes de réception", "it" to "Tovaglioli del ricevimento"),
        "Reception Water" to mapOf("de" to "Wasser Empfang", "fr" to "Eau de réception", "it" to "Acqua del ricevimento"),
        "Savory Brunch" to mapOf("de" to "Herzhafter Brunch", "fr" to "Brunch salé", "it" to "Brunch salato"),
        "Savory Coffee Break" to mapOf("de" to "Herzhafte Kaffeepause", "fr" to "Pause-café salée", "it" to "Pausa caffè salata"),
        "Savory Finger Food" to mapOf("de" to "Herzhaftes Fingerfood", "fr" to "Bouchées salées", "it" to "Finger food salato"),
        "Savory Swiss Breakfast" to mapOf("de" to "Herzhaftes Schweizer Frühstück", "fr" to "Petit-déjeuner suisse salé", "it" to "Colazione svizzera salata"),
        "Soft Drinks" to mapOf("de" to "Alkoholfreie Getränke", "fr" to "Boissons sans alcool", "it" to "Bibite analcoliche"),
        "Sweet Brunch" to mapOf("de" to "Süsser Brunch", "fr" to "Brunch sucré", "it" to "Brunch dolce"),
        "Sweet Coffee Break" to mapOf("de" to "Süsse Kaffeepause", "fr" to "Pause-café sucrée", "it" to "Pausa caffè dolce"),
        "Sweet Swiss Breakfast" to mapOf("de" to "Süsses Schweizer Frühstück", "fr" to "Petit-déjeuner suisse sucré", "it" to "Colazione svizzera dolce"),
        "Vegan Savory Bites" to mapOf("de" to "Vegane herzhafte Häppchen", "fr" to "Bouchées véganes salées", "it" to "Bocconcini vegani salati"),
        "Vegan Sweet Bites" to mapOf("de" to "Vegane süsse Häppchen", "fr" to "Bouchées véganes sucrées", "it" to "Bocconcini vegani dolci"),
    )

    private val curatedCatalogTermsByNormalized = curatedCatalogTerms.mapKeys { (english, _) -> normalizePhrase(english) }

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

    private val reverseCuratedCatalogTerms: Map<String, Map<String, String>> = buildMap {
        for (language in listOf("de", "fr", "it")) {
            val values = linkedMapOf<String, String>()
            curatedCatalogTerms.forEach { (english, translations) ->
                // Search aliases should be catalog terms, not long descriptive prose.
                if (english.length <= 100 && !english.trim().endsWith(".")) {
                    translations[language]?.let { localized ->
                        values.putIfAbsent(normalizePhrase(localized), english)
                    }
                }
            }
            put(language, values)
        }
    }

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
