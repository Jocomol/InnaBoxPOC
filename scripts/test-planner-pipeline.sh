#!/usr/bin/env bash

set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:8080}"
TEST_TMP_DIR="$(mktemp -d)"
trap 'rm -rf -- "${TEST_TMP_DIR}"' EXIT

for command in curl jq; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    echo "Required command not found: ${command}" >&2
    exit 1
  fi
done

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

resolve_plan() {
  local name="$1"
  local payload="$2"
  local expected_status="${3:-200}"
  local output_file="${TEST_TMP_DIR}/${name}.json"
  local status

  status="$(curl --silent --show-error --max-time 30 \
    --output "${output_file}" \
    --write-out '%{http_code}' \
    --header 'Content-Type: application/json' \
    --data "${payload}" \
    "${API_BASE_URL}/api/plans/resolve")"
  if [[ "${status}" != "${expected_status}" ]]; then
    jq . "${output_file}" >&2 2>/dev/null || true
    fail "${name}: expected HTTP ${expected_status}, received ${status}"
  fi
  echo "${output_file}"
}

capability_servings() {
  local plan_file="$1"
  local capability="$2"
  jq --arg capability "${capability}" --slurpfile catalog "${TEST_TMP_DIR}/meals.json" '
    [
      .selectedMeals[] as $selected
      | $catalog[0][]
      | select(.id == $selected.mealId)
      | select(.capabilities | index($capability))
      | $selected.servings
    ]
    | add // 0
  ' "${plan_file}"
}

echo "Checking seeded catalog through ${API_BASE_URL}..."
curl --silent --show-error --fail --max-time 15 \
  "${API_BASE_URL}/api/meals" > "${TEST_TMP_DIR}/meals.json"
jq -e 'length >= 19' "${TEST_TMP_DIR}/meals.json" >/dev/null ||
  fail "seeded meal catalog is unavailable or incomplete"

two_meals="$(resolve_plan two-meals '{
  "templateId": "business-apero",
  "guestCount": 100,
  "budget": 10000,
  "servingsPerGuest": 4,
  "mealCount": 2
}')"
five_meals="$(resolve_plan five-meals '{
  "templateId": "business-apero",
  "guestCount": 100,
  "budget": 10000,
  "servingsPerGuest": 4,
  "mealCount": 5,
  "capabilityShares": {
    "vegetarian": 0.30,
    "vegan": 0.20
  }
}')"

jq -e '.selectedMeals | length == 5' "${five_meals}" >/dev/null ||
  fail "mealCount=5 did not select five meals"
jq -e '[.selectedMeals[].mealId] | length == (unique | length)' "${five_meals}" >/dev/null ||
  fail "selected meal IDs are not distinct"
jq -e '[.selectedMeals[].servings] | add == 400' "${two_meals}" >/dev/null ||
  fail "mealCount=2 did not preserve 400 total servings"
jq -e '[.selectedMeals[].servings] | add == 400' "${five_meals}" >/dev/null ||
  fail "mealCount=5 multiplied or lost total servings"

vegetarian_snack_servings="$(capability_servings "${five_meals}" vegetarian)"
vegan_snack_servings="$(capability_servings "${five_meals}" vegan)"
(( vegetarian_snack_servings >= 120 )) ||
  fail "snack plan provides ${vegetarian_snack_servings}, expected at least 120 vegetarian servings"
(( vegan_snack_servings >= 80 )) ||
  fail "snack plan provides ${vegan_snack_servings}, expected at least 80 vegan servings"
jq -e --slurpfile catalog "${TEST_TMP_DIR}/meals.json" '
  any(
    .selectedMeals[] as $selected
    | $catalog[0][]
    | select(.id == $selected.mealId);
    (.capabilities | index("vegan")) and (.capabilities | index("vegetarian"))
  )
' "${five_meals}" >/dev/null || fail "no selected meal demonstrates overlapping vegan and vegetarian capabilities"

meal_like="$(resolve_plan meal-like '{
  "templateId": "business-apero",
  "guestCount": 100,
  "budget": 10000,
  "servingsPerGuest": 1,
  "mealCount": 2,
  "capabilityShares": {"vegetarian": 0.30}
}')"
vegetarian_meal_servings="$(capability_servings "${meal_like}" vegetarian)"
jq -e '[.selectedMeals[].servings] | add == 100' "${meal_like}" >/dev/null ||
  fail "meal-like plan did not preserve 100 total servings"
(( vegetarian_meal_servings >= 30 )) ||
  fail "meal-like plan provides ${vegetarian_meal_servings}, expected at least 30 vegetarian servings"

unavailable_capability="pipeline-test-capability-not-in-seed"
snack_shortfall="$(resolve_plan snack-shortfall "{
  \"templateId\": \"business-apero\",
  \"guestCount\": 100,
  \"budget\": 10000,
  \"servingsPerGuest\": 4,
  \"mealCount\": 5,
  \"capabilityShares\": {\"${unavailable_capability}\": 0.20}
}")"
jq -e --arg capability "${unavailable_capability}" '
  any(.warnings[]; contains($capability) and contains("80 of 400"))
' "${snack_shortfall}" >/dev/null || fail "snack capability shortfall was not exposed as a warning"

meal_shortfall="$(resolve_plan meal-shortfall "{
  \"templateId\": \"business-apero\",
  \"guestCount\": 100,
  \"budget\": 10000,
  \"servingsPerGuest\": 1,
  \"mealCount\": 2,
  \"capabilityShares\": {\"${unavailable_capability}\": 0.20}
}" 422)"
jq -e --arg capability "${unavailable_capability}" '
  .title == "Plan cannot be resolved" and (.detail | contains($capability))
' "${meal_shortfall}" >/dev/null || fail "meal-like capability shortfall was not returned as a planning failure"

backwards_compatible="$(resolve_plan backwards-compatible '{
  "templateId": "business-apero",
  "guestCount": 40,
  "budget": 800
}')"
jq -e '.selectedMeals | length > 0' "${backwards_compatible}" >/dev/null ||
  fail "legacy request no longer resolves"

echo "PASS: planner pipeline seed checks"
echo "  - distinct meal counts: 2 and 5"
echo "  - total serving preservation: 400"
echo "  - meal-like vegetarian servings: ${vegetarian_meal_servings}/100"
echo "  - snack vegetarian servings: ${vegetarian_snack_servings}/400"
echo "  - snack vegan servings: ${vegan_snack_servings}/400"
echo "  - impossible capability warning/failure behavior"
echo "  - legacy request compatibility"
