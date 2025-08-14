/**
 * Pinecone Vector Database Service
 * Handles document vectorization and similarity search
 */

import { Pinecone } from '@pinecone-database/pinecone'
import { openai } from '../openai'

export interface PineconeMetadata {
  documentId: string
  chunkText: string
  contextBefore?: string
  contextAfter?: string
  pageNumber?: number
  sectionTitle?: string
  chunkIndex: number
  title: string
  state?: string
  verticals?: string[]
  documentTypes?: string[]
  originalStartChar?: number
  originalEndChar?: number
}

export interface PineconeVector {
  id: string
  values: number[]
  metadata: PineconeMetadata
}

export interface PineconeSearchResult {
  id: string
  score: number
  metadata: PineconeMetadata
}

export interface PineconeSearchResponse {
  results: PineconeSearchResult[]
  totalResults: number
}

export class PineconeService {
  private pinecone: Pinecone
  private indexName: string
  private index: any

  constructor() {
    const apiKey = process.env.PINECONE_API_KEY
    this.indexName = process.env.PINECONE_INDEX_NAME || 'playbook2026'
    
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY environment variable is required')
    }

    this.pinecone = new Pinecone({
      apiKey
    })
  }

  async initIndex() {
    if (!this.index) {
      console.log('🌲 Initializing Pinecone index:', this.indexName)
      this.index = this.pinecone.index(this.indexName)
    }
    return this.index
  }

  /**
   * Generate embedding for text using OpenAI
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: text,
        dimensions: 3072 // Use full dimensions for better quality
      })

      return response.data[0].embedding
    } catch (error) {
      console.error('❌ Error generating embedding:', error)
      throw error
    }
  }

  /**
   * Upsert document chunks to Pinecone
   */
  async upsertDocumentChunks(
    documentId: string,
    chunks: Array<{
      text: string
      contextBefore?: string
      contextAfter?: string
      pageNumber?: number
      sectionTitle?: string
      chunkIndex: number
      originalStartChar?: number
      originalEndChar?: number
    }>,
    documentMetadata: {
      title: string
      state?: string
      verticals?: string[]
      documentTypes?: string[]
    }
  ): Promise<void> {
    console.log(`🌲 Upserting ${chunks.length} chunks to Pinecone for document:`, documentId)

    try {
      await this.initIndex()

      // Generate embeddings for all chunks in parallel
      const embeddingPromises = chunks.map(async (chunk, index) => {
        console.log(`📊 Generating embedding for chunk ${index + 1}/${chunks.length}`)
        
        // Use chunk text with context for better embeddings
        const embeddingText = [
          chunk.contextBefore,
          chunk.text,
          chunk.contextAfter
        ].filter(Boolean).join(' ')

        const embedding = await this.generateEmbedding(embeddingText)

        const vectorId = `${documentId}_chunk_${chunk.chunkIndex}`
        
        return {
          id: vectorId,
          values: embedding,
          metadata: {
            documentId,
            chunkText: embeddingText, // Store the full embedded text instead of just chunk.text
            contextBefore: chunk.contextBefore,
            contextAfter: chunk.contextAfter,
            pageNumber: chunk.pageNumber,
            sectionTitle: chunk.sectionTitle,
            chunkIndex: chunk.chunkIndex,
            title: documentMetadata.title,
            state: documentMetadata.state,
            verticals: documentMetadata.verticals,
            documentTypes: documentMetadata.documentTypes,
            originalStartChar: chunk.originalStartChar,
            originalEndChar: chunk.originalEndChar
          } as PineconeMetadata
        }
      })

      const vectors = await Promise.all(embeddingPromises)

      // Upsert vectors to Pinecone in batches
      const batchSize = 100
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize)
        console.log(`🌲 Upserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`)
        
        await this.index.upsert(batch)
      }

      console.log('✅ Successfully upserted all chunks to Pinecone')

    } catch (error) {
      console.error('❌ Error upserting chunks to Pinecone:', error)
      throw error
    }
  }

  /**
   * Search for similar chunks in Pinecone
   */
  async search(
    query: string,
    options: {
      topK?: number
      filter?: Record<string, any>
      includeMetadata?: boolean
    } = {}
  ): Promise<PineconeSearchResponse> {
    const { topK = 10, filter, includeMetadata = true } = options

    console.log('🔍 Pinecone search query:', query)

    try {
      await this.initIndex()

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query)

      // Search Pinecone
      const searchResponse = await this.index.query({
        vector: queryEmbedding,
        topK,
        includeMetadata,
        filter
      })

      const results: PineconeSearchResult[] = searchResponse.matches?.map((match: any) => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata as PineconeMetadata
      })) || []

      console.log(`✅ Pinecone search completed: ${results.length} results, top score: ${results[0]?.score || 'N/A'}`)

      return {
        results,
        totalResults: results.length
      }

    } catch (error) {
      console.error('❌ Error searching Pinecone:', error)
      throw error
    }
  }

  /**
   * Delete all chunks for a document
   */
  async deleteDocument(documentId: string): Promise<void> {
    console.log('🗑️ Deleting document from Pinecone:', documentId)

    try {
      await this.initIndex()

      // Delete all chunks for this document using filter-based deletion
      console.log(`🔍 Searching for vectors with documentId: ${documentId}`)
      
      let totalDeleted = 0
      let hasMore = true
      
      while (hasMore) {
        const chunks = await this.index.query({
          vector: new Array(3072).fill(0), // dummy vector for listing
          topK: 1000, // Process in batches of 1000
          filter: { documentId: documentId },
          includeMetadata: true
        })

        if (chunks.matches && chunks.matches.length > 0) {
          const idsToDelete = chunks.matches.map(match => match.id)
          await this.index.deleteMany(idsToDelete)
          totalDeleted += idsToDelete.length
          console.log(`🗑️ Deleted batch of ${idsToDelete.length} vectors (total: ${totalDeleted})`)
          
          // If we got fewer than 1000, we're done
          hasMore = chunks.matches.length === 1000
        } else {
          hasMore = false
          if (totalDeleted === 0) {
            console.log('⚠️ No vectors found to delete for document')
          }
        }
      }
      
      if (totalDeleted > 0) {
        console.log(`🗑️ Total deleted: ${totalDeleted} vectors for document ${documentId}`)
      }

      console.log('✅ Successfully deleted document from Pinecone')

    } catch (error) {
      console.error('❌ Error deleting document from Pinecone:', error)
      throw error
    }
  }

  /**
   * Search with state filtering
   */
  async searchWithStates(
    query: string,
    states: string[] | null,
    options: {
      topK?: number
      minSimilarity?: number
    } = {}
  ): Promise<PineconeSearchResponse> {
    const { topK = 10, minSimilarity = 0.3 } = options

    let filter: Record<string, any> = {}
    
    // Add state filtering if specified
    if (states && states.length > 0 && !states.includes('ALL')) {
      if (states.length === 1) {
        filter.state = states[0]
      } else {
        filter.state = { $in: states }
      }
      console.log('🏛️ Filtering by states:', states)
    }

    const searchResponse = await this.search(query, {
      topK,
      filter: Object.keys(filter).length > 0 ? filter : undefined
    })

    // Filter by minimum similarity score
    const filteredResults = searchResponse.results.filter(
      result => result.score >= minSimilarity
    )

    return {
      results: filteredResults,
      totalResults: filteredResults.length
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<any> {
    try {
      await this.initIndex()
      return await this.index.describeIndexStats()
    } catch (error) {
      console.error('❌ Error getting index stats:', error)
      throw error
    }
  }
}

// Export singleton instance
export const pineconeService = new PineconeService()