import { PineconeService } from '@/lib/pinecone/pinecone-service'
import Anthropic from '@anthropic-ai/sdk'
import { PrismaClient } from '@prisma/client'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

const prisma = new PrismaClient()
const pineconeService = new PineconeService()

export interface SearchResult {
  answer: string
  citations: Citation[]
  relatedDocuments: RelatedDocument[]
  searchMetadata: {
    query: string
    states?: string[] | null
    documentsSearched: number
    processingTime: number
  }
}

export interface Citation {
  text: string
  documentId: string
  documentTitle: string
  pageNumber?: number
  chunkIndex: number
  relevanceScore: number
}

export interface RelatedDocument {
  id: string
  title: string
  state: string
  category: string
  relevanceScore: number
}

export class SearchService {
  async search(query: string, userId: string): Promise<SearchResult> {
    const startTime = Date.now()
    
    try {
      // Extract state filter from query (e.g., @co, @ny)
      const stateRegex = /@(\w{2})/gi
      const stateMatches = query.match(stateRegex)
      const states = stateMatches ? stateMatches.map(m => m.substring(1).toUpperCase()) : null
      const cleanQuery = query.replace(stateRegex, '').trim()
      
      // 1. Search for relevant documents using Pinecone with increased topK
      console.log('Searching Pinecone for:', cleanQuery, 'States:', states)
      const searchResults = await pineconeService.searchWithStates(cleanQuery, states, {
        topK: 20, // Increased from 10 to get more results
        minSimilarity: 0.3
      })
      
      if (!searchResults.results || searchResults.results.length === 0) {
        return {
          answer: 'I couldn\'t find any relevant information in the compliance documents to answer your question.',
          citations: [],
          relatedDocuments: [],
          searchMetadata: {
            query: cleanQuery,
            states: states,
            documentsSearched: 0,
            processingTime: Date.now() - startTime
          }
        }
      }
      
      // 2. Prepare context from search results
      const contextChunks = searchResults.results.map((result) => {
        const metadata = result.metadata || {}
        return {
          text: metadata.text || '',
          documentId: metadata.documentId || '',
          title: metadata.title || '',
          state: metadata.state || '',
          chunkIndex: metadata.chunkIndex || 0,
          distance: 1 - result.score // Convert similarity score to distance
        }
      })
      
      // 3. Build context for Claude with better formatting
      const context = contextChunks.map((chunk, index) => 
        `[Source ${index + 1} - ${chunk.title} (${chunk.state})]:\n${chunk.text}\n---\n`
      ).join('\n')
      
      // 4. Call Claude to generate answer with citations
      console.log('Calling Claude for answer generation...')
      console.log('Context being sent to Claude:')
      console.log('=== CONTEXT START ===')
      console.log(context.substring(0, 500) + '...')
      console.log('=== CONTEXT END ===')
      
      const message = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        temperature: 0.7,
        system: `You are an expert compliance assistant for sports betting regulatory matters. You MUST answer questions using ONLY the information provided in the context below.

STRICT REQUIREMENTS:
1. ONLY use information that is explicitly stated in the provided sources
2. If the provided context doesn't contain enough information to answer the question, say "Based on the provided documents, I don't have sufficient information to answer this question completely."
3. ALWAYS cite your sources using [Source X] format for every fact or statement
4. Be comprehensive - extract all relevant information from the sources to provide a complete answer
5. Quote specific requirements, procedures, or standards when available

CITATION FORMAT: Every sentence should include [Source X] where X is the source number. Example:
"Operators must obtain licensing [Source 1]. Background checks are required during the application process [Source 2]."

Remember: Your answer should demonstrate that you are directly using the provided context, not general knowledge.`,
        messages: [{
          role: 'user',
          content: `Question: ${query}

REGULATORY DOCUMENTS PROVIDED:
${context}

INSTRUCTIONS:
- Answer the question using ONLY the information from the documents above
- Cite each source using [Source X] format
- Include specific details, requirements, and procedures from the sources
- If multiple sources cover the same topic, synthesize the information and cite all relevant sources

Provide a comprehensive answer based solely on the provided regulatory documents.`
        }]
      })
      
      const answer = message.content[0].type === 'text' ? message.content[0].text : ''
      
      // 5. Extract citations from the answer, and create citations from context chunks
      const citations: Citation[] = []
      const citationRegex = /\[Source (\d+)\]/g
      let match
      
      // Function to extract relevant text from chunks based on answer content
      const extractRelevantText = (chunk: any, answerText: string): string => {
        // Split chunk into sentences
        const sentences = chunk.text.split(/[.!?]+/).filter(s => s.trim().length > 10)
        
        // Get key terms from the answer (excluding common words)
        const answerWords = answerText.toLowerCase()
          .replace(/\[source \d+\]/g, '')
          .split(/\s+/)
          .filter(word => word.length > 3 && !['that', 'this', 'with', 'from', 'they', 'must', 'shall', 'will', 'can'].includes(word))
        
        // Score each sentence based on how many answer terms it contains
        const scoredSentences = sentences.map(sentence => {
          const sentLower = sentence.toLowerCase()
          const matchCount = answerWords.filter(word => sentLower.includes(word)).length
          return { sentence: sentence.trim(), score: matchCount }
        })
        
        // Sort by score and take the best sentences
        const topSentences = scoredSentences
          .filter(s => s.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 2)
          .map(s => s.sentence)
        
        if (topSentences.length > 0) {
          const result = topSentences.join('. ')
          return result.length > 300 ? result.substring(0, 300) + '...' : result
        }
        
        // Fallback to first 200 characters if no good matches
        return chunk.text.substring(0, 200) + '...'
      }

      // Get all unique document IDs from chunks and verify they exist
      const uniqueChunkDocIds = [...new Set(contextChunks.map(c => c.documentId))]
      const existingDocIds = new Set()
      
      for (const docId of uniqueChunkDocIds) {
        const docExists = await prisma.document.findUnique({
          where: { id: docId },
          select: { id: true }
        })
        if (docExists) {
          existingDocIds.add(docId)
        }
      }
      
      // Filter out chunks from documents that no longer exist
      const validChunks = contextChunks.filter(chunk => existingDocIds.has(chunk.documentId))
      
      // First, try to extract explicit citations from the answer
      while ((match = citationRegex.exec(answer)) !== null) {
        const sourceIndex = parseInt(match[1]) - 1
        if (sourceIndex >= 0 && sourceIndex < validChunks.length) {
          const chunk = validChunks[sourceIndex]
          const relevantText = extractRelevantText(chunk, answer)
          
          citations.push({
            text: relevantText,
            documentId: chunk.documentId,
            documentTitle: chunk.title,
            chunkIndex: chunk.chunkIndex,
            relevanceScore: 1 - chunk.distance
          })
        }
      }
      
      // If no explicit citations found, create citations from the most relevant chunks
      if (citations.length === 0 && validChunks.length > 0) {
        // Create citations for the top 3 most relevant chunks
        validChunks.slice(0, 3).forEach(chunk => {
          const relevantText = extractRelevantText(chunk, answer)
          citations.push({
            text: relevantText,
            documentId: chunk.documentId,
            documentTitle: chunk.title,
            chunkIndex: chunk.chunkIndex,
            relevanceScore: 1 - chunk.distance
          })
        })
      }
      
      // 6. Get unique related documents (using only existing document IDs)
      const relatedDocuments: RelatedDocument[] = []
      
      for (const docId of existingDocIds) {
        const doc = await prisma.document.findUnique({
          where: { id: docId },
          include: { category: true }
        })
        
        if (doc) {
          const relevantChunks = validChunks.filter(c => c.documentId === docId)
          const avgScore = relevantChunks.reduce((sum, c) => sum + (1 - c.distance), 0) / relevantChunks.length
          
          relatedDocuments.push({
            id: doc.id,
            title: doc.title,
            state: doc.state,
            category: doc.category?.name || 'Uncategorized',
            relevanceScore: avgScore
          })
        }
      }
      
      // 7. Save search history
      await prisma.searchHistory.create({
        data: {
          userId,
          query,
          results: {
            answer,
            citations,
            relatedDocuments
          }
        }
      })
      
      return {
        answer,
        citations,
        relatedDocuments: relatedDocuments.sort((a, b) => b.relevanceScore - a.relevanceScore),
        searchMetadata: {
          query: cleanQuery,
          states: states,
          documentsSearched: contextChunks.length,
          processingTime: Date.now() - startTime
        }
      }
      
    } catch (error) {
      console.error('Search error:', error)
      throw new Error(`Search failed: ${error.message}`)
    }
  }
}

export const searchService = new SearchService()