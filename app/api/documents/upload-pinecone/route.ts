import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { pineconeDocumentService } from '@/lib/services/pinecone-document-service'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    console.log('=== Pinecone Document Upload Started ===')
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
    const verticals = JSON.parse(formData.get('verticals') as string || '[]')
    const documentTypes = JSON.parse(formData.get('documentTypes') as string || '[]')
    
    console.log('Form data:', { 
      hasFile: !!file, 
      title, 
      state, 
      categoryId,
      verticals: verticals.length,
      documentTypes: documentTypes.length,
      fileSize: file?.size 
    })
    
    if (!file || !title || !state) {
      console.log('Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields: file, title, or state' },
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

    // Validate arrays
    if (!Array.isArray(verticals) || verticals.length === 0) {
      return NextResponse.json(
        { error: 'At least one vertical must be selected' },
        { status: 400 }
      )
    }

    if (!Array.isArray(documentTypes) || documentTypes.length === 0) {
      return NextResponse.json(
        { error: 'At least one document type must be selected' },
        { status: 400 }
      )
    }
    
    // Save file to uploads directory
    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadsDir, { recursive: true })
    
    const filename = `${uuidv4()}.pdf`
    const filePath = join(uploadsDir, filename)
    
    // Convert file to buffer and save
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)
    
    console.log('File saved to:', filePath)
    
    console.log('Starting Pinecone document service upload...')
    const result = await pineconeDocumentService.uploadDocument(filePath, {
      title,
      description,
      state,
      categoryId,
      uploadedBy: session.user.id,
      verticals,
      documentTypes
    })
    
    console.log('Pinecone document service upload completed:', result.documentId)
    
    // Track the newly added document
    try {
      await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/user/new-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: result.documentId,
          title,
          state,
          type: documentTypes[0] || 'Document',
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
        title,
        chunksCreated: result.chunksCreated,
        vectorsStored: result.vectorsStored
      }
    })
    
  } catch (error) {
    console.error('=== Pinecone Document Upload Error ===')
    console.error('Error message:', error instanceof Error ? error.message : error)
    console.error('Error stack:', error instanceof Error ? error.stack : error)
    console.error('Full error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload document' },
      { status: 500 }
    )
  }
}