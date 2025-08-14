import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { PrismaClient } from '@prisma/client'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { extractTextFromPDF, chunkText } from '@/lib/pdf/processor'
import { vectorDB } from '@/lib/vector-db/chroma'

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

    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const state = formData.get('state') as string
    const verticalsData = formData.get('verticals') as string
    const documentTypesData = formData.get('documentTypes') as string

    // Validate required fields
    if (!file || !title || !state) {
      return NextResponse.json(
        { error: 'Missing required fields: file, title, or state' },
        { status: 400 }
      )
    }

    // Parse arrays
    let verticalIds: string[] = []
    let documentTypeIds: string[] = []
    
    try {
      verticalIds = JSON.parse(verticalsData || '[]')
      documentTypeIds = JSON.parse(documentTypesData || '[]')
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid verticals or document types format' },
        { status: 400 }
      )
    }

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

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      )
    }

    // Validate file size (200MB limit)
    const maxSize = 200 * 1024 * 1024 // 200MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 200MB' },
        { status: 400 }
      )
    }

    // Verify verticals and document types exist
    const [existingVerticals, existingDocTypes] = await Promise.all([
      prisma.vertical.findMany({
        where: { id: { in: verticalIds } },
        select: { id: true }
      }),
      prisma.documentType.findMany({
        where: { id: { in: documentTypeIds } },
        select: { id: true }
      })
    ])

    if (existingVerticals.length !== verticalIds.length) {
      return NextResponse.json(
        { error: 'One or more selected verticals do not exist' },
        { status: 400 }
      )
    }

    if (existingDocTypes.length !== documentTypeIds.length) {
      return NextResponse.json(
        { error: 'One or more selected document types do not exist' },
        { status: 400 }
      )
    }

    console.log('Enhanced upload - Processing file:', {
      fileName: file.name,
      fileSize: file.size,
      title,
      state,
      verticals: verticalIds.length,
      documentTypes: documentTypeIds.length,
      userId: session.user.id
    })

    // Create uploads directory
    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadsDir, { recursive: true })

    // Generate unique filename and save file
    const fileExtension = file.name.split('.').pop()
    const filename = `${uuidv4()}.${fileExtension}`
    const filePath = join(uploadsDir, filename)

    // Save file to disk
    const buffer = await file.arrayBuffer()
    await writeFile(filePath, new Uint8Array(buffer))

    // Create document with relationships using transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the document first
      const document = await tx.document.create({
        data: {
          title,
          description: description || undefined,
          filePath: filename, // Store relative path
          fileSize: buffer.byteLength,
          state,
          uploadedBy: session.user.id,
          processingStatus: 'UPLOADED',
          processingProgress: 0
        }
      })

      // Create vertical relationships
      const verticalConnections = verticalIds.map(verticalId => ({
        documentId: document.id,
        verticalId
      }))
      
      await tx.documentVertical.createMany({
        data: verticalConnections
      })

      // Create document type relationships
      const typeConnections = documentTypeIds.map(typeId => ({
        documentId: document.id,
        documentTypeId: typeId
      }))
      
      await tx.documentDocumentType.createMany({
        data: typeConnections
      })

      return document
    })

    console.log('Enhanced upload - Document created:', {
      documentId: result.id,
      title: result.title,
      verticals: verticalIds.length,
      documentTypes: documentTypeIds.length
    })

    // Start background processing
    processDocumentAsync(result.id, filePath).catch(error => {
      console.error('Enhanced upload - Background processing failed:', error)
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
      message: 'Document uploaded successfully',
      documentId: result.id,
      title: result.title
    })

  } catch (error) {
    console.error('Enhanced upload - Upload failed:', error)
    return NextResponse.json(
      { error: 'Failed to upload document. Please try again.' },
      { status: 500 }
    )
  }
}

async function processDocumentAsync(documentId: string, filePath: string) {
  try {
    console.log('Enhanced upload - Starting actual processing for:', documentId)
    
    // Initialize vector DB
    await vectorDB.initialize()
    
    // Update status to extracting
    await prisma.document.update({
      where: { id: documentId },
      data: {
        processingStatus: 'EXTRACTING',
        processingProgress: 25
      }
    })

    // Read the PDF file and extract text
    console.log('Enhanced upload - Reading PDF file:', filePath)
    const buffer = await readFile(filePath)
    const extractedText = await extractTextFromPDF(buffer.buffer.slice(0) as ArrayBuffer)
    console.log('Enhanced upload - Text extraction completed, length:', extractedText.text.length)

    // Update to chunking
    await prisma.document.update({
      where: { id: documentId },
      data: {
        processingStatus: 'CHUNKING',
        processingProgress: 50,
        content: extractedText.text // Store the extracted text
      }
    })

    // Create text chunks
    console.log('Enhanced upload - Creating text chunks...')
    const chunks = chunkText(extractedText.text, 1000, 100)
    console.log('Enhanced upload - Created chunks:', chunks.length)

    // Update to embedding
    await prisma.document.update({
      where: { id: documentId },
      data: {
        processingStatus: 'EMBEDDING',
        processingProgress: 75,
        totalChunks: chunks.length
      }
    })

    // Add chunks to vector database
    console.log('Enhanced upload - Adding chunks to vector DB...')
    const vectorIds: string[] = []
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkId = `${documentId}-chunk-${i}`
      
      try {
        await vectorDB.addDocument({
          id: chunkId,
          content: chunks[i],
          metadata: {
            documentId: documentId,
            chunkIndex: i,
            totalChunks: chunks.length
          }
        })
        
        vectorIds.push(chunkId)
        
        // Update progress
        const progress = 75 + Math.floor((i + 1) / chunks.length * 25)
        await prisma.document.update({
          where: { id: documentId },
          data: {
            processedChunks: i + 1,
            processingProgress: progress
          }
        })
        
        console.log(`Enhanced upload - Processed chunk ${i + 1}/${chunks.length}`)
      } catch (error) {
        console.error(`Enhanced upload - Error processing chunk ${i + 1}:`, error)
        throw error
      }
    }

    // Mark as completed
    await prisma.document.update({
      where: { id: documentId },
      data: {
        processingStatus: 'COMPLETED',
        processingProgress: 100,
        vectorId: vectorIds[0] // Store first chunk ID as reference
      }
    })

    console.log('Enhanced upload - Document processing completed:', documentId)
  } catch (error) {
    console.error('Enhanced upload - Processing failed:', error)
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