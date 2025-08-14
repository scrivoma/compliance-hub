'use client'

import { useState, useEffect } from 'react'
import { X, MessageSquare, Palette, User, Trash2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { AnnotationSidebar } from './annotation-sidebar'

export interface SimplePDFViewerProps {
  documentId: string
  documentTitle: string
  onClose: () => void
}

interface AnnotationData {
  id: string
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
  createdAt: string
  user: {
    id: string
    name: string
  }
}

const COLOR_OPTIONS = [
  { name: 'Yellow', value: '#FFFF00' },
  { name: 'Green', value: '#90EE90' },
  { name: 'Blue', value: '#87CEEB' },
  { name: 'Pink', value: '#FFB6C1' },
  { name: 'Orange', value: '#FFA500' },
  { name: 'Purple', value: '#DDA0DD' }
]

export function SimplePDFViewer({ 
  documentId, 
  documentTitle, 
  onClose 
}: SimplePDFViewerProps) {
  const { data: session } = useSession()
  const [annotations, setAnnotations] = useState<AnnotationData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [showAnnotationForm, setShowAnnotationForm] = useState(false)
  const [newAnnotation, setNewAnnotation] = useState({
    text: '',
    comment: '',
    color: '#FFFF00'
  })

  // Load annotations when component mounts
  useEffect(() => {
    loadAnnotations()
  }, [documentId])

  const loadAnnotations = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/documents/${documentId}/annotations`)
      
      if (!response.ok) {
        throw new Error('Failed to load annotations')
      }
      
      const annotationsData: AnnotationData[] = await response.json()
      console.log(`✅ Loaded ${annotationsData.length} annotations`)
      setAnnotations(annotationsData)
    } catch (error) {
      console.error('Error loading annotations:', error)
      setError('Failed to load annotations')
    } finally {
      setLoading(false)
    }
  }

  const addAnnotation = async () => {
    if (!session?.user?.id || !newAnnotation.text.trim()) {
      return
    }

    try {
      const payload = {
        content: {
          text: newAnnotation.text,
          quote: newAnnotation.text.substring(0, 100)
        },
        position: {
          boundingRect: {
            x1: 100, y1: 100, x2: 200, y2: 120,
            width: 100, height: 20, pageNumber: 1
          },
          rects: [{
            x1: 100, y1: 100, x2: 200, y2: 120,
            width: 100, height: 20, pageNumber: 1
          }]
        },
        comment: newAnnotation.comment,
        color: newAnnotation.color
      }

      const response = await fetch(`/api/documents/${documentId}/annotations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Failed to save annotation')
      }

      const savedAnnotation = await response.json()
      
      // Add to local state
      const annotation: AnnotationData = {
        id: savedAnnotation.id,
        content: {
          text: newAnnotation.text,
          quote: newAnnotation.text.substring(0, 100)
        },
        position: payload.position,
        comment: newAnnotation.comment || null,
        color: newAnnotation.color,
        createdAt: savedAnnotation.createdAt,
        user: {
          id: session.user.id,
          name: session.user.name || 'Current User'
        }
      }
      
      setAnnotations(prev => [...prev, annotation])
      setNewAnnotation({ text: '', comment: '', color: '#FFFF00' })
      setShowAnnotationForm(false)
    } catch (error) {
      console.error('Error saving annotation:', error)
      alert('Failed to save annotation')
    }
  }

  const deleteAnnotation = async (annotationId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/annotations/${annotationId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete annotation')
      }

      setAnnotations(prev => prev.filter(a => a.id !== annotationId))
    } catch (error) {
      console.error('Error deleting annotation:', error)
      alert('Failed to delete annotation')
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-indigo-300 dark:border-indigo-600 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading annotations...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-7xl h-full max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">
              {documentTitle}
            </h2>
            <div className="flex items-center justify-between mt-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Simple PDF Viewer - Working annotation system
              </p>
              {annotations.length > 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex">
          {/* PDF Viewer */}
          <div className="flex-1 bg-gray-100 dark:bg-gray-900 flex flex-col">
            {/* PDF Content - Simple iframe for now */}
            <div className="flex-1 p-4">
              <iframe
                src={`/api/documents/${documentId}/pdf`}
                className="w-full h-full border border-gray-300 dark:border-gray-600 rounded"
                title={documentTitle}
              />
            </div>
            
            {/* Add Annotation Button */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowAnnotationForm(true)}
                className="flex items-center px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded hover:bg-indigo-700 dark:hover:bg-indigo-600"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Add Annotation
              </button>
            </div>
          </div>

          {/* Annotation Sidebar */}
          <AnnotationSidebar
            documentId={documentId}
            annotations={annotations}
            onAnnotationClick={(annotation) => {
              console.log('Clicked annotation:', annotation)
              alert(`Annotation: ${annotation.content.text}`)
            }}
            onAnnotationUpdate={async (annotationId, data) => {
              try {
                const response = await fetch(`/api/documents/${documentId}/annotations/${annotationId}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(data),
                })

                if (response.ok) {
                  setAnnotations(prev => prev.map(a => 
                    a.id === annotationId ? { ...a, ...data } : a
                  ))
                }
              } catch (error) {
                console.error('Failed to update annotation:', error)
              }
            }}
            onAnnotationDelete={deleteAnnotation}
            className="w-80"
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Simple annotation system - Proof of concept
          </p>
        </div>
      </div>

      {/* Add Annotation Modal */}
      {showAnnotationForm && (
        <div className="fixed inset-0 z-60 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Add Annotation</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Text to annotate
                </label>
                <input
                  type="text"
                  value={newAnnotation.text}
                  onChange={(e) => setNewAnnotation(prev => ({ ...prev, text: e.target.value }))}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Enter text..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Comment
                </label>
                <textarea
                  value={newAnnotation.comment}
                  onChange={(e) => setNewAnnotation(prev => ({ ...prev, comment: e.target.value }))}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  rows={3}
                  placeholder="Add a comment..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Color
                </label>
                <div className="flex space-x-2">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setNewAnnotation(prev => ({ ...prev, color: color.value }))}
                      className={`w-8 h-8 rounded border-2 ${
                        newAnnotation.color === color.value ? 'border-gray-800 dark:border-gray-200' : 'border-gray-300 dark:border-gray-600'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowAnnotationForm(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={addAnnotation}
                className="px-4 py-2 text-white bg-indigo-600 dark:bg-indigo-500 rounded hover:bg-indigo-700 dark:hover:bg-indigo-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}