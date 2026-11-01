#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if ! command -v docker > /dev/null 2>&1; then
    printf 'Docker is not installed or not available in this environment.\n' >&2
    exit 1
fi

docker compose version > /dev/null
docker compose config --quiet
docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet

for path in Dockerfile scripts/migrate.mjs db/migrations; do
    if [[ ! -e "$path" ]]; then
        printf 'Required deployment path is missing: %s\n' "$path" >&2
        exit 1
    fi
done

printf 'Production and development Compose configurations are valid.\n'
printf 'Start with: docker compose up --build -d\n'
