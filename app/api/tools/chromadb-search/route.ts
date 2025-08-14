import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { ChromaDBSearchTool } from '@/lib/tools/chromadb-search'

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
    const { functionCall } = body

    if (!functionCall || functionCall.name !== 'chromadb_search') {
      return NextResponse.json(
        { error: 'Invalid function call' },
        { status: 400 }
      )
    }

    // Parse the function call parameters
    const params = ChromaDBSearchTool.parseFunctionCall(functionCall)
    
    // Execute the search
    const result = await ChromaDBSearchTool.search(params)
    
    return NextResponse.json(result)

  } catch (error) {
    console.error('ChromaDB search API error:', error)
    return NextResponse.json(
      { 
        error: 'Search failed', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}