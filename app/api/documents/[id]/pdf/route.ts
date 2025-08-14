import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('PDF request for document ID:', id)
    
    // For now, allow PDF access without authentication since react-pdf doesn't send cookies
    // In production, you'd want to implement token-based auth or signed URLs
    // const session = await getServerSession(authOptions)
    // if (!session?.user?.id) {
    //   return new NextResponse('Unauthorized', { status: 401 })
    // }

    const documentId = id

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

    // Determine which PDF to serve
    let pdfFilePath: string
    
    if (document.pdfPath && document.hasGeneratedPdf) {
      // Use generated PDF for URL documents
      pdfFilePath = join(process.cwd(), document.pdfPath)
      console.log('Using generated PDF file:', pdfFilePath)
    } else {
      // Use original uploaded PDF
      pdfFilePath = join(process.cwd(), 'public', 'uploads', document.filePath)
      console.log('Using original PDF file:', pdfFilePath)
    }

    // Read the PDF file
    try {
      console.log('Attempting to read PDF file:', pdfFilePath)
      
      const fileBuffer = readFileSync(pdfFilePath)
      console.log('PDF file read successfully, size:', fileBuffer.length, 'bytes')

      // Return the PDF file with proper headers
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${document.title}.pdf"`,
          'Cache-Control': 'public, max-age=3600',
          'Accept-Ranges': 'bytes',
          'Content-Length': fileBuffer.length.toString(),
          // Add CORS headers
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          // Allow iframe embedding
          'X-Frame-Options': 'SAMEORIGIN',
          'Content-Security-Policy': "frame-ancestors 'self'",
        },
      })
    } catch (fileError) {
      console.error('File read error:', fileError)
      console.error('File path attempted:', pdfFilePath)
      return NextResponse.json(
        { error: 'PDF file not found on disk' },
        { status: 404 }
      )
    }

  } catch (error) {
    console.error('PDF serve error:', error)
    return NextResponse.json(
      { error: 'Failed to serve PDF' },
      { status: 500 }
    )
  }
}