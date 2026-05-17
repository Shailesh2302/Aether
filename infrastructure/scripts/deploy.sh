#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ENVIRONMENT="${1:-development}"
REGISTRY="${REGISTRY:-omnimind}"
VERSION="${VERSION:-latest}"

echo "=== OmniMind Deploy Script ==="
echo "Environment: $ENVIRONMENT"
echo "Version: $VERSION"

build_images() {
    echo "Building Docker images..."

    docker build -t "$REGISTRY/backend:$VERSION" "$PROJECT_ROOT/backend"
    docker build -t "$REGISTRY/frontend:$VERSION" "$PROJECT_ROOT/frontend"
}

tag_images() {
    echo "Tagging images..."

    docker tag "$REGISTRY/backend:$VERSION" "$REGISTRY/backend:latest"
    docker tag "$REGISTRY/frontend:$VERSION" "$REGISTRY/frontend:latest"
}

push_images() {
    echo "Pushing images to registry..."

    docker push "$REGISTRY/backend:$VERSION"
    docker push "$REGISTRY/frontend:$VERSION"
    docker push "$REGISTRY/backend:latest"
    docker push "$REGISTRY/frontend:latest"
}

deploy_services() {
    echo "Deploying services..."

    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" down
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" up -d --build
}

health_check() {
    echo "Performing health checks..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        local status
        status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health 2>/dev/null)

        if [ "$status" = "200" ]; then
            echo "Health check passed"
            return 0
        fi

        echo "Waiting for health... (attempt $attempt/$max_attempts)"
        sleep 5
        ((attempt++))
    done

    echo "Warning: Health check did not pass"
    return 1
}

rollback() {
    echo "Rolling back to previous version..."

    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" down
    docker tag "$REGISTRY/backend:previous" "$REGISTRY/backend:$VERSION"
    docker tag "$REGISTRY/frontend:previous" "$REGISTRY/frontend:$VERSION"
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" up -d
}

show_logs() {
    echo ""
    echo "=== Service Logs ==="
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" logs --tail=50
}

main() {
    case "$ENVIRONMENT" in
        development)
            build_images
            deploy_services
            health_check
            show_logs
            ;;
        production)
            build_images
            tag_images
            push_images
            deploy_services
            health_check
            show_logs
            ;;
        rollback)
            rollback
            ;;
        *)
            echo "Usage: $0 {development|production|rollback}"
            exit 1
            ;;
    esac
}

main "$@"