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

    const body = await request.json()
    const { query, topK = 10, minSimilarity = 0.3, states } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      )
    }

    // Execute the search using Pinecone
    const results = await pineconeService.searchDocuments(query, {
      topK,
      minSimilarity,
      states
    })
    
    return NextResponse.json({
      success: true,
      query,
      results,
      total: results.length
    })

  } catch (error) {
    console.error('Pinecone search API error:', error)
    return NextResponse.json(
      { 
        error: 'Search failed', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}