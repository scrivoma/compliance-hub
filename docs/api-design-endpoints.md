# API Design & Endpoints Documentation

## Overview

The Compliance Hub API is a Next.js 14+ application using the App Router pattern with RESTful endpoints for document management, search, and compliance analysis. All API routes are located under `/app/api/` and use Next.js route handlers with TypeScript for type safety.

## Authentication & Security

### Authentication Mechanism
- **Type**: NextAuth.js with JWT strategy
- **Provider**: Credentials-based authentication
- **Session Management**: JWT tokens stored in HTTP-only cookies
- **Password Hashing**: bcrypt with salt rounds

### Protected Routes
The following routes require authentication via `getServerSession`:
- All document upload endpoints
- Document management (GET/DELETE)
- Search endpoints
- User-specific data endpoints
- Settings endpoints

### Middleware Protection
The `middleware.ts` file protects:
- `/dashboard/*`
- `/search/*`
- `/library/*`
- `/admin/*`
- `/api/documents/upload/*`
- `/api/search/*`

## API Endpoints

### 1. Authentication Endpoints

#### POST/GET `/api/auth/[...nextauth]`
NextAuth.js dynamic route handler for authentication operations.

**Supported Operations:**
- `POST /api/auth/signin` - User login
- `POST /api/auth/signout` - User logout
- `GET /api/auth/session` - Get current session

**Login Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Session Response:**
```json
{
  "user": {
    "id": "cuid_string",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER"
  },
  "expires": "2024-01-15T..."
}
```

**Error Responses:**
- `401` - Invalid credentials
- `400` - Missing email or password

### 2. Document Management Endpoints

#### GET `/api/documents`
Retrieve documents with optional filtering.

**Query Parameters:**
- `state` - Filter by state (e.g., "NY", "CA")
- `categoryId` - Filter by category ID
- `search` - Search documents by title

**Request Example:**
```bash
GET /api/documents?state=NY&search=licensing
```

**Response:**
```json
{
  "documents": [
    {
      "id": "cuid_string",
      "title": "Document Title",
      "description": "Description",
      "filePath": "filename.pdf",
      "fileSize": 1024000,
      "state": "NY",
      "categoryId": "cuid_string",
      "uploadedBy": "user_id",
      "processingStatus": "COMPLETED",
      "processingProgress": 100,
      "createdAt": "2024-01-01T...",
      "updatedAt": "2024-01-01T...",
      "category": {
        "id": "cuid_string",
        "name": "Category Name"
      }
    }
  ]
}
```

**Error Responses:**
- `401` - Unauthorized
- `500` - Database error

#### GET `/api/documents/v2`
Enhanced document retrieval with full relationship data.

**Response includes:**
- Document details
- Associated verticals with full details
- Associated document types with full details
- Category information

**Response:**
```json
{
  "documents": [
    {
      "id": "cuid_string",
      "title": "Document Title",
      "verticals": [
        {
          "id": "vertical_id",
          "vertical": {
            "id": "vertical_id",
            "name": "sports_betting",
            "displayName": "Sports Betting"
          }
        }
      ],
      "documentTypes": [
        {
          "id": "type_id",
          "documentType": {
            "id": "type_id",
            "name": "regulation",
            "displayName": "Regulation"
          }
        }
      ]
    }
  ]
}
```

#### DELETE `/api/documents`
Delete a document and its associated vector embeddings.

**Query Parameters:**
- `id` - Document ID (required)

**Request Example:**
```bash
DELETE /api/documents?id=cuid_string
```

**Response:**
```json
{
  "success": true
}
```

**Error Responses:**
- `400` - Missing document ID
- `404` - Document not found
- `401` - Unauthorized
- `500` - Deletion failed

#### POST `/api/documents/upload`
Upload a PDF document for processing.

**Request:** multipart/form-data
- `file` - PDF file (required, max 50MB)
- `title` - Document title (required)
- `description` - Document description (optional)
- `state` - State code (required)
- `categoryId` - Category ID (required)

**Features:**
- Automatic document tracking in new-documents API
- Background processing with status updates
- File validation and error handling

**Request Example:**
```bash
curl -X POST /api/documents/upload \
  -F "file=@document.pdf" \
  -F "title=My Document" \
  -F "description=Document description" \
  -F "state=NY" \
  -F "categoryId=category_id"
```

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "cuid_string",
    "title": "Document Title",
    "processingStatus": "EXTRACTING",
    "processingProgress": 0
  }
}
```

**Error Responses:**
- `400` - Invalid file type or missing required fields
- `413` - File too large (max 50MB)
- `401` - Unauthorized
- `500` - Upload failed

#### POST `/api/documents/upload-async`
Asynchronous document upload with background processing.

**Features:**
- Max file size: 200MB
- Returns immediately after file save
- Processing happens in background
- Automatic document tracking in new-documents API

**Request:** Same as `/api/documents/upload` but with higher file size limit

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "cuid_string",
    "title": "Document Title",
    "processingStatus": "UPLOADED"
  },
  "message": "Document uploaded successfully! Processing will continue in the background."
}
```

#### POST `/api/documents/upload-llamaindex`
Upload document using LlamaIndex processing for advanced citation extraction.

**Request:** multipart/form-data
- `file` - PDF file (required, max 200MB)
- `title` - Document title (required)
- `description` - Document description (optional)
- `state` - State code (required)
- `verticals` - JSON array of vertical IDs (required)
- `documentTypes` - JSON array of document type IDs (required)

**Features:**
- Advanced citation extraction with LlamaIndex
- Automatic document tracking in new-documents API
- Enhanced search capabilities with precise citations

**Request Example:**
```bash
curl -X POST /api/documents/upload-llamaindex \
  -F "file=@document.pdf" \
  -F "title=My Document" \
  -F "state=NY" \
  -F "verticals=[\"vertical_id_1\", \"vertical_id_2\"]" \
  -F "documentTypes=[\"type_id_1\"]"
```

**Response:**
```json
{
  "success": true,
  "documentId": "cuid_string",
  "chunksCreated": 45,
  "citationIds": ["citation_1", "citation_2", "citation_3"],
  "message": "Document processed successfully with 45 citation-ready chunks",
  "processingMethod": "llamaindex"
}
```

**Error Responses:**
- `400` - Invalid verticals or documentTypes JSON
- `413` - File too large (max 200MB)
- `500` - LlamaIndex processing failed

#### GET `/api/documents/processing-status`
Check document processing status.

**Query Parameters:**
- `id` - Specific document ID (optional)

**Single Document Request:**
```bash
GET /api/documents/processing-status?id=cuid_string
```

**Single Document Response:**
```json
{
  "status": {
    "processingStatus": "EMBEDDING",
    "processingProgress": 75,
    "processedChunks": 30,
    "totalChunks": 40,
    "processingError": null
  }
}
```

**All Processing Documents Request:**
```bash
GET /api/documents/processing-status
```

**All Processing Documents Response:**
```json
{
  "processingDocuments": [
    {
      "id": "cuid_string",
      "title": "Document Title",
      "processingStatus": "CHUNKING",
      "processingProgress": 50,
      "processedChunks": 20,
      "totalChunks": 40
    }
  ]
}
```

**Processing Status Values:**
- `UPLOADED` - File uploaded, awaiting processing
- `EXTRACTING` - Extracting text from PDF
- `CHUNKING` - Creating text chunks
- `EMBEDDING` - Creating vector embeddings
- `COMPLETED` - Ready for search
- `FAILED` - Processing error occurred

### 3. Document Content Endpoints

#### GET `/api/documents/[id]/text`
Retrieve extracted text content of a document.

**Request Example:**
```bash
GET /api/documents/cuid_string/text
```

**Response:**
```json
{
  "content": "Full extracted text content of the document...",
  "title": "Document Title"
}
```

**Error Responses:**
- `404` - Document not found
- `401` - Unauthorized
- `500` - Content extraction failed

#### GET `/api/documents/[id]/pdf`
Serve PDF file with proper headers for viewing.

**Features:**
- CORS enabled for cross-origin requests
- Range request support for large files
- Proper Content-Type headers
- Inline viewing support

**Request Example:**
```bash
GET /api/documents/cuid_string/pdf
```

**Response:** Binary PDF data with headers:
```
Content-Type: application/pdf
Content-Disposition: inline; filename="document.pdf"
Access-Control-Allow-Origin: *
```

**Error Responses:**
- `404` - Document or file not found
- `401` - Unauthorized
- `500` - File serving error

### 4. Annotation Endpoints

#### GET `/api/documents/[id]/annotations`
Get all annotations for a document.

**Request Example:**
```bash
GET /api/documents/cuid_string/annotations
```

**Response:**
```json
[
  {
    "id": "annotation_id",
    "documentId": "doc_id",
    "userId": "user_id",
    "content": {
      "text": "highlighted text",
      "quote": "full quote context"
    },
    "position": {
      "boundingRect": {
        "x1": 100,
        "y1": 200,
        "x2": 300,
        "y2": 250,
        "width": 200,
        "height": 50,
        "pageNumber": 1
      },
      "rects": []
    },
    "comment": "User comment",
    "color": "#FFFF00",
    "user": {
      "id": "user_id",
      "name": "John Doe"
    },
    "createdAt": "2024-01-01T...",
    "updatedAt": "2024-01-01T..."
  }
]
```

#### POST `/api/documents/[id]/annotations`
Create a new annotation.

**Request:**
```json
{
  "content": {
    "text": "highlighted text",
    "quote": "full quote context"
  },
  "position": {
    "boundingRect": {
      "x1": 100,
      "y1": 200,
      "x2": 300,
      "y2": 250,
      "width": 200,
      "height": 50,
      "pageNumber": 1
    },
    "rects": []
  },
  "comment": "Optional comment",
  "color": "#FFFF00"
}
```

**Response:**
```json
{
  "id": "annotation_id",
  "success": true
}
```

#### DELETE `/api/documents/[id]/annotations/[annotationId]`
Delete an annotation (users can only delete their own).

**Request Example:**
```bash
DELETE /api/documents/cuid_string/annotations/annotation_id
```

**Response:**
```json
{
  "success": true
}
```

**Error Responses:**
- `403` - Not authorized to delete this annotation
- `404` - Annotation not found

### 5. Search Endpoints

#### POST `/api/search`
Basic AI-powered document search.

**Request:**
```json
{
  "query": "What are the licensing requirements for sports betting?"
}
```

**Validation:**
- Query required, non-empty string
- Max length: 500 characters

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "doc_id",
      "title": "Document Title",
      "content": "Relevant content excerpt...",
      "score": 0.85
    }
  ],
  "answer": "AI-generated comprehensive answer"
}
```

**Error Responses:**
- `400` - Invalid query (empty, too long, etc.)
- `401` - Unauthorized
- `500` - Search service error

#### POST `/api/search-citations`
Search with detailed citations and source tracking.

**Request:**
```json
{
  "query": "What are the advertising restrictions?",
  "options": {
    "topK": 5,
    "threshold": 0.7
  }
}
```

**Response:**
```json
{
  "query": "What are the advertising restrictions?",
  "answer": "Advertising restrictions include [1] no targeting minors and [2] mandatory disclaimers.",
  "citations": [
    {
      "id": "citation_id",
      "text": "source text content",
      "source": {
        "documentId": "doc_id",
        "title": "Document Title",
        "pageNumber": 5,
        "coordinates": {
          "x": 100,
          "y": 200
        }
      }
    }
  ],
  "searchResults": [
    {
      "id": "doc_id",
      "title": "Document Title",
      "content": "Relevant content...",
      "score": 0.85
    }
  ],
  "processingTime": 1234567890
}
```

**Error Responses:**
- `400` - Invalid query parameters
- `401` - Unauthorized
- `500` - Search processing error

#### POST `/api/search-citations-stream`
Streaming search endpoint with real-time response and multi-state support.

**Request:**
```json
{
  "query": "What are the compliance requirements?",
  "options": {
    "topK": 10,
    "threshold": 0.7
  },
  "conversationContext": {
    "previousQuery": "What are the licensing requirements?",
    "previousAnswer": "Licensing requires..."
  },
  "states": ["NY", "CA", "NJ"]
}
```

**Response:** Server-Sent Events stream

**Single-State Search Flow:**
```
data: {"type": "metadata", "query": "...", "citations": [...], "searchResults": [...]}
data: {"type": "content", "content": "Compliance "}
data: {"type": "content", "content": "requirements "}
data: {"type": "content", "content": "include..."}
data: {"type": "done"}
```

**Multi-State Search Flow:**
```
data: {"type": "metadata", "query": "...", "isMultiState": true, "states": ["NY", "CA"]}
data: {"type": "state-queued", "state": "NY"}
data: {"type": "state-queued", "state": "CA"}
data: {"type": "state-processing", "state": "NY"}
data: {"type": "state-answer", "state": "NY", "answer": "In New York...", "citations": [...], "sourceCount": 5}
data: {"type": "state-processing", "state": "CA"}
data: {"type": "state-answer", "state": "CA", "answer": "In California...", "citations": [...], "sourceCount": 3}
data: {"type": "state-complete", "state": "NY"}
data: {"type": "state-complete", "state": "CA"}
data: {"type": "done"}
```

**Event Types:**
- `metadata` - Initial search metadata
- `content` - Single-state streaming content
- `state-queued` - State added to processing queue
- `state-processing` - State search started
- `state-answer` - Complete state answer with citations
- `state-complete` - State processing finished
- `done` - All processing complete

**State Isolation:**
Each state is processed independently with its own:
- Separate vector search scope
- Isolated context for answer generation
- Independent citation tracking
- No cross-state contamination

**Citation Format Support:**
- Standard: `[1]`, `[2]`
- Legal: `[2(3)(a)]`, `[Section 4.2.1]`
- Multiple: `[1, 3, 5]`
- Prefixed: `[Citation 1]`

**Error Responses:**
- `400` - Invalid request format
- `401` - Unauthorized
- `500` - Streaming error
- `503` - ChromaDB connection error

### 6. Configuration Endpoints

#### GET `/api/verticals`
Get all available verticals for document categorization.

**Response:**
```json
{
  "verticals": [
    {
      "id": "vertical_id_1",
      "name": "sports_betting",
      "displayName": "Sports Betting",
      "description": "Sports betting related regulations"
    },
    {
      "id": "vertical_id_2",
      "name": "online_gaming",
      "displayName": "Online Gaming",
      "description": "Online gaming regulations"
    }
  ]
}
```

#### GET `/api/document-types`
Get all document types for categorization.

**Response:**
```json
{
  "documentTypes": [
    {
      "id": "type_id_1",
      "name": "regulation",
      "displayName": "Regulation",
      "description": "Regulatory documents"
    },
    {
      "id": "type_id_2",
      "name": "guidance",
      "displayName": "Guidance",
      "description": "Guidance documents"
    }
  ]
}
```

#### GET `/api/categories`
Get all categories (legacy categorization system).

**Response:**
```json
{
  "categories": [
    {
      "id": "category_id",
      "name": "Licensing",
      "description": "Licensing related documents"
    }
  ]
}
```

### 7. Multi-State Search Service

The multi-state search service provides state-isolated search capabilities for accurate jurisdiction-specific answers.

#### Service Architecture
```typescript
interface MultiStateSearchService {
  searchMultipleStates(
    query: string,
    states: string[],
    options: SearchOptions
  ): AsyncGenerator<StateSearchEvent>
}

interface StateSearchEvent {
  type: 'state-queued' | 'state-processing' | 'state-answer' | 'state-complete'
  state: string
  answer?: string
  citations?: Citation[]
  sourceCount?: number
}
```

#### State Isolation Process
1. **Document Filtering**: Each state search only queries documents from that specific state
2. **Context Isolation**: Answer generation uses only citations from the current state
3. **Parallel Processing**: States are processed concurrently for performance
4. **No Cross-Contamination**: Each state's context is completely isolated

#### Progressive UI Updates
- **Immediate Feedback**: UI shows all states as "queued" immediately
- **Real-time Progress**: States transition through lifecycle stages
- **Streaming Results**: Answers appear as soon as they're ready
- **Visual States**: Color-coded indicators for each processing stage

### 8. User Management Endpoints

#### GET `/api/users`
Get all users (admin-only endpoint).

**Authentication**: Required (Admin role only)

**Response:**
```json
{
  "users": [
    {
      "id": "cuid_string",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "USER",
      "organization": "Example Corp",
      "createdAt": "2024-01-01T..."
    }
  ]
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (non-admin user)

#### POST `/api/users`
Create a new user (admin-only endpoint).

**Authentication**: Required (Admin role only)

**Request:**
```json
{
  "email": "newuser@example.com",
  "name": "New User",
  "password": "password123",
  "role": "USER",
  "organization": "Example Corp"
}
```

**Validation:**
- Email must be valid format and unique
- Password must be at least 6 characters
- Role must be "USER" or "ADMIN"
- Name and email are required

**Response:**
```json
{
  "user": {
    "id": "cuid_string",
    "email": "newuser@example.com",
    "name": "New User",
    "role": "USER",
    "organization": "Example Corp",
    "createdAt": "2024-01-01T..."
  },
  "message": "User created successfully"
}
```

**Error Responses:**
- `400` - Validation error or user already exists
- `401` - Unauthorized
- `403` - Forbidden (non-admin user)

#### DELETE `/api/users/[id]`
Delete a user (admin-only endpoint).

**Authentication**: Required (Admin role only)

**Path Parameters:**
- `id` - User ID to delete

**Business Rules:**
- Admins cannot delete themselves
- Deletes associated user data (search history, annotations)

**Response:**
```json
{
  "message": "User deleted successfully"
}
```

**Error Responses:**
- `400` - Cannot delete own account
- `401` - Unauthorized
- `403` - Forbidden (non-admin user)
- `404` - User not found

### 8. User Activity Tracking Endpoints

#### GET `/api/user/recent-documents`
Get recently viewed documents for the current user.

**Authentication**: Required

**Response:**
```json
{
  "recent": [
    {
      "id": "activity_id",
      "documentId": "doc_id",
      "title": "Document Title",
      "state": "NY",
      "type": "Regulation",
      "viewedAt": "2024-01-01T12:00:00Z"
    }
  ]
}
```

**Error Responses:**
- `401` - Unauthorized
- `500` - Internal server error

#### POST `/api/user/recent-documents`
Track a document view for the current user.

**Authentication**: Required

**Request:**
```json
{
  "documentId": "doc_id",
  "title": "Document Title",
  "state": "NY",
  "type": "Regulation"
}
```

**Response:**
```json
{
  "success": true
}
```

**Error Responses:**
- `400` - Missing required fields
- `401` - Unauthorized
- `500` - Internal server error

#### GET `/api/user/recent-searches`
Get recent search history for the current user.

**Authentication**: Required

**Response:**
```json
{
  "recent": [
    {
      "id": "search_id",
      "query": "licensing requirements",
      "timestamp": "2024-01-01T12:00:00Z",
      "resultsCount": 5,
      "searchType": "ai-search",
      "states": "[\"NY\", \"CA\"]"
    }
  ]
}
```

**Error Responses:**
- `401` - Unauthorized
- `500` - Internal server error

#### POST `/api/user/recent-searches`
Track a search query for the current user.

**Authentication**: Required

**Request:**
```json
{
  "query": "licensing requirements",
  "resultsCount": 5,
  "searchType": "ai-search",
  "states": "[\"NY\", \"CA\"]"
}
```

**Response:**
```json
{
  "success": true
}
```

**Error Responses:**
- `400` - Missing required fields
- `401` - Unauthorized
- `500` - Internal server error

#### GET `/api/user/bookmarks`
Get bookmarked documents for the current user.

**Authentication**: Required

**Response:**
```json
{
  "bookmarks": [
    {
      "id": "bookmark_id",
      "documentId": "doc_id",
      "title": "Document Title",
      "state": "NY",
      "type": "Regulation",
      "bookmarkedAt": "2024-01-01T12:00:00Z"
    }
  ]
}
```

**Error Responses:**
- `401` - Unauthorized
- `500` - Internal server error

#### POST `/api/user/bookmarks`
Add a document to bookmarks for the current user.

**Authentication**: Required

**Request:**
```json
{
  "documentId": "doc_id",
  "title": "Document Title",
  "state": "NY",
  "type": "Regulation"
}
```

**Response:**
```json
{
  "success": true
}
```

**Error Responses:**
- `400` - Missing required fields
- `401` - Unauthorized
- `500` - Internal server error

#### DELETE `/api/user/bookmarks?documentId=doc_id`
Remove a document from bookmarks for the current user.

**Authentication**: Required

**Query Parameters:**
- `documentId` - Document ID to remove from bookmarks (required)

**Response:**
```json
{
  "success": true
}
```

**Error Responses:**
- `400` - Missing documentId parameter
- `401` - Unauthorized
- `404` - Bookmark not found
- `500` - Internal server error

#### HEAD `/api/user/bookmarks?documentId=doc_id`
Check if a document is bookmarked by the current user.

**Authentication**: Required

**Query Parameters:**
- `documentId` - Document ID to check (required)

**Response:**
- `200` - Document is bookmarked
- `404` - Document is not bookmarked

**Error Responses:**
- `400` - Missing documentId parameter
- `401` - Unauthorized
- `500` - Internal server error

#### GET `/api/user/new-documents`
Get recently added documents (last 30 days) for dashboard display.

**Authentication**: Required

**Response:**
```json
{
  "recent": [
    {
      "id": "doc_id",
      "title": "New Regulation Title",
      "state": "NY",
      "addedAt": "2024-01-15T10:00:00Z",
      "verticals": [
        {
          "name": "sports_betting",
          "displayName": "Sports Betting"
        }
      ],
      "documentTypes": [
        {
          "name": "regulation",
          "displayName": "Regulation"
        }
      ]
    }
  ]
}
```

**Features:**
- Automatically tracks documents uploaded via any upload endpoint
- Returns documents added in the last 30 days
- Sorted by most recent first
- Includes full vertical and document type details

**Error Responses:**
- `401` - Unauthorized
- `500` - Internal server error

#### POST `/api/user/new-documents`
Track a newly added document (typically called by upload endpoints).

**Authentication**: Required (or internal bypass with `internal: true`)

**Request:**
```json
{
  "documentId": "doc_id",
  "title": "Document Title",
  "state": "NY",
  "type": "Regulation",
  "internal": true
}
```

**Response:**
```json
{
  "success": true
}
```

**Error Responses:**
- `400` - Missing required fields
- `401` - Unauthorized (unless internal call)
- `500` - Internal server error

### 9. Mention-Based Filtering System

#### Document Filtering API Enhancement
The document endpoints now support advanced filtering through @mentions and #categories:

**@State Mentions:**
- Format: `@NY`, `@California`, `@TX`
- Filters documents by state
- Multiple states create OR condition

**#Category Mentions:**
- Verticals: `#sports_betting`, `#online_gaming`
- Document Types: `#regulation`, `#guidance`
- Multiple categories of same type: OR condition
- Different category types: AND condition

**Example Filter Query:**
```
@NY @CA #sports_betting #regulation
```
This finds documents that are:
- From NY OR CA (state filter)
- AND related to sports betting (vertical filter)
- AND are regulations (document type filter)

### 10. Configuration Endpoints

#### GET `/api/settings/rag`
Get current RAG (Retrieval Augmented Generation) settings.

**Authentication**: Required (Admin role only)

**Response:**
```json
{
  "settings": {
    "llmProvider": "anthropic",
    "anthropicModel": "claude-3-opus-20240229",
    "openAIModel": "gpt-4",
    "googleModel": "gemini-pro",
    "temperature": 0.7,
    "maxTokens": 4000,
    "sourceDocuments": 5
  }
}
```

#### POST `/api/settings/rag`
Update RAG settings (admin-only endpoint).

**Authentication**: Required (Admin role only)

**Request:**
```json
{
  "settings": {
    "llmProvider": "anthropic",
    "anthropicModel": "claude-3-opus-20240229",
    "temperature": 0.5,
    "maxTokens": 3000,
    "sourceDocuments": 8
  }
}
```

**Validation:**
- `llmProvider`: Must be "anthropic", "openai", or "google"
- `sourceDocuments`: 1-20
- `temperature`: 0-2
- `maxTokens`: 100-8000

**Response:**
```json
{
  "success": true,
  "settings": {
    "llmProvider": "anthropic",
    "temperature": 0.5,
    "maxTokens": 3000,
    "sourceDocuments": 8
  }
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (non-admin user)

### 10. Testing & Health Endpoints

#### GET `/api/test`
Test ChromaDB vector database connection and configuration.

**Response:**
```json
{
  "success": true,
  "message": "ChromaDB connection successful",
  "config": {
    "host": "localhost",
    "port": "8000",
    "hasOpenAIKey": true,
    "collections": 3
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "ChromaDB connection failed",
  "details": "Connection refused on localhost:8000"
}
```

## Error Handling

All endpoints follow consistent error response format:

```json
{
  "error": "Error message",
  "details": "Additional context (optional)",
  "code": "ERROR_CODE"
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created (for POST requests)
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `413` - Payload Too Large
- `500` - Internal Server Error

### Error Response Examples

**Validation Error:**
```json
{
  "error": "Validation failed",
  "details": "Query must be between 3 and 500 characters",
  "code": "VALIDATION_ERROR"
}
```

**Authentication Error:**
```json
{
  "error": "Authentication required",
  "code": "UNAUTHORIZED"
}
```

**File Upload Error:**
```json
{
  "error": "File upload failed",
  "details": "Only PDF files are supported",
  "code": "INVALID_FILE_TYPE"
}
```

## Rate Limiting & Constraints

### File Upload Limits
- **Standard upload**: 50MB maximum
- **Async upload**: 200MB maximum
- **LlamaIndex upload**: 200MB maximum
- **Supported formats**: PDF only

### Search Query Limits
- **Max query length**: 500 characters
- **Min query length**: 3 characters
- **Configurable result count**: 1-20 documents (topK)
- **Similarity threshold**: 0.0-1.0

### API Key Requirements
- **OpenAI API key**: Required for embeddings
- **LLM provider API keys**: Required for search responses
- **ChromaDB**: Local or remote instance required

## Database Operations

### Document Processing Pipeline
1. **File Upload**: Store file locally, create database record
2. **Text Extraction**: Extract text from PDF using multiple libraries
3. **Chunking**: Split text into manageable chunks
4. **Embedding**: Generate vector embeddings using OpenAI
5. **Storage**: Store embeddings in ChromaDB with metadata

### Search Operations
1. **Query Embedding**: Convert search query to vector
2. **Similarity Search**: Find relevant document chunks
3. **LLM Processing**: Generate response with citations
4. **Response Streaming**: Stream response to client

## Usage Examples

### Document Upload Flow
```bash
# 1. Upload document
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Cookie: next-auth.session-token=..." \
  -F "file=@document.pdf" \
  -F "title=My Document" \
  -F "state=NY" \
  -F "categoryId=category_id"

# 2. Check processing status
curl http://localhost:3000/api/documents/processing-status?id=document_id \
  -H "Cookie: next-auth.session-token=..."

# 3. Search processed document
curl -X POST http://localhost:3000/api/search-citations \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"query": "What are the requirements?"}'
```

### Streaming Search Implementation
```javascript
// Client-side streaming search
const performStreamingSearch = async (query) => {
  const response = await fetch('/api/search-citations-stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: query,
      states: ['NY', 'CA']
    })
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.substring(6));
        
        switch (data.type) {
          case 'metadata':
            setCitations(data.citations);
            setSearchResults(data.searchResults);
            break;
          case 'content':
            setAnswer(prev => prev + data.content);
            break;
          case 'done':
            setLoading(false);
            break;
        }
      }
    }
  }
};
```

### Advanced Document Processing
```bash
# Upload with LlamaIndex processing
curl -X POST http://localhost:3000/api/documents/upload-llamaindex \
  -H "Cookie: next-auth.session-token=..." \
  -F "file=@document.pdf" \
  -F "title=Complex Document" \
  -F "state=NY" \
  -F "verticals=[\"sports_betting\", \"online_gaming\"]" \
  -F "documentTypes=[\"regulation\", \"guidance\"]"
```

---

*This API documentation provides comprehensive coverage of all endpoints and their usage patterns. For implementation details, refer to the individual route files in the `/app/api/` directory.*