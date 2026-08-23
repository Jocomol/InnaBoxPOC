const i18n = window.TableplanI18n;
i18n.init();
const t = (key, params = {}) => i18n.t(key, params);
const dynamic = (value, context = 'generic') => i18n.dynamicMarkup(value, context);

const state = {
  templates: [],
  priorities: [],
  constraints: [],
  mealCategories: [],
  mealCapabilities: [],
  requiredMeals: new Map(),
  excludedMealIds: new Set(),
  excludedMealNames: new Map(),
  currentPlan: null,
  planIsStale: false,
  pickerMeals: [],
  pickerCategory: '',
  pickerCapability: '',
  pickerSearchToken: 0,
  inventoryPickerOptions: [],
  inventoryPickerRow: null,
  inventoryPickerSearchToken: 0,
  catalogType: 'meals',
  catalogLoaded: false,
  meals: [],
  products: []
};

const form = document.querySelector('#planner-form');
const templateSelect = document.querySelector('#template');
const eventTypesRoot = document.querySelector('#event-types');
const description = document.querySelector('#template-description');
const inventoryRows = document.querySelector('#inventory-rows');
const errorBox = document.querySelector('#form-error');
const results = document.querySelector('#results');
const generateButton = document.querySelector('#generate');
const constraintRoot = document.querySelector('#dietary-constraints');
const requiredMealsRoot = document.querySelector('#required-meals');
const mealPicker = document.querySelector('#meal-picker');
const pickerSearch = document.querySelector('#meal-picker-search');
const pickerCategories = document.querySelector('#meal-picker-categories');
const pickerResults = document.querySelector('#meal-picker-results');
const pickerCapability = document.querySelector('#meal-picker-capability');
const clearConstraintsButton = document.querySelector('#clear-constraints');
const clearRequiredMealsButton = document.querySelector('#clear-required-meals');
const pickerClearSelectedButton = document.querySelector('#meal-picker-clear-selected');
const pickerStatus = document.querySelector('#meal-picker-status');
const inventoryPicker = document.querySelector('#inventory-picker');
const inventoryPickerSearch = document.querySelector('#inventory-picker-search');
const inventoryPickerResults = document.querySelector('#inventory-picker-results');
const inventoryPickerStatus = document.querySelector('#inventory-picker-status');
const developerTools = document.querySelector('#developer-tools');
const catalogSearch = document.querySelector('#catalog-search');
const catalogCapability = document.querySelector('#catalog-capability');
const catalogResults = document.querySelector('#catalog-results');
const guestCountInput = document.querySelector('#guest-count');
const mealCountInput = document.querySelector('#meal-count-input');
const selectedMealsRoot = document.querySelector('#selected-meals');
const regenerateMenuButton = document.querySelector('#regenerate-menu');
const menuChangeStatus = document.querySelector('#menu-change-status');
const excludedMealsRoot = document.querySelector('#excluded-meals');
const languageSelect = document.querySelector('#language-select');
const shoppingCartPreview = document.querySelector('#shopping-cart-preview');
const shoppingCartJson = document.querySelector('#shopping-cart-json');
const shoppingCartMockStatus = document.querySelector('#shopping-cart-mock-status');

let pickerDebounce;
let inventoryPickerDebounce;

languageSelect.value = i18n.language;
languageSelect.addEventListener('change', () => i18n.setLanguage(languageSelect.value));
i18n.onLanguageChange(() => {
  languageSelect.value = i18n.language;
  renderEventTypes();
  renderMealCategories();
  renderMealCapabilities();
  renderRequiredMeals();
  renderPickerResults();
  renderInventoryPickerResults();
  renderInventoryEmptyState();
  if (state.currentPlan) renderPlan(state.currentPlan);
  if (state.catalogLoaded) {
    renderCatalogCapabilities();
    renderCatalog();
  }
  if (mealPicker.open) searchPickerMeals();
  if (inventoryPicker.open) searchInventoryConcepts();
  if (shoppingCartPreview.open && state.currentPlan) renderShoppingCartPreview(state.currentPlan);
});

document.querySelector('#add-inventory').addEventListener('click', () => {
  const row = addInventoryRow();
  openInventoryPicker(row);
});
document.querySelector('#open-meal-picker').addEventListener('click', openMealPicker);
document.querySelector('#close-meal-picker').addEventListener('click', closeMealPicker);
document.querySelector('#meal-picker-done').addEventListener('click', closeMealPicker);
document.querySelector('#close-inventory-picker').addEventListener('click', closeInventoryPicker);
clearConstraintsButton.addEventListener('click', clearConstraints);
clearRequiredMealsButton.addEventListener('click', clearRequiredMeals);
pickerClearSelectedButton.addEventListener('click', clearRequiredMeals);
pickerCapability.addEventListener('change', () => {
  state.pickerCapability = pickerCapability.value;
  searchPickerMeals();
});
document.querySelector('#back-to-form').addEventListener('click', () => {
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
guestCountInput.addEventListener('input', () => {
  syncDietaryGuestLimits();
  refreshDietaryConflictUI();
});
form.addEventListener('submit', resolvePlan);
regenerateMenuButton.addEventListener('click', () => form.requestSubmit());
pickerSearch.addEventListener('input', () => {
  clearTimeout(pickerDebounce);
  pickerDebounce = setTimeout(searchPickerMeals, 280);
});
mealPicker.addEventListener('close', () => document.body.classList.remove('dialog-open'));
mealPicker.addEventListener('click', event => {
  if (event.target === mealPicker) closeMealPicker();
});
inventoryPickerSearch.addEventListener('input', () => {
  clearTimeout(inventoryPickerDebounce);
  inventoryPickerDebounce = setTimeout(searchInventoryConcepts, 280);
});
inventoryPicker.addEventListener('close', () => {
  state.inventoryPickerRow = null;
  document.body.classList.remove('dialog-open');
});
inventoryPicker.addEventListener('click', event => {
  if (event.target === inventoryPicker) closeInventoryPicker();
});

document.querySelector('#open-shopping-cart-preview').addEventListener('click', openShoppingCartPreview);
document.querySelector('#close-shopping-cart-preview').addEventListener('click', closeShoppingCartPreview);
document.querySelector('#copy-shopping-cart-json').addEventListener('click', copyShoppingCartJson);
document.querySelector('#mock-send-shopping-cart').addEventListener('click', mockSendToShoppingCart);
shoppingCartPreview.addEventListener('close', () => {
  shoppingCartMockStatus.hidden = true;
  shoppingCartMockStatus.textContent = '';
  document.body.classList.remove('dialog-open');
});
shoppingCartPreview.addEventListener('click', event => {
  if (event.target === shoppingCartPreview) closeShoppingCartPreview();
});

developerTools.addEventListener('toggle', () => {
  if (developerTools.open && !state.catalogLoaded) loadDeveloperCatalog();
});
catalogSearch.addEventListener('input', renderCatalog);
catalogCapability.addEventListener('change', renderCatalog);
document.querySelectorAll('[data-catalog-type]').forEach(button => {
  button.addEventListener('click', () => {
    state.catalogType = button.dataset.catalogType;
    document.querySelectorAll('[data-catalog-type]').forEach(tab => {
      const selected = tab === button;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
    });
    catalogSearch.placeholder = state.catalogType === 'meals'
      ? t('catalog.searchMeals')
      : t('catalog.searchProducts');
    renderCatalogCapabilities();
    renderCatalog();
  });
});

async function loadPlannerData() {
  try {
    [state.templates, state.priorities, state.constraints, state.mealCategories, state.mealCapabilities] = await Promise.all([
      fetchJson('/api/templates'),
      fetchJson('/api/priorities'),
      fetchJson('/api/dietary-constraints'),
      fetchJson('/api/meal-categories'),
      fetchJson('/api/meal-capabilities')
    ]);

    const preferred = state.templates.find(template => template.id === 'business-apero') || state.templates[0];
    templateSelect.value = preferred?.id || '';

    renderEventTypes();
    renderDietaryConstraints();
    renderMealCategories();
    renderMealCapabilities();
    renderRequiredMeals();
    applyTemplate();
    renderInventoryEmptyState();
  } catch (error) {
    showError(`${t('common.error')}: ${error.message}`);
  }
}

function renderEventTypes() {
  if (!state.templates.length) {
    eventTypesRoot.innerHTML = `<p class="empty-row">${escapeHtml(t('event.noFormats'))}</p>`;
    return;
  }

  eventTypesRoot.innerHTML = state.templates.map(template => {
    const selected = template.id === templateSelect.value;
    return `
      <button class="event-type-card ${selected ? 'selected' : ''}" type="button" role="radio"
        aria-checked="${selected}" data-template-id="${escapeHtml(template.id)}">
        ${visualIcon(template.icon || fallbackIcon('event', template.id), 'event-type-icon')}
        <span class="event-type-copy">
          <strong>${dynamic(template.name, 'event-name')}</strong>
          <small>${dynamic(template.description, 'event-description')}</small>
        </span>
        <span class="event-type-check" aria-hidden="true">✓</span>
      </button>
    `;
  }).join('');

  eventTypesRoot.querySelectorAll('[data-template-id]').forEach(button => {
    button.addEventListener('click', () => {
      if (templateSelect.value === button.dataset.templateId) return;
      templateSelect.value = button.dataset.templateId;
      clearExcludedMeals();
      renderEventTypes();
      applyTemplate();
      if (state.currentPlan) showMenuChange(t('event.changed'), true);
    });
  });
}

function renderDietaryConstraints() {
  if (!state.constraints.length) {
    constraintRoot.innerHTML = `<p class="empty-row">${escapeHtml(t('constraints.none'))}</p>`;
    updateConstraintActions();
    return;
  }

  constraintRoot.innerHTML = state.constraints.map(constraint => `
    <label class="constraint-option">
      <span class="constraint-card">
        ${visualIcon(constraint.icon || fallbackIcon('dietary', constraint.id), 'constraint-icon')}
        <span class="constraint-copy">
          <strong>${dynamic(constraint.label, 'dietary-label')}</strong>
          <small>${dynamic(constraint.description, 'dietary-description')}</small>
        </span>
        <span class="dietary-count-control">
          <input type="number" min="0" value="0" inputmode="numeric"
            aria-label="${escapeHtml(constraint.label)} ${escapeHtml(t('constraints.guests'))}"
            data-dietary-count
            data-constraint-id="${escapeHtml(constraint.id)}"
            data-dietary-capability="${escapeHtml(constraint.dietaryCapability || constraint.requiredCapabilities?.[0] || constraint.id)}">
          <span data-i18n="constraints.guests">${escapeHtml(t('constraints.guests'))}</span>
        </span>
      </span>
    </label>
  `).join('');

  constraintRoot.querySelectorAll('input[data-dietary-count]').forEach(input => {
    input.addEventListener('input', () => {
      input.value = String(clamp(Math.trunc(Number(input.value) || 0), 0, currentGuestCount()));
      updateConstraintActions();
      refreshDietaryConflictUI();
    });
  });
  syncDietaryGuestLimits();
  updateConstraintActions();
}

function updateConstraintActions() {
  const count = Object.keys(dietaryGuestCounts()).length;
  clearConstraintsButton.hidden = count === 0;
  clearConstraintsButton.textContent = count ? t('constraints.clearCount', { count, suffix: count === 1 ? '' : 's' }) : t('constraints.clear');
  constraintRoot.querySelectorAll('input[data-dietary-count]').forEach(input => {
    input.closest('.constraint-card')?.classList.toggle('active', Number(input.value) > 0);
  });
}

function clearConstraints() {
  constraintRoot.querySelectorAll('input[data-dietary-count]').forEach(input => {
    input.value = '0';
  });
  updateConstraintActions();
  refreshDietaryConflictUI();
}

function refreshDietaryConflictUI() {
  renderRequiredMeals();
  if (mealPicker.open) renderPickerResults();
  renderCurrentMeals();
}

function currentGuestCount() {
  return Math.max(1, Math.trunc(Number(guestCountInput.value) || 1));
}

function syncDietaryGuestLimits() {
  const guests = currentGuestCount();
  constraintRoot.querySelectorAll('input[data-dietary-count]').forEach(input => {
    input.max = String(guests);
    input.value = String(clamp(Math.trunc(Number(input.value) || 0), 0, guests));
  });
  updateConstraintActions();
}

function dietaryGuestCounts() {
  return [...constraintRoot.querySelectorAll('input[data-dietary-count]')].reduce((counts, input) => {
    const count = clamp(Math.trunc(Number(input.value) || 0), 0, currentGuestCount());
    if (count > 0) counts[input.dataset.dietaryCapability] = count;
    return counts;
  }, {});
}

function dietaryShares() {
  const guests = currentGuestCount();
  return Object.fromEntries(
    Object.entries(dietaryGuestCounts()).map(([capability, count]) => [capability, count / guests])
  );
}

function renderMealCapabilities() {
  const capabilities = state.mealCapabilities || [];
  pickerCapability.innerHTML = [
    `<option value="">${escapeHtml(t('picker.dishes.allFoodTypes'))}</option>`,
    ...capabilities.map(capability => `<option value="${escapeHtml(capability)}" ${i18n.dynamicOptionAttributes(humanize(capability), 'capability')}>${escapeHtml(humanize(capability))}</option>`)
  ].join('');
  pickerCapability.value = state.pickerCapability;
}

function renderMealCategories() {
  const categories = [{ id: '', label: t('picker.dishes.all'), icon: '✦', staticLabel: true }, ...state.mealCategories];
  pickerCategories.innerHTML = categories.map(category => `
    <button class="category-button ${state.pickerCategory === category.id ? 'active' : ''}" type="button" data-category-id="${escapeHtml(category.id)}">
      ${visualIcon(category.icon || fallbackIcon('category', category.id), 'category-icon')}
      <span>${category.staticLabel ? escapeHtml(category.label) : dynamic(category.label, 'meal-category')}</span>
    </button>
  `).join('');
  pickerCategories.querySelectorAll('[data-category-id]').forEach(button => {
    button.addEventListener('click', () => {
      state.pickerCategory = button.dataset.categoryId;
      renderMealCategories();
      searchPickerMeals();
    });
  });
}

function openMealPicker() {
  if (typeof mealPicker.showModal === 'function') mealPicker.showModal();
  else mealPicker.setAttribute('open', '');
  document.body.classList.add('dialog-open');
  document.querySelector('#meal-picker-selected-count').textContent = selectedCountText();
  pickerSearch.focus();
  searchPickerMeals();
}

function closeMealPicker() {
  if (typeof mealPicker.close === 'function' && mealPicker.open) mealPicker.close();
  else mealPicker.removeAttribute('open');
  document.body.classList.remove('dialog-open');
}

async function searchPickerMeals() {
  const token = ++state.pickerSearchToken;
  const params = new URLSearchParams({ limit: '60' });
  const query = pickerSearch.value.trim();
  if (query) params.set('query', query);
  if (state.pickerCategory) params.set('categoryId', state.pickerCategory);
  if (state.pickerCapability) params.set('capability', state.pickerCapability);

  pickerStatus.textContent = t('picker.dishes.searching');
  try {
    params.set('language', i18n.language);
    const meals = await fetchJson(`/api/i18n/meals/search?${params.toString()}`);
    if (token !== state.pickerSearchToken) return;
    state.pickerMeals = meals;
    const filterText = [
      query && t('picker.dishes.matching', { query }),
      state.pickerCategory && i18n.cachedTranslation(categoryLabel(state.pickerCategory), 'meal-category'),
      state.pickerCapability && i18n.cachedTranslation(humanize(state.pickerCapability), 'capability')
    ].filter(Boolean).join(' · ');
    pickerStatus.textContent = `${t(meals.length === 1 ? 'picker.dishes.count.one' : 'picker.dishes.count.many', { count: meals.length })}${filterText ? ` · ${filterText}` : ''}`;
    renderPickerResults();
  } catch (error) {
    if (token !== state.pickerSearchToken) return;
    pickerStatus.textContent = t('picker.dishes.failed');
    pickerResults.innerHTML = `<div class="picker-empty">${escapeHtml(error.message)}</div>`;
  }
}

function renderPickerResults() {
  document.querySelector('#meal-picker-selected-count').textContent = selectedCountText();
  if (!state.pickerMeals.length) {
    pickerResults.innerHTML = `<div class="picker-empty">${escapeHtml(t('picker.dishes.none'))}</div>`;
    return;
  }

  pickerResults.innerHTML = state.pickerMeals.map(meal => {
    const conflicts = mealConstraintConflicts(meal);
    const isSelected = state.requiredMeals.has(meal.id);
    const categories = (meal.categoryIds || []).map(categoryMeta).filter(Boolean);
    return `
      <article class="picker-card ${conflicts.length ? 'conflict' : ''}">
        <div>
          <h3>${dynamic(meal.name, 'meal-name')}</h3>
          <div class="picker-card-meta">
            ${categories.slice(0, 3).map(category => `<span class="chip category-chip">${visualIcon(category.icon, 'chip-icon')}<span>${dynamic(category.label, 'meal-category')}</span></span>`).join('')}
          </div>
          ${conflicts.length ? `<p class="picker-conflict">⚠ ${escapeHtml(t('dishes.doesNotCover', { details: conflictSummary(conflicts) }))}</p>` : ''}
        </div>
        <button class="picker-add ${isSelected ? 'remove' : ''}" type="button" data-picker-meal-id="${escapeHtml(meal.id)}" aria-pressed="${isSelected}">
          ${isSelected ? escapeHtml(t('common.remove')) : escapeHtml(t('dishes.add'))}
        </button>
      </article>
    `;
  }).join('');

  pickerResults.querySelectorAll('[data-picker-meal-id]').forEach(button => {
    button.addEventListener('click', () => {
      const meal = state.pickerMeals.find(item => item.id === button.dataset.pickerMealId);
      if (!meal) return;
      const wasSelected = state.requiredMeals.has(meal.id);
      if (wasSelected) {
        state.requiredMeals.delete(meal.id);
      } else {
        state.excludedMealIds.delete(meal.id);
        state.excludedMealNames.delete(meal.id);
        state.requiredMeals.set(meal.id, meal);
      }
      renderRequiredMeals();
      renderExcludedMeals();
      renderPickerResults();
      renderCurrentMeals();
      if (state.currentPlan) {
        showMenuChange(t(wasSelected ? 'dishes.statusUnpinned' : 'dishes.statusPinned', { name: i18n.cachedTranslation(meal.name, 'meal-name') }));
      }
    });
  });
}

function selectedCountText() {
  const count = state.requiredMeals.size;
  return t(count === 1 ? 'picker.dishes.selected.one' : 'picker.dishes.selected.many', { count });
}

function updateRequiredMealActions() {
  const hasMeals = state.requiredMeals.size > 0;
  clearRequiredMealsButton.hidden = !hasMeals;
  pickerClearSelectedButton.hidden = !hasMeals;
  document.querySelector('#meal-picker-selected-count').textContent = selectedCountText();
}

function clearRequiredMeals() {
  const clearedCount = state.requiredMeals.size;
  state.requiredMeals.clear();
  renderRequiredMeals();
  renderPickerResults();
  renderCurrentMeals();
  if (state.currentPlan && clearedCount > 0) {
    showMenuChange(t(clearedCount === 1 ? 'dishes.statusCleared.one' : 'dishes.statusCleared.many', { count: clearedCount }));
  }
}

function renderRequiredMeals() {
  const meals = [...state.requiredMeals.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (!meals.length) {
    requiredMealsRoot.innerHTML = `<p class="empty-selection">${escapeHtml(t('dishes.noneSelected'))}</p>`;
    updateRequiredMealActions();
    return;
  }

  requiredMealsRoot.innerHTML = meals.map(meal => {
    const conflicts = mealConstraintConflicts(meal);
    const categories = (meal.categoryIds || []).map(categoryMeta).filter(Boolean);
    return `
      <div class="selected-meal-row ${conflicts.length ? 'conflict' : ''}">
        <div class="selected-meal-main">
          <strong>${dynamic(meal.name, 'meal-name')}</strong>
          <div class="selected-meal-meta">
            ${categories.slice(0, 3).map(category => `<span class="selected-category">${visualIcon(category.icon, 'inline-icon')} ${dynamic(category.label, 'meal-category')}</span>`).join('<span>·</span>')}
          </div>
          ${conflicts.length ? `<p class="selected-meal-warning">⚠ ${escapeHtml(t('dishes.pinnedCoverage', { details: conflictSummary(conflicts) }))}</p>` : ''}
        </div>
        <button class="remove-meal" type="button" data-remove-meal-id="${escapeHtml(meal.id)}" aria-label="Remove ${escapeHtml(meal.name)}"><span aria-hidden="true">×</span> ${escapeHtml(t('common.remove'))}</button>
      </div>
    `;
  }).join('');

  updateRequiredMealActions();

  requiredMealsRoot.querySelectorAll('[data-remove-meal-id]').forEach(button => {
    button.addEventListener('click', () => {
      const meal = state.requiredMeals.get(button.dataset.removeMealId);
      state.requiredMeals.delete(button.dataset.removeMealId);
      renderRequiredMeals();
      renderPickerResults();
      renderCurrentMeals();
      if (state.currentPlan && meal) {
        showMenuChange(`${meal.name} unpinned and eligible for the next generation.`);
      }
    });
  });
}

function mealConstraintConflicts(meal) {
  const supported = normalizedSet(meal.dietaryCapabilities);
  const counts = dietaryGuestCounts();
  return state.constraints.map(constraint => {
    const capability = String(constraint.dietaryCapability || constraint.requiredCapabilities?.[0] || constraint.id)
      .trim().toLowerCase();
    const guestCount = counts[capability] || 0;
    if (!guestCount || supported.has(capability)) return null;
    return { constraint, constraintLabel: constraint.label, capability, guestCount };
  }).filter(Boolean);
}

function conflictSummary(conflicts) {
  return conflicts.map(conflict => {
    const sourceLabel = conflict.constraint?.label || conflict.constraintLabel || humanize(conflict.capability);
    const label = i18n.cachedTranslation(sourceLabel, 'dietary-label');
    return conflict.guestCount ? `${label} (${conflict.guestCount} ${t('constraints.guests')})` : label;
  }).join(', ');
}

function serverConflictDetails(conflict) {
  const translatedList = (values, context) => (values || [])
    .map(value => i18n.cachedTranslation(humanize(value), context))
    .join(', ');
  const parts = [];
  if (conflict.missingRequiredCapabilities?.length) {
    parts.push(t('conflict.missing', { items: translatedList(conflict.missingRequiredCapabilities, 'capability') }));
  }
  if (conflict.excludedCapabilities?.length) {
    parts.push(t('conflict.excluded', { items: translatedList(conflict.excludedCapabilities, 'capability') }));
  }
  if (conflict.excludedConcepts?.length) {
    parts.push(t('conflict.contains', { items: translatedList(conflict.excludedConcepts, 'ingredient-name') }));
  }
  return parts.join('; ');
}

function applyTemplate() {
  const template = state.templates.find(item => item.id === templateSelect.value);
  if (!template) return;
  i18n.setDynamicText(description, template.description, 'event-description');
  renderWeights(template.weights);
  mealCountInput.value = template.defaults?.mealCount == null ? '' : String(template.defaults.mealCount);
}

function renderWeights(weights) {
  document.querySelector('#weights').innerHTML = configuredPriorities(weights).map(priority => {
    const value = clamp(Number(weights[priority.id] ?? priority.defaultWeight ?? 0), 0, 1);
    const descriptionId = `priority-${priority.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    return `
      <label class="weight">
        <span class="weight-header"><strong>${dynamic(priority.label, 'priority-label')}</strong><output>${Math.round(value * 100)}%</output></span>
        <input class="weight-input" data-key="${escapeHtml(priority.id)}" type="range" min="0" max="1" step="0.05" value="${value}" aria-describedby="${escapeHtml(descriptionId)}">
        <small id="${escapeHtml(descriptionId)}" class="weight-description">${dynamic(priority.description, 'priority-description')}</small>
        <span class="weight-scale"><i>${priority.lowLabel ? dynamic(priority.lowLabel, 'priority-scale') : escapeHtml(t('common.lower'))}</i><i>${priority.highLabel ? dynamic(priority.highLabel, 'priority-scale') : escapeHtml(t('common.higher'))}</i></span>
      </label>
    `;
  }).join('');
  document.querySelectorAll('.weight-input').forEach(input => {
    const syncSlider = () => {
      const percentage = Math.round(Number(input.value) * 100);
      input.style.setProperty('--range-progress', `${percentage}%`);
      input.closest('.weight').querySelector('output').value = `${percentage}%`;
    };
    syncSlider();
    input.addEventListener('input', syncSlider);
  });
}

function renderInventoryEmptyState() {
  if (!inventoryRows.querySelector('.inventory-row')) {
    inventoryRows.innerHTML = `<p class="empty-row" data-i18n="stock.none">${escapeHtml(t('stock.none'))}</p>`;
  }
}

function openInventoryPicker(row) {
  state.inventoryPickerRow = row;
  inventoryPickerSearch.value = '';
  if (typeof inventoryPicker.showModal === 'function') inventoryPicker.showModal();
  else inventoryPicker.setAttribute('open', '');
  document.body.classList.add('dialog-open');
  inventoryPickerSearch.focus();
  searchInventoryConcepts();
}

function closeInventoryPicker() {
  if (typeof inventoryPicker.close === 'function' && inventoryPicker.open) inventoryPicker.close();
  else inventoryPicker.removeAttribute('open');
  state.inventoryPickerRow = null;
  document.body.classList.remove('dialog-open');
}

async function searchInventoryConcepts() {
  const token = ++state.inventoryPickerSearchToken;
  const params = new URLSearchParams({ limit: '50' });
  const query = inventoryPickerSearch.value.trim();
  if (query) params.set('query', query);
  inventoryPickerStatus.textContent = t('picker.stock.searching');

  try {
    params.set('language', i18n.language);
    const options = await fetchJson(`/api/i18n/inventory-concepts/search?${params.toString()}`);
    if (token !== state.inventoryPickerSearchToken) return;
    state.inventoryPickerOptions = options;
    inventoryPickerStatus.textContent = `${t(options.length === 1 ? 'picker.stock.count.one' : 'picker.stock.count.many', { count: options.length })}${query ? ` · ${t('picker.stock.matching', { query })}` : ''}`;
    renderInventoryPickerResults();
  } catch (error) {
    if (token !== state.inventoryPickerSearchToken) return;
    inventoryPickerStatus.textContent = t('picker.stock.failed');
    inventoryPickerResults.innerHTML = `<div class="picker-empty">${escapeHtml(error.message)}</div>`;
  }
}

function renderInventoryPickerResults() {
  if (!state.inventoryPickerOptions.length) {
    inventoryPickerResults.innerHTML = `<div class="picker-empty">${escapeHtml(t('picker.stock.none'))}</div>`;
    return;
  }

  const selectedConcept = state.inventoryPickerRow?.querySelector('.inventory-concept')?.value || '';
  inventoryPickerResults.innerHTML = state.inventoryPickerOptions.map(option => {
    const selected = option.concept === selectedConcept;
    return `
      <article class="inventory-option-card ${selected ? 'selected' : ''}">
        <div>
          <h3>${dynamic(option.label, 'ingredient-name')}</h3>
          <p>${escapeHtml(option.concept)} · ${escapeHtml(t('stock.suggestedUnit', { unit: i18n.unitLabel(option.suggestedUnit, 2) }))}</p>
        </div>
        <button class="picker-add ${selected ? 'added' : ''}" type="button" data-inventory-concept="${escapeHtml(option.concept)}">
          ${selected ? escapeHtml(t('common.selected')) : escapeHtml(t('picker.stock.use'))}
        </button>
      </article>
    `;
  }).join('');

  inventoryPickerResults.querySelectorAll('[data-inventory-concept]').forEach(button => {
    button.addEventListener('click', () => {
      const option = state.inventoryPickerOptions.find(item => item.concept === button.dataset.inventoryConcept);
      if (!option || !state.inventoryPickerRow) return;
      setInventoryConcept(state.inventoryPickerRow, option);
      closeInventoryPicker();
    });
  });
}

function setInventoryConcept(row, option) {
  row.querySelector('.inventory-concept').value = option.concept;
  i18n.setDynamicText(row.querySelector('.inventory-concept-label'), option.label, 'ingredient-name');
  row.querySelector('.inventory-concept-id').textContent = option.concept;
  row.querySelector('.inventory-concept-button').classList.add('selected');
  const unitSelect = row.querySelector('.inventory-unit');
  if ([...unitSelect.options].some(unit => unit.value === option.suggestedUnit)) {
    unitSelect.value = option.suggestedUnit;
  }
}

function addInventoryRow(item = { concept: '', amount: '', unit: 'piece' }) {
  inventoryRows.querySelector('.empty-row')?.remove();
  const row = document.createElement('div');
  row.className = 'inventory-row';
  const hasConcept = Boolean(item.concept);
  row.innerHTML = `
    <div class="inventory-cell inventory-concept-cell">
      <span data-i18n="stock.ingredient">${escapeHtml(t('stock.ingredient'))}</span>
      <input class="inventory-concept" type="hidden" value="${escapeHtml(item.concept)}">
      <button class="inventory-concept-button ${hasConcept ? 'selected' : ''}" type="button" aria-label="Choose stock ingredient">
        <span>
          <strong class="inventory-concept-label">${hasConcept ? dynamic(humanize(item.concept), 'ingredient-name') : escapeHtml(t('stock.chooseIngredient'))}</strong>
          <small class="inventory-concept-id">${hasConcept ? escapeHtml(item.concept) : escapeHtml(t('stock.searchCatalog'))}</small>
        </span>
        <b>${hasConcept ? escapeHtml(t('stock.change')) : escapeHtml(t('stock.choose'))}</b>
      </button>
    </div>
    <label class="inventory-cell">
      <span data-i18n="stock.amount">${escapeHtml(t('stock.amount'))}</span>
      <input class="inventory-amount" aria-label="Inventory amount" type="number" min="0" step="0.1" inputmode="decimal" placeholder="0" value="${escapeHtml(item.amount)}">
    </label>
    <label class="inventory-cell">
      <span data-i18n="stock.unit">${escapeHtml(t('stock.unit'))}</span>
      <select class="inventory-unit" aria-label="Inventory unit">
        ${['piece', 'g', 'kg', 'liter', 'ml', 'cup', 'bottle'].map(unit =>
          `<option value="${unit}" ${item.unit === unit ? 'selected' : ''}>${unit}</option>`
        ).join('')}
      </select>
    </label>
    <button class="remove-inventory" type="button" aria-label="Remove inventory item"><span aria-hidden="true">×</span> ${escapeHtml(t('common.remove'))}</button>
  `;
  row.querySelector('.inventory-concept-button').addEventListener('click', () => openInventoryPicker(row));
  row.querySelector('.remove-inventory').addEventListener('click', () => {
    row.remove();
    renderInventoryEmptyState();
  });
  inventoryRows.append(row);
  return row;
}

async function resolvePlan(event) {
  event.preventDefault();
  hideError();
  if (!form.reportValidity()) return;

  const weights = {};
  document.querySelectorAll('.weight-input').forEach(input => weights[input.dataset.key] = Number(input.value));
  const availableInventory = [...document.querySelectorAll('.inventory-row')].map(row => ({
    concept: row.querySelector('.inventory-concept').value.trim(),
    amount: Number(row.querySelector('.inventory-amount').value),
    unit: row.querySelector('.inventory-unit').value
  })).filter(item => item.concept && item.amount > 0);
  const servingsValue = document.querySelector('#servings-per-guest').value;
  const mealCountValue = mealCountInput.value;

  const request = {
    templateId: templateSelect.value,
    guestCount: Number(document.querySelector('#guest-count').value),
    budget: Number(document.querySelector('#budget').value),
    servingsPerGuest: servingsValue === '' ? null : Number(servingsValue),
    mealCount: mealCountValue === '' ? null : Number(mealCountValue),
    dietaryShares: dietaryShares(),
    requiredMealIds: [...state.requiredMeals.keys()].sort(),
    excludedMealIds: [...state.excludedMealIds].sort(),
    weights,
    preferences: {
      preferredCapabilities: document.querySelector('#prepare-ahead').checked ? ['prepare-ahead'] : []
    },
    availableInventory,
    hardConstraints: {
      requiredCapabilities: [],
      excludedCapabilities: [],
      excludedConcepts: []
    }
  };

  setLoading(true);
  try {
    const plan = await fetchJson('/api/plans/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    state.currentPlan = plan;
    renderPlan(plan);
    clearMenuChangeStatus();
    renderExcludedMeals();
    results.hidden = false;
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    showError(error.message);
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } finally {
    setLoading(false);
  }
}

function renderPlan(plan) {
  const foodAmount = plan.event.servingsPerGuest == null
    ? t('plan.templatePortions')
    : t('plan.servingsEach', { count: plan.event.servingsPerGuest });
  const resultTitle = document.querySelector('#result-title');
  resultTitle.innerHTML = `${dynamic(plan.event.templateName, 'event-name')} ${escapeHtml(t('plan.forGuests', { template: '', guests: plan.event.guestCount, portions: foodAmount }).trim())}`;
  renderConstraintWarningSummary(plan.constraintConflicts || []);
  renderWarnings(plan.warnings || []);
  renderTotals(plan.totals);
  renderMeals(plan.selectedMeals || [], plan.constraintConflicts || []);
  renderShoppingItems(plan.shoppingItems || []);
  renderInventory(plan.usedExistingInventory || []);
  renderTrace(plan.fulfilledRequirements || []);
}

function renderConstraintWarningSummary(conflicts) {
  const target = document.querySelector('#constraint-warning-summary');
  target.hidden = !conflicts.length;
  if (!conflicts.length) {
    target.innerHTML = '';
    return;
  }
  const guaranteed = conflicts.filter(conflict => conflict.guaranteed);
  const affectedMealCount = new Set(guaranteed.map(conflict => conflict.mealId)).size;
  target.innerHTML = `
    <strong>${escapeHtml(t((affectedMealCount || conflicts.length) === 1 ? 'warning.pinnedTitle.one' : 'warning.pinnedTitle.many', { count: affectedMealCount || conflicts.length }))}</strong>
    <p>${escapeHtml(affectedMealCount
      ? t(affectedMealCount === 1 ? 'warning.pinnedBody.one' : 'warning.pinnedBody.many', { count: affectedMealCount })
      : t('warning.review'))}</p>
  `;
}

function renderWarnings(warnings) {
  const element = document.querySelector('#warnings');
  element.hidden = !warnings.length;
  element.innerHTML = warnings.map(warning => `<div>${dynamic(warning, 'planner-warning')}</div>`).join('');
}

function renderTotals(totals) {
  const difference = totals.budgetDifference.amount;
  const differenceLabel = difference >= 0 ? t('results.budgetRemaining') : t('results.budgetOverrun');
  document.querySelector('#totals').innerHTML = `
    <div class="total-card"><span>${escapeHtml(t('results.totalCost'))}</span><strong>${formatMoney(totals.totalCost.amount)}</strong></div>
    <div class="total-card"><span>${escapeHtml(t('results.costPerGuest'))}</span><strong>${formatMoney(totals.costPerGuest.amount)}</strong></div>
    <div class="total-card ${difference < 0 ? 'negative' : ''}"><span>${differenceLabel}</span><strong>${formatMoney(Math.abs(difference))}</strong></div>
  `;
}

function renderMeals(meals, conflicts) {
  const conflictsByMeal = conflicts.reduce((map, conflict) => {
    const list = map.get(conflict.mealId) || [];
    list.push(conflict);
    map.set(conflict.mealId, list);
    return map;
  }, new Map());

  selectedMealsRoot.innerHTML = meals.map(meal => {
    const mealConflicts = conflictsByMeal.get(meal.mealId) || [];
    const isPinned = state.requiredMeals.has(meal.mealId);
    const conflictText = mealConflicts.map(conflict => {
      const details = serverConflictDetails(conflict);
      return `${conflict.constraintLabel}${details ? ` — ${details}` : ''}`;
    }).join(' · ');
    return `
      <article class="meal-card ${mealConflicts.length ? 'conflict' : ''} ${isPinned ? 'pinned' : ''}">
        <div class="meal-top">
          <div>
            <h4>${dynamic(meal.name, 'meal-name')}</h4>
            <span class="requirement">${dynamic(humanize(meal.requirementId), 'requirement')}</span>
            ${isPinned ? `<br><span class="guaranteed-badge">${escapeHtml(t('dishes.pinned'))}</span>` : ''}
            ${mealConflicts.length ? `<span class="conflict-badge">${escapeHtml(t('dishes.constraintException'))}</span>` : ''}
          </div>
          <span class="score" title="${escapeHtml(t('results.weightedScore'))}">
            <small>${escapeHtml(t('results.scoreLabel'))}</small>
            <strong>${Math.round(meal.finalWeightedScore * 100)}</strong>
            <em>/ 100</em>
          </span>
        </div>
        <div class="meal-actions" role="group" aria-label="Actions for ${escapeHtml(meal.name)}">
          <button class="meal-pin" type="button" data-pin-meal-id="${escapeHtml(meal.mealId)}"
            aria-pressed="${isPinned}" aria-label="${isPinned ? 'Unpin' : 'Pin'} ${escapeHtml(meal.name)}"
            title="${escapeHtml(isPinned ? t('dishes.allowChangeTitle') : t('dishes.keepTitle'))}">
            <span aria-hidden="true">📌</span><span class="meal-action-label">${escapeHtml(isPinned ? t('dishes.unpin') : t('dishes.pin'))}</span>
          </button>
          <button class="meal-reject" type="button" data-reject-meal-id="${escapeHtml(meal.mealId)}"
            aria-label="Remove ${escapeHtml(meal.name)} from future generations"
            title="${escapeHtml(t('dishes.removeTitle'))}">
            <span aria-hidden="true">×</span><span class="meal-action-label">${escapeHtml(t('dishes.removeNext'))}</span>
          </button>
        </div>
        ${mealConflicts.length ? `<div class="meal-conflict-box"><strong>${escapeHtml(t('dishes.review'))}</strong> ${dynamic(conflictText, 'dietary-warning')}</div>` : ''}
        <div class="chips">
          ${(meal.matchedCapabilities || []).map(capability => `<span class="chip">${dynamic(humanize(capability), 'capability')}</span>`).join('')}
          ${(meal.matchedDietaryCapabilities || []).map(capability => `<span class="chip dietary">${dynamic(humanize(capability), 'dietary-label')}</span>`).join('')}
        </div>
        <div class="meal-meta">
          <div class="meal-stat">
            <span>${escapeHtml(t('results.servingsLabel'))}</span>
            <strong>${i18n.formatNumber(meal.servings)}</strong>
          </div>
          <div class="meal-stat">
            <span>${escapeHtml(mealTargetLabel(meal.targetQuantity))}</span>
            <strong>${escapeHtml(quantity(meal.targetQuantity))}</strong>
          </div>
        </div>
        <details class="score-details">
          <summary>${escapeHtml(t('dishes.why'))}</summary>
          <div class="score-components">${priorityEntries(meal.scoreComponents).map(([key, value]) =>
            `<span><i>${dynamic(priorityDefinition(key).label, 'priority-label')}</i><b>${Math.round(value * 100)}</b></span>`
          ).join('')}</div>
        </details>
      </article>
    `;
  }).join('');

  selectedMealsRoot.querySelectorAll('[data-pin-meal-id]').forEach(button => {
    button.addEventListener('click', () => togglePinnedMeal(button.dataset.pinMealId));
  });
  selectedMealsRoot.querySelectorAll('[data-reject-meal-id]').forEach(button => {
    button.addEventListener('click', () => rejectMeal(button.dataset.rejectMealId));
  });
}

function renderCurrentMeals() {
  if (!state.currentPlan) return;
  renderMeals(state.currentPlan.selectedMeals || [], state.currentPlan.constraintConflicts || []);
}

function requiredMealMetadata(meal) {
  return state.pickerMeals.find(item => item.id === meal.mealId)
    || state.meals.find(item => item.id === meal.mealId)
    || {
      id: meal.mealId,
      name: meal.name,
      categoryIds: [],
      capabilities: meal.matchedCapabilities || [],
      dietaryCapabilities: meal.matchedDietaryCapabilities || []
    };
}

function togglePinnedMeal(mealId) {
  const meal = state.currentPlan?.selectedMeals?.find(item => item.mealId === mealId);
  if (!meal) return;

  const wasPinned = state.requiredMeals.has(mealId);
  if (wasPinned) {
    state.requiredMeals.delete(mealId);
  } else {
    state.excludedMealIds.delete(mealId);
    state.excludedMealNames.delete(mealId);
    state.requiredMeals.set(mealId, requiredMealMetadata(meal));
  }

  renderRequiredMeals();
  renderPickerResults();
  renderExcludedMeals();
  renderCurrentMeals();
  showMenuChange(t(wasPinned ? 'dishes.statusUnpinned' : 'dishes.statusPinned', { name: i18n.cachedTranslation(meal.name, 'meal-name') }));
}

function rejectMeal(mealId) {
  const meal = state.currentPlan?.selectedMeals?.find(item => item.mealId === mealId);
  if (!meal) return;

  state.requiredMeals.delete(mealId);
  state.excludedMealIds.add(mealId);
  state.excludedMealNames.set(mealId, meal.name);
  state.currentPlan.selectedMeals = state.currentPlan.selectedMeals.filter(item => item.mealId !== mealId);

  renderRequiredMeals();
  renderPickerResults();
  renderExcludedMeals();
  renderCurrentMeals();
  showMenuChange(t('dishes.statusRemoved', { name: i18n.cachedTranslation(meal.name, 'meal-name') }), true);
}

function renderExcludedMeals() {
  const excluded = [...state.excludedMealIds]
    .map(id => ({ id, name: state.excludedMealNames.get(id) || humanize(id) }))
    .sort((left, right) => left.name.localeCompare(right.name));
  excludedMealsRoot.hidden = excluded.length === 0;
  if (!excluded.length) {
    excludedMealsRoot.innerHTML = '';
    return;
  }

  excludedMealsRoot.innerHTML = `
    <strong>${escapeHtml(t('results.menuChanged'))}</strong>
    <div class="excluded-meal-list">${excluded.map(meal => `
      <span class="excluded-meal-chip">
        ${dynamic(meal.name, 'meal-name')}
        <button type="button" data-undo-exclusion="${escapeHtml(meal.id)}" aria-label="Allow ${escapeHtml(meal.name)} in future generations">${escapeHtml(t('common.undo'))}</button>
      </span>
    `).join('')}</div>
  `;

  excludedMealsRoot.querySelectorAll('[data-undo-exclusion]').forEach(button => {
    button.addEventListener('click', () => {
      const mealId = button.dataset.undoExclusion;
      const mealName = state.excludedMealNames.get(mealId) || humanize(mealId);
      state.excludedMealIds.delete(mealId);
      state.excludedMealNames.delete(mealId);
      renderExcludedMeals();
      showMenuChange(t('dishes.statusEligibleAgain', { name: i18n.cachedTranslation(mealName, 'meal-name') }));
    });
  });
}

function clearExcludedMeals() {
  state.excludedMealIds.clear();
  state.excludedMealNames.clear();
  renderExcludedMeals();
}

function showMenuChange(message, stale = false) {
  if (stale) state.planIsStale = true;
  menuChangeStatus.hidden = false;
  menuChangeStatus.innerHTML = `
    <strong>${dynamic(message, 'ui-status')}</strong>
    <span>${escapeHtml(state.planIsStale ? t('results.menuChanged') : t('results.applyChoice'))}</span>
  `;
}

function clearMenuChangeStatus() {
  state.planIsStale = false;
  menuChangeStatus.hidden = true;
  menuChangeStatus.innerHTML = '';
}

function renderShoppingItems(items) {
  document.querySelector('#shopping-items').innerHTML = items.map(item => `
    <tr>
      <td data-label="${escapeHtml(t('table.item'))}"><strong>${dynamic(item.name, 'product-name')}</strong><small>${escapeHtml(item.sku)}${item.originCountry ? ` · ${escapeHtml(t('table.origin'))} ${escapeHtml(item.originCountry)}` : ''} · ${quantity(item.packageSize)} / ${escapeHtml(t('table.pack'))}</small></td>
      <td data-label="${escapeHtml(t('table.need'))}">${quantity(item.requiredQuantity)}</td>
      <td data-label="${escapeHtml(t('table.stockUsed'))}">${item.inventoryUsed.amount ? quantity(item.inventoryUsed) : '—'}</td>
      <td data-label="${escapeHtml(t('table.packages'))}" class="${item.packageCount === 0 ? 'covered' : ''}">${item.packageCount === 0 ? escapeHtml(t('results.covered')) : item.packageCount}</td>
      <td data-label="${escapeHtml(t('table.purchased'))}">${quantity(item.purchasedQuantity)}</td>
      <td data-label="${escapeHtml(t('table.overbuy'))}">${item.overbuyQuantity.amount ? quantity(item.overbuyQuantity) : '—'}</td>
      <td data-label="${escapeHtml(t('table.total'))}"><strong>${formatMoney(item.lineTotal.amount)}</strong></td>
    </tr>
  `).join('');
}

function buildShoppingCartMockPayload(plan) {
  const purchasableItems = (plan.shoppingItems || [])
    .filter(item => Number(item.packageCount) > 0)
    .map(item => ({
      eventInABoxProductId: item.productId,
      sku: item.sku,
      packageCount: Number(item.packageCount)
    }))
    .sort((left, right) => left.eventInABoxProductId.localeCompare(right.eventInABoxProductId));

  return {
    schemaVersion: '1.0',
    integration: 'shopping-cart',
    mode: 'MOCK',
    cartIntent: 'CREATE_OR_UPDATE_CART',
    event: {
      templateId: plan.event.templateId,
      guestCount: plan.event.guestCount,
      budget: {
        amount: plan.event.budget?.amount ?? null,
        currency: plan.event.budget?.currency || 'CHF'
      }
    },
    items: purchasableItems,
    totals: {
      packageLines: purchasableItems.length,
      packages: purchasableItems.reduce((sum, item) => sum + item.packageCount, 0),
      plannedCost: {
        amount: plan.totals?.totalCost?.amount ?? null,
        currency: plan.totals?.totalCost?.currency || 'CHF'
      }
    },
    integrationNote: 'Mock contract only. A retailer-specific adapter must map Event in a Box product IDs/SKUs to the external webshop product identifiers and cart API.'
  };
}

function renderShoppingCartPreview(plan) {
  shoppingCartJson.textContent = JSON.stringify(buildShoppingCartMockPayload(plan), null, 2);
}

function openShoppingCartPreview() {
  if (!state.currentPlan) {
    showError(t('integration.shoppingCart.noPlan'));
    return;
  }
  renderShoppingCartPreview(state.currentPlan);
  if (state.planIsStale) {
    shoppingCartMockStatus.textContent = t('integration.shoppingCart.stale');
    shoppingCartMockStatus.hidden = false;
  } else {
    shoppingCartMockStatus.hidden = true;
    shoppingCartMockStatus.textContent = '';
  }
  if (typeof shoppingCartPreview.showModal === 'function') shoppingCartPreview.showModal();
  else shoppingCartPreview.setAttribute('open', '');
  document.body.classList.add('dialog-open');
}

function closeShoppingCartPreview() {
  if (typeof shoppingCartPreview.close === 'function' && shoppingCartPreview.open) shoppingCartPreview.close();
  else shoppingCartPreview.removeAttribute('open');
  document.body.classList.remove('dialog-open');
}

async function copyShoppingCartJson() {
  const json = shoppingCartJson.textContent || '';
  try {
    await navigator.clipboard.writeText(json);
    shoppingCartMockStatus.textContent = t('integration.shoppingCart.copied');
  } catch (_) {
    shoppingCartMockStatus.textContent = t('integration.shoppingCart.copyFailed');
  }
  shoppingCartMockStatus.hidden = false;
}

function mockSendToShoppingCart() {
  if (!state.currentPlan) return;
  if (state.planIsStale) {
    shoppingCartMockStatus.textContent = t('integration.shoppingCart.stale');
    shoppingCartMockStatus.hidden = false;
    return;
  }
  const payload = buildShoppingCartMockPayload(state.currentPlan);
  shoppingCartMockStatus.textContent = t(
    payload.items.length === 1 ? 'integration.shoppingCart.mockSent.one' : 'integration.shoppingCart.mockSent.many',
    { count: payload.items.length }
  );
  shoppingCartMockStatus.hidden = false;
  console.info('Event in a Box — mock shopping cart payload', payload);
}

function renderInventory(items) {
  const target = document.querySelector('#inventory-used');
  target.innerHTML = items.length ? items.map(item => `
    <div class="stock-item"><span>${dynamic(humanize(item.concept), 'ingredient-name')}</span><strong>${quantity(item.quantity)}</strong></div>
  `).join('') : `<p class="stock-empty">${escapeHtml(t('results.noStockMatched'))}</p>`;
}

function renderTrace(requirements) {
  document.querySelector('#requirement-trace').innerHTML = requirements.map(item => `
    <div class="trace-item"><strong>${dynamic(humanize(item.requirementId), 'requirement')}</strong><br>
      <span>${item.selectedCandidateName ? dynamic(item.selectedCandidateName, item.type === 'meal' ? 'meal-name' : 'product-name') : escapeHtml(t('results.notFulfilled'))} · ${quantity(item.targetQuantity)} · ${(item.matchedCapabilities || []).map(value => dynamic(humanize(value), 'capability')).join(', ')}</span>
    </div>
  `).join('');
}

async function loadDeveloperCatalog() {
  document.querySelector('#catalog-count').textContent = t('catalog.loading');
  try {
    [state.meals, state.products] = await Promise.all([
      fetchJson('/api/meals'),
      fetchJson('/api/products')
    ]);
    state.catalogLoaded = true;
    document.querySelector('#meal-count').textContent = state.meals.length;
    document.querySelector('#product-count').textContent = state.products.length;
    renderCatalogCapabilities();
    renderCatalog();
  } catch (error) {
    document.querySelector('#catalog-count').textContent = t('catalog.failed');
    catalogResults.innerHTML = `<div class="catalog-empty">${escapeHtml(error.message)}</div>`;
  }
}

function configuredPriorities(weights) {
  const definitions = [...state.priorities];
  const definedIds = new Set(definitions.map(priority => priority.id));
  Object.keys(weights || {}).forEach(id => {
    if (!definedIds.has(id)) definitions.push(fallbackPriority(id));
  });
  return definitions.sort(comparePriorities);
}

function priorityDefinition(id) {
  return state.priorities.find(priority => priority.id === id) || fallbackPriority(id);
}

function fallbackPriority(id) {
  return {
    id,
    label: humanize(id),
    description: t('catalog.scoreFallback'),
    displayOrder: Number.MAX_SAFE_INTEGER,
    defaultWeight: 0,
    lowLabel: 'Lower',
    highLabel: 'Higher'
  };
}

function comparePriorities(left, right) {
  return (left.displayOrder ?? 0) - (right.displayOrder ?? 0) || left.id.localeCompare(right.id);
}

function priorityEntries(scores) {
  return Object.entries(scores || {}).sort(([left], [right]) =>
    comparePriorities(priorityDefinition(left), priorityDefinition(right))
  );
}

function renderCatalogCapabilities() {
  const items = state[state.catalogType] || [];
  const capabilities = [...new Set(items.flatMap(item => [
    ...(item.capabilities || []),
    ...(item.dietaryCapabilities || [])
  ]))].sort();
  catalogCapability.innerHTML = [
    `<option value="">${escapeHtml(t('catalog.allCapabilities'))}</option>`,
    ...capabilities.map(capability => `<option value="${escapeHtml(capability)}" ${i18n.dynamicOptionAttributes(humanize(capability), 'capability')}>${escapeHtml(humanize(capability))}</option>`)
  ].join('');
}

function renderCatalog() {
  if (!state.catalogLoaded) return;
  const items = state[state.catalogType];
  const query = catalogSearch.value.trim().toLocaleLowerCase();
  const capability = catalogCapability.value;
  const filtered = items.filter(item => {
    const matchesCapability = !capability ||
      (item.capabilities || []).includes(capability) ||
      (item.dietaryCapabilities || []).includes(capability);
    return matchesCapability && (!query || catalogSearchText(item).includes(query));
  });

  const nounKey = state.catalogType === 'meals' ? 'catalog.recipe' : 'catalog.item';
  const noun = t(nounKey);
  document.querySelector('#catalog-count').textContent = t(filtered.length === 1 ? 'catalog.shown.one' : 'catalog.shown.many', { count: filtered.length, noun });
  catalogResults.innerHTML = filtered.length
    ? filtered.map(item => state.catalogType === 'meals' ? recipeCard(item) : productCard(item)).join('')
    : `<div class="catalog-empty">${escapeHtml(t('catalog.noMatches', { noun }))}</div>`;
}

function catalogSearchText(item) {
  const ingredientConcepts = (item.ingredients || []).map(ingredient => ingredient.concept);
  return [
    item.id,
    item.name,
    i18n.cachedTranslation(item.name, state.catalogType === 'meals' ? 'meal-name' : 'product-name'),
    item.sku,
    item.concept,
    i18n.cachedTranslation(humanize(item.concept || ''), 'ingredient-name'),
    item.originCountry,
    ...(item.categoryIds || []),
    ...(item.capabilities || []),
    ...(item.dietaryCapabilities || []),
    ...ingredientConcepts
  ].filter(Boolean).join(' ').toLocaleLowerCase();
}

function recipeCard(meal) {
  const ingredients = meal.ingredients.map(ingredient => `
    <li><span>${dynamic(humanize(ingredient.concept), 'ingredient-name')}</span><strong>${formatAmount(ingredient.amountPerServing)} ${escapeHtml(i18n.unitLabel(ingredient.unit, ingredient.amountPerServing))}</strong></li>
  `).join('');
  const categories = (meal.categoryIds || []).map(categoryLabel).filter(Boolean);
  return `
    <article class="catalog-card recipe-card">
      <div class="catalog-card-heading">
        <div><p>${escapeHtml(t('catalog.recipe'))} · ${escapeHtml(meal.id)}</p><h3>${dynamic(meal.name, 'meal-name')}</h3></div>
        <span>${formatAmount(meal.serving.piecesPerServing)} ${escapeHtml(i18n.unitLabel('piece', meal.serving.piecesPerServing))} / ${escapeHtml(i18n.unitLabel('serving', 1))}</span>
      </div>
      ${categories.length ? `<div class="chips catalog-chips">${categories.map(label => `<span class="chip">${dynamic(label, 'meal-category')}</span>`).join('')}</div>` : ''}
      ${capabilityChips(meal.capabilities)}
      ${dietaryCapabilityChips(meal.dietaryCapabilities)}
      <div class="catalog-card-body">
        <h4>${escapeHtml(t('catalog.ingredientsPerServing'))}</h4>
        <ul class="ingredient-list">${ingredients}</ul>
      </div>
      ${catalogScores(meal.scores)}
    </article>
  `;
}

function productCard(product) {
  const conversion = product.conversion
    ? `<span>${escapeHtml(t('catalog.yields', { count: formatAmount(product.package.amount / product.conversion.amountPerServing), unit: i18n.unitLabel(product.conversion.servingUnit, 2) }))}</span>`
    : '';
  return `
    <article class="catalog-card product-card">
      <div class="catalog-card-heading">
        <div><p>${escapeHtml(t('catalog.item'))} · ${escapeHtml(product.sku)}</p><h3>${dynamic(product.name, 'product-name')}</h3></div>
        <span>${formatMoney(product.price.amount)}</span>
      </div>
      ${capabilityChips(product.capabilities)}
      ${dietaryCapabilityChips(product.dietaryCapabilities)}
      <dl class="product-facts">
        <div><dt>${escapeHtml(t('catalog.concept'))}</dt><dd>${dynamic(humanize(product.concept), 'ingredient-name')}</dd></div>
        <div><dt>${escapeHtml(t('catalog.package'))}</dt><dd>${quantity(product.package)}</dd></div>
        <div><dt>${escapeHtml(t('catalog.origin'))}</dt><dd>${escapeHtml(product.originCountry || t('catalog.unspecified'))}</dd></div>
      </dl>
      ${conversion ? `<div class="conversion-note">${conversion}</div>` : ''}
      ${catalogScores(product.scores)}
    </article>
  `;
}

function capabilityChips(capabilities) {
  return `<div class="chips catalog-chips">${(capabilities || []).map(capability =>
    `<span class="chip">${dynamic(humanize(capability), 'capability')}</span>`
  ).join('')}</div>`;
}

function dietaryCapabilityChips(capabilities) {
  if (!(capabilities || []).length) return '';
  return `<div class="chips catalog-chips">${capabilities.map(capability =>
    `<span class="chip dietary">${dynamic(humanize(capability), 'dietary-label')}</span>`
  ).join('')}</div>`;
}

function catalogScores(scores) {
  const entries = priorityEntries(scores);
  if (!entries.length) return '';
  return `
    <details class="catalog-scores">
      <summary>${escapeHtml(t('catalog.planningScores'))}</summary>
      <div class="catalog-score-list">${entries.map(([key, value]) => {
        const priority = priorityDefinition(key);
        const normalized = clamp(Number(value), 0, 1);
        return `
          <div class="catalog-score" title="${escapeHtml(i18n.cachedTranslation(priority.description, 'priority-description'))}">
            <span><i>${dynamic(priority.label, 'priority-label')}</i><b>${Math.round(normalized * 100)}</b></span>
            <progress max="1" value="${normalized}">${Math.round(normalized * 100)}%</progress>
          </div>
        `;
      }).join('')}</div>
    </details>
  `;
}

function categoryMeta(id) {
  const category = state.mealCategories.find(item => item.id === id);
  return {
    id,
    label: category?.label || humanize(id),
    icon: category?.icon || fallbackIcon('category', id)
  };
}

function categoryLabel(id) {
  return categoryMeta(id).label;
}

function visualIcon(icon, className = 'visual-icon') {
  const value = String(icon || '•').trim().slice(0, 4);
  return `<span class="${escapeHtml(className)}" aria-hidden="true">${escapeHtml(value)}</span>`;
}

function fallbackIcon(kind, id) {
  const key = String(id || '').toLowerCase();
  const icons = {
    event: {
      'business-apero': '🥂', brunch: '🥞', 'coffee-break': '☕',
      'team-lunch-buffet': '🍽️', 'vegan-reception': '🌿', 'swiss-breakfast': '🥐'
    },
    category: {
      fruit: '🍓', bakery: '🥐', meat: '🍗', 'plant-based': '🌿',
      breakfast: '🍳', lunch: '🍽️', reception: '🥂'
    },
    dietary: {
      vegetarian: '🥬', vegan: '🌱', halal: 'H', 'gluten-free': 'GF',
      'lactose-free': 'LF', 'nut-free': 'NF'
    }
  };
  return icons[kind]?.[key] || (kind === 'event' ? '✦' : kind === 'category' ? '•' : '✓');
}

function normalizedSet(values) {
  return new Set((values || []).map(value => String(value).trim().toLowerCase()).filter(Boolean));
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.title || `Request failed (${response.status})`);
  return data;
}

function setLoading(loading) {
  generateButton.disabled = loading;
  regenerateMenuButton.disabled = loading;
  generateButton.querySelector('span').textContent = loading ? t('plan.resolving') : t('plan.generate');
  regenerateMenuButton.textContent = loading ? t('plan.resolving') : t('results.regenerate');
}

function showError(message) { errorBox.textContent = message; errorBox.hidden = false; }
function hideError() { errorBox.hidden = true; errorBox.textContent = ''; }
function formatMoney(value) { return i18n.formatMoney(Number(value), 'CHF'); }
function formatAmount(value) { return i18n.formatNumber(Number(value), { maximumFractionDigits: 3 }); }
function mealTargetLabel(value) {
  const unit = String(value?.unit || '').trim().toLowerCase();
  if (['piece', 'pieces', 'pcs', 'pc'].includes(unit)) return t('results.piecesLabel');
  return t('results.targetLabel');
}
function quantity(value) { return `${i18n.formatNumber(Number(value.amount), { maximumFractionDigits: 3 })} ${i18n.unitLabel(value.unit, value.amount)}`; }
function humanize(value) { return String(value ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase()); }
function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

loadPlannerData();
