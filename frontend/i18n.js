(() => {
  'use strict';

  const SOURCE_LANGUAGE = 'en';
  const SUPPORTED_LANGUAGES = ['en', 'de', 'fr', 'it'];
  const LANGUAGE_LABELS = { en: 'English', de: 'Deutsch', fr: 'Français', it: 'Italiano' };
  const LOCALES = { de: 'de-CH', fr: 'fr-CH', it: 'it-CH', en: 'en-CH' };
  const STORAGE_KEY = 'tableplan.language.v3';
  const DB_NAME = 'tableplan-i18n';
  const DB_VERSION = 1;
  const STORE_NAME = 'translations';

  const messages = {
    en: {
      'app.title': 'Tableplan — Catering planner',
      'nav.primary': 'Primary navigation',
      'nav.planner': 'Planner',
      'nav.tools': 'Tools',
      'language.label': 'Language',
      'hero.eyebrow': 'From headcount to checkout',
      'hero.title.1': 'Plan the event.',
      'hero.title.2': 'We calculate the rest.',
      'hero.copy': 'Set the occasion, dietary rules, specific dishes and stock on hand. Tableplan returns a deterministic menu and package-level shopping list.',
      'event.title': 'Event basics',
      'event.loading': 'Loading event templates…',
      'event.format': 'Event format',
      'event.guests': 'Guests',
      'event.budget': 'Budget',
      'constraints.title': 'Dietary constraints',
      'constraints.copy': 'Choose every rule that the automatically generated menu must follow.',
      'constraints.loading': 'Loading dietary constraints…',
      'constraints.none': 'No dietary constraints are available from the catalog.',
      'constraints.note': 'Specific guaranteed meals may override these rules, but every exception will be highlighted before and after generation.',
      'constraints.clear': 'Clear selected',
      'constraints.clearCount': 'Clear {count} selected',
      'dishes.title': 'Specific dishes',
      'dishes.copy': 'Optional. Add recipes that must appear in the final menu.',
      'dishes.choose': '+ Choose dishes',
      'dishes.noneSelected': 'No specific dishes selected.',
      'dishes.remove': 'Remove',
      'dishes.add': '+ Add dish',
      'dishes.guaranteed': 'Guaranteed',
      'dishes.constraintException': 'Dietary exception',
      'dishes.constraintWarning': 'Dietary exception: {details}. This dish will still remain in the plan.',
      'dishes.stillIncluded': 'This dish will still remain in the plan.',
      'stock.title': 'Already in stock',
      'stock.copy': 'Optional. Choose ingredients already on hand; stock is deducted before package quantities are rounded up.',
      'stock.add': '+ Add stock',
      'stock.none': 'No existing stock added.',
      'stock.chooseIngredient': 'Choose ingredient',
      'stock.searchCatalog': 'Search catalog',
      'stock.change': 'Change',
      'stock.choose': 'Choose',
      'stock.ingredient': 'Ingredient',
      'stock.chooseAria': 'Choose stock ingredient',
      'stock.amount': 'Amount',
      'stock.unit': 'Unit',
      'stock.remove': 'Remove',
      'preferences.title': 'Planning preferences',
      'preferences.copy': 'Optional fine-tuning',
      'preferences.vegetarianShare': 'Vegetarian share',
      'preferences.servings': 'Food servings / guest',
      'preferences.useTemplate': 'Use template',
      'preferences.max10': 'Optional · maximum 10',
      'preferences.prepareAhead': 'Prefer prepare-ahead',
      'preferences.prepareAheadHint': 'Used as a deterministic tie-breaker',
      'preferences.priorities': 'Selection priorities',
      'preferences.prioritiesHint': 'Weights are normalized automatically.',
      'common.lower': 'Lower',
      'common.higher': 'Higher',
      'common.remove': 'Remove',
      'common.done': 'Done',
      'common.selected': 'Selected',
      'common.loading': 'Loading…',
      'common.searching': 'Searching…',
      'common.error': 'Error',
      'plan.generate': 'Generate catering plan',
      'plan.resolving': 'Resolving plan…',
      'plan.resolved': 'Resolved plan',
      'plan.defaultTitle': 'Your event, accounted for.',
      'plan.edit': 'Edit inputs',
      'plan.templatePortions': 'template portions',
      'plan.servingsEach': '{count} servings each',
      'plan.forGuests': '{template} for {guests} guests · {portions}.',
      'results.selectedMenu': 'Selected menu',
      'results.constraintCopy': 'Constraint exceptions are shown directly on the affected recipe.',
      'results.shoppingList': 'Shopping list',
      'results.shoppingCopy': 'Required amounts are netted against stock before package rounding.',
      'results.stockUsed': 'Existing stock used',
      'results.planningDetails': 'Planning details',
      'results.totalCost': 'Total cost',
      'results.costPerGuest': 'Cost per guest',
      'results.budgetRemaining': 'Budget remaining',
      'results.budgetOverrun': 'Budget overrun',
      'results.reviewBeforeService': 'Review before service:',
      'results.whySelected': 'Why this was selected',
      'results.servings': '{count} servings',
      'results.target': '{quantity} target',
      'results.scoreComponents': 'Score components',
      'results.weightedScore': 'Weighted score',
      'results.noStockMatched': 'No existing inventory matched this plan.',
      'results.notFulfilled': 'Not fulfilled',
      'results.covered': 'Covered',
      'warning.summary.one': '⚠ 1 dietary exception in this plan',
      'warning.summary.many': '⚠ {count} dietary exceptions in this plan',
      'warning.guaranteed.one': '1 exception comes from an explicitly requested dish. It remains in the plan, but should be reviewed before service.',
      'warning.guaranteed.many': '{count} exceptions come from explicitly requested dishes. They remain in the plan, but should be reviewed before service.',
      'warning.review': 'Review the highlighted recipes before service.',
      'table.item': 'Item',
      'table.need': 'Need',
      'table.stockUsed': 'Stock used',
      'table.packages': 'Packages',
      'table.purchased': 'Purchased',
      'table.overbuy': 'Overbuy',
      'table.total': 'Total',
      'table.origin': 'Origin',
      'table.pack': 'pack',
      'picker.dishes.eyebrow': 'Specific dishes',
      'picker.dishes.title': 'Choose guaranteed dishes',
      'picker.dishes.copy': 'Search directly or browse by category. Conflicts are allowed, but clearly highlighted.',
      'picker.dishes.close': 'Close dish picker',
      'picker.dishes.searchLabel': 'Search recipes',
      'picker.dishes.searchPlaceholder': 'For example “croissant”, “fruit”, “falafel”…',
      'picker.dishes.categories': 'Categories',
      'picker.dishes.foodType': 'Food type',
      'picker.dishes.allFoodTypes': 'All food types',
      'picker.dishes.all': 'All dishes',
      'picker.dishes.loading': 'Loading recipes…',
      'picker.dishes.searching': 'Searching recipes…',
      'picker.dishes.failed': 'Recipe search failed.',
      'picker.dishes.none': 'No recipes match this search and filters.',
      'picker.dishes.selected.one': '1 selected',
      'picker.dishes.selected.many': '{count} selected',
      'picker.stock.eyebrow': 'Existing stock',
      'picker.stock.title': 'Choose ingredient',
      'picker.stock.copy': 'Choose from the actual catalog instead of typing internal product concepts.',
      'picker.stock.close': 'Close ingredient picker',
      'picker.stock.searchLabel': 'Search ingredients',
      'picker.stock.searchPlaceholder': 'For example “mozzarella”, “water”, “apple”…',
      'picker.stock.loading': 'Loading ingredients…',
      'picker.stock.searching': 'Searching ingredients…',
      'picker.stock.failed': 'Ingredient search failed.',
      'picker.stock.none': 'No ingredients match this search.',
      'picker.stock.use': 'Use ingredient',
      'developer.title': 'Developer tools & catalog',
      'developer.copy': 'Recipes, products, scores and raw catalog details',
      'catalog.eyebrow': 'MongoDB catalog',
      'catalog.title': 'Browse what the planner knows.',
      'catalog.copy': 'This area is deliberately secondary to the actual event workflow.',
      'catalog.openToLoad': 'Open tools to load the catalog.',
      'catalog.recipes': 'Recipes',
      'catalog.items': 'Items',
      'catalog.searchMeals': 'Search name, ID, ingredient…',
      'catalog.searchProducts': 'Search name, SKU, concept…',
      'catalog.filter': 'Filter by capability',
      'catalog.allCapabilities': 'All capabilities',
      'catalog.loading': 'Loading catalog…',
      'catalog.failed': 'Could not load catalog.',
      'catalog.shown.one': '1 {noun} shown',
      'catalog.shown.many': '{count} {noun} shown',
      'catalog.recipe': 'recipe',
      'catalog.item': 'item',
      'catalog.noMatches': 'No {noun}s match this search and filter.',
      'catalog.ingredientsPerServing': 'Ingredients per serving',
      'catalog.yields': 'Yields {count} {unit}',
      'catalog.concept': 'Concept',
      'catalog.package': 'Package',
      'catalog.origin': 'Origin',
      'catalog.unspecified': 'Unspecified',
      'catalog.planningScores': 'Planning scores',
      'catalog.scoreFallback': 'Catalog-defined planning score.',
      'footer.poc': 'TABLEPLAN POC',
      'footer.copy': 'Explainable by design · CHF pricing',
      'unit.piece.one': 'piece', 'unit.piece.many': 'pieces',
      'unit.serving.one': 'serving', 'unit.serving.many': 'servings',
      'unit.cup.one': 'cup', 'unit.cup.many': 'cups',
      'unit.bottle.one': 'bottle', 'unit.bottle.many': 'bottles',
      'unit.liter.one': 'liter', 'unit.liter.many': 'liters'
    },
    de: {
      'app.title': 'Tableplan — Catering-Planer',
      'nav.primary': 'Hauptnavigation',
      'nav.planner': 'Planer',
      'nav.tools': 'Werkzeuge',
      'language.label': 'Sprache',
      'hero.eyebrow': 'Von der Gästezahl bis zum Einkauf',
      'hero.title.1': 'Event planen.',
      'hero.title.2': 'Den Rest berechnen wir.',
      'hero.copy': 'Anlass, Ernährungsregeln, gewünschte Gerichte und vorhandenen Bestand festlegen. Tableplan erstellt daraus deterministisch ein Menü und eine Einkaufsliste auf Verpackungsebene.',
      'event.title': 'Event-Grundlagen',
      'event.loading': 'Event-Vorlagen werden geladen…',
      'event.format': 'Event-Format',
      'event.guests': 'Gäste',
      'event.budget': 'Budget',
      'constraints.title': 'Ernährungsanforderungen',
      'constraints.copy': 'Wählen Sie alle Regeln, die das automatisch erzeugte Menü einhalten muss.',
      'constraints.loading': 'Ernährungsanforderungen werden geladen…',
      'constraints.none': 'Im Katalog sind keine Ernährungsanforderungen verfügbar.',
      'constraints.note': 'Explizit gewünschte Gerichte dürfen diese Regeln überschreiben. Jede Ausnahme wird vor und nach der Planung deutlich markiert.',
      'constraints.clear': 'Auswahl löschen',
      'constraints.clearCount': '{count} ausgewählte löschen',
      'dishes.title': 'Gewünschte Gerichte',
      'dishes.copy': 'Optional. Gerichte hinzufügen, die im endgültigen Menü enthalten sein müssen.',
      'dishes.choose': '+ Gerichte auswählen',
      'dishes.noneSelected': 'Keine bestimmten Gerichte ausgewählt.',
      'dishes.remove': 'Entfernen',
      'dishes.add': '+ Gericht hinzufügen',
      'dishes.guaranteed': 'Garantiert',
      'dishes.constraintException': 'Ausnahme von Ernährungsregel',
      'dishes.constraintWarning': 'Ausnahme von Ernährungsregel: {details}. Dieses Gericht bleibt trotzdem im Plan.',
      'dishes.stillIncluded': 'Dieses Gericht bleibt trotzdem im Plan.',
      'stock.title': 'Bereits auf Lager',
      'stock.copy': 'Optional. Vorhandene Zutaten auswählen; der Bestand wird vor dem Aufrunden auf Verpackungen abgezogen.',
      'stock.add': '+ Bestand hinzufügen',
      'stock.none': 'Kein vorhandener Bestand hinzugefügt.',
      'stock.chooseIngredient': 'Zutat auswählen',
      'stock.searchCatalog': 'Katalog durchsuchen',
      'stock.change': 'Ändern',
      'stock.choose': 'Auswählen',
      'stock.ingredient': 'Zutat',
      'stock.chooseAria': 'Lagerzutat auswählen',
      'stock.amount': 'Menge',
      'stock.unit': 'Einheit',
      'stock.remove': 'Entfernen',
      'preferences.title': 'Planungspräferenzen',
      'preferences.copy': 'Optionale Feinabstimmung',
      'preferences.vegetarianShare': 'Vegetarischer Anteil',
      'preferences.servings': 'Essensportionen / Gast',
      'preferences.useTemplate': 'Vorlage verwenden',
      'preferences.max10': 'Optional · maximal 10',
      'preferences.prepareAhead': 'Vorbereitung im Voraus bevorzugen',
      'preferences.prepareAheadHint': 'Wird als deterministischer Tie-Breaker verwendet',
      'preferences.priorities': 'Auswahlprioritäten',
      'preferences.prioritiesHint': 'Gewichte werden automatisch normalisiert.',
      'common.lower': 'Niedriger',
      'common.higher': 'Höher',
      'common.remove': 'Entfernen',
      'common.done': 'Fertig',
      'common.selected': 'Ausgewählt',
      'common.loading': 'Wird geladen…',
      'common.searching': 'Suche läuft…',
      'common.error': 'Fehler',
      'plan.generate': 'Catering-Plan erstellen',
      'plan.resolving': 'Plan wird erstellt…',
      'plan.resolved': 'Erstellter Plan',
      'plan.defaultTitle': 'Ihr Event ist durchgerechnet.',
      'plan.edit': 'Eingaben bearbeiten',
      'plan.templatePortions': 'Vorlagenportionen',
      'plan.servingsEach': '{count} Portionen pro Gast',
      'plan.forGuests': '{template} für {guests} Gäste · {portions}.',
      'results.selectedMenu': 'Ausgewähltes Menü',
      'results.constraintCopy': 'Ausnahmen von Ernährungsregeln werden direkt beim betroffenen Rezept angezeigt.',
      'results.shoppingList': 'Einkaufsliste',
      'results.shoppingCopy': 'Benötigte Mengen werden zuerst mit dem Bestand verrechnet und erst danach auf Verpackungen aufgerundet.',
      'results.stockUsed': 'Verwendeter Bestand',
      'results.planningDetails': 'Planungsdetails',
      'results.totalCost': 'Gesamtkosten',
      'results.costPerGuest': 'Kosten pro Gast',
      'results.budgetRemaining': 'Restbudget',
      'results.budgetOverrun': 'Budgetüberschreitung',
      'results.reviewBeforeService': 'Vor dem Service prüfen:',
      'results.whySelected': 'Warum ausgewählt',
      'results.servings': '{count} Portionen',
      'results.target': '{quantity} Zielmenge',
      'results.scoreComponents': 'Bewertungskomponenten',
      'results.weightedScore': 'Gewichtete Bewertung',
      'results.noStockMatched': 'Kein vorhandener Bestand wurde diesem Plan zugeordnet.',
      'results.notFulfilled': 'Nicht erfüllt',
      'results.covered': 'Abgedeckt',
      'warning.summary.one': '⚠ 1 Ausnahme von Ernährungsregeln in diesem Plan',
      'warning.summary.many': '⚠ {count} Ausnahmen von Ernährungsregeln in diesem Plan',
      'warning.guaranteed.one': '1 Ausnahme stammt von einem explizit gewünschten Gericht. Es bleibt im Plan, sollte aber vor dem Service geprüft werden.',
      'warning.guaranteed.many': '{count} Ausnahmen stammen von explizit gewünschten Gerichten. Sie bleiben im Plan, sollten aber vor dem Service geprüft werden.',
      'warning.review': 'Prüfen Sie die markierten Rezepte vor dem Service.',
      'table.item': 'Artikel',
      'table.need': 'Bedarf',
      'table.stockUsed': 'Bestand verwendet',
      'table.packages': 'Packungen',
      'table.purchased': 'Eingekauft',
      'table.overbuy': 'Übermenge',
      'table.total': 'Total',
      'table.origin': 'Herkunft',
      'table.pack': 'Packung',
      'picker.dishes.eyebrow': 'Gewünschte Gerichte',
      'picker.dishes.title': 'Garantierte Gerichte auswählen',
      'picker.dishes.copy': 'Direkt suchen oder nach Kategorie stöbern. Konflikte sind erlaubt, werden aber deutlich markiert.',
      'picker.dishes.close': 'Gerichteauswahl schliessen',
      'picker.dishes.searchLabel': 'Rezepte suchen',
      'picker.dishes.searchPlaceholder': 'Zum Beispiel „Croissant“, „Obst“, „Falafel“…',
      'picker.dishes.categories': 'Kategorien',
      'picker.dishes.foodType': 'Speisenart',
      'picker.dishes.allFoodTypes': 'Alle Speisenarten',
      'picker.dishes.all': 'Alle Gerichte',
      'picker.dishes.loading': 'Rezepte werden geladen…',
      'picker.dishes.searching': 'Rezepte werden gesucht…',
      'picker.dishes.failed': 'Rezeptsuche fehlgeschlagen.',
      'picker.dishes.none': 'Keine Rezepte entsprechen dieser Suche und den Filtern.',
      'picker.dishes.selected.one': '1 ausgewählt',
      'picker.dishes.selected.many': '{count} ausgewählt',
      'picker.stock.eyebrow': 'Vorhandener Bestand',
      'picker.stock.title': 'Zutat auswählen',
      'picker.stock.copy': 'Aus dem tatsächlichen Katalog auswählen, statt interne Produktbegriffe einzutippen.',
      'picker.stock.close': 'Zutatenauswahl schliessen',
      'picker.stock.searchLabel': 'Zutaten suchen',
      'picker.stock.searchPlaceholder': 'Zum Beispiel „Mozzarella“, „Wasser“, „Apfel“…',
      'picker.stock.loading': 'Zutaten werden geladen…',
      'picker.stock.searching': 'Zutaten werden gesucht…',
      'picker.stock.failed': 'Zutatensuche fehlgeschlagen.',
      'picker.stock.none': 'Keine Zutaten entsprechen dieser Suche.',
      'picker.stock.use': 'Zutat verwenden',
      'developer.title': 'Entwicklerwerkzeuge & Katalog',
      'developer.copy': 'Rezepte, Produkte, Bewertungen und rohe Katalogdetails',
      'catalog.eyebrow': 'MongoDB-Katalog',
      'catalog.title': 'Was der Planer kennt.',
      'catalog.copy': 'Dieser Bereich ist bewusst dem eigentlichen Event-Workflow untergeordnet.',
      'catalog.openToLoad': 'Werkzeuge öffnen, um den Katalog zu laden.',
      'catalog.recipes': 'Rezepte',
      'catalog.items': 'Artikel',
      'catalog.searchMeals': 'Name, ID, Zutat suchen…',
      'catalog.searchProducts': 'Name, SKU, Begriff suchen…',
      'catalog.filter': 'Nach Eigenschaft filtern',
      'catalog.allCapabilities': 'Alle Eigenschaften',
      'catalog.loading': 'Katalog wird geladen…',
      'catalog.failed': 'Katalog konnte nicht geladen werden.',
      'catalog.shown.one': '1 {noun} angezeigt',
      'catalog.shown.many': '{count} {noun} angezeigt',
      'catalog.recipe': 'Rezept',
      'catalog.item': 'Artikel',
      'catalog.noMatches': 'Keine passenden {noun} für diese Suche und den Filter.',
      'catalog.ingredientsPerServing': 'Zutaten pro Portion',
      'catalog.yields': 'Ergibt {count} {unit}',
      'catalog.concept': 'Begriff',
      'catalog.package': 'Packung',
      'catalog.origin': 'Herkunft',
      'catalog.unspecified': 'Nicht angegeben',
      'catalog.planningScores': 'Planungsbewertungen',
      'catalog.scoreFallback': 'Vom Katalog definierte Planungsbewertung.',
      'footer.poc': 'TABLEPLAN POC',
      'footer.copy': 'Erklärbar entwickelt · Preise in CHF',
      'unit.piece.one': 'Stück', 'unit.piece.many': 'Stück',
      'unit.serving.one': 'Portion', 'unit.serving.many': 'Portionen',
      'unit.cup.one': 'Tasse', 'unit.cup.many': 'Tassen',
      'unit.bottle.one': 'Flasche', 'unit.bottle.many': 'Flaschen',
      'unit.liter.one': 'Liter', 'unit.liter.many': 'Liter'
    },
    fr: {
      'app.title': 'Tableplan — Planificateur de catering',
      'nav.primary': 'Navigation principale',
      'nav.planner': 'Planificateur',
      'nav.tools': 'Outils',
      'language.label': 'Langue',
      'hero.eyebrow': "Du nombre d'invités jusqu'aux achats",
      'hero.title.1': "Planifiez l'événement.",
      'hero.title.2': 'Nous calculons le reste.',
      'hero.copy': "Définissez l'occasion, les contraintes alimentaires, les plats souhaités et le stock disponible. Tableplan fournit un menu déterministe et une liste d'achats au niveau des emballages.",
      'event.title': "Informations sur l'événement",
      'event.loading': "Chargement des modèles d'événement…",
      'event.format': "Format de l'événement",
      'event.guests': 'Invités',
      'event.budget': 'Budget',
      'constraints.title': 'Contraintes alimentaires',
      'constraints.copy': 'Sélectionnez toutes les règles que le menu généré automatiquement doit respecter.',
      'constraints.loading': 'Chargement des contraintes alimentaires…',
      'constraints.none': "Aucune contrainte alimentaire n'est disponible dans le catalogue.",
      'constraints.note': 'Les plats explicitement imposés peuvent déroger à ces règles, mais chaque exception sera clairement signalée avant et après la génération.',
      'constraints.clear': 'Effacer la sélection',
      'constraints.clearCount': 'Effacer {count} sélectionnées',
      'dishes.title': 'Plats spécifiques',
      'dishes.copy': 'Facultatif. Ajoutez les recettes qui doivent absolument figurer au menu final.',
      'dishes.choose': '+ Choisir des plats',
      'dishes.noneSelected': 'Aucun plat spécifique sélectionné.',
      'dishes.remove': 'Retirer',
      'dishes.add': '+ Ajouter le plat',
      'dishes.guaranteed': 'Imposé',
      'dishes.constraintException': 'Exception alimentaire',
      'dishes.constraintWarning': 'Exception alimentaire : {details}. Ce plat restera tout de même dans le plan.',
      'dishes.stillIncluded': 'Ce plat restera tout de même dans le plan.',
      'stock.title': 'Déjà en stock',
      'stock.copy': "Facultatif. Sélectionnez les ingrédients disponibles ; le stock est déduit avant l'arrondi aux emballages.",
      'stock.add': '+ Ajouter du stock',
      'stock.none': 'Aucun stock existant ajouté.',
      'stock.chooseIngredient': 'Choisir un ingrédient',
      'stock.searchCatalog': 'Rechercher dans le catalogue',
      'stock.change': 'Modifier',
      'stock.choose': 'Choisir',
      'stock.ingredient': 'Ingrédient',
      'stock.chooseAria': 'Choisir un ingrédient en stock',
      'stock.amount': 'Quantité',
      'stock.unit': 'Unité',
      'stock.remove': 'Retirer',
      'preferences.title': 'Préférences de planification',
      'preferences.copy': 'Réglages fins facultatifs',
      'preferences.vegetarianShare': 'Part végétarienne',
      'preferences.servings': 'Portions / invité',
      'preferences.useTemplate': 'Utiliser le modèle',
      'preferences.max10': 'Facultatif · maximum 10',
      'preferences.prepareAhead': "Privilégier la préparation à l'avance",
      'preferences.prepareAheadHint': "Utilisé comme critère déterministe en cas d'égalité",
      'preferences.priorities': 'Priorités de sélection',
      'preferences.prioritiesHint': 'Les pondérations sont normalisées automatiquement.',
      'common.lower': 'Plus faible',
      'common.higher': 'Plus élevé',
      'common.remove': 'Retirer',
      'common.done': 'Terminé',
      'common.selected': 'Sélectionné',
      'common.loading': 'Chargement…',
      'common.searching': 'Recherche…',
      'common.error': 'Erreur',
      'plan.generate': 'Générer le plan de catering',
      'plan.resolving': 'Génération du plan…',
      'plan.resolved': 'Plan généré',
      'plan.defaultTitle': 'Votre événement est entièrement calculé.',
      'plan.edit': 'Modifier les données',
      'plan.templatePortions': 'portions du modèle',
      'plan.servingsEach': '{count} portions par invité',
      'plan.forGuests': '{template} pour {guests} invités · {portions}.',
      'results.selectedMenu': 'Menu sélectionné',
      'results.constraintCopy': 'Les exceptions aux contraintes sont affichées directement sur la recette concernée.',
      'results.shoppingList': "Liste d'achats",
      'results.shoppingCopy': "Les quantités requises sont d'abord compensées par le stock, puis arrondies aux emballages.",
      'results.stockUsed': 'Stock utilisé',
      'results.planningDetails': 'Détails de planification',
      'results.totalCost': 'Coût total',
      'results.costPerGuest': 'Coût par invité',
      'results.budgetRemaining': 'Budget restant',
      'results.budgetOverrun': 'Dépassement du budget',
      'results.reviewBeforeService': 'À vérifier avant le service :',
      'results.whySelected': 'Pourquoi ce choix',
      'results.servings': '{count} portions',
      'results.target': 'objectif {quantity}',
      'results.scoreComponents': 'Composantes du score',
      'results.weightedScore': 'Score pondéré',
      'results.noStockMatched': "Aucun stock existant n'a été utilisé pour ce plan.",
      'results.notFulfilled': 'Non satisfait',
      'results.covered': 'Couvert',
      'warning.summary.one': '⚠ 1 exception alimentaire dans ce plan',
      'warning.summary.many': '⚠ {count} exceptions alimentaires dans ce plan',
      'warning.guaranteed.one': "1 exception provient d'un plat explicitement imposé. Il reste dans le plan mais doit être vérifié avant le service.",
      'warning.guaranteed.many': '{count} exceptions proviennent de plats explicitement imposés. Ils restent dans le plan mais doivent être vérifiés avant le service.',
      'warning.review': 'Vérifiez les recettes signalées avant le service.',
      'table.item': 'Article',
      'table.need': 'Besoin',
      'table.stockUsed': 'Stock utilisé',
      'table.packages': 'Emballages',
      'table.purchased': 'Acheté',
      'table.overbuy': 'Surplus',
      'table.total': 'Total',
      'table.origin': 'Origine',
      'table.pack': 'emballage',
      'picker.dishes.eyebrow': 'Plats spécifiques',
      'picker.dishes.title': 'Choisir les plats imposés',
      'picker.dishes.copy': 'Recherchez directement ou parcourez les catégories. Les conflits sont autorisés mais clairement signalés.',
      'picker.dishes.close': 'Fermer le sélecteur de plats',
      'picker.dishes.searchLabel': 'Rechercher des recettes',
      'picker.dishes.searchPlaceholder': 'Essayez « croissant », « fruit », « falafel »…',
      'picker.dishes.categories': 'Parcourir les catégories',
      'picker.dishes.foodType': 'Type de plat',
      'picker.dishes.allFoodTypes': 'Tous les types',
      'picker.dishes.all': 'Tous les plats',
      'picker.dishes.loading': 'Chargement des recettes…',
      'picker.dishes.searching': 'Recherche de recettes…',
      'picker.dishes.failed': 'La recherche de recettes a échoué.',
      'picker.dishes.none': 'Aucune recette ne correspond à cette recherche et à ces filtres.',
      'picker.dishes.selected.one': '1 sélectionné',
      'picker.dishes.selected.many': '{count} sélectionnés',
      'picker.stock.eyebrow': 'Stock existant',
      'picker.stock.title': 'Choisir un ingrédient',
      'picker.stock.copy': "Sélectionnez dans le catalogue réel au lieu de saisir un concept produit interne.",
      'picker.stock.close': "Fermer le sélecteur d'ingrédients",
      'picker.stock.searchLabel': 'Rechercher des ingrédients',
      'picker.stock.searchPlaceholder': 'Essayez « mozzarella », « eau », « pomme »…',
      'picker.stock.loading': 'Chargement des ingrédients…',
      'picker.stock.searching': 'Recherche des ingrédients…',
      'picker.stock.failed': "La recherche d'ingrédients a échoué.",
      'picker.stock.none': 'Aucun ingrédient ne correspond à cette recherche.',
      'picker.stock.use': "Utiliser l'ingrédient",
      'developer.title': 'Outils développeur & catalogue',
      'developer.copy': 'Recettes, produits, scores et détails bruts du catalogue',
      'catalog.eyebrow': 'Catalogue MongoDB',
      'catalog.title': 'Ce que connaît le planificateur.',
      'catalog.copy': "Cette zone est volontairement secondaire par rapport au flux de planification de l'événement.",
      'catalog.openToLoad': 'Ouvrez les outils pour charger le catalogue.',
      'catalog.recipes': 'Recettes',
      'catalog.items': 'Articles',
      'catalog.searchMeals': 'Rechercher nom, ID, ingrédient…',
      'catalog.searchProducts': 'Rechercher nom, SKU, concept…',
      'catalog.filter': 'Filtrer par caractéristique',
      'catalog.allCapabilities': 'Toutes les caractéristiques',
      'catalog.loading': 'Chargement du catalogue…',
      'catalog.failed': 'Le catalogue n’a pas pu être chargé.',
      'catalog.shown.one': '1 {noun} affiché',
      'catalog.shown.many': '{count} {noun} affichés',
      'catalog.recipe': 'recette',
      'catalog.item': 'article',
      'catalog.noMatches': 'Aucun {noun} ne correspond à cette recherche et à ce filtre.',
      'catalog.ingredientsPerServing': 'Ingrédients par portion',
      'catalog.yields': 'Donne {count} {unit}',
      'catalog.concept': 'Concept',
      'catalog.package': 'Emballage',
      'catalog.origin': 'Origine',
      'catalog.unspecified': 'Non indiqué',
      'catalog.planningScores': 'Scores de planification',
      'catalog.scoreFallback': 'Score de planification défini par le catalogue.',
      'footer.poc': 'TABLEPLAN POC',
      'footer.copy': 'Explicable par conception · prix en CHF',
      'unit.piece.one': 'pièce', 'unit.piece.many': 'pièces',
      'unit.serving.one': 'portion', 'unit.serving.many': 'portions',
      'unit.cup.one': 'tasse', 'unit.cup.many': 'tasses',
      'unit.bottle.one': 'bouteille', 'unit.bottle.many': 'bouteilles',
      'unit.liter.one': 'litre', 'unit.liter.many': 'litres'
    },
    it: {
      'app.title': 'Tableplan — Pianificatore catering',
      'nav.primary': 'Navigazione principale',
      'nav.planner': 'Pianificatore',
      'nav.tools': 'Strumenti',
      'language.label': 'Lingua',
      'hero.eyebrow': 'Dal numero di ospiti agli acquisti',
      'hero.title.1': "Pianifica l'evento.",
      'hero.title.2': 'Al resto pensiamo noi.',
      'hero.copy': "Imposta l'occasione, i vincoli alimentari, i piatti desiderati e le scorte disponibili. Tableplan restituisce un menu deterministico e una lista della spesa a livello di confezioni.",
      'event.title': "Dati dell'evento",
      'event.loading': "Caricamento dei modelli d'evento…",
      'event.format': "Formato dell'evento",
      'event.guests': 'Ospiti',
      'event.budget': 'Budget',
      'constraints.title': 'Vincoli alimentari',
      'constraints.copy': 'Seleziona tutte le regole che il menu generato automaticamente deve rispettare.',
      'constraints.loading': 'Caricamento dei vincoli alimentari…',
      'constraints.none': 'Nel catalogo non sono disponibili vincoli alimentari.',
      'constraints.note': 'I piatti richiesti esplicitamente possono ignorare queste regole, ma ogni eccezione verrà evidenziata chiaramente prima e dopo la generazione.',
      'constraints.clear': 'Cancella selezione',
      'constraints.clearCount': 'Cancella {count} selezionati',
      'dishes.title': 'Piatti specifici',
      'dishes.copy': 'Facoltativo. Aggiungi le ricette che devono comparire nel menu finale.',
      'dishes.choose': '+ Scegli piatti',
      'dishes.noneSelected': 'Nessun piatto specifico selezionato.',
      'dishes.remove': 'Rimuovi',
      'dishes.add': '+ Aggiungi piatto',
      'dishes.guaranteed': 'Garantito',
      'dishes.constraintException': 'Eccezione ai vincoli',
      'dishes.constraintWarning': 'Eccezione ai vincoli: {details}. Questo piatto resterà comunque nel piano.',
      'dishes.stillIncluded': 'Questo piatto resterà comunque nel piano.',
      'stock.title': 'Già disponibile',
      'stock.copy': 'Facoltativo. Seleziona gli ingredienti già disponibili; le scorte vengono sottratte prima di arrotondare alle confezioni.',
      'stock.add': '+ Aggiungi scorta',
      'stock.none': 'Nessuna scorta esistente aggiunta.',
      'stock.chooseIngredient': 'Scegli ingrediente',
      'stock.searchCatalog': 'Cerca nel catalogo',
      'stock.change': 'Cambia',
      'stock.choose': 'Scegli',
      'stock.ingredient': 'Ingrediente',
      'stock.chooseAria': 'Scegli ingrediente in scorta',
      'stock.amount': 'Quantità',
      'stock.unit': 'Unità',
      'stock.remove': 'Rimuovi',
      'preferences.title': 'Preferenze di pianificazione',
      'preferences.copy': 'Regolazione fine facoltativa',
      'preferences.vegetarianShare': 'Quota vegetariana',
      'preferences.servings': 'Porzioni / ospite',
      'preferences.useTemplate': 'Usa modello',
      'preferences.max10': 'Facoltativo · massimo 10',
      'preferences.prepareAhead': 'Preferisci preparazione anticipata',
      'preferences.prepareAheadHint': 'Usato come criterio deterministico in caso di parità',
      'preferences.priorities': 'Priorità di selezione',
      'preferences.prioritiesHint': 'I pesi vengono normalizzati automaticamente.',
      'common.lower': 'Più basso',
      'common.higher': 'Più alto',
      'common.remove': 'Rimuovi',
      'common.done': 'Fatto',
      'common.selected': 'Selezionato',
      'common.loading': 'Caricamento…',
      'common.searching': 'Ricerca…',
      'common.error': 'Errore',
      'plan.generate': 'Genera piano catering',
      'plan.resolving': 'Generazione del piano…',
      'plan.resolved': 'Piano generato',
      'plan.defaultTitle': "Il tuo evento è stato calcolato.",
      'plan.edit': 'Modifica dati',
      'plan.templatePortions': 'porzioni del modello',
      'plan.servingsEach': '{count} porzioni per ospite',
      'plan.forGuests': '{template} per {guests} ospiti · {portions}.',
      'results.selectedMenu': 'Menu selezionato',
      'results.constraintCopy': 'Le eccezioni ai vincoli sono mostrate direttamente sulla ricetta interessata.',
      'results.shoppingList': 'Lista della spesa',
      'results.shoppingCopy': 'Le quantità necessarie vengono compensate con le scorte prima di arrotondare alle confezioni.',
      'results.stockUsed': 'Scorte utilizzate',
      'results.planningDetails': 'Dettagli di pianificazione',
      'results.totalCost': 'Costo totale',
      'results.costPerGuest': 'Costo per ospite',
      'results.budgetRemaining': 'Budget residuo',
      'results.budgetOverrun': 'Superamento budget',
      'results.reviewBeforeService': 'Controllare prima del servizio:',
      'results.whySelected': 'Perché è stato scelto',
      'results.servings': '{count} porzioni',
      'results.target': 'obiettivo {quantity}',
      'results.scoreComponents': 'Componenti del punteggio',
      'results.weightedScore': 'Punteggio ponderato',
      'results.noStockMatched': 'Nessuna scorta esistente è stata utilizzata per questo piano.',
      'results.notFulfilled': 'Non soddisfatto',
      'results.covered': 'Coperto',
      'warning.summary.one': '⚠ 1 eccezione ai vincoli in questo piano',
      'warning.summary.many': '⚠ {count} eccezioni ai vincoli in questo piano',
      'warning.guaranteed.one': '1 eccezione deriva da un piatto richiesto esplicitamente. Rimane nel piano ma va controllato prima del servizio.',
      'warning.guaranteed.many': '{count} eccezioni derivano da piatti richiesti esplicitamente. Rimangono nel piano ma vanno controllati prima del servizio.',
      'warning.review': 'Controlla le ricette evidenziate prima del servizio.',
      'table.item': 'Articolo',
      'table.need': 'Necessario',
      'table.stockUsed': 'Scorta usata',
      'table.packages': 'Confezioni',
      'table.purchased': 'Acquistato',
      'table.overbuy': 'Eccedenza',
      'table.total': 'Totale',
      'table.origin': 'Origine',
      'table.pack': 'confezione',
      'picker.dishes.eyebrow': 'Piatti specifici',
      'picker.dishes.title': 'Scegli piatti garantiti',
      'picker.dishes.copy': 'Cerca direttamente o sfoglia le categorie. I conflitti sono consentiti ma chiaramente evidenziati.',
      'picker.dishes.close': 'Chiudi selettore piatti',
      'picker.dishes.searchLabel': 'Cerca ricette',
      'picker.dishes.searchPlaceholder': 'Prova “croissant”, “frutta”, “falafel”…',
      'picker.dishes.categories': 'Sfoglia categorie',
      'picker.dishes.foodType': 'Tipo di piatto',
      'picker.dishes.allFoodTypes': 'Tutti i tipi',
      'picker.dishes.all': 'Tutti i piatti',
      'picker.dishes.loading': 'Caricamento ricette…',
      'picker.dishes.searching': 'Ricerca ricette…',
      'picker.dishes.failed': 'Ricerca ricette non riuscita.',
      'picker.dishes.none': 'Nessuna ricetta corrisponde alla ricerca e ai filtri.',
      'picker.dishes.selected.one': '1 selezionato',
      'picker.dishes.selected.many': '{count} selezionati',
      'picker.stock.eyebrow': 'Scorte esistenti',
      'picker.stock.title': 'Scegli un ingrediente',
      'picker.stock.copy': 'Seleziona dal catalogo reale invece di digitare un concetto prodotto interno.',
      'picker.stock.close': 'Chiudi selettore ingredienti',
      'picker.stock.searchLabel': 'Cerca ingredienti',
      'picker.stock.searchPlaceholder': 'Prova “mozzarella”, “acqua”, “mela”…',
      'picker.stock.loading': 'Caricamento ingredienti…',
      'picker.stock.searching': 'Ricerca ingredienti…',
      'picker.stock.failed': 'Ricerca ingredienti non riuscita.',
      'picker.stock.none': 'Nessun ingrediente corrisponde alla ricerca.',
      'picker.stock.use': "Usa l'ingrediente",
      'developer.title': 'Strumenti sviluppatore & catalogo',
      'developer.copy': 'Ricette, prodotti, punteggi e dettagli grezzi del catalogo',
      'catalog.eyebrow': 'Catalogo MongoDB',
      'catalog.title': 'Cosa conosce il pianificatore.',
      'catalog.copy': "Quest'area è volutamente secondaria rispetto al flusso di pianificazione dell'evento.",
      'catalog.openToLoad': 'Apri gli strumenti per caricare il catalogo.',
      'catalog.recipes': 'Ricette',
      'catalog.items': 'Articoli',
      'catalog.searchMeals': 'Cerca nome, ID, ingrediente…',
      'catalog.searchProducts': 'Cerca nome, SKU, concetto…',
      'catalog.filter': 'Filtra per caratteristica',
      'catalog.allCapabilities': 'Tutte le caratteristiche',
      'catalog.loading': 'Caricamento catalogo…',
      'catalog.failed': 'Caricamento catalogo non riuscito.',
      'catalog.shown.one': '1 {noun} mostrato',
      'catalog.shown.many': '{count} {noun} mostrati',
      'catalog.recipe': 'ricetta',
      'catalog.item': 'articolo',
      'catalog.noMatches': 'Nessun {noun} corrisponde alla ricerca e al filtro.',
      'catalog.ingredientsPerServing': 'Ingredienti per porzione',
      'catalog.yields': 'Produce {count} {unit}',
      'catalog.concept': 'Concetto',
      'catalog.package': 'Confezione',
      'catalog.origin': 'Origine',
      'catalog.unspecified': 'Non specificato',
      'catalog.planningScores': 'Punteggi di pianificazione',
      'catalog.scoreFallback': 'Punteggio di pianificazione definito dal catalogo.',
      'footer.poc': 'TABLEPLAN POC',
      'footer.copy': 'Spiegabile per progettazione · prezzi in CHF',
      'unit.piece.one': 'pezzo', 'unit.piece.many': 'pezzi',
      'unit.serving.one': 'porzione', 'unit.serving.many': 'porzioni',
      'unit.cup.one': 'tazza', 'unit.cup.many': 'tazze',
      'unit.bottle.one': 'bottiglia', 'unit.bottle.many': 'bottiglie',
      'unit.liter.one': 'litro', 'unit.liter.many': 'litri'
    }
  };

  // Current-branch wording overrides. Static UI copy is curated; catalog data still translates dynamically.
  Object.assign(messages.en, {
    'hero.copy': 'Set the occasion, dietary guest counts, specific dishes and stock on hand. Tableplan returns a deterministic menu and package-level shopping list.',
    'constraints.title': 'Dietary guest counts',
    'constraints.copy': 'Enter how many guests need compatible servings. One dish may cover more than one dietary need.',
    'constraints.note': 'These counts set minimum serving coverage; they do not require every dish in the menu to match. Pinned dishes that do not cover an active need are clearly flagged.',
    'constraints.guests': 'guests',
    'constraints.clearCount': 'Clear {count} count{suffix}',
    'event.noFormats': 'No event formats are available.',
    'event.changed': 'Event format changed — regenerate to calculate a new menu.',
    'preferences.mealCount': 'Distinct meals offered',
    'preferences.mealCountHint': 'Changing this does not change total servings',
    'results.selectedMenuCopy': 'Pin dishes to keep them, or remove dishes from the next generation.',
    'results.regenerate': 'Regenerate menu',
    'results.menuChanged': 'Menu changed — regenerate to update quantities and costs.',
    'results.applyChoice': 'Use Regenerate menu to apply this choice.',
    'warning.pinnedTitle.one': '⚠ 1 pinned dish needs dietary review',
    'warning.pinnedTitle.many': '⚠ {count} pinned dishes need dietary review',
    'warning.pinnedBody.one': 'The selected dish does not satisfy one or more dietary needs you entered. It remains in the menu by request; the planner allocates compatible servings through the other dishes.',
    'warning.pinnedBody.many': '{count} selected dishes do not satisfy one or more dietary needs you entered. They remain in the menu by request; the planner allocates compatible servings through the other dishes.',
    'dishes.doesNotCover': 'Does not cover: {details}. It can still be pinned; other dishes must provide this dietary coverage.',
    'dishes.pinnedCoverage': 'Pinned dietary exception: {details}. The dish stays in the menu; compatible servings are allocated through other dishes.',
    'dishes.pinned': 'Pinned',
    'dishes.pin': 'Pin',
    'dishes.unpin': 'Unpin',
    'dishes.removeNext': 'Remove',
    'dishes.review': 'Review dietary coverage:',
    'dishes.why': 'Why this was selected',
    'dishes.coverage': '{name} coverage',
    'picker.dishes.copy': 'Search directly or browse by category. A pinned dish may miss an active dietary need; that is allowed and clearly highlighted.',
    'picker.dishes.categories': 'Browse categories',
    'picker.dishes.matching': 'matching “{query}”',
    'picker.dishes.count.one': '1 recipe',
    'picker.dishes.count.many': '{count} recipes',
    'picker.stock.count.one': '1 ingredient',
    'picker.stock.count.many': '{count} ingredients',
    'picker.stock.matching': 'matching “{query}”',
    'search.localizedHint': 'Searches both the selected language and the English catalog.',
    'catalog.menuChanged': 'Menu changed',
    'common.undo': 'Undo',
    'common.origin': 'Origin',
    'common.target': 'target',
  });

  Object.assign(messages.de, {
    'hero.copy': 'Anlass, Anzahl der Gäste mit Ernährungsbedürfnissen, gewünschte Gerichte und vorhandenen Bestand festlegen. Tableplan erstellt daraus deterministisch ein Menü und eine Einkaufsliste auf Verpackungsebene.',
    'constraints.title': 'Ernährungsbedürfnisse',
    'constraints.copy': 'Geben Sie an, wie viele Gäste passende Portionen benötigen. Ein Gericht kann mehrere Bedürfnisse gleichzeitig abdecken.',
    'constraints.note': 'Die Zahlen definieren die minimale Abdeckung; nicht jedes Gericht muss zu jeder Ernährungsform passen. Angeheftete Gerichte ohne passende Abdeckung werden deutlich markiert.',
    'constraints.guests': 'Gäste',
    'constraints.clear': 'Eingaben löschen',
    'constraints.clearCount': '{count} Eingabe{suffix} löschen',
    'event.noFormats': 'Keine Eventformate verfügbar.',
    'event.changed': 'Eventformat geändert — neu berechnen, um ein neues Menü zu erstellen.',
    'preferences.mealCount': 'Anzahl verschiedener Gerichte',
    'preferences.mealCountHint': 'Dies ändert nicht die Gesamtzahl der Portionen',
    'results.selectedMenuCopy': 'Gerichte anheften, um sie zu behalten, oder für die nächste Berechnung ausschliessen.',
    'results.regenerate': 'Menü neu berechnen',
    'results.menuChanged': 'Menü geändert — neu berechnen, um Mengen und Kosten zu aktualisieren.',
    'results.applyChoice': 'Mit „Menü neu berechnen“ wird diese Auswahl angewendet.',
    'warning.pinnedTitle.one': '⚠ 1 angeheftetes Gericht prüfen',
    'warning.pinnedTitle.many': '⚠ {count} angeheftete Gerichte prüfen',
    'warning.pinnedBody.one': 'Das ausgewählte Gericht deckt mindestens ein angegebenes Ernährungsbedürfnis nicht ab. Es bleibt auf Wunsch im Menü; passende Portionen werden über die übrigen Gerichte eingeplant.',
    'warning.pinnedBody.many': '{count} ausgewählte Gerichte decken mindestens ein angegebenes Ernährungsbedürfnis nicht ab. Sie bleiben auf Wunsch im Menü; passende Portionen werden über die übrigen Gerichte eingeplant.',
    'dishes.doesNotCover': 'Deckt nicht ab: {details}. Das Gericht kann trotzdem angeheftet werden; die übrigen Gerichte müssen diese Ernährungsbedürfnisse abdecken.',
    'dishes.pinnedCoverage': 'Hinweis zum angehefteten Gericht: {details}. Es bleibt im Menü; passende Portionen werden über andere Gerichte eingeplant.',
    'dishes.pinned': 'Angeheftet', 'dishes.pin': 'Anheften', 'dishes.unpin': 'Lösen',
    'dishes.removeNext': 'Entfernen', 'dishes.review': 'Ernährungsabdeckung prüfen:',
    'dishes.why': 'Warum dieses Gericht gewählt wurde', 'dishes.coverage': '{name}-Abdeckung',
    'picker.dishes.copy': 'Direkt suchen oder nach Kategorie stöbern. Ein angeheftetes Gericht darf ein aktives Ernährungsbedürfnis verfehlen; dies wird deutlich markiert.',
    'picker.dishes.categories': 'Kategorien durchsuchen',
    'picker.dishes.matching': 'passend zu „{query}”',
    'picker.dishes.count.one': '1 Rezept', 'picker.dishes.count.many': '{count} Rezepte',
    'picker.stock.count.one': '1 Zutat', 'picker.stock.count.many': '{count} Zutaten',
    'picker.stock.matching': 'passend zu „{query}”',
    'search.localizedHint': 'Die Suche berücksichtigt die gewählte Sprache und den englischen Katalog.',
    'common.undo': 'Rückgängig', 'common.origin': 'Herkunft', 'common.target': 'Zielmenge',
  });

  Object.assign(messages.fr, {
    'hero.copy': "Définissez l’occasion, le nombre d’invités ayant des besoins alimentaires, les plats souhaités et le stock disponible. Tableplan fournit un menu déterministe et une liste d’achats par emballage.",
    'constraints.title': 'Besoins alimentaires',
    'constraints.copy': 'Indiquez combien d’invités ont besoin de portions compatibles. Un même plat peut couvrir plusieurs besoins.',
    'constraints.note': 'Ces nombres définissent une couverture minimale ; tous les plats ne doivent pas respecter chaque besoin. Les plats épinglés incompatibles sont clairement signalés.',
    'constraints.guests': 'invités',
    'constraints.clear': 'Effacer les valeurs',
    'constraints.clearCount': 'Effacer {count} valeur{suffix}',
    'event.noFormats': 'Aucun format d’événement disponible.',
    'event.changed': 'Format d’événement modifié — recalculez pour créer un nouveau menu.',
    'preferences.mealCount': 'Nombre de plats différents',
    'preferences.mealCountHint': 'Cela ne change pas le nombre total de portions',
    'results.selectedMenuCopy': 'Épinglez les plats à conserver ou retirez-les de la prochaine génération.',
    'results.regenerate': 'Recalculer le menu',
    'results.menuChanged': 'Menu modifié — recalculez pour mettre à jour les quantités et les coûts.',
    'results.applyChoice': 'Utilisez « Recalculer le menu » pour appliquer ce choix.',
    'warning.pinnedTitle.one': '⚠ 1 plat épinglé à vérifier',
    'warning.pinnedTitle.many': '⚠ {count} plats épinglés à vérifier',
    'warning.pinnedBody.one': 'Le plat sélectionné ne couvre pas au moins un besoin alimentaire saisi. Il reste au menu sur demande ; les portions compatibles sont allouées via les autres plats.',
    'warning.pinnedBody.many': '{count} plats sélectionnés ne couvrent pas au moins un besoin alimentaire saisi. Ils restent au menu sur demande ; les portions compatibles sont allouées via les autres plats.',
    'dishes.doesNotCover': 'Ne couvre pas : {details}. Le plat peut tout de même être épinglé ; les autres plats doivent assurer cette couverture.',
    'dishes.pinnedCoverage': 'Attention au plat épinglé : {details}. Il reste au menu ; les portions compatibles sont allouées via d’autres plats.',
    'dishes.pinned': 'Épinglé', 'dishes.pin': 'Épingler', 'dishes.unpin': 'Désépingler',
    'dishes.removeNext': 'Retirer', 'dishes.review': 'Vérifier la couverture alimentaire :',
    'dishes.why': 'Pourquoi ce plat a été choisi', 'dishes.coverage': 'Couverture {name}',
    'picker.dishes.copy': 'Recherchez directement ou parcourez les catégories. Un plat épinglé peut ne pas couvrir un besoin actif ; cela est clairement signalé.',
    'picker.dishes.categories': 'Parcourir les catégories',
    'picker.dishes.matching': 'correspondant à « {query} »',
    'picker.dishes.count.one': '1 recette', 'picker.dishes.count.many': '{count} recettes',
    'picker.stock.count.one': '1 ingrédient', 'picker.stock.count.many': '{count} ingrédients',
    'picker.stock.matching': 'correspondant à « {query} »',
    'search.localizedHint': 'La recherche utilise la langue choisie ainsi que le catalogue anglais.',
    'common.undo': 'Annuler', 'common.origin': 'Origine', 'common.target': 'cible',
  });

  Object.assign(messages.it, {
    'hero.copy': 'Imposta l’occasione, il numero di ospiti con esigenze alimentari, i piatti desiderati e le scorte disponibili. Tableplan restituisce un menu deterministico e una lista della spesa a livello di confezione.',
    'constraints.title': 'Esigenze alimentari',
    'constraints.copy': 'Indica quanti ospiti necessitano di porzioni compatibili. Un piatto può coprire più esigenze contemporaneamente.',
    'constraints.note': 'I numeri definiscono la copertura minima; non tutti i piatti devono soddisfare ogni esigenza. I piatti fissati non compatibili vengono evidenziati chiaramente.',
    'constraints.guests': 'ospiti',
    'constraints.clear': 'Azzera valori',
    'constraints.clearCount': 'Azzera {count} valore{suffix}',
    'event.noFormats': 'Nessun formato evento disponibile.',
    'event.changed': 'Formato evento modificato — ricalcola per creare un nuovo menu.',
    'preferences.mealCount': 'Numero di piatti diversi',
    'preferences.mealCountHint': 'Non modifica il numero totale di porzioni',
    'results.selectedMenuCopy': 'Fissa i piatti da mantenere oppure rimuovili dalla prossima generazione.',
    'results.regenerate': 'Ricalcola menu',
    'results.menuChanged': 'Menu modificato — ricalcola per aggiornare quantità e costi.',
    'results.applyChoice': 'Usa « Ricalcola menu » per applicare questa scelta.',
    'warning.pinnedTitle.one': '⚠ 1 piatto fissato da verificare',
    'warning.pinnedTitle.many': '⚠ {count} piatti fissati da verificare',
    'warning.pinnedBody.one': 'Il piatto selezionato non copre almeno una delle esigenze alimentari inserite. Rimane nel menu su richiesta; le porzioni compatibili vengono allocate tramite gli altri piatti.',
    'warning.pinnedBody.many': '{count} piatti selezionati non coprono almeno una delle esigenze alimentari inserite. Rimangono nel menu su richiesta; le porzioni compatibili vengono allocate tramite gli altri piatti.',
    'dishes.doesNotCover': 'Non copre: {details}. Il piatto può comunque essere fissato; gli altri piatti devono fornire questa copertura.',
    'dishes.pinnedCoverage': 'Attenzione al piatto fissato: {details}. Rimane nel menu; le porzioni compatibili vengono allocate tramite altri piatti.',
    'dishes.pinned': 'Fissato', 'dishes.pin': 'Fissa', 'dishes.unpin': 'Sblocca',
    'dishes.removeNext': 'Rimuovi', 'dishes.review': 'Verifica copertura alimentare:',
    'dishes.why': 'Perché è stato scelto', 'dishes.coverage': 'Copertura {name}',
    'picker.dishes.copy': 'Cerca direttamente o sfoglia le categorie. Un piatto fissato può non coprire un’esigenza attiva; ciò viene evidenziato chiaramente.',
    'picker.dishes.categories': 'Sfoglia categorie',
    'picker.dishes.matching': 'corrispondente a « {query} »',
    'picker.dishes.count.one': '1 ricetta', 'picker.dishes.count.many': '{count} ricette',
    'picker.stock.count.one': '1 ingrediente', 'picker.stock.count.many': '{count} ingredienti',
    'picker.stock.matching': 'corrispondente a « {query} »',
    'search.localizedHint': 'La ricerca usa sia la lingua selezionata sia il catalogo inglese.',
    'common.undo': 'Annulla', 'common.origin': 'Origine', 'common.target': 'obiettivo',
  });

  let currentLanguage = resolveInitialLanguage();
  let dbPromise = null;
  let flushTimer = null;
  let providerReady = currentLanguage === SOURCE_LANGUAGE;
  let providerCheckPromise = null;
  let providerRetryTimer = null;
  const TRANSLATION_REQUEST_TIMEOUT_MS = 3500;
  const PROVIDER_RETRY_MS = 5000;
  const pendingDynamicElements = new Set();
  const localeListeners = new Set();
  const memoryTranslations = new Map();

  function resolveInitialLanguage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED_LANGUAGES.includes(stored)) return stored;
    return SOURCE_LANGUAGE;
  }

  function interpolate(value, params = {}) {
    return String(value).replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`);
  }

  function t(key, params = {}) {
    return interpolate(messages[currentLanguage]?.[key] ?? messages.en[key] ?? key, params);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  }

  function dynamicMarkup(value, context = 'generic') {
    const source = String(value ?? '');
    return `<span data-i18n-dynamic-source="${escapeHtml(source)}" data-i18n-context="${escapeHtml(context)}">${escapeHtml(source)}</span>`;
  }

  function setDynamicText(element, value, context = 'generic') {
    if (!element) return;
    const source = String(value ?? '');
    element.dataset.i18nDynamicSource = source;
    element.dataset.i18nContext = context;
    delete element.dataset.i18nAppliedLanguage;
    delete element.dataset.i18nAppliedSource;
    element.textContent = source;
    queueDynamicElement(element);
  }

  function dynamicOptionAttributes(value, context = 'generic') {
    const source = String(value ?? '');
    return `data-i18n-dynamic-source="${escapeHtml(source)}" data-i18n-context="${escapeHtml(context)}"`;
  }

  function applyStatic(root = document) {
    root.querySelectorAll?.('[data-i18n]').forEach(element => {
      element.textContent = t(element.dataset.i18n);
    });
    root.querySelectorAll?.('[data-i18n-placeholder]').forEach(element => {
      element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder));
    });
    root.querySelectorAll?.('[data-i18n-aria-label]').forEach(element => {
      element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
    });
    root.querySelectorAll?.('[data-i18n-title]').forEach(element => {
      element.setAttribute('title', t(element.dataset.i18nTitle));
    });
    root.querySelectorAll?.('[data-i18n-unit]').forEach(element => {
      element.textContent = unitLabel(element.dataset.i18nUnit, Number(element.dataset.i18nUnitAmount || 2));
    });
    if (root === document) document.title = t('app.title');
  }

  function setLanguage(language) {
    if (!SUPPORTED_LANGUAGES.includes(language) || language === currentLanguage) return;
    currentLanguage = language;
    providerReady = language === SOURCE_LANGUAGE;
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
    applyStatic(document);
    document.querySelectorAll('[data-i18n-dynamic-source]').forEach(element => {
      delete element.dataset.i18nAppliedLanguage;
      delete element.dataset.i18nAppliedSource;
      element.textContent = element.dataset.i18nDynamicSource || '';
      queueDynamicElement(element);
    });
    if (language !== SOURCE_LANGUAGE) ensureProviderReady();
    localeListeners.forEach(listener => listener(language));
  }

  function onLanguageChange(listener) {
    localeListeners.add(listener);
    return () => localeListeners.delete(listener);
  }

  function openDb() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(() => null);
    return dbPromise;
  }

  async function cacheGet(key) {
    const db = await openDb();
    if (!db) return null;
    return new Promise(resolve => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    });
  }

  async function cachePut(key, value) {
    const db = await openDb();
    if (!db) return;
    await new Promise(resolve => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  }

  function cacheKey(targetLanguage, sourceLanguage, context, text) {
    return `${targetLanguage}|${sourceLanguage || 'auto'}|${context || 'generic'}|${text}`;
  }

  function scheduleProviderRetry() {
    if (currentLanguage === SOURCE_LANGUAGE || providerRetryTimer) return;
    providerRetryTimer = window.setTimeout(() => {
      providerRetryTimer = null;
      ensureProviderReady(true);
    }, PROVIDER_RETRY_MS);
  }

  async function ensureProviderReady(force = false) {
    if (currentLanguage === SOURCE_LANGUAGE) {
      providerReady = true;
      return true;
    }
    if (providerReady && !force) return true;
    if (providerCheckPromise) return providerCheckPromise;

    providerCheckPromise = (async () => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 2200);
      try {
        const response = await fetch('/api/i18n/status', { signal: controller.signal, cache: 'no-store' });
        const body = response.ok ? await response.json() : {};
        providerReady = Boolean(response.ok && body.ready);
      } catch (_) {
        providerReady = false;
      } finally {
        window.clearTimeout(timer);
        providerCheckPromise = null;
      }

      if (providerReady) {
        queueDynamicTree(document);
      } else {
        scheduleProviderRetry();
      }
      return providerReady;
    })();
    return providerCheckPromise;
  }

  async function translateItems(items, options = {}) {
    const targetLanguage = options.targetLanguage || currentLanguage;
    const sourceLanguage = options.sourceLanguage || SOURCE_LANGUAGE;
    const normalized = items
      .map(item => ({ text: String(item.text ?? '').trim(), context: item.context || 'generic' }))
      .filter(item => item.text);
    if (!normalized.length) return [];
    if (targetLanguage === sourceLanguage || targetLanguage === SOURCE_LANGUAGE && sourceLanguage === SOURCE_LANGUAGE) {
      return normalized.map(item => ({ ...item, translatedText: item.text, translated: false }));
    }

    const results = new Array(normalized.length);
    const missing = [];
    const cachedValues = await Promise.all(normalized.map(item =>
      cacheGet(cacheKey(targetLanguage, sourceLanguage, item.context, item.text))
    ));
    normalized.forEach((item, index) => {
      const key = cacheKey(targetLanguage, sourceLanguage, item.context, item.text);
      const cached = cachedValues[index];
      if (cached) {
        results[index] = { ...item, translatedText: cached, translated: true };
        memoryTranslations.set(`${targetLanguage}|${item.context}|${item.text}`, cached);
      }
      else missing.push({ ...item, index, key });
    });

    if (!missing.length) return results;

    if (!providerReady) {
      ensureProviderReady();
      missing.forEach(item => {
        results[item.index] = { text: item.text, context: item.context, translatedText: item.text, translated: false };
      });
      return results;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TRANSLATION_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch('/api/i18n/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          targetLanguage,
          sourceLanguage,
          items: missing.map(({ text, context }) => ({ text, context }))
        })
      });
      if (!response.ok) throw new Error(`Translation request failed (${response.status})`);
      const body = await response.json();
      const translatedItems = Array.isArray(body.items) ? body.items : [];
      missing.forEach((item, offset) => {
        const translated = translatedItems[offset];
        const translatedText = String(translated?.translatedText || item.text);
        const didTranslate = Boolean(translated?.translated && translatedText && translatedText !== item.text);
        results[item.index] = { text: item.text, context: item.context, translatedText, translated: didTranslate };
        if (didTranslate) {
          memoryTranslations.set(`${targetLanguage}|${item.context}|${item.text}`, translatedText);
          cachePut(item.key, translatedText);
        }
      });
    } catch (_) {
      providerReady = false;
      scheduleProviderRetry();
      missing.forEach(item => {
        results[item.index] = { text: item.text, context: item.context, translatedText: item.text, translated: false };
      });
    } finally {
      window.clearTimeout(timer);
    }
    return results;
  }

  async function translateText(text, context = 'generic', options = {}) {
    const [result] = await translateItems([{ text, context }], options);
    return result?.translatedText || String(text ?? '');
  }

  async function searchQueries(query) {
    const normalized = String(query ?? '').trim();
    if (!normalized) return [''];
    if (currentLanguage === SOURCE_LANGUAGE) return [normalized];
    if (!providerReady) {
      ensureProviderReady();
      return [normalized];
    }
    const sourceQuery = await translateText(normalized, 'search-query', {
      targetLanguage: SOURCE_LANGUAGE,
      sourceLanguage: currentLanguage
    });
    return [...new Set([normalized, sourceQuery].map(value => String(value || '').trim()).filter(Boolean))];
  }

  function queueDynamicElement(element) {
    if (!(element instanceof Element) || !element.dataset.i18nDynamicSource) return;
    pendingDynamicElements.add(element);
    if (flushTimer) return;
    flushTimer = window.setTimeout(flushDynamicElements, 35);
  }

  function queueDynamicTree(root) {
    if (!(root instanceof Element) && root !== document) return;
    if (root instanceof Element && root.matches('[data-i18n-dynamic-source]')) queueDynamicElement(root);
    root.querySelectorAll?.('[data-i18n-dynamic-source]').forEach(queueDynamicElement);
  }

  async function flushDynamicElements() {
    flushTimer = null;
    const elements = [...pendingDynamicElements].filter(element => element.isConnected);
    pendingDynamicElements.clear();
    const active = elements.filter(element => {
      const source = element.dataset.i18nDynamicSource || '';
      return source && (element.dataset.i18nAppliedLanguage !== currentLanguage || element.dataset.i18nAppliedSource !== source);
    });
    if (!active.length) return;

    const unique = new Map();
    active.forEach(element => {
      const text = element.dataset.i18nDynamicSource || '';
      const context = element.dataset.i18nContext || 'generic';
      const key = `${context}\u0000${text}`;
      if (!unique.has(key)) unique.set(key, { text, context });
    });
    const translated = await translateItems([...unique.values()]);
    const translatedByKey = new Map(translated.map(item => [`${item.context}\u0000${item.text}`, item.translatedText]));

    active.forEach(element => {
      const source = element.dataset.i18nDynamicSource || '';
      const context = element.dataset.i18nContext || 'generic';
      const key = `${context}\u0000${source}`;
      if (!element.isConnected) return;
      element.textContent = translatedByKey.get(key) || source;
      element.dataset.i18nAppliedLanguage = currentLanguage;
      element.dataset.i18nAppliedSource = source;
    });
  }


  function cachedTranslation(text, context = 'generic') {
    const source = String(text ?? '');
    if (currentLanguage === SOURCE_LANGUAGE) return source;
    return memoryTranslations.get(`${currentLanguage}|${context}|${source}`) || source;
  }

  function formatNumber(value, options = {}) {
    return new Intl.NumberFormat(LOCALES[currentLanguage] || LOCALES.en, options).format(value);
  }

  function formatMoney(value, currency = 'CHF') {
    return new Intl.NumberFormat(LOCALES[currentLanguage] || LOCALES.en, { style: 'currency', currency }).format(value);
  }

  function unitLabel(unit, amount) {
    const normalized = String(unit || '').toLowerCase();
    if (['g', 'kg', 'ml'].includes(normalized)) return normalized;
    if (normalized === 'l') return t('unit.liter.many');
    const key = `unit.${normalized}.${Number(amount) === 1 ? 'one' : 'many'}`;
    const translated = messages[currentLanguage]?.[key] ?? messages.en[key];
    return translated || unit;
  }

  function init() {
    document.documentElement.lang = currentLanguage;
    applyStatic(document);
    queueDynamicTree(document);
    if (currentLanguage !== SOURCE_LANGUAGE) ensureProviderReady();

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node instanceof Element) {
            applyStatic(node);
            queueDynamicTree(node);
          }
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.TableplanI18n = {
    init,
    t,
    setLanguage,
    get language() { return currentLanguage; },
    get supportedLanguages() { return [...SUPPORTED_LANGUAGES]; },
    languageLabel: language => LANGUAGE_LABELS[language] || language,
    onLanguageChange,
    applyStatic,
    dynamicMarkup,
    dynamicOptionAttributes,
    setDynamicText,
    queueDynamicTree,
    translateItems,
    translateText,
    searchQueries,
    cachedTranslation,
    formatNumber,
    formatMoney,
    unitLabel,
    get translationReady() { return providerReady; }
  };
})();
