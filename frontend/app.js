const state = {
  templates: [],
  priorities: [],
  constraints: [],
  mealCategories: [],
  requiredMeals: new Map(),
  pickerMeals: [],
  pickerCategory: '',
  pickerSearchToken: 0,
  catalogType: 'meals',
  catalogLoaded: false,
  meals: [],
  products: []
};

const form = document.querySelector('#planner-form');
const templateSelect = document.querySelector('#template');
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
const pickerStatus = document.querySelector('#meal-picker-status');
const developerTools = document.querySelector('#developer-tools');
const catalogSearch = document.querySelector('#catalog-search');
const catalogCapability = document.querySelector('#catalog-capability');
const catalogResults = document.querySelector('#catalog-results');

let pickerDebounce;

document.querySelector('#add-inventory').addEventListener('click', () => addInventoryRow());
document.querySelector('#open-meal-picker').addEventListener('click', openMealPicker);
document.querySelector('#close-meal-picker').addEventListener('click', closeMealPicker);
document.querySelector('#back-to-form').addEventListener('click', () => {
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
templateSelect.addEventListener('change', applyTemplate);
form.addEventListener('submit', resolvePlan);
pickerSearch.addEventListener('input', () => {
  clearTimeout(pickerDebounce);
  pickerDebounce = setTimeout(searchPickerMeals, 180);
});
mealPicker.addEventListener('close', () => document.body.classList.remove('dialog-open'));
mealPicker.addEventListener('click', event => {
  if (event.target === mealPicker) closeMealPicker();
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
      ? 'Search name, ID, ingredient…'
      : 'Search name, SKU, concept…';
    renderCatalogCapabilities();
    renderCatalog();
  });
});

const shareInput = document.querySelector('#vegetarian-share');
shareInput.addEventListener('input', () => {
  document.querySelector('#vegetarian-share-value').value = `${Math.round(Number(shareInput.value) * 100)}%`;
});

async function loadPlannerData() {
  try {
    [state.templates, state.priorities, state.constraints, state.mealCategories] = await Promise.all([
      fetchJson('/api/templates'),
      fetchJson('/api/priorities'),
      fetchJson('/api/dietary-constraints'),
      fetchJson('/api/meal-categories')
    ]);

    templateSelect.innerHTML = state.templates
      .map(template => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name)}</option>`)
      .join('');
    templateSelect.disabled = false;
    const preferred = state.templates.find(template => template.id === 'business-apero');
    if (preferred) templateSelect.value = preferred.id;

    renderDietaryConstraints();
    renderMealCategories();
    renderRequiredMeals();
    applyTemplate();
    renderInventoryEmptyState();
  } catch (error) {
    showError(`Could not load planner data. ${error.message}`);
  }
}

function renderDietaryConstraints() {
  if (!state.constraints.length) {
    constraintRoot.innerHTML = '<p class="empty-row">No dietary constraints are configured.</p>';
    return;
  }

  constraintRoot.innerHTML = state.constraints.map(constraint => `
    <label class="constraint-option">
      <input type="checkbox" value="${escapeHtml(constraint.id)}" data-constraint-id="${escapeHtml(constraint.id)}">
      <span class="constraint-card">
        <span class="constraint-box" aria-hidden="true">✓</span>
        <span>
          <strong>${escapeHtml(constraint.label)}</strong>
          <small>${escapeHtml(constraint.description)}</small>
        </span>
      </span>
    </label>
  `).join('');

  constraintRoot.querySelectorAll('input[data-constraint-id]').forEach(input => {
    input.addEventListener('change', () => {
      renderRequiredMeals();
      renderPickerResults();
    });
  });
}

function selectedConstraintIds() {
  return new Set([...constraintRoot.querySelectorAll('input[data-constraint-id]:checked')].map(input => input.value));
}

function selectedConstraintDefinitions() {
  const ids = selectedConstraintIds();
  return state.constraints.filter(constraint => ids.has(constraint.id));
}

function renderMealCategories() {
  const categories = [{ id: '', label: 'All dishes' }, ...state.mealCategories];
  pickerCategories.innerHTML = categories.map(category => `
    <button class="category-button ${state.pickerCategory === category.id ? 'active' : ''}" type="button" data-category-id="${escapeHtml(category.id)}">
      ${escapeHtml(category.label)}
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

  pickerStatus.textContent = 'Searching recipes…';
  try {
    const meals = await fetchJson(`/api/meals/search?${params.toString()}`);
    if (token !== state.pickerSearchToken) return;
    state.pickerMeals = meals;
    const filterText = [query && `matching “${query}”`, state.pickerCategory && categoryLabel(state.pickerCategory)].filter(Boolean).join(' · ');
    pickerStatus.textContent = `${meals.length} recipe${meals.length === 1 ? '' : 's'}${filterText ? ` · ${filterText}` : ''}`;
    renderPickerResults();
  } catch (error) {
    if (token !== state.pickerSearchToken) return;
    pickerStatus.textContent = 'Recipe search failed.';
    pickerResults.innerHTML = `<div class="picker-empty">${escapeHtml(error.message)}</div>`;
  }
}

function renderPickerResults() {
  document.querySelector('#meal-picker-selected-count').textContent = selectedCountText();
  if (!state.pickerMeals.length) {
    pickerResults.innerHTML = '<div class="picker-empty">No recipes match this search and category.</div>';
    return;
  }

  pickerResults.innerHTML = state.pickerMeals.map(meal => {
    const conflicts = mealConstraintConflicts(meal);
    const isSelected = state.requiredMeals.has(meal.id);
    const categories = (meal.categoryIds || []).map(categoryLabel).filter(Boolean);
    return `
      <article class="picker-card ${conflicts.length ? 'conflict' : ''}">
        <div>
          <h3>${escapeHtml(meal.name)}</h3>
          <div class="picker-card-meta">
            ${categories.slice(0, 3).map(label => `<span class="chip">${escapeHtml(label)}</span>`).join('')}
          </div>
          ${conflicts.length ? `<p class="picker-conflict">⚠ ${escapeHtml(conflictSummary(conflicts))}</p>` : ''}
        </div>
        <button class="picker-add ${isSelected ? 'added' : ''}" type="button" data-picker-meal-id="${escapeHtml(meal.id)}" ${isSelected ? 'disabled' : ''}>
          ${isSelected ? 'Added' : 'Add'}
        </button>
      </article>
    `;
  }).join('');

  pickerResults.querySelectorAll('[data-picker-meal-id]').forEach(button => {
    button.addEventListener('click', () => {
      const meal = state.pickerMeals.find(item => item.id === button.dataset.pickerMealId);
      if (!meal) return;
      state.requiredMeals.set(meal.id, meal);
      renderRequiredMeals();
      renderPickerResults();
    });
  });
}

function selectedCountText() {
  const count = state.requiredMeals.size;
  return `${count} selected`;
}

function renderRequiredMeals() {
  const meals = [...state.requiredMeals.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (!meals.length) {
    requiredMealsRoot.innerHTML = '<p class="empty-selection">No specific dishes selected.</p>';
    return;
  }

  requiredMealsRoot.innerHTML = meals.map(meal => {
    const conflicts = mealConstraintConflicts(meal);
    const categories = (meal.categoryIds || []).map(categoryLabel).filter(Boolean);
    return `
      <div class="selected-meal-row ${conflicts.length ? 'conflict' : ''}">
        <div class="selected-meal-main">
          <strong>${escapeHtml(meal.name)}</strong>
          <div class="selected-meal-meta">
            ${categories.slice(0, 3).map(label => `<span>${escapeHtml(label)}</span>`).join('<span>·</span>')}
          </div>
          ${conflicts.length ? `<p class="selected-meal-warning">⚠ Constraint exception: ${escapeHtml(conflictSummary(conflicts))}. This dish will still be included.</p>` : ''}
        </div>
        <button class="remove-meal" type="button" data-remove-meal-id="${escapeHtml(meal.id)}" aria-label="Remove ${escapeHtml(meal.name)}">×</button>
      </div>
    `;
  }).join('');

  requiredMealsRoot.querySelectorAll('[data-remove-meal-id]').forEach(button => {
    button.addEventListener('click', () => {
      state.requiredMeals.delete(button.dataset.removeMealId);
      renderRequiredMeals();
      renderPickerResults();
    });
  });
}

function mealConstraintConflicts(meal) {
  const capabilities = normalizedSet(meal.capabilities || []);
  const ingredientConcepts = normalizedSet((meal.ingredients || []).map(ingredient => ingredient.concept));
  return selectedConstraintDefinitions().map(constraint => {
    const required = normalizedSet(constraint.requiredCapabilities || []);
    const excluded = normalizedSet(constraint.excludedCapabilities || []);
    const excludedConcepts = normalizedSet(constraint.excludedConcepts || []);
    const missingRequiredCapabilities = [...required].filter(value => !capabilities.has(value));
    const conflictingCapabilities = [...excluded].filter(value => capabilities.has(value));
    const conflictingConcepts = [...excludedConcepts].filter(value => ingredientConcepts.has(value));
    if (!missingRequiredCapabilities.length && !conflictingCapabilities.length && !conflictingConcepts.length) return null;
    return {
      constraint,
      missingRequiredCapabilities,
      excludedCapabilities: conflictingCapabilities,
      excludedConcepts: conflictingConcepts
    };
  }).filter(Boolean);
}

function conflictSummary(conflicts) {
  return conflicts.map(conflict => conflict.constraint?.label || conflict.constraintLabel).join(', ');
}

function serverConflictDetails(conflict) {
  const parts = [];
  if (conflict.missingRequiredCapabilities?.length) {
    parts.push(`does not meet ${conflict.missingRequiredCapabilities.map(humanize).join(', ')}`);
  }
  if (conflict.excludedCapabilities?.length) {
    parts.push(`has excluded ${conflict.excludedCapabilities.map(humanize).join(', ')}`);
  }
  if (conflict.excludedConcepts?.length) {
    parts.push(`contains ${conflict.excludedConcepts.map(humanize).join(', ')}`);
  }
  return parts.join('; ');
}

function applyTemplate() {
  const template = state.templates.find(item => item.id === templateSelect.value);
  if (!template) return;
  description.textContent = template.description;
  renderWeights(template.weights);
  const vegetarianShare = template.defaults?.vegetarianShare;
  const hasVegetarianRequirement = template.requirements.some(requirement =>
    requirement.requiredCapabilities.includes('vegetarian') && requirement.target.share != null
  );
  document.querySelector('#vegetarian-share-field').hidden = !hasVegetarianRequirement;
  if (vegetarianShare != null) {
    shareInput.value = vegetarianShare;
    shareInput.dispatchEvent(new Event('input'));
  }
}

function renderWeights(weights) {
  document.querySelector('#weights').innerHTML = configuredPriorities(weights).map(priority => {
    const value = clamp(Number(weights[priority.id] ?? priority.defaultWeight ?? 0), 0, 1);
    const descriptionId = `priority-${priority.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    return `
      <label class="weight">
        <span class="weight-header"><strong>${escapeHtml(priority.label)}</strong><output>${Math.round(value * 100)}%</output></span>
        <input class="weight-input" data-key="${escapeHtml(priority.id)}" type="range" min="0" max="1" step="0.05" value="${value}" aria-describedby="${escapeHtml(descriptionId)}">
        <small id="${escapeHtml(descriptionId)}" class="weight-description">${escapeHtml(priority.description)}</small>
        <span class="weight-scale"><i>${escapeHtml(priority.lowLabel || 'Lower')}</i><i>${escapeHtml(priority.highLabel || 'Higher')}</i></span>
      </label>
    `;
  }).join('');
  document.querySelectorAll('.weight-input').forEach(input => {
    input.addEventListener('input', () => {
      input.closest('.weight').querySelector('output').value = `${Math.round(Number(input.value) * 100)}%`;
    });
  });
}

function renderInventoryEmptyState() {
  if (!inventoryRows.children.length) {
    inventoryRows.innerHTML = '<p class="empty-row">No existing stock added.</p>';
  }
}

function addInventoryRow(item = { concept: '', amount: '', unit: 'piece' }) {
  inventoryRows.querySelector('.empty-row')?.remove();
  const row = document.createElement('div');
  row.className = 'inventory-row';
  row.innerHTML = `
    <label class="inventory-cell inventory-concept-cell">
      <span>Product concept</span>
      <input class="inventory-concept" aria-label="Inventory concept" placeholder="e.g. water" value="${escapeHtml(item.concept)}">
    </label>
    <label class="inventory-cell">
      <span>Amount</span>
      <input class="inventory-amount" aria-label="Inventory amount" type="number" min="0" step="0.1" inputmode="decimal" placeholder="0" value="${escapeHtml(item.amount)}">
    </label>
    <label class="inventory-cell">
      <span>Unit</span>
      <select class="inventory-unit" aria-label="Inventory unit">
        ${['piece', 'g', 'kg', 'liter', 'ml', 'cup', 'bottle'].map(unit =>
          `<option value="${unit}" ${item.unit === unit ? 'selected' : ''}>${unit}</option>`
        ).join('')}
      </select>
    </label>
    <button class="remove-inventory" type="button" aria-label="Remove inventory item">×</button>
  `;
  row.querySelector('.remove-inventory').addEventListener('click', () => {
    row.remove();
    renderInventoryEmptyState();
  });
  inventoryRows.append(row);
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
  const shareVisible = !document.querySelector('#vegetarian-share-field').hidden;
  const servingsValue = document.querySelector('#servings-per-guest').value;

  const request = {
    templateId: templateSelect.value,
    guestCount: Number(document.querySelector('#guest-count').value),
    budget: Number(document.querySelector('#budget').value),
    servingsPerGuest: servingsValue === '' ? null : Number(servingsValue),
    requiredMealIds: [...state.requiredMeals.keys()].sort(),
    selectedConstraintIds: [...selectedConstraintIds()].sort(),
    weights,
    preferences: {
      vegetarianShare: shareVisible ? Number(shareInput.value) : null,
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
    renderPlan(plan);
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
    ? 'template portions'
    : `${plan.event.servingsPerGuest} servings each`;
  document.querySelector('#result-title').textContent = `${plan.event.templateName} for ${plan.event.guestCount} guests · ${foodAmount}.`;
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
  target.innerHTML = `
    <strong>⚠ ${conflicts.length} dietary constraint exception${conflicts.length === 1 ? '' : 's'} in this plan</strong>
    <p>${guaranteed.length
      ? `${guaranteed.length} exception${guaranteed.length === 1 ? '' : 's'} come from dishes you explicitly guaranteed. They remain in the plan, but should be reviewed before service.`
      : 'Review the highlighted recipes before service.'}</p>
  `;
}

function renderWarnings(warnings) {
  const element = document.querySelector('#warnings');
  element.hidden = !warnings.length;
  element.innerHTML = warnings.map(warning => `<div>${escapeHtml(warning)}</div>`).join('');
}

function renderTotals(totals) {
  const difference = totals.budgetDifference.amount;
  const differenceLabel = difference >= 0 ? 'Budget remaining' : 'Budget overrun';
  document.querySelector('#totals').innerHTML = `
    <div class="total-card"><span>Total cost</span><strong>${formatMoney(totals.totalCost.amount)}</strong></div>
    <div class="total-card"><span>Cost per guest</span><strong>${formatMoney(totals.costPerGuest.amount)}</strong></div>
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

  document.querySelector('#selected-meals').innerHTML = meals.map(meal => {
    const mealConflicts = conflictsByMeal.get(meal.mealId) || [];
    const conflictText = mealConflicts.map(conflict => {
      const details = serverConflictDetails(conflict);
      return `${conflict.constraintLabel}${details ? ` — ${details}` : ''}`;
    }).join(' · ');
    return `
      <article class="meal-card ${mealConflicts.length ? 'conflict' : ''}">
        <div class="meal-top">
          <div>
            <h4>${escapeHtml(meal.name)}</h4>
            <span class="requirement">${escapeHtml(humanize(meal.requirementId))}</span>
            ${meal.guaranteed ? '<br><span class="guaranteed-badge">Guaranteed</span>' : ''}
            ${mealConflicts.length ? '<span class="conflict-badge">Constraint exception</span>' : ''}
          </div>
          <span class="score" title="Weighted score">${Math.round(meal.finalWeightedScore * 100)}</span>
        </div>
        ${mealConflicts.length ? `<div class="meal-conflict-box"><strong>Review before service:</strong> ${escapeHtml(conflictText)}</div>` : ''}
        <div class="chips">${(meal.matchedCapabilities || []).map(capability => `<span class="chip">${escapeHtml(humanize(capability))}</span>`).join('')}</div>
        <div class="meal-meta"><span>${meal.servings} servings</span><span>${quantity(meal.targetQuantity)} target</span></div>
        <details class="score-details">
          <summary>Why this was selected</summary>
          <div class="score-components">${priorityEntries(meal.scoreComponents).map(([key, value]) =>
            `<span><i>${escapeHtml(priorityDefinition(key).label)}</i><b>${Math.round(value * 100)}</b></span>`
          ).join('')}</div>
        </details>
      </article>
    `;
  }).join('');
}

function renderShoppingItems(items) {
  document.querySelector('#shopping-items').innerHTML = items.map(item => `
    <tr>
      <td data-label="Item"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.sku)}${item.originCountry ? ` · Origin ${escapeHtml(item.originCountry)}` : ''} · ${quantity(item.packageSize)} / pack</small></td>
      <td data-label="Need">${quantity(item.requiredQuantity)}</td>
      <td data-label="Stock used">${item.inventoryUsed.amount ? quantity(item.inventoryUsed) : '—'}</td>
      <td data-label="Packages" class="${item.packageCount === 0 ? 'covered' : ''}">${item.packageCount === 0 ? 'Covered' : item.packageCount}</td>
      <td data-label="Purchased">${quantity(item.purchasedQuantity)}</td>
      <td data-label="Overbuy">${item.overbuyQuantity.amount ? quantity(item.overbuyQuantity) : '—'}</td>
      <td data-label="Total"><strong>${formatMoney(item.lineTotal.amount)}</strong></td>
    </tr>
  `).join('');
}

function renderInventory(items) {
  const target = document.querySelector('#inventory-used');
  target.innerHTML = items.length ? items.map(item => `
    <div class="stock-item"><span>${escapeHtml(humanize(item.concept))}</span><strong>${quantity(item.quantity)}</strong></div>
  `).join('') : '<p class="stock-empty">No existing inventory matched this plan.</p>';
}

function renderTrace(requirements) {
  document.querySelector('#requirement-trace').innerHTML = requirements.map(item => `
    <div class="trace-item"><strong>${escapeHtml(humanize(item.requirementId))}</strong><br>
      <span>${escapeHtml(item.selectedCandidateName || 'Not fulfilled')} · ${quantity(item.targetQuantity)} · ${(item.matchedCapabilities || []).map(value => escapeHtml(humanize(value))).join(', ')}</span>
    </div>
  `).join('');
}

async function loadDeveloperCatalog() {
  document.querySelector('#catalog-count').textContent = 'Loading catalog…';
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
    document.querySelector('#catalog-count').textContent = 'Catalog failed to load.';
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
    description: 'Catalog-defined planning score.',
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
  const capabilities = [...new Set(items.flatMap(item => item.capabilities || []))].sort();
  catalogCapability.innerHTML = [
    '<option value="">All capabilities</option>',
    ...capabilities.map(capability => `<option value="${escapeHtml(capability)}">${escapeHtml(humanize(capability))}</option>`)
  ].join('');
}

function renderCatalog() {
  if (!state.catalogLoaded) return;
  const items = state[state.catalogType];
  const query = catalogSearch.value.trim().toLocaleLowerCase();
  const capability = catalogCapability.value;
  const filtered = items.filter(item => {
    const matchesCapability = !capability || (item.capabilities || []).includes(capability);
    return matchesCapability && (!query || catalogSearchText(item).includes(query));
  });

  const noun = state.catalogType === 'meals' ? 'recipe' : 'item';
  document.querySelector('#catalog-count').textContent = `${filtered.length} ${noun}${filtered.length === 1 ? '' : 's'} shown`;
  catalogResults.innerHTML = filtered.length
    ? filtered.map(item => state.catalogType === 'meals' ? recipeCard(item) : productCard(item)).join('')
    : `<div class="catalog-empty">No ${noun}s match this search and filter.</div>`;
}

function catalogSearchText(item) {
  const ingredientConcepts = (item.ingredients || []).map(ingredient => ingredient.concept);
  return [
    item.id,
    item.name,
    item.sku,
    item.concept,
    item.originCountry,
    ...(item.categoryIds || []),
    ...(item.capabilities || []),
    ...ingredientConcepts
  ].filter(Boolean).join(' ').toLocaleLowerCase();
}

function recipeCard(meal) {
  const ingredients = meal.ingredients.map(ingredient => `
    <li><span>${escapeHtml(humanize(ingredient.concept))}</span><strong>${formatAmount(ingredient.amountPerServing)} ${escapeHtml(ingredient.unit)}</strong></li>
  `).join('');
  const categories = (meal.categoryIds || []).map(categoryLabel).filter(Boolean);
  return `
    <article class="catalog-card recipe-card">
      <div class="catalog-card-heading">
        <div><p>Recipe · ${escapeHtml(meal.id)}</p><h3>${escapeHtml(meal.name)}</h3></div>
        <span>${formatAmount(meal.serving.piecesPerServing)} ${meal.serving.piecesPerServing === 1 ? 'piece' : 'pieces'} / serving</span>
      </div>
      ${categories.length ? `<div class="chips catalog-chips">${categories.map(label => `<span class="chip">${escapeHtml(label)}</span>`).join('')}</div>` : ''}
      ${capabilityChips(meal.capabilities)}
      <div class="catalog-card-body">
        <h4>Ingredients per serving</h4>
        <ul class="ingredient-list">${ingredients}</ul>
      </div>
      ${catalogScores(meal.scores)}
    </article>
  `;
}

function productCard(product) {
  const conversion = product.conversion
    ? `<span>Yields ${formatAmount(product.package.amount / product.conversion.amountPerServing)} ${escapeHtml(product.conversion.servingUnit)}s</span>`
    : '';
  return `
    <article class="catalog-card product-card">
      <div class="catalog-card-heading">
        <div><p>Item · ${escapeHtml(product.sku)}</p><h3>${escapeHtml(product.name)}</h3></div>
        <span>${formatMoney(product.price.amount)}</span>
      </div>
      ${capabilityChips(product.capabilities)}
      <dl class="product-facts">
        <div><dt>Concept</dt><dd>${escapeHtml(humanize(product.concept))}</dd></div>
        <div><dt>Package</dt><dd>${quantity(product.package)}</dd></div>
        <div><dt>Origin</dt><dd>${escapeHtml(product.originCountry || 'Unspecified')}</dd></div>
      </dl>
      ${conversion ? `<div class="conversion-note">${conversion}</div>` : ''}
      ${catalogScores(product.scores)}
    </article>
  `;
}

function capabilityChips(capabilities) {
  return `<div class="chips catalog-chips">${(capabilities || []).map(capability =>
    `<span class="chip">${escapeHtml(humanize(capability))}</span>`
  ).join('')}</div>`;
}

function catalogScores(scores) {
  const entries = priorityEntries(scores);
  if (!entries.length) return '';
  return `
    <details class="catalog-scores">
      <summary>Planning scores</summary>
      <div class="catalog-score-list">${entries.map(([key, value]) => {
        const priority = priorityDefinition(key);
        const normalized = clamp(Number(value), 0, 1);
        return `
          <div class="catalog-score" title="${escapeHtml(priority.description)}">
            <span><i>${escapeHtml(priority.label)}</i><b>${Math.round(normalized * 100)}</b></span>
            <progress max="1" value="${normalized}">${Math.round(normalized * 100)}%</progress>
          </div>
        `;
      }).join('')}</div>
    </details>
  `;
}

function categoryLabel(id) {
  return state.mealCategories.find(category => category.id === id)?.label || humanize(id);
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
  generateButton.querySelector('span').textContent = loading ? 'Resolving plan…' : 'Generate catering plan';
}

function showError(message) { errorBox.textContent = message; errorBox.hidden = false; }
function hideError() { errorBox.hidden = true; errorBox.textContent = ''; }
function formatMoney(value) { return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(value); }
function formatAmount(value) { return Number(value).toLocaleString('de-CH', { maximumFractionDigits: 3 }); }
function quantity(value) { return `${Number(value.amount).toLocaleString('de-CH', { maximumFractionDigits: 3 })} ${value.unit}`; }
function humanize(value) { return String(value ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase()); }
function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

loadPlannerData();
