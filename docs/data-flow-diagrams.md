# Data Flow Diagrams Documentation

## Overview

This document provides comprehensive data flow diagrams for the Compliance Hub application, illustrating how data moves through the system from user interactions to database operations and external service integrations.

## Primary Data Flow Patterns

### 1. Document Upload & Processing Data Flow

```mermaid
graph TB
    subgraph "Client Layer"
        User[User Interface]
        UploadForm[Upload Form]
        ProgressUI[Progress UI]
    end
    
    subgraph "Application Layer"
        UploadAPI["/api/documents/upload"]
        ProcessingAPI["/api/documents/processing-status"]
        DocumentAPI["/api/documents"]
    end
    
    subgraph "Service Layer"
        FileHandler[File Handler]
        PDFProcessor[PDF Processor]
        TextExtractor[Text Extractor]
        ChunkService[Chunk Service]
        EmbeddingService[Embedding Service]
    end
    
    subgraph "Data Layer"
        LocalStorage[Local File Storage]
        DB[(SQLite Database)]
        ChromaDB[(ChromaDB Vector Store)]
    end
    
    subgraph "External Services"
        OpenAI[OpenAI Embeddings API]
        LLMProvider[LLM Provider APIs]
    end
    
    User --> UploadForm
    UploadForm --> UploadAPI
    UploadAPI --> FileHandler
    FileHandler --> LocalStorage
    FileHandler --> DB
    
    DB --> PDFProcessor
    PDFProcessor --> TextExtractor
    TextExtractor --> ChunkService
    ChunkService --> EmbeddingService
    EmbeddingService --> OpenAI
    OpenAI --> EmbeddingService
    EmbeddingService --> ChromaDB
    ChromaDB --> DB
    
    ProcessingAPI --> DB
    ProcessingAPI --> ProgressUI
    ProgressUI --> User
    
    DocumentAPI --> DB
    DocumentAPI --> User
```

### 2. AI Search & Response Data Flow

```mermaid
graph TB
    subgraph "Client Layer"
        SearchUI[Search Interface]
        StreamingUI[Streaming Response UI]
        CitationUI[Citation Links]
    end
    
    subgraph "Application Layer"
        SearchAPI["/api/search-citations-stream"]
        DocumentAPI["/api/documents/[id]/text"]
        SettingsAPI["/api/settings/rag"]
    end
    
    subgraph "Service Layer"
        QueryProcessor[Query Processor]
        VectorSearch[Vector Search Service]
        LLMService[LLM Service]
        CitationProcessor[Citation Processor]
        ResponseStreamer[Response Streamer]
    end
    
    subgraph "Data Layer"
        ChromaDB[(ChromaDB Vector Store)]
        DB[(SQLite Database)]
        Cache[Response Cache]
    end
    
    subgraph "External Services"
        OpenAI[OpenAI Embeddings]
        Anthropic[Anthropic Claude]
        GoogleAI[Google Gemini]
    end
    
    SearchUI --> SearchAPI
    SearchAPI --> QueryProcessor
    QueryProcessor --> VectorSearch
    VectorSearch --> ChromaDB
    ChromaDB --> VectorSearch
    VectorSearch --> DB
    
    DB --> LLMService
    LLMService --> Anthropic
    LLMService --> GoogleAI
    Anthropic --> LLMService
    GoogleAI --> LLMService
    
    LLMService --> CitationProcessor
    CitationProcessor --> ResponseStreamer
    ResponseStreamer --> StreamingUI
    StreamingUI --> SearchUI
    
    CitationProcessor --> CitationUI
    CitationUI --> DocumentAPI
    DocumentAPI --> DB
    
    SettingsAPI --> Cache
    Cache --> LLMService
```

### 3. Authentication & Authorization Data Flow

```mermaid
graph TB
    subgraph "Client Layer"
        LoginForm[Login Form]
        SessionState[Session State]
        ProtectedUI[Protected Components]
    end
    
    subgraph "Application Layer"
        AuthAPI["/api/auth/[...nextauth]"]
        Middleware[Next.js Middleware]
        ProtectedAPI[Protected API Routes]
    end
    
    subgraph "Service Layer"
        AuthService[Auth Service]
        SessionManager[Session Manager]
        RoleChecker[Role Checker]
        PasswordValidator[Password Validator]
    end
    
    subgraph "Data Layer"
        DB[(SQLite Database)]
        JWTStore[JWT Token Store]
        SessionStore[Session Store]
    end
    
    subgraph "External Services"
        BCrypt[BCrypt Service]
    end
    
    LoginForm --> AuthAPI
    AuthAPI --> AuthService
    AuthService --> PasswordValidator
    PasswordValidator --> BCrypt
    BCrypt --> PasswordValidator
    PasswordValidator --> DB
    
    DB --> SessionManager
    SessionManager --> JWTStore
    JWTStore --> SessionStore
    SessionStore --> SessionState
    SessionState --> LoginForm
    
    SessionState --> ProtectedUI
    ProtectedUI --> ProtectedAPI
    ProtectedAPI --> Middleware
    Middleware --> RoleChecker
    RoleChecker --> SessionStore
    SessionStore --> RoleChecker
    RoleChecker --> ProtectedAPI
```

## Detailed Data Flow Scenarios

### 1. Document Upload Process

#### Data Flow Steps:
1. **User Initiation**: User selects PDF file and fills form
2. **Client Validation**: Form validates file type, size, required fields
3. **File Upload**: FormData sent to `/api/documents/upload`
4. **Server Processing**: 
   - File saved to local storage
   - Database record created with `UPLOADED` status
   - Background processing triggered
5. **Background Processing**:
   - Status updates to `EXTRACTING`
   - PDF text extraction
   - Status updates to `CHUNKING`
   - Text chunking for embeddings
   - Status updates to `EMBEDDING`
   - Vector embedding generation
   - ChromaDB storage
   - Status updates to `COMPLETED`

#### Data Transformations:
```typescript
// Input: FormData
{
  file: File,
  title: string,
  description: string,
  state: string,
  categoryId: string
}

// Database Record
{
  id: "cuid_string",
  title: "Document Title",
  filePath: "documents/filename.pdf",
  processingStatus: "UPLOADED",
  processingProgress: 0
}

// ChromaDB Vector
{
  id: "chunk_id",
  embedding: [0.1, 0.2, ...],
  metadata: {
    documentId: "doc_id",
    chunkIndex: 0,
    content: "chunk text"
  }
}
```

### 2. Search Query Processing

#### Data Flow Steps:
1. **Query Input**: User enters search query
2. **Query Validation**: Length, content validation
3. **Context Enhancement**: Add conversation context if available
4. **Vector Search**: 
   - Query embedding generation
   - ChromaDB similarity search
   - Document retrieval
5. **LLM Processing**:
   - Context preparation
   - LLM API call
   - Response streaming
6. **Citation Processing**:
   - Citation pattern extraction
   - Document linking
   - UI rendering

#### Data Transformations:
```typescript
// Input Query
{
  query: "What are the licensing requirements?",
  states: ["NY", "CA"],
  conversationContext: {...}
}

// Vector Search Results
{
  results: [
    {
      id: "chunk_id",
      score: 0.85,
      metadata: {
        documentId: "doc_id",
        content: "licensing requirements..."
      }
    }
  ]
}

// LLM Response
{
  answer: "Licensing requirements include [1] background checks...",
  citations: [
    {
      number: 1,
      documentId: "doc_id",
      text: "background checks are required..."
    }
  ]
}
```

### 3. User Session Management

#### Data Flow Steps:
1. **Login Request**: Credentials submitted
2. **Authentication**: Database user lookup, password verification
3. **Session Creation**: JWT token generation
4. **Session Storage**: Token stored in HTTP-only cookies
5. **Request Authorization**: Middleware validates tokens
6. **Role Checking**: Access control based on user roles

#### Data Transformations:
```typescript
// Login Input
{
  email: "user@example.com",
  password: "plaintext_password"
}

// Database Lookup
{
  id: "user_id",
  email: "user@example.com",
  password: "$2b$10$hashedpassword",
  role: "USER"
}

// JWT Token
{
  sub: "user_id",
  email: "user@example.com",
  role: "USER",
  iat: 1640995200,
  exp: 1641081600
}
```

## Complex Data Flow Scenarios

### 1. Multi-Step Document Processing with Error Handling

```mermaid
graph TB
    subgraph "Happy Path"
        Upload[Document Upload]
        Extract[Text Extraction]
        Chunk[Text Chunking]
        Embed[Embedding Generation]
        Store[Vector Storage]
        Complete[Processing Complete]
    end
    
    subgraph "Error Handling"
        ExtractError[Extraction Failed]
        ChunkError[Chunking Failed]
        EmbedError[Embedding Failed]
        StoreError[Storage Failed]
        Retry[Retry Logic]
        Failed[Mark as Failed]
    end
    
    subgraph "Status Updates"
        StatusDB[(Status Database)]
        ProgressUI[Progress UI]
        ErrorUI[Error UI]
    end
    
    Upload --> Extract
    Extract --> Chunk
    Chunk --> Embed
    Embed --> Store
    Store --> Complete
    
    Extract --> ExtractError
    Chunk --> ChunkError
    Embed --> EmbedError
    Store --> StoreError
    
    ExtractError --> Retry
    ChunkError --> Retry
    EmbedError --> Retry
    StoreError --> Retry
    
    Retry --> Extract
    Retry --> Failed
    
    Upload --> StatusDB
    Extract --> StatusDB
    Chunk --> StatusDB
    Embed --> StatusDB
    Store --> StatusDB
    Complete --> StatusDB
    Failed --> StatusDB
    
    StatusDB --> ProgressUI
    StatusDB --> ErrorUI
```

### 2. Real-time Search with Streaming Response

```mermaid
graph TB
    subgraph "Client Stream Processing"
        QuerySubmit[Query Submission]
        StreamOpen[Stream Connection]
        MetadataRcv[Metadata Received]
        ContentRcv[Content Streaming]
        StreamClose[Stream Complete]
    end
    
    subgraph "Server Stream Processing"
        QueryProcess[Query Processing]
        VectorSearch[Vector Search]
        LLMCall[LLM API Call]
        ResponseChunk[Response Chunking]
        StreamSend[Stream Sending]
    end
    
    subgraph "Data Processing"
        CitationExtract[Citation Extraction]
        ContentFormat[Content Formatting]
        MetadataFormat[Metadata Formatting]
    end
    
    QuerySubmit --> QueryProcess
    QueryProcess --> VectorSearch
    VectorSearch --> LLMCall
    LLMCall --> ResponseChunk
    ResponseChunk --> CitationExtract
    CitationExtract --> ContentFormat
    ContentFormat --> MetadataFormat
    
    MetadataFormat --> StreamSend
    StreamSend --> StreamOpen
    StreamOpen --> MetadataRcv
    
    ResponseChunk --> StreamSend
    StreamSend --> ContentRcv
    ContentRcv --> StreamClose
```

## Data Consistency Patterns

### 1. Document State Consistency

```mermaid
graph LR
    subgraph "Document Lifecycle"
        UPLOADED[UPLOADED]
        EXTRACTING[EXTRACTING]
        CHUNKING[CHUNKING]
        EMBEDDING[EMBEDDING]
        COMPLETED[COMPLETED]
        FAILED[FAILED]
    end
    
    subgraph "Database Updates"
        StatusUpdate[Status Update]
        ProgressUpdate[Progress Update]
        ErrorUpdate[Error Update]
    end
    
    subgraph "Vector Store Sync"
        VectorCreate[Vector Creation]
        VectorUpdate[Vector Update]
        VectorDelete[Vector Deletion]
    end
    
    UPLOADED --> EXTRACTING
    EXTRACTING --> CHUNKING
    CHUNKING --> EMBEDDING
    EMBEDDING --> COMPLETED
    
    EXTRACTING --> FAILED
    CHUNKING --> FAILED
    EMBEDDING --> FAILED
    
    EXTRACTING --> StatusUpdate
    CHUNKING --> StatusUpdate
    EMBEDDING --> StatusUpdate
    COMPLETED --> StatusUpdate
    FAILED --> StatusUpdate
    
    StatusUpdate --> ProgressUpdate
    StatusUpdate --> ErrorUpdate
    
    EMBEDDING --> VectorCreate
    COMPLETED --> VectorUpdate
    FAILED --> VectorDelete
```

### 2. Search Result Consistency

```mermaid
graph TB
    subgraph "Search Processing"
        QueryInput[Query Input]
        VectorQuery[Vector Query]
        DocumentFilter[Document Filter]
        ResultRank[Result Ranking]
        CitationGen[Citation Generation]
    end
    
    subgraph "Data Validation"
        DocExists[Document Exists?]
        DocComplete[Processing Complete?]
        DocAccessible[User Accessible?]
    end
    
    subgraph "Result Filtering"
        FilterResults[Filter Results]
        ValidCitations[Validate Citations]
        FinalResults[Final Results]
    end
    
    QueryInput --> VectorQuery
    VectorQuery --> DocumentFilter
    DocumentFilter --> DocExists
    DocExists --> DocComplete
    DocComplete --> DocAccessible
    
    DocAccessible --> ResultRank
    ResultRank --> CitationGen
    CitationGen --> ValidCitations
    ValidCitations --> FilterResults
    FilterResults --> FinalResults
```

## Performance Optimization Data Flows

### 1. Caching Strategy

```mermaid
graph TB
    subgraph "Request Flow"
        UserRequest[User Request]
        CacheCheck[Cache Check]
        CacheHit[Cache Hit]
        CacheMiss[Cache Miss]
        DataSource[Data Source]
        CacheUpdate[Cache Update]
        Response[Response]
    end
    
    subgraph "Cache Layers"
        L1Cache[L1: Memory Cache]
        L2Cache[L2: Redis Cache]
        L3Cache[L3: Database Cache]
    end
    
    UserRequest --> CacheCheck
    CacheCheck --> L1Cache
    L1Cache --> CacheHit
    L1Cache --> L2Cache
    L2Cache --> CacheHit
    L2Cache --> L3Cache
    L3Cache --> CacheHit
    L3Cache --> CacheMiss
    
    CacheHit --> Response
    CacheMiss --> DataSource
    DataSource --> CacheUpdate
    CacheUpdate --> L1Cache
    CacheUpdate --> L2Cache
    CacheUpdate --> L3Cache
    CacheUpdate --> Response
```

### 2. Database Query Optimization

```mermaid
graph TB
    subgraph "Query Processing"
        QueryRequest[Query Request]
        QueryPlan[Query Plan]
        IndexCheck[Index Check]
        QueryExecution[Query Execution]
        ResultSet[Result Set]
    end
    
    subgraph "Optimization Layers"
        QueryOptimizer[Query Optimizer]
        IndexOptimizer[Index Optimizer]
        ConnectionPool[Connection Pool]
        ResultCache[Result Cache]
    end
    
    QueryRequest --> QueryOptimizer
    QueryOptimizer --> QueryPlan
    QueryPlan --> IndexOptimizer
    IndexOptimizer --> IndexCheck
    IndexCheck --> ConnectionPool
    ConnectionPool --> QueryExecution
    QueryExecution --> ResultCache
    ResultCache --> ResultSet
```

## Error Handling Data Flows

### 1. Graceful Error Recovery

```mermaid
graph TB
    subgraph "Error Detection"
        Operation[Operation]
        ErrorCheck[Error Check]
        ErrorType[Error Type]
        ErrorLog[Error Logging]
    end
    
    subgraph "Recovery Strategies"
        Retry[Retry Logic]
        Fallback[Fallback Logic]
        Degraded[Degraded Service]
        UserNotify[User Notification]
    end
    
    subgraph "Error Types"
        NetworkError[Network Error]
        ValidationError[Validation Error]
        ServiceError[Service Error]
        DatabaseError[Database Error]
    end
    
    Operation --> ErrorCheck
    ErrorCheck --> ErrorType
    ErrorType --> NetworkError
    ErrorType --> ValidationError
    ErrorType --> ServiceError
    ErrorType --> DatabaseError
    
    NetworkError --> Retry
    ValidationError --> UserNotify
    ServiceError --> Fallback
    DatabaseError --> Degraded
    
    Retry --> Operation
    Fallback --> Degraded
    Degraded --> UserNotify
    
    ErrorType --> ErrorLog
```

### 2. Data Validation Flow

```mermaid
graph TB
    subgraph "Input Validation"
        UserInput[User Input]
        ClientValidation[Client Validation]
        ServerValidation[Server Validation]
        DatabaseValidation[Database Validation]
    end
    
    subgraph "Validation Rules"
        TypeCheck[Type Check]
        FormatCheck[Format Check]
        BusinessRules[Business Rules]
        SecurityCheck[Security Check]
    end
    
    subgraph "Error Handling"
        ValidationError[Validation Error]
        ErrorMessage[Error Message]
        ErrorResponse[Error Response]
        UserFeedback[User Feedback]
    end
    
    UserInput --> ClientValidation
    ClientValidation --> ServerValidation
    ServerValidation --> DatabaseValidation
    
    ClientValidation --> TypeCheck
    ServerValidation --> FormatCheck
    DatabaseValidation --> BusinessRules
    ServerValidation --> SecurityCheck
    
    TypeCheck --> ValidationError
    FormatCheck --> ValidationError
    BusinessRules --> ValidationError
    SecurityCheck --> ValidationError
    
    ValidationError --> ErrorMessage
    ErrorMessage --> ErrorResponse
    ErrorResponse --> UserFeedback
```

## Monitoring & Analytics Data Flows

### 1. System Monitoring

```mermaid
graph TB
    subgraph "Data Collection"
        AppMetrics[Application Metrics]
        ServerMetrics[Server Metrics]
        DatabaseMetrics[Database Metrics]
        UserMetrics[User Metrics]
    end
    
    subgraph "Processing"
        MetricsAggregator[Metrics Aggregator]
        AlertProcessor[Alert Processor]
        DashboardProcessor[Dashboard Processor]
    end
    
    subgraph "Storage & Output"
        MetricsDB[(Metrics Database)]
        AlertSystem[Alert System]
        MonitoringDashboard[Monitoring Dashboard]
    end
    
    AppMetrics --> MetricsAggregator
    ServerMetrics --> MetricsAggregator
    DatabaseMetrics --> MetricsAggregator
    UserMetrics --> MetricsAggregator
    
    MetricsAggregator --> AlertProcessor
    MetricsAggregator --> DashboardProcessor
    
    AlertProcessor --> AlertSystem
    DashboardProcessor --> MonitoringDashboard
    
    MetricsAggregator --> MetricsDB
    MetricsDB --> AlertProcessor
    MetricsDB --> DashboardProcessor
```

### 2. User Analytics

```mermaid
graph TB
    subgraph "User Interactions"
        SearchQueries[Search Queries]
        DocumentViews[Document Views]
        UploadActions[Upload Actions]
        NavigationEvents[Navigation Events]
    end
    
    subgraph "Analytics Processing"
        EventAggregator[Event Aggregator]
        UserSessionTracker[User Session Tracker]
        BehaviorAnalyzer[Behavior Analyzer]
    end
    
    subgraph "Insights Generation"
        UsagePatterns[Usage Patterns]
        PerformanceMetrics[Performance Metrics]
        UserSegmentation[User Segmentation]
        RecommendationEngine[Recommendation Engine]
    end
    
    SearchQueries --> EventAggregator
    DocumentViews --> EventAggregator
    UploadActions --> EventAggregator
    NavigationEvents --> EventAggregator
    
    EventAggregator --> UserSessionTracker
    EventAggregator --> BehaviorAnalyzer
    
    UserSessionTracker --> UsagePatterns
    BehaviorAnalyzer --> PerformanceMetrics
    BehaviorAnalyzer --> UserSegmentation
    UsagePatterns --> RecommendationEngine
```

---

*This data flow documentation provides comprehensive coverage of how data moves through the Compliance Hub system. For implementation details, refer to the service layer and API documentation.*