'use client'

import { useState, useEffect } from 'react'
import "react-pdf-highlighter/dist/style.css"
import { X, MessageSquare, Palette, User, Trash2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import {
  PdfLoader,
  PdfHighlighter,
  Highlight,
  Popup,
  AreaHighlight,
  IHighlight,
  NewHighlight,
  LTWHP,
  LTWH
} from "react-pdf-highlighter"
import { AnnotationSidebar } from './annotation-sidebar'

export interface AnnotatedPDFViewerProps {
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
    boundingRect: LTWH
    rects: LTWHP[]
    pageNumber: number
  }
  comment?: string
  color: string
  createdAt: string
  user: {
    id: string
    name: string
  }
}

const parseIdFromHighlight = (highlight: IHighlight) => {
  return highlight.id
}

const resetHash = () => {
  document.location.hash = ""
}

const getNextId = () => String(Math.random()).slice(2)

const parseIdFromHash = () => {
  return document.location.hash.slice("#highlight-".length)
}

const scrollToHighlightFromHash = () => {
  const highlight = parseIdFromHash()
  if (highlight) {
    document.querySelector(`[data-highlight-id="${highlight}"]`)?.scrollIntoView()
  }
}

const HighlightPopup = ({
  comment,
  onCommentChange,
  onDelete,
  onSave,
  onCancel,
  user,
  createdAt,
  isOwner
}: {
  comment?: string
  onCommentChange: (comment: string) => void
  onDelete?: () => void
  onSave: () => void
  onCancel: () => void
  user?: { name: string }
  createdAt?: string
  isOwner: boolean
}) => (
  <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-80">
    {user && (
      <div className="flex items-center text-xs text-gray-500 mb-2">
        <User className="h-3 w-3 mr-1" />
        <span>{user.name}</span>
        {createdAt && (
          <span className="ml-2">
            {new Date(createdAt).toLocaleDateString()}
          </span>
        )}
      </div>
    )}
    
    <textarea
      placeholder="Add a comment..."
      autoFocus
      value={comment || ""}
      onChange={(e) => onCommentChange(e.target.value)}
      className="w-full p-2 border border-gray-300 rounded text-sm resize-none"
      rows={3}
    />
    
    <div className="flex justify-between items-center mt-3">
      <div className="flex space-x-2">
        {isOwner && onDelete && (
          <button
            onClick={onDelete}
            className="flex items-center px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </button>
        )}
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="px-3 py-1 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded"
        >
          Save
        </button>
      </div>
    </div>
  </div>
)

const COLOR_OPTIONS = [
  { name: 'Yellow', value: '#FFFF00' },
  { name: 'Green', value: '#90EE90' },
  { name: 'Blue', value: '#87CEEB' },
  { name: 'Pink', value: '#FFB6C1' },
  { name: 'Orange', value: '#FFA500' },
  { name: 'Purple', value: '#DDA0DD' }
]

const AnnotationTip = ({
  onOpen,
  onConfirm,
}: {
  onOpen: () => void
  onConfirm: (comment: { text: string; emoji: string }, color: string) => void
}) => {
  const [comment, setComment] = useState("")
  const [selectedColor, setSelectedColor] = useState("#FFFF00")
  const [isEditing, setIsEditing] = useState(false)

  const handleConfirm = () => {
    onConfirm({
      text: comment,
      emoji: ""
    }, selectedColor)
    setComment("")
    setSelectedColor("#FFFF00")
    setIsEditing(false)
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
      {!isEditing ? (
        <div className="text-center">
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center px-3 py-2 text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Add Comment
          </button>
        </div>
      ) : (
        <div className="w-72">
          <textarea
            placeholder="Add a comment..."
            autoFocus
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-sm resize-none"
            rows={3}
          />
          
          {/* Color picker */}
          <div className="flex items-center space-x-2 mt-2 mb-2">
            <Palette className="h-4 w-4 text-gray-500" />
            <div className="flex space-x-1">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setSelectedColor(color.value)}
                  className={`w-5 h-5 rounded border-2 ${
                    selectedColor === color.value ? 'border-gray-800' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => {
                setIsEditing(false)
                setComment("")
              }}
              className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-3 py-1 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function AnnotatedPDFViewer({ 
  documentId, 
  documentTitle, 
  onClose 
}: AnnotatedPDFViewerProps) {
  const { data: session } = useSession()
  const [highlights, setHighlights] = useState<IHighlight[]>([])
  const [annotations, setAnnotations] = useState<AnnotationData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [scrollToHighlight, setScrollToHighlight] = useState<string | null>(null)
  const [highlighterReady, setHighlighterReady] = useState(false)

  // Load annotations when component mounts
  useEffect(() => {
    loadAnnotations()
  }, [documentId])

  // Debug what react-pdf-highlighter is actually rendering
  useEffect(() => {
    if (highlights.length > 0) {
      console.log(`🎨 Looking for highlights in DOM...`)
      
      setTimeout(() => {
        // Check for various possible selectors
        const selectors = [
          '.highlight__part',
          '.highlight',
          '.PdfHighlighter *[class*="highlight"]',
          '*[class*="highlight"]',
          '.react-pdf__Page',
          '.PdfHighlighter'
        ]
        
        selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector)
          console.log(`${selector}: ${elements.length} elements`)
        })
        
        // Log all classes in the PDF area
        const pdfContainer = document.querySelector('.PdfHighlighter')
        if (pdfContainer) {
          console.log('🔍 PDF Container found, checking children...')
          const allElements = pdfContainer.querySelectorAll('*')
          console.log(`Total elements in PDF container: ${allElements.length}`)
          
          // Log first few elements with their classes
          Array.from(allElements).slice(0, 10).forEach((el, i) => {
            console.log(`Element ${i}: ${el.tagName} - classes: ${el.className}`)
          })
        } else {
          console.log('❌ No PDF Container found')
        }
      }, 2000)
    }
  }, [highlights])

  // Handle scrolling to highlight
  useEffect(() => {
    if (scrollToHighlight && highlights.length > 0) {
      console.log(`📍 Attempting to scroll to highlight: ${scrollToHighlight}`)
      
      const timeoutId = setTimeout(() => {
        const parts = document.querySelectorAll('.highlight__part')
        console.log(`📍 Found ${parts.length} highlight parts for scrolling`)
        
        if (parts.length > 0) {
          // For now, just scroll to the first highlight
          const firstPart = parts[0] as HTMLElement
          firstPart.scrollIntoView({ behavior: 'smooth', block: 'center' })
          
          // Add visual feedback
          firstPart.style.border = '2px solid red'
          setTimeout(() => {
            firstPart.style.border = ''
          }, 2000)
          
          console.log('✅ Scrolled to highlight')
        } else {
          console.log('❌ No highlight parts found for scrolling')
        }
        setScrollToHighlight(null)
      }, 1500) // Even longer delay
      
      return () => clearTimeout(timeoutId)
    }
  }, [scrollToHighlight, highlights])

  const loadAnnotations = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/documents/${documentId}/annotations`)
      
      if (!response.ok) {
        throw new Error('Failed to load annotations')
      }
      
      const annotationsData: AnnotationData[] = await response.json()
      console.log(`✅ Loaded ${annotationsData.length} annotations`)
      
      // Convert annotations to react-pdf-highlighter format
      const highlightsData: IHighlight[] = annotationsData.map(annotation => ({
        id: annotation.id,
        content: annotation.content,
        position: annotation.position,
        comment: {
          text: annotation.comment || '',
          emoji: ''
        },
        color: annotation.color
      })) as any
      console.log(`✅ Converted to ${highlightsData.length} highlights`)
      
      setAnnotations(annotationsData)
      setHighlights(highlightsData)
    } catch (error) {
      console.error('Error loading annotations:', error)
      setError('Failed to load annotations')
    } finally {
      setLoading(false)
    }
  }

  const addHighlight = async (highlight: NewHighlight & { color?: string }) => {
    if (!session?.user?.id) {
      alert('You must be logged in to add annotations')
      return
    }

    try {
      const payload = {
        content: highlight.content,
        position: highlight.position,
        comment: highlight.comment?.text || '',
        color: highlight.color || '#FFFF00' // Use selected color or default yellow
      }
      console.log(`💾 Saving annotation with color: ${payload.color}`)
      
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
      const newHighlight: IHighlight = {
        id: savedAnnotation.id,
        content: highlight.content,
        position: highlight.position,
        comment: highlight.comment,
        color: highlight.color || '#FFFF00'
      } as any
      
      // Don't call loadAnnotations() here - just update state directly  
      setHighlights(prev => {
        const newHighlights = [...prev, newHighlight]
        console.log(`✨ Added highlight with color: ${(newHighlight as any).color}`)
        console.log(`📊 Total highlights now: ${newHighlights.length}`)
        console.log(`📊 Highlight data:`, newHighlight)
        return newHighlights
      })
      
      // Add to annotations state for sidebar
      const newAnnotation: AnnotationData = {
        id: savedAnnotation.id,
        content: highlight.content as any,
        position: highlight.position as any,
        comment: highlight.comment?.text || undefined,
        color: highlight.color || '#FFFF00',
        createdAt: savedAnnotation.createdAt,
        user: {
          id: session.user.id,
          name: session.user.name || 'Current User'
        }
      }
      setAnnotations(prev => [...prev, newAnnotation])
    } catch (error) {
      console.error('Error saving annotation:', error)
      alert('Failed to save annotation')
    }
  }

  const updateHighlight = async (
    highlightId: string,
    highlight: Partial<IHighlight>,
    comment: { text: string; emoji: string }
  ) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/annotations/${highlightId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: comment.text,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update annotation')
      }

      // Update local state
      setHighlights(prev =>
        prev.map(h =>
          h.id === highlightId
            ? { ...h, comment }
            : h
        )
      )
    } catch (error) {
      console.error('Error updating annotation:', error)
      alert('Failed to update annotation')
    }
  }

  const deleteHighlight = async (highlightId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/annotations/${highlightId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete annotation')
      }

      // Remove from local state
      setHighlights(prev => prev.filter(h => h.id !== highlightId))
      setAnnotations(prev => prev.filter(a => a.id !== highlightId))
    } catch (error) {
      console.error('Error deleting annotation:', error)
      alert('Failed to delete annotation')
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading annotations...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
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
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl h-full max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 truncate">
              {documentTitle}
            </h2>
            <div className="flex items-center justify-between mt-1">
              <p className="text-sm text-gray-600">
                Annotated PDF Viewer - Click and drag to highlight text
              </p>
              {highlights.length > 0 && (
                <div className="text-sm text-gray-500">
                  {highlights.length} annotation{highlights.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex">
          {/* PDF Viewer */}
          <div 
            className="flex-1 bg-gray-100"
            style={{
              position: 'relative',
              width: '100%',
              height: '100%'
            }}
          >
              <PdfLoader
                url={`/api/documents/${documentId}/pdf`}
                beforeLoad={<div className="text-center p-8">Loading PDF...</div>}
              >
                {(pdfDocument) => (
                  <PdfHighlighter
                    pdfDocument={pdfDocument}
                    enableAreaSelection={(event) => event.altKey}
                    onScrollChange={resetHash}
                    scrollRef={(scrollTo) => {
                      // Signal that highlighter is ready
                      setHighlighterReady(true)
                      console.log(`📚 PdfHighlighter ready with ${highlights.length} highlights`)
                    }}
                    highlights={highlights}
                    onSelectionFinished={(
                      position,
                      content,
                      hideTipAndSelection,
                      transformSelection
                    ) => (
                      <AnnotationTip
                        onOpen={transformSelection}
                        onConfirm={(comment, color) => {
                          addHighlight({ content, position, comment, color })
                          hideTipAndSelection()
                        }}
                      />
                    )}
                    highlightTransform={(
                      highlight,
                      index,
                      setTip,
                      hideTip,
                      viewportToScaled,
                      screenshot,
                      isScrolledTo
                    ) => {
                      const isTextHighlight = !(
                        highlight.content && highlight.content.image
                      )

                      const component = isTextHighlight ? (
                        <Highlight
                          isScrolledTo={isScrolledTo}
                          position={highlight.position}
                          comment={highlight.comment}
                        />
                      ) : (
                        <AreaHighlight
                          isScrolledTo={isScrolledTo}
                          highlight={highlight}
                          onChange={(boundingRect) => {
                            updateHighlight(
                              highlight.id,
                              { ...highlight, position: { ...highlight.position, boundingRect } },
                              highlight.comment || { text: '', emoji: '' }
                            )
                          }}
                        />
                      )

                      return (
                        <Popup
                          popupContent={
                            <HighlightPopup
                              comment={highlight.comment?.text}
                              onCommentChange={(comment) => {
                                updateHighlight(
                                  highlight.id,
                                  highlight,
                                  { text: comment, emoji: '' }
                                )
                              }}
                              onDelete={() => deleteHighlight(highlight.id)}
                              onSave={() => hideTip()}
                              onCancel={() => hideTip()}
                              user={annotations.find(a => a.id === highlight.id)?.user}
                              createdAt={annotations.find(a => a.id === highlight.id)?.createdAt}
                              isOwner={annotations.find(a => a.id === highlight.id)?.user.id === session?.user?.id}
                            />
                          }
                          onMouseOver={(popupContent) => setTip(highlight, (highlight) => popupContent)}
                          onMouseOut={hideTip}
                          key={index}
                        >
                          {component}
                        </Popup>
                      )
                    }}
                  />
                )}
              </PdfLoader>
          </div>

          {/* Annotation Sidebar */}
          <AnnotationSidebar
            documentId={documentId}
            annotations={annotations}
            onAnnotationClick={(annotation) => {
              // Scroll to the annotation highlight
              setScrollToHighlight(annotation.id)
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
                  // Update local state instead of reloading
                  setAnnotations(prev => prev.map(a => 
                    a.id === annotationId ? { ...a, ...data } : a
                  ))
                  // Also update highlights for comment changes
                  if (data.comment !== undefined) {
                    setHighlights(prev => prev.map(h =>
                      h.id === annotationId 
                        ? { ...h, comment: { text: data.comment || '', emoji: '' } }
                        : h
                    ))
                  }
                }
              } catch (error) {
                console.error('Failed to update annotation:', error)
              }
            }}
            onAnnotationDelete={(annotationId) => {
              deleteHighlight(annotationId)
            }}
            className="w-80"
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 text-center">
          <p className="text-xs text-gray-500">
            Click and drag to select text for highlighting. Alt+click and drag to create area highlights.
          </p>
        </div>
      </div>
    </div>
  )
}
