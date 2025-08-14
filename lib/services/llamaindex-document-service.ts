import { PrismaClient } from '@prisma/client'
import { processDocumentWithFallback, type ProcessedDocument, type DocumentChunk } from '../pdf/llamaindex-processor'
import { openai } from '../openai'
import { ChromaClient } from 'chromadb'
import path from 'path'
import { agentSetIntegration } from '../agentset/agentset-integration'

const prisma = new PrismaClient()

// Enhanced chunk data for LlamaIndex
interface EnhancedChunk extends DocumentChunk {
  embedding?: number[]
  citationId: string // Unique ID for citation tracking
}

export class LlamaIndexDocumentService {
  private chroma: ChromaClient
  private collection: any

  constructor() {
    this.chroma = new ChromaClient({
      host: process.env.CHROMADB_HOST || 'localhost',
      port: parseInt(process.env.CHROMADB_PORT || '8002')
    })
  }

  async initCollection() {
    if (!this.collection) {
      try {
        this.collection = await this.chroma.getCollection({ 
          name: 'compliance_documents_llamaindex' 
        })
      } catch {
        this.collection = await this.chroma.createCollection({ 
          name: 'compliance_documents_llamaindex',
          metadata: { "hnsw:space": "cosine" }
        })
      }
    }
    return this.collection
  }

  async uploadDocument(
    filePath: string,
    documentData: {
      title: string
      description?: string
      state: string
      categoryId?: string
      uploadedBy: string
      verticals?: string[]
      documentTypes?: string[]
    }
  ): Promise<{
    documentId: string
    chunksCreated: number
    citationIds: string[]
  }> {
    console.log('🔄 Starting LlamaIndex document upload:', documentData.title)

    try {
      // Process document with coordinate tracking
      const processed = await processDocumentWithFallback(filePath)
      
      // Create document record
      const document = await prisma.document.create({
        data: {
          title: documentData.title,
          description: documentData.description,
          filePath: path.basename(filePath),
          fileSize: 0, // Will be updated later
          state: documentData.state,
          categoryId: documentData.categoryId,
          uploadedBy: documentData.uploadedBy,
          content: processed.text,
          metadata: {
            ...processed.metadata,
            chunksCount: processed.chunks.length,
            processingVersion: '2.0-llamaindex'
          },
          processingStatus: 'CHUNKING'
        }
      })

      console.log('✅ Document created in database:', document.id)

      // Create enhanced chunks with citation IDs
      const enhancedChunks: EnhancedChunk[] = processed.chunks.map((chunk, index) => ({
        ...chunk,
        citationId: `${document.id}_cite_${index}`
      }))

      // Generate embeddings and store in ChromaDB
      await this.initCollection()
      const citationIds: string[] = []

      for (let i = 0; i < enhancedChunks.length; i++) {
        const chunk = enhancedChunks[i]
        
        console.log(`📊 Processing chunk ${i + 1}/${enhancedChunks.length}`)

        try {
          // Generate embedding
          const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: chunk.text,
          })

          const embedding = response.data[0].embedding

          // Store in ChromaDB with enhanced metadata
          await this.collection.add({
            ids: [chunk.citationId],
            embeddings: [embedding],
            documents: [chunk.text],
            metadatas: [{
              documentId: document.id,
              title: documentData.title,
              chunkIndex: chunk.metadata.chunk_index,
              pageNumber: chunk.metadata.page_number,
              startChar: chunk.metadata.start_char,
              endChar: chunk.metadata.end_char,
              coordinates: JSON.stringify(chunk.metadata.coordinates),
              state: documentData.state,
              processingMethod: processed.metadata.processingMethod,
              citationId: chunk.citationId
            }]
          })

          citationIds.push(chunk.citationId)
          
        } catch (error) {
          console.error(`❌ Error processing chunk ${i + 1}:`, error)
        }
      }

      // Add relationships
      if (documentData.verticals?.length) {
        await prisma.documentVertical.createMany({
          data: documentData.verticals.map(verticalId => ({
            documentId: document.id,
            verticalId
          }))
        })
      }

      if (documentData.documentTypes?.length) {
        await prisma.documentDocumentType.createMany({
          data: documentData.documentTypes.map(documentTypeId => ({
            documentId: document.id,
            documentTypeId
          }))
        })
      }

      // Update status
      await prisma.document.update({
        where: { id: document.id },
        data: { 
          processingStatus: 'COMPLETED',
          vectorId: `llamaindex_${document.id}` // Mark as LlamaIndex processed
        }
      })

      console.log('🎉 Document upload completed successfully')
      console.log(`📊 Created ${citationIds.length} citation-ready chunks`)

      return {
        documentId: document.id,
        chunksCreated: citationIds.length,
        citationIds
      }

    } catch (error) {
      console.error('❌ Error in LlamaIndex document upload:', error)
      throw error
    }
  }

  async searchWithCitations(
    query: string,
    options: {
      topK?: number
      minSimilarity?: number
      documentIds?: string[]
      states?: string[]
    } = {}
  ): Promise<{
    results: Array<{
      text: string
      score: number
      citationId: string
      metadata: {
        documentId: string
        title: string
        pageNumber: number
        coordinates: any
        startChar: number
        endChar: number
        state?: string
      }
    }>
  }> {
    const { topK = 5, minSimilarity = 0.3, states = null } = options

    console.log('🔍 Searching with citations:', query)

    try {
      await this.initCollection()

      // Generate query embedding
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      })

      const queryEmbedding = response.data[0].embedding

      let searchResults: any

      // For multi-state searches, search each state separately to get topK results per state
      if (states && states.length > 1 && !states.includes('ALL')) {
        console.log(`🏛️ Multi-state search: Getting ${topK} results per state for ${states.length} states`)
        
        const allResults = {
          documents: [[]],
          metadatas: [[]],
          distances: [[]]
        }

        for (const state of states) {
          console.log(`🔍 Searching ${state} for ${topK} results...`)
          
          const stateResults = await this.collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: topK,
            include: ['documents', 'metadatas', 'distances'],
            where: { state: state }
          })

          if (stateResults.documents?.[0] && stateResults.metadatas?.[0]) {
            allResults.documents[0].push(...stateResults.documents[0])
            allResults.metadatas[0].push(...stateResults.metadatas[0])
            allResults.distances[0].push(...(stateResults.distances?.[0] || []))
            console.log(`✅ Found ${stateResults.documents[0].length} results for ${state}`)
          }
        }

        searchResults = allResults
        console.log(`🎯 Total combined results: ${searchResults.documents[0].length} across ${states.length} states`)
        
      } else {
        // Single state or ALL states - use original logic
        let whereClause: any = {}
        if (states && states.length > 0 && !states.includes('ALL')) {
          whereClause = { state: states[0] }
          console.log('🏛️ Single state search:', states[0])
        }

        searchResults = await this.collection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: topK,
          include: ['documents', 'metadatas', 'distances'],
          ...(Object.keys(whereClause).length > 0 && { where: whereClause })
        })
      }

      if (!searchResults.documents?.[0] || !searchResults.metadatas?.[0]) {
        return { results: [] }
      }

      // Format results with citation data
      const results = []
      for (let i = 0; i < searchResults.documents[0].length; i++) {
        const distance = searchResults.distances?.[0]?.[i] || 1
        const score = 1 - distance
        
        if (score >= minSimilarity) {
          const metadata = searchResults.metadatas[0][i]
          
          results.push({
            text: searchResults.documents[0][i],
            score,
            citationId: metadata.citationId,
            metadata: {
              documentId: metadata.documentId,
              title: metadata.title,
              pageNumber: metadata.pageNumber,
              coordinates: JSON.parse(metadata.coordinates || '{}'),
              startChar: metadata.startChar,
              endChar: metadata.endChar,
              state: metadata.state
            }
          })
        }
      }

      console.log(`✅ Found ${results.length} citation-ready results`)
      return { results }

    } catch (error) {
      console.error('❌ Error in citation search:', error)
      throw error
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    console.log('🗑️ Deleting document with citations:', documentId)

    try {
      await this.initCollection()

      // Delete from AgentSet first (before deleting from database)
      await agentSetIntegration.deleteDocument(documentId)

      // Delete all chunks for this document from ChromaDB
      await this.collection.delete({
        where: { documentId: documentId }
      })

      // Delete from database (cascades to relationships)
      await prisma.document.delete({
        where: { id: documentId }
      })

      console.log('✅ Document and all citations deleted successfully')

    } catch (error) {
      console.error('❌ Error deleting document:', error)
      throw error
    }
  }
}

export const llamaIndexDocumentService = new LlamaIndexDocumentService()