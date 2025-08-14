import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { asyncDocumentService } from '@/lib/services/async-document-service'

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
    const documentId = searchParams.get('id')
    
    if (documentId) {
      // Get status for specific document
      const status = await asyncDocumentService.getProcessingStatus(documentId)
      
      if (!status) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json({ status })
    } else {
      // Get all processing documents for user
      const processingDocuments = await asyncDocumentService.getProcessingDocuments(session.user.id)
      
      return NextResponse.json({ processingDocuments })
    }
    
  } catch (error) {
    console.error('Error fetching processing status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch processing status' },
      { status: 500 }
    )
  }
}