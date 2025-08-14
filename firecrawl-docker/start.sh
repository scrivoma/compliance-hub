#!/bin/bash

# Firecrawl Startup Script

echo "🔥 Starting Firecrawl with high-quality PDF parsing..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy .env.example to .env and add your API keys"
    echo "Run: cp .env.example .env"
    exit 1
fi

# Check if LLAMAPARSE_API_KEY is set
if ! grep -q "LLAMAPARSE_API_KEY=." .env; then
    echo "⚠️  Warning: LLAMAPARSE_API_KEY not set in .env"
    echo "PDF parsing quality will be poor without this key!"
    echo "Get your key from: https://cloud.llamaindex.ai/api-key"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Start the services
echo "🚀 Starting Docker containers..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Test the API
echo "🧪 Testing Firecrawl API..."
response=$(curl -s -X POST http://localhost:3002/v1/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "formats": ["markdown"]}')

if echo "$response" | grep -q "success.*true"; then
    echo "✅ Firecrawl is running successfully!"
    echo "🌐 API available at: http://localhost:3002"
    echo ""
    echo "📝 To view logs: docker-compose logs -f"
    echo "🛑 To stop: docker-compose down"
else
    echo "❌ Firecrawl API test failed!"
    echo "Check logs with: docker-compose logs"
    exit 1
fi