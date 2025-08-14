import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// PUT /api/documents/[id]/annotations/[annotationId] - Update an annotation
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; annotationId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: documentId, annotationId } = await params
    const body = await request.json()
    
    const { comment, color } = body

    // Find the annotation and verify ownership
    const existingAnnotation = await prisma.annotation.findUnique({
      where: { id: annotationId },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!existingAnnotation) {
      return NextResponse.json(
        { error: 'Annotation not found' },
        { status: 404 }
      )
    }

    if (existingAnnotation.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only edit your own annotations' },
        { status: 403 }
      )
    }

    if (existingAnnotation.documentId !== documentId) {
      return NextResponse.json(
        { error: 'Annotation does not belong to this document' },
        { status: 400 }
      )
    }

    // Update the annotation
    const updatedAnnotation = await prisma.annotation.update({
      where: { id: annotationId },
      data: {
        comment: comment !== undefined ? comment : existingAnnotation.comment,
        color: color !== undefined ? color : existingAnnotation.color,
        updatedAt: new Date()
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

    return NextResponse.json(updatedAnnotation)
    
  } catch (error) {
    console.error('Error updating annotation:', error)
    return NextResponse.json(
      { error: 'Failed to update annotation' },
      { status: 500 }
    )
  }
}

// DELETE /api/documents/[id]/annotations/[annotationId] - Delete an annotation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; annotationId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: documentId, annotationId } = await params

    // Find the annotation and verify ownership
    const existingAnnotation = await prisma.annotation.findUnique({
      where: { id: annotationId }
    })

    if (!existingAnnotation) {
      return NextResponse.json(
        { error: 'Annotation not found' },
        { status: 404 }
      )
    }

    if (existingAnnotation.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only delete your own annotations' },
        { status: 403 }
      )
    }

    if (existingAnnotation.documentId !== documentId) {
      return NextResponse.json(
        { error: 'Annotation does not belong to this document' },
        { status: 400 }
      )
    }

    // Delete the annotation
    await prisma.annotation.delete({
      where: { id: annotationId }
    })

    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Error deleting annotation:', error)
    return NextResponse.json(
      { error: 'Failed to delete annotation' },
      { status: 500 }
    )
  }
}