import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { PrismaClient } from '@prisma/client'
import { processDocumentWithFallback } from '@/lib/pdf/llamaindex-processor-stub'
import { enhancedChunkingService } from '@/lib/pdf/enhanced-chunking'
import { pineconeService } from '@/lib/pinecone/pinecone-service'

const prisma = new PrismaClient()

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

    console.log('🔄 Starting async LlamaIndex document upload')

    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const state = formData.get('state') as string
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

    // Create document record with UPLOADED status
    const document = await prisma.document.create({
      data: {
        title,
        description: description || undefined,
        filePath: filename,
        fileSize: file.size,
        state,
        uploadedBy: session.user.email,
        content: '', // Will be filled during processing
        metadata: {
          filename: file.name,
          originalSize: file.size,
          verticals: verticalsArray,
          documentTypes: documentTypesArray,
          processingMethod: 'llamaindex-async'
        },
        processingStatus: 'UPLOADED',
        processingProgress: 0
      }
    })

    // Add relationships
    if (verticalsArray.length > 0) {
      await prisma.documentVertical.createMany({
        data: verticalsArray.map((verticalId: string) => ({
          documentId: document.id,
          verticalId
        }))
      })
    }

    if (documentTypesArray.length > 0) {
      await prisma.documentDocumentType.createMany({
        data: documentTypesArray.map((documentTypeId: string) => ({
          documentId: document.id,
          documentTypeId
        }))
      })
    }

    console.log('✅ Document created in database:', document.id)

    // Track the newly added document
    try {
      const documentType = documentTypesArray.length > 0 ? documentTypesArray[0] : 'Document'
      await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/user/new-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: document.id,
          title: document.title,
          state: document.state,
          type: documentType,
          internal: true
        })
      }).catch(error => {
        console.error('Failed to track document addition:', error)
      })
      
      console.log('📝 Document addition tracked')
    } catch (error) {
      console.warn('⚠️ Failed to track document addition:', error)
    }

    // Process document with Pinecone directly
    try {
      console.log('🚀 Starting Pinecone processing...')
      
      // Update status to processing
      await prisma.document.update({
        where: { id: document.id },
        data: {
          processingStatus: 'EXTRACTING',
          processingProgress: 10
        }
      })
      
      // Process document with LlamaParse/fallback
      const processed = await processDocumentWithFallback(filepath)
      
      // Update status to chunking
      await prisma.document.update({
        where: { id: document.id },
        data: {
          processingStatus: 'CHUNKING',
          processingProgress: 30,
          content: processed.text
        }
      })
      
      // Create enhanced chunks
      const enhancedChunks = enhancedChunkingService.createEnhancedChunks(processed, {
        chunkSize: 800,
        contextRadius: 300,
        preserveSentences: true,
        preserveParagraphs: true
      })
      
      // Update status to embedding
      await prisma.document.update({
        where: { id: document.id },
        data: {
          processingStatus: 'EMBEDDING',
          processingProgress: 60,
          totalChunks: enhancedChunks.length
        }
      })
      
      // Prepare chunks for Pinecone
      const pineconeChunks = enhancedChunks.map(chunk => ({
        text: chunk.text,
        contextBefore: chunk.contextBefore,
        contextAfter: chunk.contextAfter,
        pageNumber: chunk.pageNumber,
        sectionTitle: chunk.sectionTitle,
        chunkIndex: chunk.chunkIndex,
        originalStartChar: chunk.originalStartChar,
        originalEndChar: chunk.originalEndChar
      }))
      
      // Store in Pinecone
      await pineconeService.upsertDocumentChunks(
        document.id,
        pineconeChunks,
        {
          title: document.title,
          state: document.state,
          verticals: verticalsArray,
          documentTypes: documentTypesArray
        }
      )
      
      // Mark as completed
      await prisma.document.update({
        where: { id: document.id },
        data: {
          processingStatus: 'COMPLETED',
          processingProgress: 100,
          vectorId: `pinecone_${document.id}`,
          metadata: {
            chunksCount: enhancedChunks.length,
            processingVersion: '3.0-pinecone-fuzzy',
            ...(document.metadata && typeof document.metadata === 'object' ? document.metadata as Record<string, any> : {})
          }
        }
      })
      
      console.log('✅ Pinecone processing completed:', {
        documentId: document.id,
        chunksCreated: enhancedChunks.length,
        vectorsStored: enhancedChunks.length
      })
      
    } catch (error) {
      console.error('❌ Pinecone processing failed:', error)
      await prisma.document.update({
        where: { id: document.id },
        data: {
          processingStatus: 'FAILED',
          processingProgress: 0,
          processingError: error instanceof Error ? error.message : 'Unknown error'
        }
      }).catch(e => console.error('Failed to update error status:', e))
    }

    return NextResponse.json({
      success: true,
      documentId: document.id,
      message: 'Document uploaded successfully. Processing started in background.',
      processingStatus: 'UPLOADED',
      processingProgress: 0
    })

  } catch (error) {
    console.error('❌ Error in async LlamaIndex upload:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Upload failed',
        details: 'Check server logs for more information'
      },
      { status: 500 }
    )
  }
}