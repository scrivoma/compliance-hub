'use client'

import { useCallback } from 'react'
import { useSession } from 'next-auth/react'

export interface AnnotationManagerProps {
  documentId: string
}

export interface AnnotationEvent {
  id: string
  type: 'highlight' | 'sticky-note' | 'strikethrough' | 'underline' | 'drawing' | 'comment'
  content: any
  position: {
    pageNumber: number
    boundingRect: {
      x: number
      y: number
      width: number
      height: number
    }
    rects?: Array<{
      x: number
      y: number
      width: number
      height: number
      pageNumber: number
    }>
  }
  color?: string
  comment?: string
  userId?: string
  createdAt?: string
  updatedAt?: string
}

export interface UserPreferences {
  defaultColor: string
  showCoachMarks: boolean
  preferences: any
}

export class AnnotationManager {
  private documentId: string
  private userId: string | undefined

  constructor(documentId: string, userId?: string) {
    this.documentId = documentId
    this.userId = userId
  }

  // Load annotations for the document
  async loadAnnotations(): Promise<AnnotationEvent[]> {
    if (!this.userId) return []

    try {
      const response = await fetch(`/api/documents/${this.documentId}/annotations`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to load annotations: ${response.statusText}`)
      }

      const annotations = await response.json()
      console.log(`Loaded ${annotations.length} annotations for document ${this.documentId}`)
      return annotations
    } catch (error) {
      console.error('Error loading annotations:', error)
      return []
    }
  }

  // Save new annotation
  async saveAnnotation(annotation: Omit<AnnotationEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<AnnotationEvent | null> {
    if (!this.userId) {
      console.warn('Cannot save annotation: user not authenticated')
      return null
    }

    try {
      const payload = {
        type: annotation.type,
        content: annotation.content,
        pageNumber: annotation.position.pageNumber,
        position: annotation.position,
        color: annotation.color || '#FFFF00',
        comment: annotation.comment || '',
      }

      const response = await fetch(`/api/documents/${this.documentId}/annotations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Failed to save annotation: ${response.statusText}`)
      }

      const savedAnnotation = await response.json()
      console.log('Annotation saved successfully:', savedAnnotation.id)
      return savedAnnotation
    } catch (error) {
      console.error('Error saving annotation:', error)
      return null
    }
  }

  // Update existing annotation
  async updateAnnotation(annotationId: string, updates: Partial<AnnotationEvent>): Promise<boolean> {
    if (!this.userId) {
      console.warn('Cannot update annotation: user not authenticated')
      return false
    }

    try {
      const response = await fetch(`/api/documents/${this.documentId}/annotations/${annotationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error(`Failed to update annotation: ${response.statusText}`)
      }

      console.log('Annotation updated successfully:', annotationId)
      return true
    } catch (error) {
      console.error('Error updating annotation:', error)
      return false
    }
  }

  // Delete annotation
  async deleteAnnotation(annotationId: string): Promise<boolean> {
    if (!this.userId) {
      console.warn('Cannot delete annotation: user not authenticated')
      return false
    }

    try {
      const response = await fetch(`/api/documents/${this.documentId}/annotations/${annotationId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`Failed to delete annotation: ${response.statusText}`)
      }

      console.log('Annotation deleted successfully:', annotationId)
      return true
    } catch (error) {
      console.error('Error deleting annotation:', error)
      return false
    }
  }

  // Load user preferences
  async loadUserPreferences(): Promise<UserPreferences | null> {
    if (!this.userId) return null

    try {
      const response = await fetch(`/api/users/${this.userId}/annotation-preferences`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          // No preferences found, return defaults
          return {
            defaultColor: '#FFFF00',
            showCoachMarks: true,
            preferences: {}
          }
        }
        throw new Error(`Failed to load user preferences: ${response.statusText}`)
      }

      const preferences = await response.json()
      console.log('User preferences loaded successfully')
      return preferences
    } catch (error) {
      console.error('Error loading user preferences:', error)
      return null
    }
  }

  // Save user preferences
  async saveUserPreferences(preferences: Partial<UserPreferences>): Promise<boolean> {
    if (!this.userId) {
      console.warn('Cannot save preferences: user not authenticated')
      return false
    }

    try {
      const response = await fetch(`/api/users/${this.userId}/annotation-preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      })

      if (!response.ok) {
        throw new Error(`Failed to save user preferences: ${response.statusText}`)
      }

      console.log('User preferences saved successfully')
      return true
    } catch (error) {
      console.error('Error saving user preferences:', error)
      return false
    }
  }

  // Export annotations in Adobe's format
  async exportAnnotations(): Promise<any> {
    try {
      const annotations = await this.loadAnnotations()
      
      // Convert to Adobe's annotation format
      const adobeFormat = annotations.map(annotation => ({
        ...annotation.content,
        id: annotation.id,
        type: annotation.type,
        rect: annotation.position.boundingRect,
        page: annotation.position.pageNumber - 1, // Adobe uses 0-based page indexing
        color: annotation.color,
        contents: annotation.comment,
        author: annotation.userId,
        creationDate: annotation.createdAt,
        modDate: annotation.updatedAt
      }))

      return adobeFormat
    } catch (error) {
      console.error('Error exporting annotations:', error)
      return []
    }
  }

  // Import annotations from Adobe's format
  async importAnnotations(adobeAnnotations: any[]): Promise<boolean> {
    try {
      const annotations = adobeAnnotations.map(adobeAnnotation => ({
        type: adobeAnnotation.type || 'highlight',
        content: {
          text: adobeAnnotation.contents || '',
          quote: adobeAnnotation.RC || ''
        },
        position: {
          pageNumber: (adobeAnnotation.page || 0) + 1, // Convert to 1-based indexing
          boundingRect: adobeAnnotation.rect || adobeAnnotation.Rect,
          rects: adobeAnnotation.QuadPoints ? this.convertQuadPointsToRects(adobeAnnotation.QuadPoints, adobeAnnotation.page + 1) : []
        },
        color: adobeAnnotation.color || '#FFFF00',
        comment: adobeAnnotation.contents || ''
      }))

      // Save each annotation
      const results = await Promise.all(
        annotations.map(annotation => this.saveAnnotation(annotation))
      )

      const successCount = results.filter(result => result !== null).length
      console.log(`Imported ${successCount}/${annotations.length} annotations`)
      return successCount === annotations.length
    } catch (error) {
      console.error('Error importing annotations:', error)
      return false
    }
  }

  // Helper function to convert Adobe QuadPoints to rect format
  private convertQuadPointsToRects(quadPoints: number[], pageNumber: number): Array<any> {
    const rects = []
    for (let i = 0; i < quadPoints.length; i += 8) {
      const quad = quadPoints.slice(i, i + 8)
      const minX = Math.min(quad[0], quad[2], quad[4], quad[6])
      const minY = Math.min(quad[1], quad[3], quad[5], quad[7])
      const maxX = Math.max(quad[0], quad[2], quad[4], quad[6])
      const maxY = Math.max(quad[1], quad[3], quad[5], quad[7])
      
      rects.push({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        pageNumber: pageNumber
      })
    }
    return rects
  }
}

// React hook for using the annotation manager
export function useAnnotationManager(documentId: string) {
  const { data: session } = useSession()
  
  const annotationManager = new AnnotationManager(documentId, session?.user?.id)
  
  const loadAnnotations = useCallback(() => {
    return annotationManager.loadAnnotations()
  }, [annotationManager])

  const saveAnnotation = useCallback((annotation: Omit<AnnotationEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    return annotationManager.saveAnnotation(annotation)
  }, [annotationManager])

  const updateAnnotation = useCallback((annotationId: string, updates: Partial<AnnotationEvent>) => {
    return annotationManager.updateAnnotation(annotationId, updates)
  }, [annotationManager])

  const deleteAnnotation = useCallback((annotationId: string) => {
    return annotationManager.deleteAnnotation(annotationId)
  }, [annotationManager])

  const loadUserPreferences = useCallback(() => {
    return annotationManager.loadUserPreferences()
  }, [annotationManager])

  const saveUserPreferences = useCallback((preferences: Partial<UserPreferences>) => {
    return annotationManager.saveUserPreferences(preferences)
  }, [annotationManager])

  const exportAnnotations = useCallback(() => {
    return annotationManager.exportAnnotations()
  }, [annotationManager])

  const importAnnotations = useCallback((adobeAnnotations: any[]) => {
    return annotationManager.importAnnotations(adobeAnnotations)
  }, [annotationManager])

  return {
    loadAnnotations,
    saveAnnotation,
    updateAnnotation,
    deleteAnnotation,
    loadUserPreferences,
    saveUserPreferences,
    exportAnnotations,
    importAnnotations,
    isAuthenticated: !!session?.user?.id
  }
}