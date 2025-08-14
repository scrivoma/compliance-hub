import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { documentService } from '@/lib/services/document-service'
import { pineconeDocumentService } from '@/lib/services/pinecone-document-service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    const state = searchParams.get('state')
    const categoryId = searchParams.get('categoryId')
    const search = searchParams.get('search')
    
    const filters: any = {}
    if (state) filters.state = state
    if (categoryId) filters.categoryId = categoryId
    if (search) filters.search = search
    
    const documents = await documentService.getDocuments(filters)
    
    return NextResponse.json({
      documents
    })
    
  } catch (error) {
    console.error('Failed to get documents:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve documents' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }
    
    // Use Pinecone document service for proper cleanup
    await pineconeDocumentService.deleteDocument(id)
    
    return NextResponse.json({
      success: true
    })
    
  } catch (error) {
    console.error('Failed to delete document:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete document' },
      { status: 500 }
    )
  }
}