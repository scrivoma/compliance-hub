import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { pineconeDocumentService } from '@/lib/services/pinecone-document-service'

export async function POST(request: NextRequest) {
  try {
    console.log('=== Pinecone AI Search Started ===')
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      console.log('No valid session found')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { query, topK, minSimilarity, states } = body
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }
    
    if (query.length > 500) {
      return NextResponse.json(
        { error: 'Query too long (max 500 characters)' },
        { status: 400 }
      )
    }
    
    console.log('Processing Pinecone search query:', {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      topK: topK || 5,
      minSimilarity: minSimilarity || 0.3,
      states: states || 'all'
    })
    
    const searchOptions = {
      topK: topK || 5,
      minSimilarity: minSimilarity || 0.3,
      states: states || null
    }
    
    const result = await pineconeDocumentService.searchWithCitations(query, searchOptions)
    
    console.log('Pinecone search completed successfully:', {
      resultsCount: result.results.length,
      totalCitations: result.results.reduce((sum, r) => sum + r.citationPositions.length, 0)
    })
    
    // Format response to match expected structure
    const formattedResults = result.results.map(searchResult => ({
      text: searchResult.text,
      score: searchResult.score,
      metadata: {
        documentId: searchResult.metadata.documentId,
        title: searchResult.metadata.title,
        pageNumber: searchResult.metadata.pageNumber,
        sectionTitle: searchResult.metadata.sectionTitle,
        state: searchResult.metadata.state
      },
      citations: searchResult.citationPositions.map(citation => ({
        startIndex: citation.startIndex,
        endIndex: citation.endIndex,
        confidence: citation.confidence,
        text: citation.highlightText,
        documentId: searchResult.metadata.documentId
      }))
    }))
    
    return NextResponse.json({
      success: true,
      results: formattedResults,
      query,
      totalResults: result.results.length,
      searchEngine: 'pinecone-fuzzy',
      processingTime: Date.now() // Placeholder
    })
    
  } catch (error) {
    console.error('=== Pinecone AI Search Error ===')
    console.error('Error message:', error instanceof Error ? error.message : error)
    console.error('Error stack:', error instanceof Error ? error.stack : error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pinecone search failed' },
      { status: 500 }
    )
  }
}