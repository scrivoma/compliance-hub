import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/documents/[id]/annotations - Get all annotations for a document
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

    const annotations = await prisma.annotation.findMany({
      where: {
        documentId: documentId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { pageNumber: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    return NextResponse.json(annotations)
    
  } catch (error) {
    console.error('Error fetching annotations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch annotations' },
      { status: 500 }
    )
  }
}

// POST /api/documents/[id]/annotations - Create a new annotation
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
    const body = await request.json()
    
    const { 
      type = 'highlight',
      content, 
      position, 
      pageNumber = 1,
      comment, 
      color 
    } = body

    // Validate required fields
    if (!content || !position) {
      return NextResponse.json(
        { error: 'Content and position are required' },
        { status: 400 }
      )
    }

    // Verify document exists
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    const annotation = await prisma.annotation.create({
      data: {
        documentId: documentId,
        userId: session.user.id,
        type: type,
        content: content,
        position: position,
        pageNumber: pageNumber,
        comment: comment || null,
        color: color || '#FFFF00'
      },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json(annotation, { status: 201 })
    
  } catch (error) {
    console.error('Error creating annotation:', error)
    return NextResponse.json(
      { error: 'Failed to create annotation' },
      { status: 500 }
    )
  }
}