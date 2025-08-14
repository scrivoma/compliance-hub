import { NextRequest, NextResponse } from 'next/server'
import { pineconeService } from '@/lib/pinecone/pinecone-service'
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
    const { query, options = {} } = await request.json()

    // Load RAG settings
    const settings = await loadRAGSettings()
    const effectiveModel = getEffectiveModel(settings)

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    console.log('🔍 Citation search started:', query, 'Provider:', settings.llmProvider, 'Model:', effectiveModel)

    // Use Pinecone for search instead of ChromaDB-based service
    const searchOptions = { 
      ...options, 
      topK: settings.sourceDocuments,
      minSimilarity: 0.3
    }
    const rawResults = await pineconeService.searchDocuments(query, searchOptions)
    
    // Format results to match expected citation structure
    const searchResults = {
      results: rawResults.map((result, index) => ({
        text: result.text,
        score: result.score,
        citationId: `cite_${index}`,
        metadata: result.metadata
      }))
    }

    if (searchResults.results.length === 0) {
      return NextResponse.json({
        query,
        answer: "I couldn't find any relevant information to answer your question.",
        citations: [],
        searchResults: []
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
      context += `\n[Citation ${citationNumber}]:\n${result.text}\n`
      
      citations.push({
        id: result.citationId,
        text: result.text,
        source: result.metadata
      })
    })

    context += "\n=== END CONTEXT ===\n"

    // Generate answer with citations using Claude
    const prompt = `You are a compliance expert analyzing regulatory documents. Answer the user's question based on the provided context.

IMPORTANT CITATION RULES:
1. Use citation numbers [1], [2], etc. to reference specific information
2. Only cite information that directly supports your answer
3. Be specific about which citation supports each claim
4. If multiple citations support the same point, list them like [1, 2]

User Question: ${query}

${context}

Provide a comprehensive answer with proper citations:`

    let answer = 'No answer generated'

    if (settings.llmProvider === 'anthropic') {
      if (!anthropic) {
        throw new Error('Anthropic API key not configured')
      }
      const response = await anthropic.messages.create({
        model: effectiveModel,
        max_tokens: settings.maxTokens,
        temperature: settings.temperature,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
      answer = response.content[0]?.type === 'text' ? response.content[0].text : 'No answer generated'
    } else if (settings.llmProvider === 'openai') {
      if (!openai) {
        throw new Error('OpenAI API key not configured')
      }
      const response = await openai.chat.completions.create({
        model: effectiveModel,
        max_tokens: settings.maxTokens,
        temperature: settings.temperature,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
      answer = response.choices[0]?.message?.content || 'No answer generated'
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
      const result = await model.generateContent(prompt)
      answer = result.response.text() || 'No answer generated'
    } else {
      throw new Error(`Provider ${settings.llmProvider} not supported`)
    }

    console.log('✅ Citation search completed')

    return NextResponse.json({
      query,
      answer,
      citations,
      searchResults: searchResults.results.map(result => ({
        text: result.text.substring(0, 200) + '...',
        score: result.score,
        source: result.metadata
      })),
      processingTime: Date.now()
    })

  } catch (error) {
    console.error('❌ Error in citation search:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}