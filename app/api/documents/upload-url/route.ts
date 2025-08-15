import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { PrismaClient } from '@prisma/client'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { llamaParseUrlScraper } from '@/lib/llamaparse/url-scraper'
import { pineconeDocumentService } from '@/lib/services/pinecone-document-service'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { url, title: providedTitle, description: providedDescription, state, verticals, documentTypes } = body

    // Validate required fields
    if (!url || !state) {
      return NextResponse.json(
        { error: 'Missing required fields: url or state' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Parse arrays
    const verticalIds = verticals || []
    const documentTypeIds = documentTypes || []

    if (verticalIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one vertical must be selected' },
        { status: 400 }
      )
    }

    if (documentTypeIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one document type must be selected' },
        { status: 400 }
      )
    }

    // Verify verticals and document types exist
    // First try by ID, then by name (for backward compatibility with static data)
    let existingVerticals = await prisma.vertical.findMany({
      where: { id: { in: verticalIds } },
      select: { id: true, name: true }
    })
    
    // If not found by ID, try by name
    if (existingVerticals.length === 0) {
      existingVerticals = await prisma.vertical.findMany({
        where: { name: { in: verticalIds } },
        select: { id: true, name: true }
      })
    }
    
    // If still not found, create them from known static values
    if (existingVerticals.length === 0) {
      const knownVerticals = ['fantasy-sports', 'igaming', 'ilottery', 'landbased', 'lottery', 'sports-online', 'sports-retail']
      const verticalsToCreate = verticalIds.filter((v: string) => knownVerticals.includes(v))
      
      if (verticalsToCreate.length > 0) {
        // Create missing verticals
        for (const name of verticalsToCreate) {
          const displayName = name.split('-').map((w: string) => 
            w.charAt(0).toUpperCase() + w.slice(1)
          ).join(' ')
          
          await prisma.vertical.upsert({
            where: { name },
            update: {},
            create: { name, displayName }
          })
        }
        
        existingVerticals = await prisma.vertical.findMany({
          where: { name: { in: verticalIds } },
          select: { id: true, name: true }
        })
      }
    }
    
    let existingDocTypes = await prisma.documentType.findMany({
      where: { id: { in: documentTypeIds } },
      select: { id: true, name: true }
    })
    
    // If not found by ID, try by name
    if (existingDocTypes.length === 0) {
      existingDocTypes = await prisma.documentType.findMany({
        where: { name: { in: documentTypeIds } },
        select: { id: true, name: true }
      })
    }
    
    // If still not found, create them from known static values
    if (existingDocTypes.length === 0) {
      const knownDocTypes = ['aml', 'data', 'formal-guidance', 'informal-guidance', 'licensing-forms', 'other', 'regulation', 'statute', 'technical-bulletin']
      const docTypesToCreate = documentTypeIds.filter((dt: string) => knownDocTypes.includes(dt))
      
      if (docTypesToCreate.length > 0) {
        // Create missing document types
        for (const name of docTypesToCreate) {
          const displayName = name.split('-').map((w: string) => 
            w.charAt(0).toUpperCase() + w.slice(1)
          ).join(' ')
          
          await prisma.documentType.upsert({
            where: { name },
            update: {},
            create: { name, displayName }
          })
        }
        
        existingDocTypes = await prisma.documentType.findMany({
          where: { name: { in: documentTypeIds } },
          select: { id: true, name: true }
        })
      }
    }

    if (existingVerticals.length === 0) {
      return NextResponse.json(
        { error: 'One or more selected verticals do not exist and could not be created' },
        { status: 400 }
      )
    }

    if (existingDocTypes.length === 0) {
      return NextResponse.json(
        { error: 'One or more selected document types do not exist and could not be created' },
        { status: 400 }
      )
    }

    console.log('🌐 URL upload - Processing URL:', {
      url,
      state,
      verticals: verticalIds.length,
      documentTypes: documentTypeIds.length,
      userId: session.user.id
    })

    // Scrape the URL using LlamaParse
    const scrapedDoc = await llamaParseUrlScraper.scrapeUrl(url)
    
    // DEBUG: Log LlamaParse result details
    console.log('🔍 DEBUG - LlamaParse result:', {
      contentLength: scrapedDoc.content.length,
      isPdf: scrapedDoc.isPdf,
      title: scrapedDoc.title,
      firstChars: scrapedDoc.content.substring(0, 500),
      lastChars: scrapedDoc.content.substring(Math.max(0, scrapedDoc.content.length - 500)),
      hasFeeText: scrapedDoc.content.includes('fee'),
      hasThousandText: scrapedDoc.content.includes('thousand'),
      hasExceedText: scrapedDoc.content.includes('exceed'),
      has125Text: scrapedDoc.content.includes('125')
    })
    
    // Use provided title/description or scraped ones
    const title = providedTitle || scrapedDoc.title
    const description = providedDescription || scrapedDoc.description || undefined

    // Use temp directory for Vercel serverless compatibility
    const uploadsDir = '/tmp'
    // No need to create /tmp directory - it exists in serverless functions

    let filename: string
    let content: string
    let sourceType: 'URL' | 'PDF_URL'
    let fileSize: number

    if (scrapedDoc.isPdf) {
      // Handle PDF URL - use LlamaParse content directly
      console.log('📄 Using LlamaParse extracted content for PDF')
      
      if (scrapedDoc.content && scrapedDoc.content.trim() !== '') {
        // LlamaParse successfully extracted content
        filename = `${uuidv4()}.md`
        const filePath = join(uploadsDir, filename)
        
        content = scrapedDoc.content
        
        // DEBUG: Log content before saving to file
        console.log('🔍 DEBUG - Before writeFile:', {
          contentLength: content.length,
          firstChars: content.substring(0, 500),
          hasFeeText: content.includes('fee'),
          hasThousandText: content.includes('thousand'),
          has125Text: content.includes('125')
        })
        
        await writeFile(filePath, content)
        
        // DEBUG: Read back and verify file content
        const { readFile } = await import('fs/promises')
        const savedContent = await readFile(filePath, 'utf-8')
        console.log('🔍 DEBUG - After writeFile/readFile:', {
          originalLength: content.length,
          savedLength: savedContent.length,
          contentMatches: content === savedContent,
          savedFirstChars: savedContent.substring(0, 500),
          savedHasFeeText: savedContent.includes('fee'),
          savedHasThousandText: savedContent.includes('thousand'),
          savedHas125Text: savedContent.includes('125')
        })
        
        sourceType = 'PDF_URL'
        fileSize = Buffer.byteLength(content, 'utf8')
      } else {
        // LlamaParse failed, download PDF for fallback processing
        console.log('📥 LlamaParse failed, downloading PDF for fallback processing')
        const pdfBuffer = await llamaParseUrlScraper.downloadPdf(url)
        
        filename = `${uuidv4()}.pdf`
        const filePath = join(uploadsDir, filename)
        await writeFile(filePath, pdfBuffer)
        
        content = '' // Will be extracted during processing
        sourceType = 'PDF_URL'
        fileSize = pdfBuffer.length
      }
    } else {
      // Handle scraped HTML content - save as markdown file
      console.log('💾 Saving scraped content as markdown')
      filename = `${uuidv4()}.md`
      const filePath = join(uploadsDir, filename)
      
      content = scrapedDoc.content
      await writeFile(filePath, content)
      
      sourceType = 'URL'
      fileSize = Buffer.byteLength(content, 'utf8')
    }

    // Create document with relationships using transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the document
      const document = await tx.document.create({
        data: {
          title,
          description,
          filePath: filename,
          fileSize,
          state,
          uploadedBy: session.user.id,
          content: (sourceType === 'URL' || (sourceType === 'PDF_URL' && content)) ? content : undefined, // Store content for scraped URLs and LlamaParse PDFs
          sourceUrl: url,
          sourceType,
          processingStatus: 'UPLOADED',
          processingProgress: 0,
          metadata: {
            ...scrapedDoc.metadata,
            originalUrl: url,
            scrapedAt: new Date().toISOString(),
          }
        }
      })

      // Create vertical relationships using resolved IDs
      const verticalConnections = existingVerticals.map((vertical) => ({
        documentId: document.id,
        verticalId: vertical.id
      }))
      
      await tx.documentVertical.createMany({
        data: verticalConnections
      })

      // Create document type relationships using resolved IDs
      const typeConnections = existingDocTypes.map((docType) => ({
        documentId: document.id,
        documentTypeId: docType.id
      }))
      
      await tx.documentDocumentType.createMany({
        data: typeConnections
      })

      return document
    })

    // DEBUG: Check content stored in database
    console.log('🔍 DEBUG - Database content check:', {
      documentId: result.id,
      hasContent: !!result.content,
      contentLength: result.content?.length || 0,
      dbFirstChars: result.content?.substring(0, 500) || 'NO CONTENT',
      dbHasFeeText: result.content?.includes('fee') || false,
      dbHasThousandText: result.content?.includes('thousand') || false,
      dbHas125Text: result.content?.includes('125') || false
    })

    console.log('🌐 URL upload - Document created:', {
      documentId: result.id,
      title: result.title,
      sourceType: result.sourceType,
      fileSize: result.fileSize
    })

    // Start background processing with Pinecone
    const filePath = join(uploadsDir, filename)
    processDocumentWithPinecone(result.id, filePath, result.sourceType, verticalIds, documentTypeIds).catch(error => {
      console.error('🌐 URL upload - Background processing failed:', error)
    })

    // Track the newly added document
    try {
      const documentType = documentTypeIds.length > 0 ? documentTypeIds[0] : 'Document'
      await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/user/new-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: result.id,
          title: result.title,
          state: result.state,
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

    return NextResponse.json({
      message: 'URL processed successfully',
      documentId: result.id,
      title: result.title,
      sourceType: result.sourceType
    })

  } catch (error) {
    console.error('🌐 URL upload - Upload failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process URL' },
      { status: 500 }
    )
  }
}

async function processDocumentWithPinecone(
  documentId: string, 
  filePath: string, 
  sourceType: string,
  verticalIds: string[],
  documentTypeIds: string[]
) {
  try {
    console.log('🌐 Pinecone URL upload - Starting processing for:', documentId, 'type:', sourceType)
    
    // Get document details
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    })

    if (!document) {
      throw new Error('Document not found')
    }

    // Update processing status
    await prisma.document.update({
      where: { id: documentId },
      data: {
        processingStatus: 'EXTRACTING',
        processingProgress: 10
      }
    })

    let processed
    
    if (sourceType === 'PDF_URL' && filePath.endsWith('.md')) {
      // LlamaParse already processed the PDF - use the content directly
      console.log('🌐 Using LlamaParse-extracted content for Pinecone')
      
      if (!document.content) {
        throw new Error('No LlamaParse content found for markdown file')
      }

      // DEBUG: Check content retrieved from database for processing
      console.log('🔍 DEBUG - Content from database for processing:', {
        contentLength: document.content.length,
        firstChars: document.content.substring(0, 500),
        lastChars: document.content.substring(Math.max(0, document.content.length - 500)),
        hasFeeText: document.content.includes('fee'),
        hasThousandText: document.content.includes('thousand'),
        has125Text: document.content.includes('125')
      })

      // Create a mock processed document for consistency
      processed = {
        text: document.content,
        chunks: [],
        pages: [{ pageNumber: 1, text: document.content, coordinates: [] }],
        metadata: {
          totalPages: 1,
          processingMethod: 'llamaindex' as const,
          extractedAt: new Date().toISOString()
        }
      }
    } else if (sourceType === 'PDF_URL') {
      // Process PDF file with fallback
      console.log('🌐 Processing PDF with Pinecone fallback')
      const { processDocumentWithFallback } = await import('@/lib/pdf/llamaindex-processor')
      processed = await processDocumentWithFallback(filePath)
      
      // Update document content if not already set
      await prisma.document.update({
        where: { id: documentId },
        data: { content: processed.text }
      })
    } else {
      // For scraped URLs, create processed document from content
      console.log('🌐 Processing scraped URL content for Pinecone')
      
      if (!document.content) {
        throw new Error('No content found for scraped URL')
      }

      processed = {
        text: document.content,
        chunks: [],
        pages: [{ pageNumber: 1, text: document.content, coordinates: [] }],
        metadata: {
          totalPages: 1,
          processingMethod: 'llamaindex' as const,
          extractedAt: new Date().toISOString()
        }
      }
    }

    // Update processing status
    await prisma.document.update({
      where: { id: documentId },
      data: {
        processingStatus: 'EMBEDDING',
        processingProgress: 50
      }
    })

    // Instead of creating a new document, update the existing one
    // First, update the document with the processed content if needed
    if (processed && processed.text && !document.content) {
      await prisma.document.update({
        where: { id: documentId },
        data: { content: processed.text }
      })
    }

    // Process with enhanced chunking
    const { enhancedChunkingService } = await import('@/lib/pdf/enhanced-chunking')
    const { pineconeService } = await import('@/lib/pinecone/pinecone-service')
    
    const enhancedChunks = enhancedChunkingService.createEnhancedChunks(processed, {
      chunkSize: 800,
      contextRadius: 300,
      preserveSentences: true,
      preserveParagraphs: true
    })

    console.log(`📊 Created ${enhancedChunks.length} enhanced chunks`)

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

    // Update progress
    await prisma.document.update({
      where: { id: documentId },
      data: {
        processingStatus: 'EMBEDDING',
        processingProgress: 75,
        totalChunks: enhancedChunks.length
      }
    })

    // Store in Pinecone
    await pineconeService.upsertDocumentChunks(
      documentId,
      pineconeChunks,
      {
        title: document.title,
        state: document.state,
        verticals: verticalIds,
        documentTypes: documentTypeIds
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
          processingVersion: '3.0-pinecone-fuzzy',
          ...(document.metadata && typeof document.metadata === 'object' ? document.metadata as Record<string, any> : {})
        }
      }
    })

    console.log('🌐 Pinecone processing completed:', {
      documentId: documentId,
      chunksCreated: enhancedChunks.length,
      vectorsStored: enhancedChunks.length
    })

    // Generate PDF for URL documents
    if ((sourceType === 'URL' || sourceType === 'PDF_URL') && document.content) {
      console.log('🌐 Starting PDF generation for URL document:', documentId)
      
      try {
        const { pdfGenerator } = await import('@/services/pdf-generator')
        const pdfResult = await pdfGenerator.generatePdfForDocument(documentId)
        
        if (pdfResult.success) {
          console.log('🌐 PDF generation completed for:', documentId)
        } else {
          console.warn('🌐 PDF generation failed for:', documentId, pdfResult.error)
        }
      } catch (pdfError) {
        console.error('🌐 PDF generation error:', pdfError)
        // Don't fail the entire process if PDF generation fails
      }
    }

  } catch (error) {
    console.error('🌐 Pinecone processing failed:', error)
    await prisma.document.update({
      where: { id: documentId },
      data: {
        processingStatus: 'FAILED',
        processingProgress: 0,
        processingError: error instanceof Error ? error.message : 'Unknown error'
      }
    }).catch(e => console.error('Failed to update error status:', e))
  }
}