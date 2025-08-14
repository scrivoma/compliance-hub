// Stub version for Vercel deployment without heavy dependencies
export interface CoordinateData {
  page: number
  x: number
  y: number
  width: number
  height: number
}

export interface DocumentChunk {
  text: string
  metadata: {
    page_number: number
    chunk_index: number
    coordinates: CoordinateData
    start_char: number
    end_char: number
  }
}

export interface ProcessedDocument {
  text: string
  chunks: DocumentChunk[]
  pages: Array<{
    pageNumber: number
    text: string
    coordinates: CoordinateData[]
  }>
  metadata: {
    totalPages: number
    processingMethod: 'llamaindex'
    extractedAt: string
  }
}

// Stub implementation that returns minimal data
export async function processDocumentWithLlamaIndex(
  filePath: string,
  options: {
    chunkSize?: number
    chunkOverlap?: number
  } = {}
): Promise<ProcessedDocument> {
  console.log('⚠️ LlamaIndex processing disabled for Vercel deployment')
  
  // Return minimal valid structure
  return {
    text: 'Document processing temporarily disabled',
    chunks: [],
    pages: [{
      pageNumber: 1,
      text: 'Document processing temporarily disabled',
      coordinates: []
    }],
    metadata: {
      totalPages: 1,
      processingMethod: 'llamaindex',
      extractedAt: new Date().toISOString()
    }
  }
}

export async function processDocumentWithFallback(filePath: string): Promise<ProcessedDocument> {
  return processDocumentWithLlamaIndex(filePath)
}