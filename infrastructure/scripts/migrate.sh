#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== Aether Database Migration ==="

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-aether}"
DB_USER="${DB_USER:-aether}"
DB_PASSWORD="${DB_PASSWORD:-aether_secret}"

export PGPASSWORD="$DB_PASSWORD"

run_migrations() {
    echo "Running database migrations..."

    local migrations_dir="$PROJECT_ROOT/backend/migrations"

    if [ ! -d "$migrations_dir" ]; then
        echo "Migrations directory not found: $migrations_dir"
        return 1
    fi

    local container_id
    container_id=$(docker ps -q --filter "ancestor=postgres:16-alpine" | head -n 1)

    if [ -z "$container_id" ]; then
        echo "Running migrations locally..."

        if command -v psql &> /dev/null; then
            for migration in "$migrations_dir"/*.sql; do
                if [ -f "$migration" ]; then
                    echo "Applying: $(basename "$migration")"
                    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration"
                fi
            done
        else
            echo "Error: psql not found and no PostgreSQL container running"
            exit 1
        fi
    else
        echo "Running migrations via Docker container..."

        docker exec -i "$container_id" psql -U "$DB_USER" -d "$DB_NAME" < "$migrations_dir/migrations.sql" 2>/dev/null || \
        docker exec -i "$container_id" sh -c 'psql -U aether -d aether' < "$migrations_dir/migrations.sql"
    fi

    echo "Migrations completed successfully"
}

verify_migrations() {
    echo "Verifying migrations..."

    local result
    result=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM schema_migrations;" 2>/dev/null) || true

    if [ -n "$result" ]; then
        echo "Schema migrations table exists"
    else
        echo "Creating schema_migrations table..."
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                version VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );"
    fi
}

rollback_migration() {
    local version="$1"
    if [ -z "$version" ]; then
        echo "Error: Version required for rollback"
        exit 1
    fi

    echo "Rolling back migration: $version"

    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        DELETE FROM schema_migrations WHERE version = '$version';"
}

show_status() {
    echo ""
    echo "=== Migration Status ==="
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT version, applied_at FROM schema_migrations ORDER BY applied_at DESC;" 2>/dev/null || true
}

main() {
    case "${1:-migrate}" in
        migrate)
            run_migrations
            verify_migrations
            show_status
            ;;
        rollback)
            rollback_migration "$2"
            ;;
        status)
            show_status
            ;;
        *)
            echo "Usage: $0 {migrate|rollback <version>|status}"
            exit 1
            ;;
    esac
}

main "$@"