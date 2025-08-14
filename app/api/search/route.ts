import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { searchService } from '@/lib/services/search-service'

export async function POST(request: NextRequest) {
  try {
    console.log('=== AI Search Started ===')
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      console.log('No valid session found')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { query } = await request.json()
    
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
    
    console.log('Processing search query:', query)
    
    const result = await searchService.search(query, session.user.id)
    
    console.log('Search completed successfully')
    
    return NextResponse.json({
      success: true,
      ...result
    })
    
  } catch (error) {
    console.error('=== AI Search Error ===')
    console.error('Error message:', error instanceof Error ? error.message : error)
    console.error('Error stack:', error instanceof Error ? error.stack : error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    )
  }
}