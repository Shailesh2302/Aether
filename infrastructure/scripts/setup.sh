#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== Aether Setup Script ==="
echo "Project root: $PROJECT_ROOT"

check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "Error: Docker is not installed"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        echo "Error: Docker Compose is not installed"
        exit 1
    fi

    echo "Docker version: $(docker --version)"
    echo "Docker Compose version: $(docker-compose --version)"
}

check_requirements() {
    echo "Checking requirements..."

    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        echo "Warning: .env file not found. Creating from template..."
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env" 2>/dev/null || true
    fi
}

create_directories() {
    echo "Creating directories..."
    mkdir -p "$PROJECT_ROOT/data/postgres"
    mkdir -p "$PROJECT_ROOT/data/redis"
    mkdir -p "$PROJECT_ROOT/data/qdrant"
    mkdir -p "$PROJECT_ROOT/logs"
}

pull_images() {
    echo "Pulling Docker images..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" pull
}

start_services() {
    echo "Starting services..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" up -d

    echo "Waiting for services to be ready..."
    sleep 10

    check_services
}

check_services() {
    echo "Checking services health..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f "$PROJECT_ROOT/docker-compose.yml" ps | grep -q "Up"; then
            echo "Services are running"
            return 0
        fi
        echo "Waiting for services... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done

    echo "Warning: Some services may not be ready"
}

show_status() {
    echo ""
    echo "=== Services Status ==="
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" ps

    echo ""
    echo "=== Setup Complete ==="
    echo "Services available at:"
    echo "  - Frontend: http://localhost"
    echo "  - API: http://localhost/api"
    echo "  - Prometheus: http://localhost:9090"
    echo "  - Grafana: http://localhost:3001"
}

main() {
    check_docker
    check_requirements
    create_directories
    pull_images
    start_services
    show_status
}

main "$@"