import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { PrismaClient } from '@prisma/client'
import { processDocumentWithFallback } from '@/lib/pdf/llamaindex-processor'
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

    // Resolve verticals and document types (handle both IDs and names)
    let resolvedVerticals = await prisma.vertical.findMany({
      where: { 
        OR: [
          { id: { in: verticalsArray } },
          { name: { in: verticalsArray } }
        ]
      }
    })
    
    // Auto-create missing verticals from known static values
    if (resolvedVerticals.length === 0 && verticalsArray.length > 0) {
      const knownVerticals = ['fantasy-sports', 'igaming', 'ilottery', 'landbased', 'lottery', 'sports-online', 'sports-retail']
      for (const v of verticalsArray) {
        if (knownVerticals.includes(v)) {
          const displayName = v.split('-').map((w: string) => 
            w === 'sports' ? 'Sports' : w.charAt(0).toUpperCase() + w.slice(1)
          ).join(' ')
          await prisma.vertical.upsert({
            where: { name: v },
            update: {},
            create: { name: v, displayName }
          })
        }
      }
      resolvedVerticals = await prisma.vertical.findMany({
        where: { name: { in: verticalsArray } }
      })
    }
    
    let resolvedDocTypes = await prisma.documentType.findMany({
      where: { 
        OR: [
          { id: { in: documentTypesArray } },
          { name: { in: documentTypesArray } }
        ]
      }
    })
    
    // Auto-create missing document types from known static values
    if (resolvedDocTypes.length === 0 && documentTypesArray.length > 0) {
      const knownDocTypes = ['aml', 'data', 'formal-guidance', 'informal-guidance', 'licensing-forms', 'other', 'regulation', 'statute', 'technical-bulletin']
      for (const dt of documentTypesArray) {
        if (knownDocTypes.includes(dt)) {
          const displayName = dt.split('-').map((w: string) => 
            w.charAt(0).toUpperCase() + w.slice(1)
          ).join(' ')
          await prisma.documentType.upsert({
            where: { name: dt },
            update: {},
            create: { name: dt, displayName }
          })
        }
      }
      resolvedDocTypes = await prisma.documentType.findMany({
        where: { name: { in: documentTypesArray } }
      })
    }

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

    // Add relationships using resolved IDs
    if (resolvedVerticals.length > 0) {
      await prisma.documentVertical.createMany({
        data: resolvedVerticals.map((vertical) => ({
          documentId: document.id,
          verticalId: vertical.id
        }))
      })
    }

    if (resolvedDocTypes.length > 0) {
      await prisma.documentDocumentType.createMany({
        data: resolvedDocTypes.map((docType) => ({
          documentId: document.id,
          documentTypeId: docType.id
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