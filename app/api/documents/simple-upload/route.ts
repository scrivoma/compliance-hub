import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { pineconeService } from '@/lib/pinecone/pinecone-service'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    console.log('=== Simple Upload Test Started ===')
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    console.log('Testing Pinecone connection...')
    
    console.log('Testing Pinecone search...')
    const testResults = await pineconeService.searchDocuments('test compliance', {
      topK: 1,
      minSimilarity: 0.1
    })
    console.log('Pinecone search successful, results:', testResults.length)
    
    console.log('Testing database connection...')
    const categories = await prisma.category.findMany()
    console.log('Found categories:', categories.length)
    
    return NextResponse.json({
      success: true,
      message: 'All systems working',
      pineconeResults: testResults.length,
      categoriesCount: categories.length
    })
    
  } catch (error) {
    console.error('=== Simple Upload Test Error ===')
    console.error('Error message:', error instanceof Error ? error.message : error)
    console.error('Error stack:', error instanceof Error ? error.stack : error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}