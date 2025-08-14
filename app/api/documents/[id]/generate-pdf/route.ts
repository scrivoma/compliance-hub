import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { PrismaClient } from '@prisma/client'
import { pdfGenerator } from '@/services/pdf-generator'

const prisma = new PrismaClient()

// POST /api/documents/[id]/generate-pdf - Generate PDF for URL document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: documentId } = await params

    // Get document from database
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Check if document is suitable for PDF generation
    if (document.sourceType !== 'URL' && document.sourceType !== 'PDF_URL') {
      return NextResponse.json(
        { error: 'PDF generation only supported for URL documents' },
        { status: 400 }
      )
    }

    if (!document.content) {
      return NextResponse.json(
        { error: 'Document has no content to convert to PDF' },
        { status: 400 }
      )
    }

    // Check if PDF already exists and is recent
    if (document.hasGeneratedPdf && document.pdfGeneratedAt) {
      const hoursSinceGeneration = (Date.now() - new Date(document.pdfGeneratedAt).getTime()) / (1000 * 60 * 60)
      
      // If PDF was generated less than 24 hours ago, return existing info
      if (hoursSinceGeneration < 24) {
        return NextResponse.json({
          message: 'PDF already exists and is recent',
          documentId: documentId,
          pdfPath: document.pdfPath,
          hasGeneratedPdf: true,
          pdfGeneratedAt: document.pdfGeneratedAt,
          skipRegeneration: true
        })
      }
    }

    console.log(`Starting PDF generation for document: ${documentId}`)

    // Generate PDF
    const result = await pdfGenerator.generatePdfForDocument(documentId)

    if (!result.success) {
      console.error(`PDF generation failed for ${documentId}:`, result.error)
      return NextResponse.json(
        { error: result.error || 'Failed to generate PDF' },
        { status: 500 }
      )
    }

    console.log(`PDF generation completed for ${documentId}`)

    return NextResponse.json({
      message: 'PDF generated successfully',
      documentId: documentId,
      pdfPath: result.filePath,
      fileSize: result.fileSize,
      hasGeneratedPdf: true,
      pdfGeneratedAt: new Date().toISOString()
    }, { status: 201 })

  } catch (error) {
    console.error('Error in PDF generation endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error during PDF generation' },
      { status: 500 }
    )
  }
}

// GET /api/documents/[id]/generate-pdf - Check PDF generation status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: documentId } = await params

    // Get document from database
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        sourceType: true,
        hasGeneratedPdf: true,
        pdfPath: true,
        pdfGeneratedAt: true,
        content: true
      }
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    const canGeneratePdf = (document.sourceType === 'URL' || document.sourceType === 'PDF_URL') && !!document.content
    const hasRecentPdf = document.hasGeneratedPdf && document.pdfGeneratedAt && 
      (Date.now() - new Date(document.pdfGeneratedAt).getTime()) < (24 * 60 * 60 * 1000) // 24 hours

    return NextResponse.json({
      documentId: documentId,
      title: document.title,
      sourceType: document.sourceType,
      canGeneratePdf: canGeneratePdf,
      hasGeneratedPdf: document.hasGeneratedPdf,
      pdfPath: document.pdfPath,
      pdfGeneratedAt: document.pdfGeneratedAt,
      hasRecentPdf: hasRecentPdf,
      hasContent: !!document.content
    })

  } catch (error) {
    console.error('Error checking PDF generation status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/documents/[id]/generate-pdf - Delete generated PDF
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: documentId } = await params

    // Get document from database
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    if (!document.hasGeneratedPdf) {
      return NextResponse.json(
        { error: 'No generated PDF to delete' },
        { status: 400 }
      )
    }

    // Update database to remove PDF reference
    await prisma.document.update({
      where: { id: documentId },
      data: {
        pdfPath: null,
        hasGeneratedPdf: false,
        pdfGeneratedAt: null
      }
    })

    // Note: We're not actually deleting the PDF file from disk for safety
    // In a production system, you might want to implement a cleanup job
    // that removes old PDF files based on some criteria

    return NextResponse.json({
      message: 'Generated PDF reference removed from document',
      documentId: documentId
    })

  } catch (error) {
    console.error('Error deleting generated PDF:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}