const state = { templates: [], meals: [], requiredMealIds: new Set() };
const form = document.querySelector('#planner-form');
const templateSelect = document.querySelector('#template');
const requiredMealSelect = document.querySelector('#required-meal-select');
const requiredMealChips = document.querySelector('#required-meal-chips');
const description = document.querySelector('#template-description');
const inventoryRows = document.querySelector('#inventory-rows');
const errorBox = document.querySelector('#form-error');
const results = document.querySelector('#results');
const generateButton = document.querySelector('#generate');

const weightLabels = {
  price: 'Value',
  swiss: 'Swiss origin',
  presentation: 'Presentation',
  prepEase: 'Prep ease',
  sustainability: 'Sustainability',
  quality: 'Quality'
};

document.querySelector('#add-inventory').addEventListener('click', () => addInventoryRow());
document.querySelector('#back-to-form').addEventListener('click', () => {
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
templateSelect.addEventListener('change', applyTemplate);
requiredMealSelect.addEventListener('change', () => {
  if (!requiredMealSelect.value) return;
  state.requiredMealIds.add(requiredMealSelect.value);
  renderRequiredMeals();
});
form.addEventListener('submit', resolvePlan);

const shareInput = document.querySelector('#vegetarian-share');
shareInput.addEventListener('input', () => {
  document.querySelector('#vegetarian-share-value').value = `${Math.round(Number(shareInput.value) * 100)}%`;
});

async function loadTemplates() {
  try {
    [state.templates, state.meals] = await Promise.all([
      fetchJson('/api/templates'),
      fetchJson('/api/meals')
    ]);
    templateSelect.innerHTML = state.templates
      .map(template => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name)}</option>`)
      .join('');
    templateSelect.disabled = false;
    const preferred = state.templates.find(template => template.id === 'business-apero');
    if (preferred) templateSelect.value = preferred.id;
    renderRequiredMeals();
    applyTemplate();
    addInventoryRow({ concept: 'mini-spinach-quiche', amount: 40, unit: 'piece' });
  } catch (error) {
    showError(`Could not load the catalog. ${error.message}`);
  }
}

function renderRequiredMeals() {
  const selectedIds = [...state.requiredMealIds].sort();
  requiredMealSelect.innerHTML = [
    '<option value="">Add a guaranteed meal…</option>',
    ...state.meals
      .filter(meal => !state.requiredMealIds.has(meal.id))
      .map(meal => `<option value="${escapeHtml(meal.id)}">${escapeHtml(meal.name)}</option>`)
  ].join('');
  requiredMealSelect.disabled = !state.meals.length;

  requiredMealChips.innerHTML = selectedIds.length
    ? selectedIds.map(id => {
        const meal = state.meals.find(item => item.id === id);
        return `<span class="required-meal-chip">${escapeHtml(meal?.name || id)}<button type="button" data-meal-id="${escapeHtml(id)}" aria-label="Remove ${escapeHtml(meal?.name || id)}">×</button></span>`;
      }).join('')
    : '<span class="no-required-meals">No guaranteed meals selected.</span>';

  requiredMealChips.querySelectorAll('button[data-meal-id]').forEach(button => {
    button.addEventListener('click', () => {
      state.requiredMealIds.delete(button.dataset.mealId);
      renderRequiredMeals();
    });
  });
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
  document.querySelector('#weights').innerHTML = Object.entries(weights).map(([key, value]) => `
    <label class="weight">
      <span class="weight-header"><strong>${escapeHtml(weightLabels[key] || key)}</strong><output>${Math.round(value * 100)}%</output></span>
      <input class="weight-input" data-key="${escapeHtml(key)}" type="range" min="0" max="1" step="0.05" value="${value}">
    </label>
  `).join('');
  document.querySelectorAll('.weight-input').forEach(input => {
    input.addEventListener('input', () => {
      input.closest('.weight').querySelector('output').value = `${Math.round(Number(input.value) * 100)}%`;
    });
  });
}

function addInventoryRow(item = { concept: '', amount: '', unit: 'piece' }) {
  inventoryRows.querySelector('.empty-row')?.remove();
  const row = document.createElement('div');
  row.className = 'inventory-row';
  row.innerHTML = `
    <input class="inventory-concept" aria-label="Inventory concept" placeholder="e.g. water" value="${escapeHtml(item.concept)}">
    <input class="inventory-amount" aria-label="Inventory amount" type="number" min="0" step="0.1" placeholder="0" value="${escapeHtml(item.amount)}">
    <select class="inventory-unit" aria-label="Inventory unit">
      ${['piece', 'g', 'kg', 'liter', 'ml', 'cup', 'bottle'].map(unit =>
        `<option value="${unit}" ${item.unit === unit ? 'selected' : ''}>${unit}</option>`
      ).join('')}
    </select>
    <button class="remove-inventory" type="button" aria-label="Remove inventory item">×</button>
  `;
  row.querySelector('.remove-inventory').addEventListener('click', () => {
    row.remove();
    if (!inventoryRows.children.length) inventoryRows.innerHTML = '<p class="empty-row">No existing stock added.</p>';
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
  const dietary = document.querySelector('#dietary-constraint').value;
  const shareVisible = !document.querySelector('#vegetarian-share-field').hidden;
  const servingsValue = document.querySelector('#servings-per-guest').value;

  const request = {
    templateId: templateSelect.value,
    guestCount: Number(document.querySelector('#guest-count').value),
    budget: Number(document.querySelector('#budget').value),
    servingsPerGuest: servingsValue === '' ? null : Number(servingsValue),
    requiredMealIds: [...state.requiredMealIds].sort(),
    weights,
    preferences: {
      vegetarianShare: shareVisible ? Number(shareInput.value) : null,
      preferredCapabilities: document.querySelector('#prepare-ahead').checked ? ['prepare-ahead'] : []
    },
    availableInventory,
    hardConstraints: {
      requiredCapabilities: dietary ? [dietary] : [],
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
  renderWarnings(plan.warnings);
  renderTotals(plan.totals);
  renderMeals(plan.selectedMeals, new Set(plan.event.requiredMealIds || []));
  renderShoppingItems(plan.shoppingItems);
  renderInventory(plan.usedExistingInventory);
  renderTrace(plan.fulfilledRequirements);
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

function renderMeals(meals, requiredMealIds) {
  document.querySelector('#selected-meals').innerHTML = meals.map(meal => `
    <article class="meal-card">
      <div class="meal-top">
        <div><h4>${escapeHtml(meal.name)}</h4><span class="requirement">${escapeHtml(humanize(meal.requirementId))}</span>${requiredMealIds.has(meal.mealId) ? '<br><span class="guaranteed-badge">Guaranteed</span>' : ''}</div>
        <span class="score" title="Weighted score">${Math.round(meal.finalWeightedScore * 100)}</span>
      </div>
      <div class="chips">${meal.matchedCapabilities.map(capability => `<span class="chip">${escapeHtml(capability)}</span>`).join('')}</div>
      <div class="meal-meta"><span>${meal.servings} servings</span><span>${quantity(meal.targetQuantity)} target</span></div>
      <details class="score-details">
        <summary>Score components</summary>
        <div class="score-components">${Object.entries(meal.scoreComponents).map(([key, value]) =>
          `<span><i>${escapeHtml(weightLabels[key] || key)}</i><b>${Math.round(value * 100)}</b></span>`
        ).join('')}</div>
      </details>
    </article>
  `).join('');
}

function renderShoppingItems(items) {
  document.querySelector('#shopping-items').innerHTML = items.map(item => `
    <tr>
      <td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.sku)} · ${quantity(item.packageSize)} / pack</small></td>
      <td>${quantity(item.requiredQuantity)}</td>
      <td>${item.inventoryUsed.amount ? quantity(item.inventoryUsed) : '—'}</td>
      <td class="${item.packageCount === 0 ? 'covered' : ''}">${item.packageCount === 0 ? 'Covered' : item.packageCount}</td>
      <td>${quantity(item.purchasedQuantity)}</td>
      <td>${item.overbuyQuantity.amount ? quantity(item.overbuyQuantity) : '—'}</td>
      <td><strong>${formatMoney(item.lineTotal.amount)}</strong></td>
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
      <span>${escapeHtml(item.selectedCandidateName || 'Not fulfilled')} · ${quantity(item.targetQuantity)} · ${item.matchedCapabilities.map(escapeHtml).join(', ')}</span>
    </div>
  `).join('');
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
function quantity(value) { return `${Number(value.amount).toLocaleString('de-CH', { maximumFractionDigits: 3 })} ${value.unit}`; }
function humanize(value) { return value.replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase()); }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

loadTemplates();
