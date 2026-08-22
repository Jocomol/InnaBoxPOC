#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
API_BASE_URL="${API_BASE_URL:-http://localhost:8080}"
SCENARIOS_FILE="${SCENARIOS_FILE:-${PROJECT_DIR}/specdrive/pipeline/pipeline_weighting_test_scenarios.json}"
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

dietary_servings() {
  local plan_file="$1"
  local capability="$2"
  jq --arg capability "${capability}" --slurpfile catalog "${TEST_TMP_DIR}/meals.json" '
    [
      .selectedMeals[] as $selected
      | $catalog[0][]
      | select(.id == $selected.mealId)
      | select(.dietaryCapabilities | index($capability))
      | $selected.servings
    ]
    | add // 0
  ' "${plan_file}"
}

[[ -f "${SCENARIOS_FILE}" ]] || fail "scenario file not found: ${SCENARIOS_FILE}"
jq -e '.scenarios | length == 8' "${SCENARIOS_FILE}" >/dev/null ||
  fail "expected exactly eight weighting scenarios"

curl --silent --show-error --fail --max-time 30 \
  "${API_BASE_URL}/api/meals" > "${TEST_TMP_DIR}/meals.json"

jq -c '.scenarios[]' "${SCENARIOS_FILE}" | while IFS= read -r scenario; do
  scenario_id="$(jq -r '.id' <<< "${scenario}")"
  request="$(jq -c '.request' <<< "${scenario}")"
  expected_status="$(jq -r '.expect.status' <<< "${scenario}")"
  response_file="${TEST_TMP_DIR}/${scenario_id}.json"
  actual_status="$(curl --silent --show-error --max-time 30 \
    --output "${response_file}" \
    --write-out '%{http_code}' \
    --header 'Content-Type: application/json' \
    --data "${request}" \
    "${API_BASE_URL}/api/plans/resolve")"

  if [[ "${actual_status}" != "${expected_status}" ]]; then
    jq . "${response_file}" >&2 2>/dev/null || true
    fail "${scenario_id}: expected HTTP ${expected_status}, received ${actual_status}"
  fi

  selected_count="$(jq -r '.expect.selectedMealCount // empty' <<< "${scenario}")"
  if [[ -n "${selected_count}" ]]; then
    jq -e --argjson expected "${selected_count}" '.selectedMeals | length == $expected' "${response_file}" >/dev/null ||
      fail "${scenario_id}: selected meal count differs from ${selected_count}"
  fi

  selected_ids="$(jq -c '.expect.selectedMealIds // empty' <<< "${scenario}")"
  if [[ -n "${selected_ids}" ]]; then
    jq -e --argjson expected "${selected_ids}" '[.selectedMeals[].mealId] == $expected' "${response_file}" >/dev/null ||
      fail "${scenario_id}: selected meal IDs differ from ${selected_ids}"
  fi

  total_servings="$(jq -r '.expect.totalMealServings // empty' <<< "${scenario}")"
  if [[ -n "${total_servings}" ]]; then
    jq -e --argjson expected "${total_servings}" '[.selectedMeals[].servings] | add == $expected' "${response_file}" >/dev/null ||
      fail "${scenario_id}: total meal servings differ from ${total_servings}"
  fi

  expected_score="$(jq -r '.expect.selectedMealFinalWeightedScore // empty' <<< "${scenario}")"
  if [[ -n "${expected_score}" ]]; then
    jq -e --argjson expected "${expected_score}" '
      (.selectedMeals | length == 1) and
      ((.selectedMeals[0].finalWeightedScore - $expected) | abs < 0.0000001)
    ' "${response_file}" >/dev/null || fail "${scenario_id}: final weighted score differs from ${expected_score}"
  fi

  expected_weights="$(jq -c '.expect.appliedWeights // empty' <<< "${scenario}")"
  if [[ -n "${expected_weights}" ]]; then
    jq -e --argjson expected "${expected_weights}" '.event.appliedWeights == $expected' "${response_file}" >/dev/null ||
      fail "${scenario_id}: normalized applied weights differ from ${expected_weights}"
  fi

  while IFS=$'\t' read -r capability minimum; do
    [[ -n "${capability}" ]] || continue
    provided="$(dietary_servings "${response_file}" "${capability}")"
    (( provided >= minimum )) ||
      fail "${scenario_id}: ${capability} provides ${provided} servings, expected at least ${minimum}"
  done < <(jq -r '.expect.minimumDietaryServings // {} | to_entries[] | [.key, .value] | @tsv' <<< "${scenario}")

  if jq -e '.expect.allAutomaticallySelectedMealsMustMatchAtLeastOneTemplateMealRequirement == true' <<< "${scenario}" >/dev/null; then
    required_capabilities="$(jq -c '.expect.requiredMealCapabilitiesForThisTemplate' <<< "${scenario}")"
    jq -e --argjson required "${required_capabilities}" --slurpfile catalog "${TEST_TMP_DIR}/meals.json" '
      [.selectedMeals[].mealId] as $selectedIds
      | all(
          $selectedIds[];
          . as $mealId
          | ($catalog[0][] | select(.id == $mealId) | .capabilities) as $capabilities
          | all($required[]; . as $requiredCapability | $capabilities | index($requiredCapability) != null)
        )
    ' "${response_file}" >/dev/null || fail "${scenario_id}: selected an event-incompatible meal"
  fi

  if jq -e '.expect.noDietaryShortfallWarning == true' <<< "${scenario}" >/dev/null; then
    jq -e 'all(.warnings[]; (startswith("Dietary capability") | not))' "${response_file}" >/dev/null ||
      fail "${scenario_id}: returned an unexpected dietary-share warning"
  fi

  product_expectation="$(jq -c '.expect.productForRequirement // empty' <<< "${scenario}")"
  if [[ -n "${product_expectation}" ]]; then
    jq -e --argjson expected "${product_expectation}" '
      any(
        .fulfilledRequirements[];
        .requirementId == $expected.requirementId and .selectedCandidateId == $expected.productId
      )
    ' "${response_file}" >/dev/null || fail "${scenario_id}: direct product selection differs from ${product_expectation}"
  fi

  meal_summary="$(jq -c '[.selectedMeals[] | {id: .mealId, servings, score: .finalWeightedScore}]' "${response_file}")"
  weight_summary="$(jq -c '.event.appliedWeights' "${response_file}")"
  warning_summary="$(jq -c '.warnings' "${response_file}")"
  product_summary="$(jq -c '[.fulfilledRequirements[] | select(.type == "product") | {requirement: .requirementId, product: .selectedCandidateId}]' "${response_file}")"
  capability_summary="$(
    jq -r '.request.dietaryShares // {} | keys[]' <<< "${scenario}" |
      while IFS= read -r capability; do
        printf '%s=%s ' "${capability}" "$(dietary_servings "${response_file}" "${capability}")"
      done
  )"

  echo "PASS ${scenario_id}"
  echo "  meals=${meal_summary}"
  echo "  dietaryServings=${capability_summary:-none}"
  echo "  products=${product_summary}"
  echo "  appliedWeights=${weight_summary}"
  echo "  warnings=${warning_summary}"
done

echo "PASS: all eight pipeline weighting scenarios"
