#!/bin/bash
# Script to validate Docker Compose setup
# This is for testing purposes only

set -e

echo "🚀 Testing Docker Compose configuration..."

# Check if docker and docker compose are available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed"
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"

# Validate docker-compose.yml syntax
echo "📝 Validating docker-compose.yml..."
if docker compose config --quiet; then
    echo "✅ docker-compose.yml is valid"
else
    echo "❌ docker-compose.yml has errors"
    exit 1
fi

# Validate docker-compose.dev.yml syntax
echo "📝 Validating docker-compose.dev.yml..."
if docker compose -f docker-compose.dev.yml config --quiet; then
    echo "✅ docker-compose.dev.yml is valid"
else
    echo "❌ docker-compose.dev.yml has errors"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.docker.example..."
    cp .env.docker.example .env
    echo "✅ .env file created"
else
    echo "✅ .env file exists"
fi

# Check if required directories exist
echo "📂 Checking required directories..."
for dir in docker/init supabase/migrations; do
    if [ -d "$dir" ]; then
        echo "✅ $dir exists"
    else
        echo "❌ $dir is missing"
        exit 1
    fi
done

# Check if required files exist
echo "📄 Checking required files..."
for file in Dockerfile; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file is missing"
        exit 1
    fi
done

echo ""
echo "✅ All validation checks passed!"
echo ""
echo "📚 Next steps:"
echo "  1. Run 'docker compose up -d' to start all services"
echo "  2. Access the app at http://localhost:3000"
echo "  3. Access PostgREST API at http://localhost:3001"
echo ""
echo "For development, you can use:"
echo "  docker compose up -d db rest  # Start backend only"
echo "  npm run dev                    # Run Next.js locally"
echo ""
