import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { pineconeService } from '@/lib/pinecone/pinecone-service'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { query, limit = 5 } = await request.json()
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      )
    }

    console.log('🔍 Voice search request:', { query, limit, user: session.user.id })
    
    // Perform the search using Pinecone
    const searchResults = await pineconeService.searchDocuments(query, {
      topK: limit,
      minSimilarity: 0.3
    })
    
    console.log('📊 Pinecone search results:', {
      query,
      resultCount: searchResults.length,
      scores: searchResults.slice(0, 3).map(r => r.score) // Log top 3 scores
    })
    
    // Format results for voice API
    const formattedResults = searchResults.map((result) => ({
      content: result.text,
      metadata: result.metadata || {},
      score: result.score
    }))
    
    // Create a response that's easy for the AI to understand
    const searchSummary = formattedResults.length > 0 
      ? `Found ${formattedResults.length} relevant documents related to "${query}". Here are the key findings:\n\n${
          formattedResults.map((result, index) => 
            `${index + 1}. ${result.content?.substring(0, 200) || 'No content'}${result.content && result.content.length > 200 ? '...' : ''}\n`
          ).join('\n')
        }`
      : `No relevant documents found for "${query}". The search covered sports betting and online gaming compliance documents.`
    
    return NextResponse.json({
      success: true,
      query,
      summary: searchSummary,
      results: formattedResults,
      total: formattedResults.length
    })
    
  } catch (error) {
    console.error('❌ Voice search error:', error)
    
    // Check if it's a Pinecone connection error
    if (error instanceof Error && error.message.includes('Connection')) {
      return NextResponse.json(
        { 
          error: 'Pinecone connection failed',
          message: 'Please check Pinecone configuration and API key'
        },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Optional: Add a GET endpoint for testing
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
  
  return NextResponse.json({
    message: 'Voice search API is running',
    endpoint: '/api/voice/search',
    methods: ['POST'],
    requiredFields: ['query'],
    optionalFields: ['limit']
  })
}