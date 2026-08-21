#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "Reseeding catering database..."
docker compose --project-directory "${PROJECT_DIR}" exec -T mongodb \
  mongosh catering < "${PROJECT_DIR}/mongo/seed.js"
echo "Done."
