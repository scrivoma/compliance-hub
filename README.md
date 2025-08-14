# Compliance Hub

AI-powered regulatory compliance document library for sports betting and online gaming.

## Features

- **AI Search**: Natural language search with citations linking to source documents
- **Document Library**: Browse and filter documents by state and category
- **Document Viewer**: View PDFs with highlighted relevant sections
- **User Authentication**: Secure login for compliance teams
- **Vector Search**: OpenAI embeddings with ChromaDB for semantic search

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Vector DB**: ChromaDB
- **AI Models**: Claude (Anthropic) for search, OpenAI for embeddings
- **Auth**: NextAuth.js
- **PDF Processing**: pdf.js

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. Set up database:
```bash
npx prisma migrate dev
```

4. Start ChromaDB:
```bash
docker run -p 8000:8000 chromadb/chroma
```

5. Run development server:
```bash
npm run dev
```

## Maintenance Scripts

### Vector Database Health Check

Check for orphaned vectors in ChromaDB that don't match documents in the database:

```bash
npx tsx check-vector-consistency.ts
```

This script will:
- Compare documents in the database with vector chunks in ChromaDB
- Identify any orphaned vectors from deleted documents
- Report consistency status and recommend cleanup if needed

### Clean Orphaned Vectors

If the health check finds orphaned vectors, clean them up with:

```bash
npx tsx clean-chromadb.ts
```

This script will:
- Remove vector chunks that don't correspond to existing documents
- Preserve all valid vectors for current documents
- Report cleanup progress and final statistics

### Reprocess Documents

Re-extract text and regenerate vector embeddings for all documents:

```bash
npx tsx scripts/reprocess-documents.ts
```

Use this when:
- Text extraction logic has been updated
- Vector embeddings need to be regenerated
- Document content appears inconsistent with search results