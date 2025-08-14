# Firecrawl Docker Setup

This is a properly configured Firecrawl instance that produces high-quality markdown output from PDFs and web pages.

## Quick Start

1. **Get Required API Keys**:
   - **LlamaParse API Key** (REQUIRED for PDF quality): https://cloud.llamaindex.ai/api-key
   - OpenAI API Key (optional but recommended): https://platform.openai.com/api-keys

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env and add your LLAMAPARSE_API_KEY at minimum
   ```

3. **Start Firecrawl**:
   ```bash
   docker-compose up -d
   ```

4. **Verify it's running**:
   ```bash
   curl -X POST http://localhost:3002/v1/scrape \
     -H "Content-Type: application/json" \
     -d '{"url": "https://example.com", "formats": ["markdown"]}'
   ```

## Why This Setup?

Your previous Firecrawl instance was missing the `LLAMAPARSE_API_KEY`, which caused:
- Poor markdown formatting (no headers, tables, or lists)
- "NaN" artifacts in output
- Bullet points rendered as ● instead of markdown syntax

With LlamaParse API key configured, you'll get:
- Proper markdown headers (#, ##, ###)
- Correctly formatted tables
- Clean markdown lists
- No artifacts or formatting issues

## Architecture

This setup includes:
- **API Service**: Main Firecrawl API (port 3002)
- **Worker Service**: Background job processing
- **Playwright Service**: Browser automation for JavaScript rendering
- **Redis**: Queue management and caching

## Troubleshooting

If you still get poor quality output:
1. Check that LLAMAPARSE_API_KEY is set correctly
2. Ensure all services are running: `docker-compose ps`
3. Check logs: `docker-compose logs -f`

## Stopping the Old Instance

Before starting this new instance, stop the old one:
```bash
docker ps  # Find the old container
docker stop [old-container-id]
```