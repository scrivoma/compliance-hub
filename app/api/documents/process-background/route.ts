import { NextRequest, NextResponse } from 'next/server'
import { llamaIndexDocumentService } from '@/lib/services/llamaindex-document-service'
import { PrismaClient } from '@prisma/client'
import { processDocumentWithFallback } from '@/lib/pdf/llamaindex-processor'
import { openai } from '@/lib/openai'
import { ChromaClient } from 'chromadb'

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

    // Process document with coordinate tracking using LlamaIndex
    console.log('📊 Processing document with LlamaIndex...')
    let processed
    try {
      const { processDocumentWithLlamaIndex } = await import('@/lib/pdf/llamaindex-processor')
      processed = await processDocumentWithLlamaIndex(filepath)
      console.log('✅ LlamaIndex processing successful')
    } catch (error) {
      console.warn('⚠️ LlamaIndex processing failed, using fallback:', error instanceof Error ? error.message : error)
      processed = await processDocumentWithFallback(filepath)
    }

    // Update status to CHUNKING
    await prisma.document.update({
      where: { id: documentId },
      data: { 
        processingStatus: 'CHUNKING',
        processingProgress: 30,
        content: processed.text,
        metadata: {
          ...(document.metadata as Record<string, any> || {}),
          ...(processed.metadata as Record<string, any> || {}),
          chunksCount: processed.chunks.length
        }
      }
    })

    // Update status to EMBEDDING
    await prisma.document.update({
      where: { id: documentId },
      data: { 
        processingStatus: 'EMBEDDING',
        processingProgress: 50
      }
    })

    // Initialize ChromaDB with proper configuration
    const chroma = new ChromaClient({
      host: process.env.CHROMADB_HOST || 'localhost',
      port: parseInt(process.env.CHROMADB_PORT || '8002')
    })

    let collection
    try {
      collection = await chroma.getCollection({ 
        name: 'compliance_documents_llamaindex' 
      })
      console.log('✅ Using existing ChromaDB collection')
    } catch {
      console.log('🔄 Creating new ChromaDB collection')
      collection = await chroma.createCollection({ 
        name: 'compliance_documents_llamaindex',
        metadata: { "hnsw:space": "cosine" }
      })
    }

    // Process chunks with embeddings
    const totalChunks = processed.chunks.length
    let processedChunks = 0

    for (let i = 0; i < processed.chunks.length; i++) {
      const chunk = processed.chunks[i]
      const citationId = `${documentId}_cite_${i}`
      
      try {
        // Generate embedding
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunk.text,
        })

        const embedding = response.data[0].embedding

        // Store in ChromaDB
        await collection.add({
          ids: [citationId],
          embeddings: [embedding],
          documents: [chunk.text],
          metadatas: [{
            documentId: document.id,
            title: document.title,
            chunkIndex: chunk.metadata.chunk_index,
            pageNumber: chunk.metadata.page_number,
            startChar: chunk.metadata.start_char,
            endChar: chunk.metadata.end_char,
            coordinates: JSON.stringify(chunk.metadata.coordinates),
            state: document.state,
            processingMethod: processed.metadata.processingMethod,
            citationId: citationId
          }]
        })

        processedChunks++
        
        // Update progress every 10 chunks or at the end
        if (processedChunks % 10 === 0 || processedChunks === totalChunks) {
          const progress = 50 + Math.floor((processedChunks / totalChunks) * 45) // 50-95%
          await prisma.document.update({
            where: { id: documentId },
            data: { 
              processingProgress: progress,
              processedChunks: processedChunks,
              totalChunks: totalChunks
            }
          })
          console.log(`📊 Progress: ${processedChunks}/${totalChunks} chunks (${progress}%)`)
        }
        
      } catch (error) {
        console.error(`❌ Error processing chunk ${i + 1}:`, error)
      }
    }

    // Mark as completed
    await prisma.document.update({
      where: { id: documentId },
      data: { 
        processingStatus: 'COMPLETED',
        processingProgress: 100,
        vectorId: `llamaindex_${documentId}`
      }
    })

    console.log('🎉 Background processing completed successfully')
    console.log(`📊 Created ${processedChunks} citation-ready chunks`)

    return NextResponse.json({
      success: true,
      chunksCreated: processedChunks,
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