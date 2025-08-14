import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { processDocumentWithFallback } from '@/lib/pdf/llamaindex-processor'
import { enhancedChunkingService } from '@/lib/pdf/enhanced-chunking'
import { pineconeService } from '@/lib/pinecone/pinecone-service'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const { documentId, filepath } = await request.json()

    if (!documentId || !filepath) {
      return NextResponse.json(
        { error: 'Document ID and filepath are required' },
        { status: 400 }
      )
    }

    console.log('🔄 Starting background processing for document:', documentId)

    // Update status to EXTRACTING
    await prisma.document.update({
      where: { id: documentId },
      data: { 
        processingStatus: 'EXTRACTING',
        processingProgress: 10
      }
    })

    // Get document details
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        verticals: true,
        documentTypes: true
      }
    })

    if (!document) {
      throw new Error('Document not found')
    }

    // Process document with LlamaIndex processor
    console.log('📊 Processing document with LlamaIndex...')
    const processed = await processDocumentWithFallback(filepath)

    // Update status to CHUNKING
    await prisma.document.update({
      where: { id: documentId },
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
      where: { id: documentId },
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
        verticals: document.verticals?.map(v => v.verticalId) || [],
        documentTypes: document.documentTypes?.map(dt => dt.documentTypeId) || []
      }
    )

    // Mark as completed
    await prisma.document.update({
      where: { id: documentId },
      data: { 
        processingStatus: 'COMPLETED',
        processingProgress: 100,
        vectorId: `pinecone_${documentId}`,
        metadata: {
          chunksCount: enhancedChunks.length,
          processingVersion: '3.0-pinecone-background',
          ...(document.metadata && typeof document.metadata === 'object' ? document.metadata as Record<string, any> : {})
        }
      }
    })

    console.log('🎉 Background processing completed successfully')
    console.log(`📊 Created ${enhancedChunks.length} enhanced chunks in Pinecone`)

    return NextResponse.json({
      success: true,
      chunksCreated: enhancedChunks.length,
      message: 'Document processing completed successfully'
    })

  } catch (error) {
    console.error('❌ Error in background processing:', error)
    
    // Update document status to FAILED
    try {
      const { documentId } = await request.json()
      if (documentId) {
        await prisma.document.update({
          where: { id: documentId },
          data: { 
            processingStatus: 'FAILED',
            processingError: error instanceof Error ? error.message : 'Processing failed'
          }
        })
      }
    } catch (updateError) {
      console.error('Failed to update document status:', updateError)
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Processing failed',
        details: 'Check server logs for more information'
      },
      { status: 500 }
    )
  }
}