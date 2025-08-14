# Search API and Vector Database Integration Analysis

## Issue Summary

The search results are returning citations that don't match the actual document content due to several critical data integrity issues in the vector database and document storage system.

## Root Causes Identified

### 1. **Orphaned Vector Data**
- **Problem**: The ChromaDB vector database contains 4 unique document IDs, but only 2 documents exist in the PostgreSQL database
- **Orphaned Document IDs**: `cmd1c6o2200148cfkgbi9zep2`, `cmd1p0aq900028c35e1ld86mi`
- **Impact**: Search results are pulling chunks from deleted documents, creating citations that reference non-existent content

### 2. **Content Mismatch Between Vector DB and Database**
- **Problem**: Vector chunks contain different content than what's stored in the database
- **Example**: Vector chunk shows "licensing. 14. The presence or absence of any tax benefits to the limited partner..." but this content doesn't exist in the current database document
- **Impact**: Citations display text that users cannot find when viewing the actual document

### 3. **Missing Metadata in Vector Database**
- **Problem**: Vector entries have `title: undefined` in metadata
- **Impact**: Citations cannot properly display document titles, making them less useful for users

### 4. **Stale Vector Database State**
- **Problem**: The vector database appears to contain data from previous document versions or deleted documents
- **Impact**: Search results include outdated information that no longer corresponds to current documents

## Technical Flow Analysis

### Current Data Flow:
1. **Document Upload** (`document-service.ts`):
   - Extracts text from PDF
   - Chunks text into 1000-character segments
   - Stores full content in PostgreSQL `Document.content`
   - Creates vector embeddings for each chunk in ChromaDB
   - Stores chunks with metadata: `{documentId, title, state, categoryId, chunkIndex, totalChunks}`

2. **Search Process** (`search-service.ts`):
   - Queries ChromaDB for relevant chunks
   - Extracts document metadata from vector results
   - Verifies document existence in PostgreSQL (lines 165-173)
   - Filters out chunks from non-existent documents (line 176)
   - Generates citations from vector chunk content
   - **BUT**: Citations use vector chunk text, not database content

3. **Document Retrieval** (`/api/documents/[id]/text/route.ts`):
   - Returns content directly from PostgreSQL `Document.content` field
   - This content may differ from what's stored in vector chunks

## Specific Code Issues

### In `search-service.ts`:

1. **Line 183**: `extractRelevantText(chunk, answer)` extracts text from vector chunks, not database content
2. **Lines 165-176**: Document existence check is good, but doesn't verify content consistency
3. **Line 196-208**: Fallback citation creation still uses vector chunk content
4. **Missing**: No verification that vector chunk content matches database content

### In `chroma.ts`:

1. **Lines 81-86**: Vector storage works correctly
2. **Missing**: No mechanism to update existing chunks when document content changes
3. **Missing**: No cleanup of orphaned chunks when documents are deleted

### In `document-service.ts`:

1. **Lines 219-230**: Delete operation attempts to clean vector DB but may not catch all chunks
2. **Lines 148-150**: Only stores first chunk ID as `vectorId`, but document has many chunks
3. **Missing**: No mechanism to update vector DB when document content is modified

## Data Integrity Problems

1. **Orphaned Vectors**: 2 out of 4 document IDs in vector DB don't exist in database
2. **Content Drift**: Vector chunks contain content that doesn't match current database documents
3. **Metadata Loss**: Vector metadata missing critical information like document titles
4. **No Synchronization**: No mechanism to keep vector DB and database content in sync

## Recommended Solutions

### 1. **Immediate Fix - Clean Vector Database**
```typescript
// Create cleanup script to remove orphaned vectors
async function cleanupOrphanedVectors() {
  const validDocIds = await prisma.document.findMany({ select: { id: true } })
  const validIds = new Set(validDocIds.map(d => d.id))
  
  // Remove vectors for non-existent documents
  // Implement in vector DB cleanup script
}
```

### 2. **Fix Citation Content Source**
```typescript
// In search-service.ts, line 183
// Instead of using vector chunk content, fetch from database:
const dbDocument = await prisma.document.findUnique({
  where: { id: chunk.documentId },
  select: { content: true }
})
const relevantText = extractRelevantTextFromDatabase(dbDocument.content, answer, chunk.chunkIndex)
```

### 3. **Add Content Consistency Verification**
```typescript
// Add verification step in search process
const verifyChunkConsistency = async (chunk, documentId) => {
  const dbDoc = await prisma.document.findUnique({ where: { id: documentId } })
  return dbDoc?.content?.includes(chunk.text.substring(0, 100))
}
```

### 4. **Improve Vector Metadata**
```typescript
// In document-service.ts, lines 116-123
metadata: {
  documentId: document.id,
  title: upload.title,
  state: upload.state,
  categoryId: upload.categoryId,
  chunkIndex: i,
  totalChunks: chunks.length,
  chunkStartIndex: i * 1000, // Add position tracking
  contentHash: hashChunk(chunk) // Add content verification
}
```

### 5. **Implement Vector DB Synchronization**
- Add document update handlers to refresh vector chunks
- Implement periodic consistency checks
- Add vector DB versioning to track content changes

## Files Affected

1. `/lib/services/search-service.ts` - Main search logic
2. `/lib/vector-db/chroma.ts` - Vector database interface
3. `/lib/services/document-service.ts` - Document processing and storage
4. `/app/api/search/route.ts` - Search API endpoint
5. `/app/api/documents/[id]/text/route.ts` - Document content retrieval

## Priority Actions

1. **High Priority**: Clean orphaned vector data
2. **High Priority**: Fix citation content to use database source
3. **Medium Priority**: Add content consistency verification
4. **Medium Priority**: Improve vector metadata
5. **Low Priority**: Implement full synchronization system

The core issue is that the vector database has become out of sync with the main database, causing search results to reference content that no longer exists or differs from the current document content.