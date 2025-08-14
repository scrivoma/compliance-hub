import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { pineconeService } from '@/lib/pinecone/pinecone-service'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    console.log('=== Testing Document Storage and Search ===')
    
    // 1. Check database for documents
    const documents = await prisma.document.findMany({
      include: {
        category: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    console.log(`Found ${documents.length} documents in database`)
    
    // 2. Test Pinecone search
    console.log('Testing Pinecone search...')
    
    const searchResults = await pineconeService.searchDocuments('licensing requirements', {
      topK: 3,
      minSimilarity: 0.3
    })
    console.log('Search results:', searchResults)
    
    // 3. Format results for display
    const formattedResults = {
      documentsInDatabase: documents.length,
      latestDocument: documents[0] ? {
        id: documents[0].id,
        title: documents[0].title,
        state: documents[0].state,
        category: documents[0].category?.name || 'Unknown',
        hasVectorId: !!documents[0].vectorId,
        contentLength: documents[0].content?.length || 0,
        createdAt: documents[0].createdAt
      } : null,
      vectorSearchResults: {
        found: searchResults.length,
        results: searchResults.map((result, index) => ({
          id: `result_${index}`,
          score: result.score,
          text: result.text?.substring(0, 200) + '...' || 'No text',
          metadata: result.metadata
        }))
      }
    }
    
    return NextResponse.json({
      success: true,
      summary: `Found ${documents.length} documents in database, ${searchResults.length} vector search results`,
      data: formattedResults
    })
    
  } catch (error) {
    console.error('Test search error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}