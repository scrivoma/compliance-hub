import { NextRequest } from 'next/server'
import { pineconeDocumentService } from '@/lib/services/pinecone-document-service'
import { pineconeService } from '@/lib/pinecone/pinecone-service'
import { multiStateSearchService } from '@/lib/services/multi-state-search-service'
import { loadRAGSettings, getEffectiveModel } from '@/lib/settings/rag-settings'
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, options = {}, conversationContext = null, states = null, stateAnswers = null } = body

    // Load RAG settings
    const settings = await loadRAGSettings()
    const effectiveModel = getEffectiveModel(settings)

    console.log('🔍 Request body:', { 
      query, 
      hasContext: !!conversationContext,
      contextKeys: conversationContext ? Object.keys(conversationContext) : null,
      provider: settings.llmProvider,
      model: effectiveModel,
      states: states,
      summaryOnly: options.summaryOnly,
      hasStateAnswers: !!stateAnswers
    })

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Handle summary-only requests with existing state answers
    if (options.summaryOnly && stateAnswers && stateAnswers.length > 1) {
      console.log('📝 Generating summary from existing state answers...')
      
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          // Send summary header
          const summaryHeader = {
            type: 'summary-header'
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(summaryHeader)}\n\n`))
          
          try {
            const summary = await multiStateSearchService.generateSummary(query, stateAnswers, settings)
            
            // Stream summary content
            const summaryChunks = summary.split(' ')
            let currentChunk = ''
            
            for (let i = 0; i < summaryChunks.length; i++) {
              currentChunk += summaryChunks[i] + ' '
              
              if (i % 10 === 0 || i === summaryChunks.length - 1) {
                const summaryData = {
                  type: 'summary-content',
                  content: currentChunk
                }
                
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(summaryData)}\n\n`))
                currentChunk = ''
                
                await new Promise(resolve => setTimeout(resolve, 100))
              }
            }
            
            // Send summary completion
            const summaryComplete = {
              type: 'summary-complete'
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(summaryComplete)}\n\n`))
            
            // Send done
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
            controller.close()
            
          } catch (error) {
            console.error('❌ Error generating summary:', error)
            const errorData = {
              type: 'error',
              error: 'Failed to generate summary'
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`))
            controller.close()
          }
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      })
    }

    console.log('🔍 Citation search started (streaming):', query)

    // Generate enhanced search query for follow-up questions
    let searchQuery = query
    if (conversationContext) {
      console.log('🔄 Generating contextual search query for follow-up...')
      
      const queryEnhancementPrompt = `Rewrite this follow-up question to include context from the previous conversation:

Previous question: ${conversationContext.previousQuery}
Follow-up: ${query}

Rewrite the follow-up to be a standalone search query that includes relevant keywords from both questions. Focus on regulatory and compliance terms.

Enhanced query:`

      console.log('📝 Query enhancement prompt:', queryEnhancementPrompt.substring(0, 200) + '...')

      try {
        let enhancedQuery = query // fallback

        if (settings.llmProvider === 'anthropic') {
          if (!anthropic) {
            throw new Error('Anthropic API key not configured')
          }
          const response = await anthropic.messages.create({
            model: effectiveModel,
            max_tokens: 150,
            temperature: 0.1,
            messages: [{ role: 'user', content: queryEnhancementPrompt }]
          })
          enhancedQuery = response.content[0]?.type === 'text' ? response.content[0].text.trim() : query
        } else if (settings.llmProvider === 'openai') {
          if (!openai) {
            throw new Error('OpenAI API key not configured')
          }
          const response = await openai.chat.completions.create({
            model: effectiveModel,
            max_tokens: 150,
            temperature: 0.1,
            messages: [{ role: 'user', content: queryEnhancementPrompt }]
          })
          enhancedQuery = response.choices[0]?.message?.content?.trim() || query
        } else if (settings.llmProvider === 'google') {
          if (!genAI) {
            throw new Error('Google API key not configured')
          }
          const model = genAI.getGenerativeModel({ 
            model: effectiveModel,
            generationConfig: { temperature: 0.1, maxOutputTokens: 150 }
          })
          console.log('📝 Sending query enhancement prompt to Google...')
          const result = await model.generateContent(queryEnhancementPrompt)
          const responseText = result.response.text()?.trim()
          console.log('📝 Google response:', responseText)
          enhancedQuery = responseText || query
        }

        // Validate that we got a meaningful enhancement
        if (enhancedQuery && enhancedQuery.trim() && enhancedQuery !== query && enhancedQuery.length > 3) {
          searchQuery = enhancedQuery
          console.log('🎯 Enhanced search query:', searchQuery)
        } else {
          console.log('⚠️ Enhancement failed, using manual fallback')
          // Manual fallback: combine key terms from both questions
          const prevKeywords = conversationContext.previousQuery.toLowerCase()
            .split(' ')
            .filter((word: string) => word.length > 3 && !['what', 'how', 'when', 'where', 'why', 'the', 'and', 'for', 'are', 'this', 'that'].includes(word))
            .slice(0, 3)
          
          const followUpKeywords = query.toLowerCase()
            .split(' ')
            .filter((word: string) => word.length > 2)
            .slice(0, 3)
          
          const combinedKeywords = Array.from(new Set([...prevKeywords, ...followUpKeywords]))
          searchQuery = combinedKeywords.join(' ')
          console.log('🔧 Manual fallback query:', searchQuery)
        }

      } catch (error) {
        console.error('❌ Failed to enhance query, using original:', error)
        searchQuery = query
      }
    }

    // Check if this is a multi-state search that needs isolation
    const isMultiStateSearch = states && states.length > 1 && !states.includes('ALL')
    
    if (isMultiStateSearch) {
      console.log('🏛️ Multi-state search detected, using state isolation service')
      
      // Use streaming multi-state search for real-time results
      console.log('🔍 Input states for multi-state search:', states)
      return streamMultiStateSearchResults(searchQuery, states, settings, conversationContext, query, options)
    }

    // Single state or ALL states - use original logic
    const searchOptions = { 
      ...options, 
      topK: settings.sourceDocuments,
      states: states
    }
    // Use simple Pinecone search for standard RAG workflow
    console.log('🔍 Using simple Pinecone search for standard RAG...')
    const pineconeResults = await pineconeService.searchWithStates(searchQuery, states, {
      topK: settings.sourceDocuments,
      minSimilarity: 0.1
    })
    
    // Convert to simple search results format
    const searchResults = {
      results: pineconeResults.results.map((result, index) => ({
        text: result.metadata.chunkText,
        score: result.score,
        citationPositions: [], // Skip fuzzy matching for now
        metadata: {
          documentId: result.metadata.documentId,
          title: result.metadata.title,
          pageNumber: result.metadata.pageNumber || 1,
          chunkText: result.metadata.chunkText,
          startChar: 0,
          endChar: result.metadata.chunkText.length,
          coordinates: []
        }
      }))
    }
    
    console.log('🔍 Simple RAG results:', {
      pineconeResults: pineconeResults.results.length,
      convertedResults: searchResults.results.length,
      topScore: pineconeResults.results[0]?.score || 'none'
    })

    console.log('🔍 Pinecone search results:', {
      resultsCount: searchResults.results.length,
      query: searchQuery,
      options: searchOptions
    })

    if (searchResults.results.length === 0) {
      return new Response(JSON.stringify({
        query,
        answer: "I couldn't find any relevant information to answer your question.",
        citations: [],
        searchResults: []
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Prepare context for Claude with citation markers
    let context = "=== CONTEXT WITH CITATIONS ===\n"
    const citations: Array<{
      id: string
      text: string
      source: {
        documentId: string
        title: string
        pageNumber: number
        coordinates: any
        startChar: number
        endChar: number
      }
    }> = []

    searchResults.results.forEach((result, index) => {
      const citationNumber = index + 1
      const chunkText = result.metadata.chunkText || result.text || ''
      context += `\n[Citation ${citationNumber}]:\n${chunkText}\n`
      
      // Debug logging
      if (index === 0) {
        console.log('📄 First search result:', {
          text: chunkText?.substring(0, 200) + '...',
          score: result.score,
          hasText: !!chunkText,
          textLength: chunkText?.length || 0,
          metadataKeys: result.metadata ? Object.keys(result.metadata) : []
        })
      }
      
      // Create proper citation with positions if available
      const citation = {
        id: `cite_${index}`,
        text: chunkText,
        source: {
          documentId: result.metadata.documentId,
          title: result.metadata.title,
          pageNumber: result.metadata.pageNumber || 1,
          coordinates: result.citationPositions || [],
          startChar: (result.citationPositions as any)?.[0]?.startIndex || 0,
          endChar: (result.citationPositions as any)?.[0]?.endIndex || chunkText.length
        }
      }
      
      // Debug citation structure
      if (index === 0) {
        console.log('📍 Citation structure:', {
          hasPositions: !!result.citationPositions,
          positionsCount: result.citationPositions?.length || 0,
          firstPosition: result.citationPositions?.[0] || 'none',
          source: citation.source
        })
      }
      
      citations.push(citation)
    })

    context += "\n=== END CONTEXT ===\n"
    
    // Debug the context being sent to AI
    console.log('📊 Context summary:', {
      totalLength: context.length,
      numCitations: searchResults.results.length,
      firstCitation: context.substring(0, 500) + '...'
    })

    // Generate answer with citations using Claude
    let prompt = `You are a compliance expert analyzing regulatory documents. Answer the user's question based on the provided context.

IMPORTANT CITATION RULES:
1. Use citation numbers [1], [2], etc. to reference specific information
2. Only cite information that directly supports your answer
3. Be specific about which citation supports each claim
4. If multiple citations support the same point, list them like [1, 2]
5. ALWAYS include citation numbers for any regulatory fact or requirement mentioned`

    // Add conversation context if this is a follow-up question
    if (conversationContext) {
      prompt += `\n\nPREVIOUS CONVERSATION:
Original Question: ${conversationContext.previousQuery}
Previous Answer: ${conversationContext.previousAnswer}`

      // Add state context from previous conversation
      if (conversationContext.stateContext) {
        prompt += `\nPrevious Context: ${conversationContext.stateContext}`
      }

      prompt += `\n\nThis is a follow-up question that may reference the previous conversation.`
      
      // If we enhanced the search query, mention it
      if (searchQuery !== query) {
        prompt += `\n\nNOTE: The search was enhanced from "${query}" to "${searchQuery}" to find more relevant context.`
      }
    }

    // Add state context information
    if (states && states.length > 0) {
      if (states.includes('ALL')) {
        prompt += `\n\nJURISDICTION CONTEXT: This search covers ALL states. 

REQUIRED ANSWER FORMAT:
1. Break down your answer by state, with clear sections for each jurisdiction
2. Use headers like "Colorado:", "Michigan:", etc.
3. Include specific citations for each state's requirements
4. End with a "Summary Comparison:" section highlighting key differences
5. EVERY regulatory fact must have a citation number`
      } else if (states.length === 1) {
        prompt += `\n\nJURISDICTION CONTEXT: This search is specifically for ${states[0]} regulations. Focus your answer on ${states[0]}-specific requirements.`
      } else {
        prompt += `\n\nJURISDICTION CONTEXT: This search covers multiple states: ${states.join(', ')}. 

REQUIRED ANSWER FORMAT:
1. Break down your answer by state, with clear sections for each jurisdiction
2. Use headers like "${states.map((s: string) => s + ':').join(', ')}"
3. Include specific citations for each state's requirements
4. End with a "Summary Comparison:" section highlighting key differences
5. EVERY regulatory fact must have a citation number`
      }
    }

    prompt += `\n\nCurrent Question: ${query}

${context}

Provide a comprehensive answer with proper citations:`

    // Create a streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // First, send the metadata (citations, etc)
          const metadata = {
            type: 'metadata',
            query,
            citations,
            searchResults: searchResults.results.map(result => ({
              text: result.text.substring(0, 100) + '...', // Further reduced to 100
              score: result.score,
              source: {
                documentId: result.metadata.documentId,
                title: result.metadata.title,
                pageNumber: result.metadata.pageNumber,
                state: (result.metadata as any).state
                // Omit coordinates and character positions to reduce size
              }
            }))
          }
          
          try {
            const metadataStr = JSON.stringify(metadata)
            console.log('📊 Metadata size:', metadataStr.length, 'characters')
            
            // If metadata is too large, send citations separately
            if (metadataStr.length > 6000) {
              console.warn('⚠️ Large metadata detected, splitting into chunks')
              
              // Send basic metadata first
              const basicMetadata = {
                type: 'metadata',
                query,
                citations: [],
                searchResults: []
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(basicMetadata)}\n\n`))
              
              // Send citations in a separate chunk
              const citationsData = {
                type: 'citations',
                citations
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(citationsData)}\n\n`))
              
            } else {
              controller.enqueue(encoder.encode(`data: ${metadataStr}\n\n`))
            }
          } catch (jsonError) {
            console.error('Failed to stringify metadata:', jsonError)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Metadata serialization failed' })}\n\n`))
          }

          // Stream the answer using configured LLM provider
          if (settings.llmProvider === 'anthropic') {
            if (!anthropic) {
              throw new Error('Anthropic API key not configured')
            }
            const stream = await anthropic.messages.create({
              model: effectiveModel,
              max_tokens: settings.maxTokens,
              temperature: settings.temperature,
              messages: [
                {
                  role: 'user',
                  content: prompt
                }
              ],
              stream: true
            })

            for await (const chunk of stream) {
              if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                const data = {
                  type: 'content',
                  content: chunk.delta.text
                }
                try {
                  const jsonStr = JSON.stringify(data)
                  controller.enqueue(encoder.encode(`data: ${jsonStr}\n\n`))
                } catch (jsonError) {
                  console.error('Failed to stringify content:', jsonError, 'Content:', chunk.delta.text)
                }
              }
            }
          } else if (settings.llmProvider === 'openai') {
            if (!openai) {
              throw new Error('OpenAI API key not configured')
            }
            const stream = await openai.chat.completions.create({
              model: effectiveModel,
              max_tokens: settings.maxTokens,
              temperature: settings.temperature,
              messages: [
                {
                  role: 'user',
                  content: prompt
                }
              ],
              stream: true
            })

            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content
              if (content) {
                const data = {
                  type: 'content',
                  content: content
                }
                try {
                  const jsonStr = JSON.stringify(data)
                  controller.enqueue(encoder.encode(`data: ${jsonStr}\n\n`))
                } catch (jsonError) {
                  console.error('Failed to stringify content:', jsonError, 'Content:', content)
                }
              }
            }
          } else if (settings.llmProvider === 'google') {
            if (!genAI) {
              throw new Error('Google API key not configured')
            }
            const model = genAI.getGenerativeModel({ 
              model: effectiveModel,
              generationConfig: {
                temperature: settings.temperature,
                maxOutputTokens: settings.maxTokens,
              }
            })

            const result = await model.generateContentStream(prompt)

            for await (const chunk of result.stream) {
              const chunkText = chunk.text()
              if (chunkText) {
                const data = {
                  type: 'content',
                  content: chunkText
                }
                try {
                  const jsonStr = JSON.stringify(data)
                  controller.enqueue(encoder.encode(`data: ${jsonStr}\n\n`))
                } catch (jsonError) {
                  console.error('Failed to stringify content:', jsonError, 'Content:', chunkText)
                }
              }
            }
          } else {
            throw new Error(`Provider ${settings.llmProvider} not supported`)
          }

          // Send completion signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
          controller.close()
          
          console.log('✅ Citation search completed (streaming)')
        } catch (error) {
          console.error('❌ Error during streaming:', error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Stream failed' })}\n\n`))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })

  } catch (error) {
    console.error('❌ Error in citation search:', error)
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error')
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Streams multi-state search results as they complete in real-time
 */
async function streamMultiStateSearchResults(query: string, states: string[], settings: any, conversationContext: any, originalQuery: string, options: any = {}) {
  console.log('🎯 Starting real-time multi-state search streaming')
  
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Deduplicate states
        const uniqueStates = Array.from(new Set(states))
        
        // Send metadata with multi-state structure
        const metadata = {
          type: 'multi-state-metadata',
          query: originalQuery,
          stateCount: uniqueStates.length,
          states: uniqueStates,
          totalProcessingTime: 0
        }
        
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`))
        
        // Send initial state-queued events for immediate UI feedback
        for (const state of uniqueStates) {
          const queuedEvent = {
            type: 'state-queued',
            state: state
          }
          
          if (controller.desiredSize !== null) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(queuedEvent)}\n\n`))
          }
        }
        
        // Process states concurrently and stream results as they complete
        const statePromises = uniqueStates.map(async (state) => {
          console.log(`🔍 Starting ${state} search`)
          
          try {
            // Send state-processing event before starting search
            const processingEvent = {
              type: 'state-processing',
              state: state
            }
            
            if (controller.desiredSize !== null) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(processingEvent)}\n\n`))
            }
            
            // Search for this state using the multi-state service
            const stateResult = await multiStateSearchService.searchSingleState(query, state, settings.sourceDocuments, settings, conversationContext)
            
            // Send state header with correct source count
            const stateHeader = {
              type: 'state-header',
              state: state,
              sourceCount: stateResult.sourceCount,
              processingTime: stateResult.processingTime
            }
            
            // Check if controller is still open before enqueueing
            if (controller.desiredSize === null) {
              console.log(`⚠️ Controller closed, skipping state header for ${state}`)
              return stateResult
            }
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(stateHeader)}\n\n`))
            
            // Send state citations
            const stateCitations = {
              type: 'state-citations',
              state: state,
              citations: stateResult.citations
            }
            
            if (controller.desiredSize === null) {
              console.log(`⚠️ Controller closed, skipping state citations for ${state}`)
              return stateResult
            }
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(stateCitations)}\n\n`))
            
            // Stream the answer content in chunks
            const answerChunks = stateResult.answer.split(' ')
            let currentChunk = ''
            
            for (let i = 0; i < answerChunks.length; i++) {
              currentChunk += answerChunks[i] + ' '
              
              // Send chunk every 8 words or at the end
              if (i % 8 === 0 || i === answerChunks.length - 1) {
                const contentData = {
                  type: 'state-content',
                  state: state,
                  content: currentChunk
                }
                
                if (controller.desiredSize !== null) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(contentData)}\n\n`))
                }
                currentChunk = ''
                
                // Small delay to simulate streaming
                await new Promise(resolve => setTimeout(resolve, 100))
              }
            }
            
            // Send state completion
            const stateComplete = {
              type: 'state-complete',
              state: state
            }
            
            if (controller.desiredSize !== null) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(stateComplete)}\n\n`))
            }
            
            console.log(`✅ ${state} search completed`)
            return stateResult
            
          } catch (error) {
            console.error(`❌ Error processing ${state}:`, error)
            
            // Send error for this state
            const stateError = {
              type: 'state-error',
              state: state,
              error: 'Failed to process state'
            }
            
            // Check if controller is still open before enqueueing error
            if (controller.desiredSize !== null) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(stateError)}\n\n`))
            }
            
            return null
          }
        })
        
        // Wait for all states to complete
        const stateResults = await Promise.all(statePromises)
        const validResults = stateResults.filter(r => r !== null)
        
        // Only generate summary if explicitly requested
        if (validResults.length > 1 && options.summaryOnly) {
          console.log('📝 Generating summary on demand...')
          
          const summaryHeader = {
            type: 'summary-header'
          }
          
          if (controller.desiredSize !== null) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(summaryHeader)}\n\n`))
          }
          
          try {
            const summary = await multiStateSearchService.generateSummary(query, validResults, settings)
            
            // Stream summary content
            const summaryChunks = summary.split(' ')
            let currentChunk = ''
            
            for (let i = 0; i < summaryChunks.length; i++) {
              currentChunk += summaryChunks[i] + ' '
              
              if (i % 10 === 0 || i === summaryChunks.length - 1) {
                const summaryData = {
                  type: 'summary-content',
                  content: currentChunk
                }
                
                if (controller.desiredSize !== null) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(summaryData)}\n\n`))
                }
                currentChunk = ''
                
                await new Promise(resolve => setTimeout(resolve, 100))
              }
            }
            
            // Send summary completion
            const summaryComplete = {
              type: 'summary-complete'
            }
            
            if (controller.desiredSize !== null) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(summaryComplete)}\n\n`))
            }
            
          } catch (error) {
            console.error('❌ Error generating summary:', error)
            
            const summaryError = {
              type: 'summary-error',
              error: 'Failed to generate summary'
            }
            
            if (controller.desiredSize !== null) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(summaryError)}\n\n`))
            }
          }
        }
        
        // Send final completion
        if (controller.desiredSize !== null) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
          controller.close()
        }
        
        console.log('✅ Real-time multi-state search streaming completed')
        
      } catch (error) {
        console.error('❌ Error in real-time multi-state search:', error)
        if (controller.desiredSize !== null) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Multi-state stream failed' })}\n\n`))
          controller.close()
        }
      }
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}