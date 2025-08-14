import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    console.log('🔄 Starting LlamaIndex document upload')

    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const state = formData.get('state') as string
    const categoryId = formData.get('categoryId') as string
    const verticals = formData.get('verticals') as string
    const documentTypes = formData.get('documentTypes') as string

    // Validate required fields
    if (!file || !title || !state) {
      return NextResponse.json(
        { error: 'File, title, and state are required' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.includes('pdf')) {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      )
    }

    // Validate file size (200MB limit)
    const maxSize = 200 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File size must be less than ${maxSize / (1024 * 1024)}MB` },
        { status: 400 }
      )
    }

    console.log('📄 File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    })

    // Save file to uploads directory
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const filepath = join(process.cwd(), 'public', 'uploads', filename)
    
    await writeFile(filepath, buffer)
    console.log('💾 File saved to:', filepath)

    // Parse arrays
    const verticalsArray = verticals ? JSON.parse(verticals) : []
    const documentTypesArray = documentTypes ? JSON.parse(documentTypes) : []

    // LlamaIndex service temporarily disabled for Vercel deployment
    // Redirect to async Pinecone upload instead
    return NextResponse.json({
      error: 'LlamaIndex service temporarily disabled',
      message: 'Please use the async LlamaIndex upload endpoint instead',
      redirect: '/api/documents/upload-async-llamaindex'
    }, { status: 501 })

  } catch (error) {
    console.error('❌ Error in LlamaIndex upload:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Upload failed',
        details: 'Check server logs for more information'
      },
      { status: 500 }
    )
  }
}