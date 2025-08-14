/**
 * AgentSet.ai RAG Service
 * Pilot implementation to test citation accuracy against current ChromaDB setup
 */

export interface AgentSetNamespace {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface AgentSetDocument {
  id: string
  name: string
  type: string
  size: number
  status: 'processing' | 'completed' | 'failed'
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface AgentSetIngestJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  documentsCount: number
  createdAt: string
  updatedAt: string
  error?: string
}

export interface AgentSetSearchResult {
  score: number
  document: {
    id: string
    name: string
    type: string
    metadata?: Record<string, any>
  }
  chunk: {
    id: string
    content: string
    startChar: number
    endChar: number
    pageNumber?: number
  }
  citations?: Array<{
    text: string
    source: string
    startChar: number
    endChar: number
    confidence: number
  }>
}

export interface AgentSetSearchResponse {
  query: string
  results: AgentSetSearchResult[]
  totalResults: number
  processingTime: number
  citations: Array<{
    id: string
    text: string
    sourceDocument: string
    startChar: number
    endChar: number
    confidence: number
  }>
}

export class AgentSetService {
  private apiKey: string
  private baseUrl: string

  constructor() {
    this.apiKey = process.env.AGENTSET_API_KEY || ''
    this.baseUrl = process.env.AGENTSET_BASE_URL || 'https://api.agentset.ai'
    
    if (!this.apiKey) {
      throw new Error('AGENTSET_API_KEY environment variable is required')
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    console.log('🌐 Making AgentSet API request:', {
      url,
      method: options.method || 'GET',
      hasApiKey: !!this.apiKey
    })
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    console.log('📡 AgentSet API response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ AgentSet API error response:', errorText)
      throw new Error(`AgentSet API error ${response.status}: ${errorText}`)
    }

    const jsonResponse = await response.json()
    console.log('📦 AgentSet API response data:', {
      type: Array.isArray(jsonResponse) ? 'array' : typeof jsonResponse,
      keys: typeof jsonResponse === 'object' ? Object.keys(jsonResponse) : 'n/a',
      length: Array.isArray(jsonResponse) ? jsonResponse.length : 'n/a'
    })

    // For search endpoints, log the full response structure
    if (endpoint.includes('/search')) {
      console.log('🔍 Full search response:', JSON.stringify(jsonResponse, null, 2))
    }

    return jsonResponse
  }

  // Namespace management
  async createNamespace(name: string, description?: string): Promise<AgentSetNamespace> {
    console.log('🔧 Creating AgentSet namespace:', name)
    
    return this.makeRequest<AgentSetNamespace>('/v1/namespace', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description: description || `Compliance Hub pilot test - ${name}`,
      }),
    })
  }

  async listNamespaces(): Promise<AgentSetNamespace[]> {
    try {
      const response = await this.makeRequest<any>('/v1/namespace')
      
      // Handle different response formats
      if (Array.isArray(response)) {
        return response
      } else if (response && Array.isArray(response.data)) {
        return response.data
      } else if (response && Array.isArray(response.namespaces)) {
        return response.namespaces
      } else {
        console.warn('Unexpected namespaces response format:', response)
        return []
      }
    } catch (error) {
      console.error('Failed to list namespaces:', error)
      throw error
    }
  }

  async getNamespace(namespaceId: string): Promise<AgentSetNamespace> {
    return this.makeRequest<AgentSetNamespace>(`/v1/namespace/${namespaceId}`)
  }

  async deleteNamespace(namespaceId: string): Promise<void> {
    await this.makeRequest<void>(`/v1/namespace/${namespaceId}`, {
      method: 'DELETE',
    })
  }

  // Document ingestion
  async createIngestJob(
    namespaceId: string,
    documents: Array<{
      name: string
      content: string
      type: 'pdf' | 'txt' | 'html' | 'md'
      metadata?: Record<string, any>
    }>
  ): Promise<AgentSetIngestJob> {
    console.log('📄 Creating AgentSet ingest job for', documents.length, 'documents')
    
    // Convert documents to AgentSet batch format
    const batchItems = documents.map(doc => ({
      type: "TEXT" as const,
      text: doc.content,
      fileName: doc.name
    }))
    
    const requestBody = {
      payload: {
        type: "BATCH" as const,
        items: batchItems
      }
    }
    
    console.log('📋 Request body structure (AgentSet format):', {
      payloadType: requestBody.payload.type,
      itemsCount: requestBody.payload.items.length,
      firstItem: requestBody.payload.items[0] ? {
        type: requestBody.payload.items[0].type,
        fileName: requestBody.payload.items[0].fileName,
        hasText: !!requestBody.payload.items[0].text,
        textLength: requestBody.payload.items[0].text?.length
      } : 'none'
    })
    
    const rawResponse = await this.makeRequest<any>(`/v1/namespace/${namespaceId}/ingest-jobs`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })
    
    console.log('🔍 Ingest job creation response:', JSON.stringify(rawResponse, null, 2))
    
    // Handle AgentSet response format: { success: true, data: { id: "...", status: "..." } }
    const jobData = rawResponse.data || rawResponse
    
    return {
      id: jobData.id,
      status: jobData.status || 'pending',
      documentsCount: batchItems.length,
      createdAt: jobData.createdAt || new Date().toISOString(),
      updatedAt: jobData.updatedAt || new Date().toISOString(),
    } as AgentSetIngestJob
  }

  async getIngestJob(namespaceId: string, jobId: string): Promise<AgentSetIngestJob> {
    return this.makeRequest<AgentSetIngestJob>(`/v1/namespace/${namespaceId}/ingest-jobs/${jobId}`)
  }

  async listIngestJobs(namespaceId: string): Promise<AgentSetIngestJob[]> {
    return this.makeRequest<AgentSetIngestJob[]>(`/v1/namespace/${namespaceId}/ingest-jobs`)
  }

  // Document management
  async listDocuments(namespaceId: string): Promise<AgentSetDocument[]> {
    return this.makeRequest<AgentSetDocument[]>(`/v1/namespace/${namespaceId}/documents`)
  }

  async getDocument(namespaceId: string, documentId: string): Promise<AgentSetDocument> {
    return this.makeRequest<AgentSetDocument>(`/v1/namespace/${namespaceId}/documents/${documentId}`)
  }

  async deleteDocument(namespaceId: string, documentId: string): Promise<void> {
    await this.makeRequest<void>(`/v1/namespace/${namespaceId}/documents/${documentId}`, {
      method: 'DELETE',
    })
  }

  // Search and RAG
  async search(
    namespaceId: string,
    query: string,
    options: {
      topK?: number
      includeMetadata?: boolean
      rerank?: boolean
      filters?: Record<string, any>
    } = {}
  ): Promise<AgentSetSearchResponse> {
    console.log('🔍 AgentSet search query:', query)
    
    const rawResponse = await this.makeRequest<any>(`/v1/namespace/${namespaceId}/search`, {
      method: 'POST',
      body: JSON.stringify({
        query,
        topK: options.topK || 10,
        includeMetadata: options.includeMetadata || true,
        rerank: options.rerank || true,
        filters: options.filters || {},
      }),
    })

    // Parse AgentSet response format: { success: true, data: [...] }
    const searchResults = rawResponse.data || []
    
    const response: AgentSetSearchResponse = {
      query,
      results: searchResults,
      totalResults: searchResults.length,
      processingTime: rawResponse.processingTime || 0,
      citations: searchResults.flatMap((result: any) => result.citations || [])
    }

    console.log('✅ AgentSet search completed:', {
      totalResults: response.totalResults,
      citationsCount: response.citations?.length || 0,
      processingTime: response.processingTime,
    })

    return response
  }

  // Utility methods for testing
  async waitForIngestJob(
    namespaceId: string,
    jobId: string,
    maxWaitTime: number = 300000 // 5 minutes
  ): Promise<AgentSetIngestJob> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitTime) {
      const job = await this.getIngestJob(namespaceId, jobId)
      
      if (job.status === 'completed') {
        console.log('✅ AgentSet ingest job completed')
        return job
      }
      
      if (job.status === 'failed') {
        throw new Error(`AgentSet ingest job failed: ${job.error}`)
      }
      
      console.log('⏳ AgentSet ingest job still processing...', job.status)
      await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
    }
    
    throw new Error('AgentSet ingest job timed out')
  }

  // Test citation accuracy
  async testCitationAccuracy(
    namespaceId: string,
    testQueries: Array<{
      query: string
      expectedCitation?: string
      description: string
    }>
  ) {
    console.log('🧪 Testing AgentSet citation accuracy with', testQueries.length, 'queries')
    
    const results = []
    
    for (const test of testQueries) {
      try {
        console.log(`\n🔍 Testing: ${test.description}`)
        console.log(`Query: "${test.query}"`)
        
        const searchResponse = await this.search(namespaceId, test.query, {
          topK: 5,
          rerank: true,
        })
        
        const result = {
          query: test.query,
          description: test.description,
          totalResults: searchResponse.totalResults,
          citationsFound: searchResponse.citations?.length || 0,
          topResult: searchResponse.results[0] || null,
          citations: searchResponse.citations || [],
          processingTime: searchResponse.processingTime,
        }
        
        results.push(result)
        
        console.log('✅ Test completed:', {
          totalResults: result.totalResults,
          citationsFound: result.citationsFound,
          processingTime: result.processingTime,
        })
        
        if (result.topResult) {
          console.log('📄 Top result:', {
            score: result.topResult.score,
            document: result.topResult.document.name,
            contentPreview: result.topResult.chunk.content.substring(0, 200) + '...',
          })
        }
        
      } catch (error) {
        console.error('❌ Test failed:', test.description, error)
        results.push({
          query: test.query,
          description: test.description,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
    
    return results
  }
}

// Export singleton instance (lazy loading)
let _agentSetService: AgentSetService | null = null
export const agentSetService = {
  get instance() {
    if (!_agentSetService) {
      _agentSetService = new AgentSetService()
    }
    return _agentSetService
  },
  // Proxy all methods
  listNamespaces: (...args: any[]) => agentSetService.instance.listNamespaces(...args),
  createNamespace: (...args: any[]) => agentSetService.instance.createNamespace(...args),
  getNamespace: (...args: any[]) => agentSetService.instance.getNamespace(...args),
  deleteNamespace: (...args: any[]) => agentSetService.instance.deleteNamespace(...args),
  createIngestJob: (...args: any[]) => agentSetService.instance.createIngestJob(...args),
  getIngestJob: (...args: any[]) => agentSetService.instance.getIngestJob(...args),
  listIngestJobs: (...args: any[]) => agentSetService.instance.listIngestJobs(...args),
  listDocuments: (...args: any[]) => agentSetService.instance.listDocuments(...args),
  getDocument: (...args: any[]) => agentSetService.instance.getDocument(...args),
  deleteDocument: (...args: any[]) => agentSetService.instance.deleteDocument(...args),
  search: (...args: any[]) => agentSetService.instance.search(...args),
  waitForIngestJob: (...args: any[]) => agentSetService.instance.waitForIngestJob(...args),
  testCitationAccuracy: (...args: any[]) => agentSetService.instance.testCitationAccuracy(...args),
}