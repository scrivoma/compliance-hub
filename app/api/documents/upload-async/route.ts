import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { asyncDocumentService } from '@/lib/services/async-document-service'

export async function POST(request: NextRequest) {
  try {
    console.log('=== Async Document Upload Started ===')
    const session = await getServerSession(authOptions)
    console.log('Session:', session?.user?.id ? 'Valid' : 'Invalid')
    
    if (!session?.user?.id) {
      console.log('No valid session found')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    console.log('Parsing form data...')
    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const state = formData.get('state') as string
    const categoryId = formData.get('categoryId') as string
    
    console.log('Form data:', { 
      hasFile: !!file, 
      title, 
      state, 
      categoryId,
      fileSize: file?.size 
    })
    
    if (!file || !title || !state || !categoryId) {
      console.log('Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      )
    }
    
    // Validate file size (200MB max for async processing)
    if (file.size > 200 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 200MB' },
        { status: 400 }
      )
    }
    
    console.log('Starting async document upload...')
    const result = await asyncDocumentService.quickUpload({
      file,
      title,
      description,
      state,
      categoryId,
      uploadedBy: session.user.id
    })
    console.log('Async upload completed:', result.id)
    
    // Track the newly added document
    try {
      await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/user/new-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: result.id,
          title: result.title,
          state: state,
          type: 'Document',
          internal: true
        })
      }).catch(error => {
        console.error('Failed to track document addition:', error)
      })
      
      console.log('📝 Document addition tracked')
    } catch (error) {
      console.warn('⚠️ Failed to track document addition:', error)
    }
    
    return NextResponse.json({
      success: true,
      document: result,
      message: 'Document uploaded successfully! Processing will continue in the background.'
    })
    
  } catch (error) {
    console.error('=== Async Document Upload Error ===')
    console.error('Error message:', error instanceof Error ? error.message : error)
    console.error('Error stack:', error instanceof Error ? error.stack : error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload document' },
      { status: 500 }
    )
  }
}