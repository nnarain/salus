#!/bin/bash
set -e

# This script runs the application migrations

echo "Running application migrations..."

for migration in /migrations/*.sql; do
  if [ -f "$migration" ]; then
    echo "Running migration: $(basename $migration)"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$migration"
  fi
done

echo "All migrations completed!"
