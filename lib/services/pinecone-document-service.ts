/**
 * Pinecone Document Service
 * Replaces ChromaDB with Pinecone for vector storage and search
 */

import { PrismaClient } from '@prisma/client'
import { processDocumentWithFallback, type ProcessedDocument } from '../pdf/llamaindex-processor'
import { enhancedChunkingService, type EnhancedChunk } from '../pdf/enhanced-chunking'
import { pineconeService } from '../pinecone/pinecone-service'
import { fuzzyCitationService, type CitationPosition } from '../citation/fuzzy-citation-service'
import path from 'path'

const prisma = new PrismaClient()

export interface SearchResult {
  text: string
  score: number
  citationPositions: CitationPosition[]
  metadata: {
    documentId: string
    title: string
    pageNumber?: number
    sectionTitle?: string
    state?: string
  }
}

export interface SearchOptions {
  topK?: number
  minSimilarity?: number
  states?: string[] | null
}

export class PineconeDocumentService {
  /**
   * Upload and process a document with Pinecone storage
   */
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
    vectorsStored: number
  }> {
    console.log('🔄 Starting Pinecone document upload:', documentData.title)

    try {
      // Process document with enhanced coordinate tracking
      const processed = await processDocumentWithFallback(filePath)
      
      // Create document record in database
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
            processingVersion: '3.0-pinecone-fuzzy'
          },
          processingStatus: 'CHUNKING'
        }
      })

      console.log('✅ Document created in database:', document.id)

      // Create enhanced chunks with context preservation
      const enhancedChunks = enhancedChunkingService.createEnhancedChunks(processed, {
        chunkSize: 800,
        contextRadius: 300,
        preserveSentences: true,
        preserveParagraphs: true
      })

      console.log(`📊 Created ${enhancedChunks.length} enhanced chunks`)

      // Prepare chunks for Pinecone
      const pineconeChunks = enhancedChunks.map(chunk => ({
        text: chunk.text,
        contextBefore: chunk.contextBefore,
        contextAfter: chunk.contextAfter,
        pageNumber: chunk.pageNumber,
        sectionTitle: chunk.sectionTitle,
        chunkIndex: chunk.chunkIndex,
        originalStartChar: chunk.originalStartChar,
        originalEndChar: chunk.originalEndChar
      }))

      // Store in Pinecone
      await pineconeService.upsertDocumentChunks(
        document.id,
        pineconeChunks,
        {
          title: documentData.title,
          state: documentData.state,
          verticals: documentData.verticals,
          documentTypes: documentData.documentTypes
        }
      )

      // Handle document relationships (verticals and document types)
      if (documentData.verticals && documentData.verticals.length > 0) {
        const verticalConnections = documentData.verticals.map(verticalId => ({
          documentId: document.id,
          verticalId
        }))
        await prisma.documentVertical.createMany({ data: verticalConnections })
      }

      if (documentData.documentTypes && documentData.documentTypes.length > 0) {
        const typeConnections = documentData.documentTypes.map(typeId => ({
          documentId: document.id,
          documentTypeId: typeId
        }))
        await prisma.documentDocumentType.createMany({ data: typeConnections })
      }

      // Update processing status
      await prisma.document.update({
        where: { id: document.id },
        data: { processingStatus: 'COMPLETED' }
      })

      console.log('✅ Document processing completed successfully')

      return {
        documentId: document.id,
        chunksCreated: enhancedChunks.length,
        vectorsStored: enhancedChunks.length
      }

    } catch (error) {
      console.error('❌ Error in Pinecone document upload:', error)
      throw error
    }
  }

  /**
   * Search documents using Pinecone + fuzzy citation matching
   */
  async searchWithCitations(
    query: string,
    options: SearchOptions = {}
  ): Promise<{
    results: SearchResult[]
  }> {
    const { topK = 5, minSimilarity = 0.3, states = null } = options

    console.log('🔍 Searching with Pinecone + fuzzy citations:', query)

    try {
      // Search in Pinecone with state filtering
      const pineconeResults = await pineconeService.searchWithStates(query, states, {
        topK: topK * 2, // Get more results for better fuzzy matching
        minSimilarity
      })

      console.log(`📊 Pinecone returned ${pineconeResults.results.length} results`)

      // Group results by document for fuzzy citation processing
      const documentGroups = new Map<string, typeof pineconeResults.results>()
      
      for (const result of pineconeResults.results) {
        const docId = result.metadata.documentId
        if (!documentGroups.has(docId)) {
          documentGroups.set(docId, [])
        }
        documentGroups.get(docId)!.push(result)
      }

      // Process each document group for fuzzy citations
      const searchResults: SearchResult[] = []

      for (const [documentId, results] of documentGroups) {
        try {
          // Get full document text for fuzzy matching
          const document = await prisma.document.findUnique({
            where: { id: documentId },
            select: { content: true, title: true, state: true }
          })

          if (!document || !document.content) {
            console.warn('⚠️ Document not found or has no content:', documentId)
            continue
          }

          // Prepare search results for fuzzy matching
          const chunksForMatching = results.map(result => ({
            chunkText: result.metadata.chunkText,
            contextBefore: result.metadata.contextBefore,
            contextAfter: result.metadata.contextAfter,
            metadata: result.metadata
          }))

          // Find citation positions using fuzzy matching
          console.log(`🔍 Attempting fuzzy citation matching for document ${documentId}:`)
          console.log(`   Document content length: ${document.content.length}`)
          console.log(`   Chunks to match: ${chunksForMatching.length}`)
          chunksForMatching.forEach((chunk, idx) => {
            console.log(`   Chunk ${idx}: "${chunk.chunkText.substring(0, 100)}..."`)
          })
          
          const citationPositions = fuzzyCitationService.findMultipleCitations(
            chunksForMatching,
            document.content,
            {
              threshold: 0.3,
              contextRadius: 200,
              minMatchLength: 20
            }
          )
          
          console.log(`🎯 Fuzzy citation results: ${citationPositions.length} positions found`)
          citationPositions.forEach((pos, idx) => {
            console.log(`   Position ${idx}: ${pos.startIndex}-${pos.endIndex}, confidence: ${pos.confidence}`)
          })

          // Create search results for each good chunk from this document
          if (citationPositions.length > 0) {
            // Create a result for each chunk that has good citations
            for (let i = 0; i < Math.min(results.length, 3); i++) { // Limit to top 3 chunks per document
              const result = results[i]
              
              // Filter citation positions that belong to this chunk
              const chunkCitations = citationPositions.filter(citation => 
                citation.highlightText.includes(result.metadata.chunkText.substring(0, 50)) ||
                result.metadata.chunkText.includes(citation.highlightText.substring(0, 50))
              )
              
              // If this chunk has citations or we haven't added any results yet, include it
              if (chunkCitations.length > 0 || i === 0) {
                searchResults.push({
                  text: result.metadata.chunkText,
                  score: result.score,
                  citationPositions: chunkCitations.length > 0 ? chunkCitations : citationPositions,
                  metadata: {
                    documentId,
                    title: document.title,
                    pageNumber: result.metadata.pageNumber,
                    sectionTitle: result.metadata.sectionTitle,
                    state: document.state,
                    chunkText: result.metadata.chunkText
                  }
                })
              }
            }
          }

        } catch (error) {
          console.error('❌ Error processing document for citations:', documentId, error)
          // Continue with other documents
        }
      }

      // Sort by relevance score and limit results
      searchResults.sort((a, b) => b.score - a.score)
      const limitedResults = searchResults.slice(0, topK)

      console.log(`✅ Found ${limitedResults.length} results with ${limitedResults.reduce((sum, r) => sum + r.citationPositions.length, 0)} total citations`)

      return { results: limitedResults }

    } catch (error) {
      console.error('❌ Error in Pinecone search with citations:', error)
      throw error
    }
  }

  /**
   * Delete a document from Pinecone and database
   */
  async deleteDocument(documentId: string): Promise<void> {
    console.log('🗑️ Deleting document from Pinecone and database:', documentId)

    try {
      // Delete from Pinecone
      await pineconeService.deleteDocument(documentId)

      // Delete from database (cascades to relationships)
      await prisma.document.delete({
        where: { id: documentId }
      })

      console.log('✅ Document deleted successfully')

    } catch (error) {
      console.error('❌ Error deleting document:', error)
      throw error
    }
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(documentId: string): Promise<{
    title: string
    state: string
    chunksCount: number
    processingStatus: string
    pineconeVectors: number
  }> {
    try {
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          title: true,
          state: true,
          metadata: true,
          processingStatus: true
        }
      })

      if (!document) {
        throw new Error('Document not found')
      }

      // Get Pinecone stats (approximate)
      const indexStats = await pineconeService.getIndexStats()
      
      return {
        title: document.title,
        state: document.state,
        chunksCount: (document.metadata as any)?.chunksCount || 0,
        processingStatus: document.processingStatus,
        pineconeVectors: indexStats.totalVectorCount || 0
      }

    } catch (error) {
      console.error('❌ Error getting document stats:', error)
      throw error
    }
  }

  /**
   * Test fuzzy citation accuracy for a specific document
   */
  async testCitationAccuracy(
    documentId: string,
    testQueries: string[]
  ): Promise<Array<{
    query: string
    found: boolean
    citationsCount: number
    confidence: number
    searchScore: number
  }>> {
    console.log(`🧪 Testing citation accuracy for ${testQueries.length} queries`)

    const results = []

    for (const query of testQueries) {
      try {
        const searchResult = await this.searchWithCitations(query, {
          topK: 1,
          minSimilarity: 0.1
        })

        const result = searchResult.results.find(r => r.metadata.documentId === documentId)
        
        results.push({
          query,
          found: !!result,
          citationsCount: result?.citationPositions.length || 0,
          confidence: result?.citationPositions[0]?.confidence || 0,
          searchScore: result?.score || 0
        })

      } catch (error) {
        console.error('❌ Test query failed:', query, error)
        results.push({
          query,
          found: false,
          citationsCount: 0,
          confidence: 0,
          searchScore: 0
        })
      }
    }

    const successRate = results.filter(r => r.found).length / results.length
    console.log(`✅ Citation accuracy test completed: ${(successRate * 100).toFixed(1)}% success rate`)

    return results
  }
}

// Export singleton instance
export const pineconeDocumentService = new PineconeDocumentService()