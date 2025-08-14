import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface CreateAnnotationData {
  documentId: string
  userId: string
  content: {
    text: string
    quote: string
  }
  position: {
    boundingRect: {
      x1: number
      y1: number
      x2: number
      y2: number
      width: number
      height: number
      pageNumber: number
    }
    rects: Array<{
      x1: number
      y1: number
      x2: number
      y2: number
      width: number
      height: number
      pageNumber: number
    }>
  }
  comment?: string
  color?: string
}

export interface UpdateAnnotationData {
  comment?: string
  color?: string
}

export interface AnnotationWithUser {
  id: string
  documentId: string
  userId: string
  content: {
    text: string
    quote: string
  }
  position: {
    boundingRect: {
      x1: number
      y1: number
      x2: number
      y2: number
      width: number
      height: number
      pageNumber: number
    }
    rects: Array<{
      x1: number
      y1: number
      x2: number
      y2: number
      width: number
      height: number
      pageNumber: number
    }>
  }
  comment: string | null
  color: string
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    name: string
  }
}

export class AnnotationService {
  
  /**
   * Get all annotations for a document
   */
  static async getAnnotationsForDocument(documentId: string): Promise<AnnotationWithUser[]> {
    try {
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
        orderBy: {
          createdAt: 'desc'
        }
      })

      return annotations as AnnotationWithUser[]
    } catch (error) {
      console.error('Error fetching annotations:', error)
      throw new Error('Failed to fetch annotations')
    }
  }

  /**
   * Create a new annotation
   */
  static async createAnnotation(data: CreateAnnotationData): Promise<AnnotationWithUser> {
    try {
      // Verify document exists
      const document = await prisma.document.findUnique({
        where: { id: data.documentId }
      })

      if (!document) {
        throw new Error('Document not found')
      }

      const annotation = await prisma.annotation.create({
        data: {
          documentId: data.documentId,
          userId: data.userId,
          content: data.content,
          position: data.position,
          comment: data.comment || null,
          color: data.color || '#FFFF00'
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

      return annotation as AnnotationWithUser
    } catch (error) {
      console.error('Error creating annotation:', error)
      throw new Error('Failed to create annotation')
    }
  }

  /**
   * Update an annotation
   */
  static async updateAnnotation(
    annotationId: string, 
    userId: string, 
    data: UpdateAnnotationData
  ): Promise<AnnotationWithUser> {
    try {
      // Find the annotation and verify ownership
      const existingAnnotation = await prisma.annotation.findUnique({
        where: { id: annotationId }
      })

      if (!existingAnnotation) {
        throw new Error('Annotation not found')
      }

      if (existingAnnotation.userId !== userId) {
        throw new Error('You can only edit your own annotations')
      }

      const updatedAnnotation = await prisma.annotation.update({
        where: { id: annotationId },
        data: {
          comment: data.comment !== undefined ? data.comment : existingAnnotation.comment,
          color: data.color !== undefined ? data.color : existingAnnotation.color,
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

      return updatedAnnotation as AnnotationWithUser
    } catch (error) {
      console.error('Error updating annotation:', error)
      throw new Error('Failed to update annotation')
    }
  }

  /**
   * Delete an annotation
   */
  static async deleteAnnotation(annotationId: string, userId: string): Promise<void> {
    try {
      // Find the annotation and verify ownership
      const existingAnnotation = await prisma.annotation.findUnique({
        where: { id: annotationId }
      })

      if (!existingAnnotation) {
        throw new Error('Annotation not found')
      }

      if (existingAnnotation.userId !== userId) {
        throw new Error('You can only delete your own annotations')
      }

      await prisma.annotation.delete({
        where: { id: annotationId }
      })
    } catch (error) {
      console.error('Error deleting annotation:', error)
      throw new Error('Failed to delete annotation')
    }
  }

  /**
   * Get annotations by user
   */
  static async getAnnotationsByUser(userId: string): Promise<AnnotationWithUser[]> {
    try {
      const annotations = await prisma.annotation.findMany({
        where: {
          userId: userId
        },
        include: {
          user: {
            select: {
              id: true,
              name: true
            }
          },
          document: {
            select: {
              id: true,
              title: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return annotations as AnnotationWithUser[]
    } catch (error) {
      console.error('Error fetching user annotations:', error)
      throw new Error('Failed to fetch user annotations')
    }
  }

  /**
   * Get annotation statistics for a document
   */
  static async getDocumentAnnotationStats(documentId: string) {
    try {
      const stats = await prisma.annotation.groupBy({
        by: ['userId'],
        where: {
          documentId: documentId
        },
        _count: {
          id: true
        }
      })

      const totalAnnotations = await prisma.annotation.count({
        where: {
          documentId: documentId
        }
      })

      const uniqueAnnotators = stats.length

      return {
        totalAnnotations,
        uniqueAnnotators,
        annotationsByUser: stats
      }
    } catch (error) {
      console.error('Error fetching annotation stats:', error)
      throw new Error('Failed to fetch annotation statistics')
    }
  }

  /**
   * Search annotations by text content
   */
  static async searchAnnotations(
    documentId: string, 
    searchText: string
  ): Promise<AnnotationWithUser[]> {
    try {
      // Note: SQLite doesn't support full-text search on JSON fields
      // For production, consider using a proper search solution
      const annotations = await prisma.annotation.findMany({
        where: {
          documentId: documentId,
          OR: [
            {
              comment: {
                contains: searchText,
                mode: 'insensitive'
              }
            }
            // Could add content search here if needed
          ]
        },
        include: {
          user: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return annotations as AnnotationWithUser[]
    } catch (error) {
      console.error('Error searching annotations:', error)
      throw new Error('Failed to search annotations')
    }
  }
}