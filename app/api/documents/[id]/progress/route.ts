import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        processingStatus: true,
        processingProgress: true,
        processingError: true,
        totalChunks: true,
        processedChunks: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      documentId: document.id,
      title: document.title,
      status: document.processingStatus,
      progress: document.processingProgress,
      error: document.processingError,
      totalChunks: document.totalChunks,
      processedChunks: document.processedChunks,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt
    })

  } catch (error) {
    console.error('Error fetching document progress:', error)
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    )
  }
}