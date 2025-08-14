import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { vectorDB } from '@/lib/vector-db/chroma'
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
    
    // 2. Test ChromaDB search
    console.log('Testing ChromaDB search...')
    await vectorDB.initialize()
    
    const searchResults = await vectorDB.searchDocuments('licensing requirements', 3)
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
        found: searchResults.ids?.[0]?.length || 0,
        results: searchResults.ids?.[0]?.map((id: string, index: number) => ({
          id,
          distance: searchResults.distances?.[0]?.[index],
          text: searchResults.documents?.[0]?.[index]?.substring(0, 200) + '...',
          metadata: searchResults.metadatas?.[0]?.[index]
        })) || []
      }
    }
    
    return NextResponse.json({
      success: true,
      summary: `Found ${documents.length} documents in database, ${searchResults.ids?.[0]?.length || 0} vector search results`,
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