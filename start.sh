#!/bin/bash

# Health Tracker Quick Start Script

echo "🏥 Health Tracker - Quick Start"
echo "================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    echo "⚠️  No .env file found. Copying from .env.example..."
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env file"
    echo ""
    echo "📝 Please edit backend/.env and add your API keys:"
    echo "   - OPENAI_API_KEY (optional, for AI features)"
    echo "   - MEALIE_API_TOKEN (optional, for Mealie integration)"
    echo ""
fi

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ Created .env file"
fi

echo "🚀 Starting Health Tracker..."
echo ""

# Start Docker Compose
docker-compose up -d

echo ""
echo "✅ Health Tracker is starting!"
echo ""
echo "📊 Access the application at:"
echo "   Frontend: http://localhost"
echo "   Backend API: http://localhost:3000"
echo ""
echo "📋 Useful commands:"
echo "   View logs: docker-compose logs -f"
echo "   Stop: docker-compose down"
echo "   Restart: docker-compose restart"
echo ""
echo "⏳ Please wait a moment for all services to start..."
echo "   You can check status with: docker-compose ps"
