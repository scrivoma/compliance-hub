import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('Text request for document ID:', id)

    // Get document from database
    const document = await prisma.document.findUnique({
      where: { id }
    })

    if (!document) {
      console.log('Document not found:', id)
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    console.log('Document found, returning content length:', document.content?.length || 0)

    return NextResponse.json({
      content: document.content || 'No content available for this document.',
      title: document.title,
      sourceType: document.sourceType,
      sourceUrl: document.sourceUrl
    })
  } catch (error) {
    console.error('Error serving document text:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}