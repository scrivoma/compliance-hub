import { pineconeService } from '../pinecone/pinecone-service'
import { loadRAGSettings, getEffectiveModel } from '../settings/rag-settings'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
}) : null

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null

const genAI = process.env.GOOGLE_API_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null

export interface Citation {
  id: string
  text: string
  source: {
    documentId: string
    title: string
    pageNumber: number
    coordinates: any
    startChar: number
    endChar: number
    state?: string
  }
}

export interface StateAnswer {
  state: string
  answer: string
  citations: Citation[]
  sourceCount: number
  processingTime: number
}

export interface MultiStateSearchResult {
  query: string
  stateAnswers: StateAnswer[]
  summary?: string
  totalProcessingTime: number
}

export class MultiStateSearchService {
  
  /**
   * Searches multiple states with isolated answer generation
   * Each state gets its own prompt with only its sources to prevent cross-contamination
   */
  async searchMultipleStates(
    query: string,
    states: string[],
    options: {
      topK?: number
      generateSummary?: boolean
      conversationContext?: any
    } = {}
  ): Promise<MultiStateSearchResult> {
    const startTime = Date.now()
    const { topK = 5, generateSummary = false, conversationContext = null } = options
    
    // Deduplicate states to prevent duplicate processing
    const uniqueStates = [...new Set(states)]
    
    console.log(`🏛️ Starting multi-state search for ${uniqueStates.length} states:`, uniqueStates)
    if (uniqueStates.length !== states.length) {
      console.log('⚠️ Duplicate states detected and removed:', states.length - uniqueStates.length)
    }
    
    // Load RAG settings
    const settings = await loadRAGSettings()
    
    // Handle single state case
    if (uniqueStates.length === 1) {
      const singleStateResult = await this.searchSingleState(query, uniqueStates[0], topK, settings, conversationContext)
      return {
        query,
        stateAnswers: [singleStateResult],
        totalProcessingTime: Date.now() - startTime
      }
    }
    
    // Process multiple states in parallel
    const statePromises = uniqueStates.map(state => 
      this.searchSingleState(query, state, topK, settings, conversationContext)
    )
    
    const stateAnswers = await Promise.all(statePromises)
    
    let summary: string | undefined
    if (generateSummary && stateAnswers.length > 1) {
      summary = await this.generateSummary(query, stateAnswers, settings)
    }
    
    return {
      query,
      stateAnswers,
      summary,
      totalProcessingTime: Date.now() - startTime
    }
  }
  
  /**
   * Searches a single state with isolated sources
   */
  async searchSingleState(
    query: string,
    state: string,
    topK: number,
    settings: any,
    conversationContext: any
  ): Promise<StateAnswer> {
    const stateStartTime = Date.now()
    
    console.log(`🔍 Searching state: ${state} (${topK} sources)`)
    
    // Search for sources in this state only
    const searchOptions = { 
      topK,
      states: [state] // Force single state search
    }
    
    // Use simple Pinecone search for this state
    console.log(`🔍 Searching Pinecone for state: ${state}`)
    const pineconeResults = await pineconeService.searchWithStates(query, [state], {
      topK,
      minSimilarity: 0.1
    })
    console.log(`📊 Pinecone results for ${state}: ${pineconeResults.results.length} chunks found`)
    
    if (pineconeResults.results.length === 0) {
      return {
        state,
        answer: `Based on the available ${state} regulatory documents, I couldn't find sufficient information to answer your question.`,
        citations: [],
        sourceCount: 0,
        processingTime: Date.now() - stateStartTime
      }
    }
    
    // Convert to search results format
    const searchResults = {
      results: pineconeResults.results.map((result, index) => ({
        text: result.metadata.chunkText,
        score: result.score,
        citationId: `cite_${state}_${index}`,
        metadata: {
          documentId: result.metadata.documentId,
          title: result.metadata.title,
          pageNumber: result.metadata.pageNumber || 1,
          coordinates: [],
          startChar: 0,
          endChar: result.metadata.chunkText.length,
          state: state
        }
      }))
    }
    
    // Prepare context for this state only
    const context = this.buildStateContext(searchResults.results, state)
    
    // Generate answer using only this state's sources
    const answer = await this.generateStateAnswer(query, context, state, settings, conversationContext)
    
    // Build citations array with complete metadata structure
    const citations: Citation[] = searchResults.results.map((result, index) => ({
      id: result.citationId,
      text: result.text,
      source: {
        documentId: result.metadata.documentId,
        title: result.metadata.title,
        pageNumber: result.metadata.pageNumber,
        coordinates: result.metadata.coordinates || [],
        startChar: result.metadata.startChar,
        endChar: result.metadata.endChar,
        state: result.metadata.state
      }
    }))
    
    console.log(`🔍 ${state} citations debug:`, {
      count: citations.length,
      firstCitation: citations[0] ? {
        id: citations[0].id,
        hasDocumentId: !!citations[0].source.documentId,
        hasTitle: !!citations[0].source.title,
        state: citations[0].source.state
      } : 'none'
    })
    
    console.log(`✅ ${state} search completed: ${citations.length} citations`)
    
    return {
      state,
      answer,
      citations,
      sourceCount: searchResults.results.length,
      processingTime: Date.now() - stateStartTime
    }
  }
  
  /**
   * Builds context string for a specific state
   */
  private buildStateContext(results: any[], state: string): string {
    let context = `=== ${state} REGULATORY DOCUMENTS ===\n`
    
    results.forEach((result, index) => {
      const citationNumber = index + 1
      context += `\n[Citation ${citationNumber}]:\n${result.text}\n`
    })
    
    context += `\n=== END ${state} CONTEXT ===\n`
    return context
  }
  
  /**
   * Generates answer for a specific state using only that state's sources
   */
  private async generateStateAnswer(
    query: string,
    context: string,
    state: string,
    settings: any,
    conversationContext: any
  ): Promise<string> {
    const effectiveModel = getEffectiveModel(settings)
    
    let prompt = `You are a compliance expert analyzing ${state} regulatory documents. Answer the user's question based ONLY on the ${state} documents provided.

CRITICAL REQUIREMENTS:
1. Only use information from the ${state} regulatory documents provided
2. Use citation numbers [1], [2], etc. to reference specific information
3. If the ${state} documents don't contain enough information, state that clearly
4. Do not make assumptions about other states or general practices
5. Be specific about ${state} requirements and regulations
6. Always include citation numbers for regulatory facts or requirements

CITATION RULES:
- Use [1], [2], etc. format for citations
- Only cite information that directly supports your answer
- If multiple citations support the same point, list them like [1, 2]
- Every regulatory requirement must be cited

CONTEXT AWARENESS:
- Focus specifically on ${state} regulations
- Do not reference other states unless explicitly mentioned in the ${state} documents
- Provide ${state}-specific compliance guidance`

    // Add conversation context if this is a follow-up question
    if (conversationContext) {
      prompt += `\n\nPREVIOUS CONVERSATION:
Original Question: ${conversationContext.previousQuery}
Previous Answer: ${conversationContext.previousAnswer}

This is a follow-up question about ${state} regulations specifically.`
    }

    const fullPrompt = `${prompt}\n\n${context}\n\nQuestion: ${query}\n\nProvide a comprehensive answer about ${state} regulations based solely on the provided ${state} documents.`
    
    console.log(`🤖 Generating ${state} answer using ${settings.llmProvider}...`)
    
    try {
      if (settings.llmProvider === 'anthropic') {
        if (!anthropic) {
          throw new Error('Anthropic API key not configured')
        }
        const response = await anthropic.messages.create({
          model: effectiveModel,
          max_tokens: 1000,
          temperature: 0.7,
          messages: [{ role: 'user', content: fullPrompt }]
        })
        return response.content[0]?.type === 'text' ? response.content[0].text : ''
      } else if (settings.llmProvider === 'openai') {
        if (!openai) {
          throw new Error('OpenAI API key not configured')
        }
        const response = await openai.chat.completions.create({
          model: effectiveModel,
          max_tokens: 1000,
          temperature: 0.7,
          messages: [{ role: 'user', content: fullPrompt }]
        })
        return response.choices[0]?.message?.content || ''
      } else if (settings.llmProvider === 'google') {
        if (!genAI) {
          throw new Error('Google API key not configured')
        }
        const model = genAI.getGenerativeModel({ 
          model: effectiveModel,
          generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
        })
        const result = await model.generateContent(fullPrompt)
        return result.response.text() || ''
      }
      
      throw new Error(`Unsupported LLM provider: ${settings.llmProvider}`)
      
    } catch (error) {
      console.error(`❌ Error generating ${state} answer:`, error)
      throw error
    }
  }
  
  /**
   * Generates a summary combining all state answers
   */
  async generateSummary(
    query: string,
    stateAnswers: StateAnswer[],
    settings: any
  ): Promise<string> {
    const effectiveModel = getEffectiveModel(settings)
    
    console.log('📝 Generating multi-state summary...')
    
    // Build summary context
    let summaryContext = `=== MULTI-STATE ANALYSIS ===\n\nOriginal Question: ${query}\n\n`
    
    stateAnswers.forEach(stateAnswer => {
      summaryContext += `${stateAnswer.state} ANSWER:\n${stateAnswer.answer}\n\n`
    })
    
    const summaryPrompt = `You are a compliance expert analyzing regulatory differences across multiple states. 

Based on the individual state answers provided, create a comprehensive summary that:

1. **Highlights key differences** between states
2. **Identifies common patterns** across jurisdictions
3. **Provides comparative analysis** of requirements
4. **Notes any contradictions** or unique state provisions
5. **Offers practical guidance** for multi-state compliance

INSTRUCTIONS:
- Do not add new information not present in the state answers
- Focus on comparison and synthesis
- Highlight significant differences clearly
- Provide actionable insights for compliance across these states
- Maintain accuracy to the original state-specific information

${summaryContext}

Provide a comprehensive multi-state summary and analysis.`
    
    try {
      if (settings.llmProvider === 'anthropic') {
        if (!anthropic) {
          throw new Error('Anthropic API key not configured')
        }
        const response = await anthropic.messages.create({
          model: effectiveModel,
          max_tokens: 1500,
          temperature: 0.5,
          messages: [{ role: 'user', content: summaryPrompt }]
        })
        return response.content[0]?.type === 'text' ? response.content[0].text : ''
      } else if (settings.llmProvider === 'openai') {
        if (!openai) {
          throw new Error('OpenAI API key not configured')
        }
        const response = await openai.chat.completions.create({
          model: effectiveModel,
          max_tokens: 1500,
          temperature: 0.5,
          messages: [{ role: 'user', content: summaryPrompt }]
        })
        return response.choices[0]?.message?.content || ''
      } else if (settings.llmProvider === 'google') {
        if (!genAI) {
          throw new Error('Google API key not configured')
        }
        const model = genAI.getGenerativeModel({ 
          model: effectiveModel,
          generationConfig: { temperature: 0.5, maxOutputTokens: 1500 }
        })
        const result = await model.generateContent(summaryPrompt)
        return result.response.text() || ''
      }
      
      throw new Error(`Unsupported LLM provider: ${settings.llmProvider}`)
      
    } catch (error) {
      console.error('❌ Error generating summary:', error)
      return 'Unable to generate summary at this time.'
    }
  }
}

export const multiStateSearchService = new MultiStateSearchService()