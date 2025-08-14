import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { vectorDB } from '@/lib/vector-db/chroma'
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
    
    console.log('Testing ChromaDB connection...')
    await vectorDB.initialize()
    console.log('ChromaDB initialized successfully')
    
    console.log('Testing vector DB add document...')
    const testId = `test-${Date.now()}`
    await vectorDB.addDocument({
      id: testId,
      content: 'This is a test document for compliance testing.',
      metadata: {
        title: 'Test Document',
        state: 'NY',
        type: 'test'
      }
    })
    console.log('Test document added to vector DB')
    
    console.log('Testing database connection...')
    const categories = await prisma.category.findMany()
    console.log('Found categories:', categories.length)
    
    return NextResponse.json({
      success: true,
      message: 'All systems working',
      testId,
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