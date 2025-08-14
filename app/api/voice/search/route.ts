import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { ChromaClient } from 'chromadb'

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
    
    // Connect to ChromaDB
    const chromaHost = process.env.CHROMA_HOST || 'localhost'
    const chromaPort = process.env.CHROMA_PORT || '8002'
    const client = new ChromaClient({ 
      path: `http://${chromaHost}:${chromaPort}` 
    })
    
    // Get the collection
    const collection = await client.getCollection({
      name: 'documents'
    })
    
    // Perform the search
    const results = await collection.query({
      queryTexts: [query],
      nResults: limit,
      include: ['documents', 'metadatas', 'distances']
    })
    
    console.log('📊 ChromaDB search results:', {
      query,
      resultCount: results.documents[0]?.length || 0,
      distances: results.distances?.[0]?.slice(0, 3) // Log top 3 distances
    })
    
    // Format results for ElevenLabs
    const formattedResults = results.documents[0]?.map((doc, index) => ({
      content: doc,
      metadata: results.metadatas?.[0]?.[index] || {},
      distance: results.distances?.[0]?.[index] || 0
    })) || []
    
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
    
    // Check if it's a ChromaDB connection error
    if (error instanceof Error && error.message.includes('Connection')) {
      return NextResponse.json(
        { 
          error: 'ChromaDB connection failed',
          message: 'Please ensure ChromaDB is running on the configured host and port'
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