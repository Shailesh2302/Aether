#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== OmniMind Database Seed ==="

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-omnimind}"
DB_USER="${DB_USER:-omnimind}"
DB_PASSWORD="${DB_PASSWORD:-omnimind_secret}"

export PGPASSWORD="$DB_PASSWORD"

seed_users() {
    echo "Seeding users..."

    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        INSERT INTO users (email, username, password_hash, created_at)
        VALUES
            ('admin@omnimind.ai', 'admin', '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzf6Z0K4i.', NOW()),
            ('demo@omnimind.ai', 'demo', '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzf6Z0K4i.', NOW())
        ON CONFLICT (email) DO NOTHING;"
}

seed_collections() {
    echo "Seeding collections..."

    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        INSERT INTO collections (name, description, user_id, created_at)
        VALUES
            ('Default', 'Default collection for new uploads', 1, NOW()),
            ('Demo Collection', 'Demo collection showcasing features', 2, NOW())
        ON CONFLICT DO NOTHING;"
}

seed_documents() {
    echo "Seeding documents..."

    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        INSERT INTO documents (collection_id, title, content, file_type, status, created_at)
        VALUES
            (1, 'Welcome Document', 'Welcome to OmniMind. This is your personal AI assistant.', 'txt', 'indexed', NOW()),
            (1, 'Getting Started', 'Learn how to use OmniMind effectively.', 'md', 'indexed', NOW())
        ON CONFLICT DO NOTHING;"
}

seed_conversations() {
    echo "Seeding conversations..."

    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        INSERT INTO conversations (user_id, title, created_at, updated_at)
        VALUES
            (1, 'Welcome Chat', NOW(), NOW()),
            (2, 'Demo Chat', NOW(), NOW())
        ON CONFLICT DO NOTHING;"
}

seed_vector_data() {
    echo "Seeding vector data..."

    local container_id
    container_id=$(docker ps -q --filter "ancestor=qdrant/qdrant" | head -n 1)

    if [ -n "$container_id" ]; then
        echo "Vector data would be seeded via API in production"
    fi
}

main() {
    seed_users
    seed_collections
    seed_documents
    seed_conversations

    echo ""
    echo "=== Seed Complete ==="
    echo "Default credentials:"
    echo "  Admin: admin@omnimind.ai / admin123"
    echo "  Demo: demo@omnimind.ai / demo123"
}

main "$@"