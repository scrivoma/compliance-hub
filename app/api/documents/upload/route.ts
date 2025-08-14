import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { pineconeDocumentService } from '@/lib/services/pinecone-document-service'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    console.log('=== Document Upload Started ===')
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
    
    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 50MB' },
        { status: 400 }
      )
    }
    
    console.log('Starting Pinecone document upload...')
    
    // Create uploads directory
    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadsDir, { recursive: true })
    
    // Save file to disk
    const fileExtension = file.name.split('.').pop()
    const filename = `${uuidv4()}.${fileExtension}`
    const filePath = join(uploadsDir, filename)
    
    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))
    
    console.log('File saved, processing with Pinecone...')
    
    // Process with Pinecone document service
    const result = await pineconeDocumentService.uploadDocument(filePath, {
      title,
      description,
      state,
      categoryId,
      uploadedBy: session.user.id,
      verticals: [], // Add verticals if needed
      documentTypes: [] // Add document types if needed
    })
    
    console.log('Pinecone document upload completed:', result.documentId)
    
    // Track the newly added document
    try {
      await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/user/new-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: result.documentId,
          title: title,
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
      document: {
        id: result.documentId,
        title: title,
        state: state,
        chunksCreated: result.chunksCreated,
        vectorsStored: result.vectorsStored
      }
    })
    
  } catch (error) {
    console.error('=== Document Upload Error ===')
    console.error('Error message:', error instanceof Error ? error.message : error)
    console.error('Error stack:', error instanceof Error ? error.stack : error)
    console.error('Full error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload document' },
      { status: 500 }
    )
  }
}