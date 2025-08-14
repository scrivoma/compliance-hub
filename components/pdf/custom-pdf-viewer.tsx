'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { X, MessageSquare, Palette, User, Trash2, MapPin } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { AnnotationSidebar } from './annotation-sidebar'

// Import react-pdf CSS styles
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure PDF.js worker using local file
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.js'

export interface CustomPDFViewerProps {
  documentId: string
  documentTitle: string
  onClose: () => void
  // Optional citation data for search results
  citationData?: {
    id: string
    text: string
    pageNumber: number
    startChar: number
    endChar: number
    coordinates: {
      page: number
      x: number
      y: number
      width: number
      height: number
    }
  }
  // Mode: 'annotation' (default) or 'search'
  mode?: 'annotation' | 'search'
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

export function CustomPDFViewer({ 
  documentId, 
  documentTitle, 
  onClose,
  citationData,
  mode = 'annotation'
}: CustomPDFViewerProps) {
  const { data: session } = useSession()
  const [numPages, setNumPages] = useState<number>()
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [annotations, setAnnotations] = useState<AnnotationData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [viewMode, setViewMode] = useState<'annotation' | 'search' | 'both'>(mode === 'search' ? 'search' : 'annotation')
  const [citationHighlights, setCitationHighlights] = useState<Array<{
    pageNumber: number
    x: number
    y: number
    width: number
    height: number
    citationId: string
  }>>([])
  const [pageWidth, setPageWidth] = useState<number>(800)
  const [pageHeight, setPageHeight] = useState<number>(1000)
  const [isSelecting, setIsSelecting] = useState(false)
  const [currentSelection, setCurrentSelection] = useState<{
    text: string
    rects: Array<{
      x: number
      y: number
      width: number
      height: number
      pageNumber: number
    }>
    pageNumber: number
  } | null>(null)
  const [showSelectionPopup, setShowSelectionPopup] = useState(false)
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 })
  const pdfContainerRef = useRef<HTMLDivElement>(null)

  // Load annotations when component mounts
  useEffect(() => {
    loadAnnotations()
  }, [documentId])
  
  // Process citation data when provided
  useEffect(() => {
    if (citationData && pageWidth && pageHeight) {
      console.log('🔍 Processing citation data:', citationData)
      console.log('📏 Current page dimensions:', { pageWidth, pageHeight })
      console.log('📍 Citation coordinates:', citationData.coordinates)
      console.log('📍 Citation text preview:', citationData.text.substring(0, 100) + '...')
      console.log('📍 Citation page number:', citationData.pageNumber)
      console.log('📍 Citation start/end chars:', citationData.startChar, '-', citationData.endChar)
      
      // The coordinates from LlamaIndex might be in different coordinate systems
      // Let's try both the original coordinates and a fallback approach
      const pdfCoords = citationData.coordinates
      
      console.log('🔍 Original coordinates from LlamaIndex:', pdfCoords)
      console.log('🔍 Page dimensions for scaling:', { pageWidth, pageHeight })
      
      let citationHighlight
      
      // Try the original coordinates first, but with some validation
      if (pdfCoords && pdfCoords.x !== undefined && pdfCoords.y !== undefined) {
        // The coordinates might be in different scales, try multiple approaches
        
        // PDF coordinates have origin at BOTTOM-LEFT, but browser rendering has origin at TOP-LEFT
        // We need to flip the Y coordinate!
        
        // Approach 1: Direct coordinates with Y-axis flip
        const directCoords = {
          pageNumber: citationData.pageNumber,
          x: pdfCoords.x,
          y: pageHeight - pdfCoords.y - (pdfCoords.height || 30), // Flip Y coordinate
          width: pdfCoords.width || 200,
          height: pdfCoords.height || 30,
          citationId: citationData.id
        }
        
        // Approach 2: Scale from PDF points with Y-axis flip
        const scaledCoords = {
          pageNumber: citationData.pageNumber,
          x: (pdfCoords.x * pageWidth) / 612, // 612 is standard PDF width in points
          y: pageHeight - ((pdfCoords.y * pageHeight) / 792) - ((pdfCoords.height * pageHeight) / 792 || 30), // Flip Y coordinate
          width: (pdfCoords.width * pageWidth) / 612 || 200,
          height: (pdfCoords.height * pageHeight) / 792 || 30,
          citationId: citationData.id
        }
        
        console.log('🔍 Direct coordinates (Y-flipped):', directCoords)
        console.log('🔍 Scaled coordinates (Y-flipped):', scaledCoords)
        
        // Use direct coordinates if they seem reasonable, otherwise use scaled
        if (directCoords.x >= 0 && directCoords.x < pageWidth && 
            directCoords.y >= 0 && directCoords.y < pageHeight) {
          citationHighlight = directCoords
          console.log('✅ Using direct coordinates with Y-flip')
          console.log('📊 Direct coord validation: x=', directCoords.x, 'y=', directCoords.y, 'pageW=', pageWidth, 'pageH=', pageHeight)
        } else {
          citationHighlight = scaledCoords
          console.log('✅ Using scaled coordinates with Y-flip')
          console.log('📊 Scaled coord validation: x=', scaledCoords.x, 'y=', scaledCoords.y, 'pageW=', pageWidth, 'pageH=', pageHeight)
        }
      } else {
        // Fallback: position based on text and page analysis
        console.log('⚠️ No valid coordinates, using text-based positioning')
        citationHighlight = {
          pageNumber: citationData.pageNumber,
          x: 50,
          y: 50, // Near top since the target text appears to be in upper portion
          width: pageWidth - 100,
          height: 80,
          citationId: citationData.id
        }
      }
      
      console.log('🎨 Final citation highlight:', citationHighlight)
      setCitationHighlights([citationHighlight])
    } else {
      console.log('⚠️ Citation data not ready:', { citationData: !!citationData, pageWidth, pageHeight })
    }
  }, [citationData, pageWidth, pageHeight])
  
  // Enhanced scroll function that works for both annotations and citations
  const scrollToElement = useCallback((elementId: string, elementType: 'annotation' | 'citation' = 'annotation') => {
    console.log(`📍 Scrolling to ${elementType}: ${elementId}`)
    
    const selector = elementType === 'citation' 
      ? `rect[data-citation-id="${elementId}"]`
      : `rect[data-annotation-id="${elementId}"]`
    
    const searchData = elementType === 'citation' 
      ? citationHighlights.find(c => c.citationId === elementId)
      : annotations.find(a => a.id === elementId)
      
    if (!searchData) {
      console.log(`❌ ${elementType} not found: ${elementId}`)
      return
    }

    // Add delay to ensure DOM is ready
    setTimeout(() => {
      console.log(`🔍 Looking for ${elementType}: ${elementId}`)
      
      // Debug: Check what SVG elements exist
      const allRects = document.querySelectorAll(`rect[data-${elementType}-id]`)
      console.log(`🔍 Found ${allRects.length} ${elementType} rects in DOM:`, 
        Array.from(allRects).map(r => r.getAttribute(`data-${elementType}-id`)))
      
      // Find the SVG element
      const svgElement = document.querySelector(selector)
      if (!svgElement) {
        console.log(`❌ SVG element not found for ${elementType}: ${elementId}`)
        return
      }

      console.log(`✅ Found SVG element for ${elementType}: ${elementId}`)

      // Get the PDF container (our scroll container)
      const pdfContainer = pdfContainerRef.current
      if (!pdfContainer) {
        console.log(`❌ PDF container not found`)
        return
      }

      // Calculate scroll position
      const svgRect = svgElement.getBoundingClientRect()
      const containerRect = pdfContainer.getBoundingClientRect()
      
      const elementTop = svgRect.top - containerRect.top + pdfContainer.scrollTop
      const containerHeight = pdfContainer.clientHeight
      const scrollTop = elementTop - (containerHeight / 2)
      
      console.log(`📐 Scroll calculation:`, {
        containerHeight,
        elementTop,
        scrollTop,
        currentScrollTop: pdfContainer.scrollTop
      })

      // Smooth scroll to the calculated position
      pdfContainer.scrollTo({
        top: Math.max(0, scrollTop),
        behavior: 'smooth'
      })

      // Add visual feedback
      const rect = svgElement as SVGRectElement
      const originalOpacity = rect.style.fillOpacity || (elementType === 'citation' ? '0.5' : '0.3')
      const originalStroke = rect.style.stroke || (elementType === 'citation' ? '#FFD700' : (searchData as any).color)
      const originalStrokeWidth = rect.style.strokeWidth || '1'
      
      // Flash effect
      rect.style.fillOpacity = '0.8'
      rect.style.stroke = '#ff0000'
      rect.style.strokeWidth = '3'
      rect.style.filter = 'drop-shadow(0 0 6px rgba(255, 0, 0, 0.8))'
      
      setTimeout(() => {
        rect.style.fillOpacity = originalOpacity
        rect.style.stroke = originalStroke
        rect.style.strokeWidth = originalStrokeWidth
        rect.style.filter = ''
      }, 2000)

      console.log(`✅ Scrolled to ${elementType}: ${elementId}`)
    }, 100)
  }, [annotations, citationHighlights])
  
  // Auto-scroll to citation after highlights are set
  useEffect(() => {
    if (citationData && citationHighlights.length > 0) {
      console.log('📍 Auto-scrolling to citation after highlights are ready')
      console.log('📍 Citation should be on page:', citationData.pageNumber)
      
      // First, set the page number to the citation page
      setPageNumber(citationData.pageNumber)
      
      setTimeout(() => {
        scrollToElement(citationData.id, 'citation')
      }, 1500) // Delay for PDF and SVG rendering
    }
  }, [citationHighlights, citationData, scrollToElement])

  // Lock body scroll when modal is open
  useEffect(() => {
    // Disable body scroll
    document.body.style.overflow = 'hidden'
    
    // Re-enable body scroll on cleanup
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

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

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    console.log(`📄 PDF loaded with ${numPages} pages`)
  }, [])

  const onPageLoadSuccess = useCallback((page: any) => {
    const { width, height, originalWidth, originalHeight } = page
    setPageWidth(width)
    setPageHeight(height)
    console.log(`📏 Page dimensions - rendered: ${width}x${height}, original: ${originalWidth}x${originalHeight}`)
    
    // Store original PDF dimensions for coordinate scaling
    if (originalWidth && originalHeight) {
      setPageHeight(height) // Keep this for rendering
      setPageWidth(width)   // Keep this for rendering
      // We'll use originalWidth/originalHeight for coordinate scaling
    }
  }, [])

  const deleteAnnotation = async (annotationId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/annotations/${annotationId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete annotation')
      }

      setAnnotations(prev => prev.filter(a => a.id !== annotationId))
      console.log(`🗑️ Deleted annotation: ${annotationId}`)
    } catch (error) {
      console.error('Error deleting annotation:', error)
      alert('Failed to delete annotation')
    }
  }

  const updateAnnotation = async (annotationId: string, data: { comment?: string; color?: string }) => {
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
        console.log(`✏️ Updated annotation: ${annotationId}`)
      }
    } catch (error) {
      console.error('Failed to update annotation:', error)
    }
  }

  // Text selection functions
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !pdfContainerRef.current) {
      setCurrentSelection(null)
      setShowSelectionPopup(false)
      return
    }

    const selectedText = selection.toString().trim()
    if (!selectedText) {
      setCurrentSelection(null)
      setShowSelectionPopup(false)
      return
    }

    try {
      // Get selection range and bounding rectangles
      const range = selection.getRangeAt(0)
      const rects = Array.from(range.getClientRects())
      
      if (rects.length === 0) {
        console.log('❌ No client rects found for selection')
        return
      }

      // Find which page this selection is on
      const pageElement = range.commonAncestorContainer.nodeType === Node.TEXT_NODE 
        ? range.commonAncestorContainer.parentElement?.closest('.react-pdf__Page')
        : range.commonAncestorContainer.closest?.('.react-pdf__Page')

      if (!pageElement) {
        console.log('❌ Could not find page element for selection')
        return
      }

      const pageNumber = parseInt(pageElement.getAttribute('data-page-number') || '1')
      const pageRect = pageElement.getBoundingClientRect()
      const containerRect = pdfContainerRef.current.getBoundingClientRect()

      // Convert client rects to page-relative coordinates
      const selectionRects = rects.map(rect => ({
        x: rect.left - pageRect.left,
        y: rect.top - pageRect.top,
        width: rect.width,
        height: rect.height,
        pageNumber
      }))

      console.log(`📝 Text selected: "${selectedText}" on page ${pageNumber}`)
      console.log(`📐 Selection rects:`, selectionRects)

      setCurrentSelection({
        text: selectedText,
        rects: selectionRects,
        pageNumber
      })

      // Position popup near the selection
      const lastRect = rects[rects.length - 1]
      setPopupPosition({
        x: lastRect.right - containerRect.left + 10,
        y: lastRect.top - containerRect.top
      })
      setShowSelectionPopup(true)

    } catch (error) {
      console.error('Error processing text selection:', error)
    }
  }, [])

  const handleSelectionClear = useCallback(() => {
    window.getSelection()?.removeAllRanges()
    setCurrentSelection(null)
    setShowSelectionPopup(false)
  }, [])

  const createAnnotationFromSelection = async (color: string, comment: string) => {
    if (!currentSelection || !session?.user?.id) {
      return
    }

    try {
      // Create position data compatible with our annotation format
      const boundingRect = {
        x1: Math.min(...currentSelection.rects.map(r => r.x)),
        y1: Math.min(...currentSelection.rects.map(r => r.y)),
        x2: Math.max(...currentSelection.rects.map(r => r.x + r.width)),
        y2: Math.max(...currentSelection.rects.map(r => r.y + r.height)),
        width: pageWidth,
        height: pageHeight,
        pageNumber: currentSelection.pageNumber
      }

      const rects = currentSelection.rects.map(rect => ({
        x1: rect.x,
        y1: rect.y,
        x2: rect.x + rect.width,
        y2: rect.y + rect.height,
        width: pageWidth,
        height: pageHeight,
        pageNumber: rect.pageNumber
      }))

      const payload = {
        content: {
          text: currentSelection.text,
          quote: currentSelection.text.substring(0, 100)
        },
        position: {
          boundingRect,
          rects
        },
        comment: comment || null,
        color
      }

      console.log(`💾 Creating annotation from selection:`, payload)

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
      const newAnnotation: AnnotationData = {
        id: savedAnnotation.id,
        content: payload.content,
        position: payload.position,
        comment: payload.comment,
        color,
        createdAt: savedAnnotation.createdAt,
        user: {
          id: session.user.id,
          name: session.user.name || 'Current User'
        }
      }

      setAnnotations(prev => [...prev, newAnnotation])
      console.log(`✅ Created annotation: ${savedAnnotation.id}`)

      // Clear selection
      handleSelectionClear()
    } catch (error) {
      console.error('Error creating annotation from selection:', error)
      alert('Failed to create annotation')
    }
  }
  
  // Legacy function for annotation scrolling (for backwards compatibility)
  const scrollToAnnotation = useCallback((annotationId: string) => {
    scrollToElement(annotationId, 'annotation')
  }, [scrollToElement])
  
  // New function for citation scrolling
  const scrollToCitation = useCallback((citationId: string) => {
    scrollToElement(citationId, 'citation')
  }, [scrollToElement])

  const handleHighlightClick = useCallback((annotationId: string) => {
    console.log(`🎯 Highlight clicked: ${annotationId}`)
    
    // Find the annotation
    const annotation = annotations.find(a => a.id === annotationId)
    if (!annotation) return

    // Create a more elegant popup instead of alert
    const existingPopup = document.getElementById('highlight-info-popup')
    if (existingPopup) {
      existingPopup.remove()
    }

    const popup = document.createElement('div')
    popup.id = 'highlight-info-popup'
    popup.className = 'fixed z-50 bg-white rounded-lg shadow-xl border border-gray-300 p-4 max-w-sm'
    popup.style.cssText = `
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      animation: fadeIn 0.2s ease-out;
    `

    popup.innerHTML = `
      <style>
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      </style>
      <div class="flex items-start justify-between mb-3">
        <h4 class="text-sm font-medium text-gray-900">Annotation Details</h4>
        <button onclick="this.parentElement.parentElement.remove()" class="text-gray-400 hover:text-gray-600 transition-colors">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="space-y-3">
        <div class="p-2 bg-gray-50 rounded border" style="border-left: 4px solid ${annotation.color};">
          <p class="text-sm text-gray-700">"${annotation.content.text}"</p>
        </div>
        ${annotation.comment ? `
          <div>
            <p class="text-xs font-medium text-gray-700 mb-1">Comment:</p>
            <p class="text-sm text-gray-600">${annotation.comment}</p>
          </div>
        ` : ''}
        <div class="flex items-center justify-between text-xs text-gray-500">
          <span>By ${annotation.user.name}</span>
          <span>${new Date(annotation.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    `

    document.body.appendChild(popup)

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (popup.parentElement) {
        popup.remove()
      }
    }, 5000)
  }, [annotations])

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-indigo-300 dark:border-indigo-600 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading PDF viewer...</p>
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
    <div 
      className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4"
      onClick={(e) => {
        // Close modal when clicking backdrop
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-7xl h-full max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">
              {documentTitle}
            </h2>
            <div className="flex items-center justify-between mt-1">
              <div className="flex flex-col space-y-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {mode === 'search' && citationData 
                    ? `🔍 Search Citation: ${citationData.text.substring(0, 60)}${citationData.text.length > 60 ? '...' : ''}`
                    : '📝 Select text to highlight • 🎯 Click highlights to view details • 📋 Use sidebar to navigate'
                  }
                </p>
                {/* View Mode Toggle */}
                {(citationData || annotations.length > 0) && (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">View:</span>
                    <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 text-xs">
                      {citationData && (
                        <button
                          onClick={() => setViewMode('search')}
                          className={`px-2 py-1 rounded-l-lg transition-colors ${
                            viewMode === 'search' 
                              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-600' 
                              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          🔍 Citation
                        </button>
                      )}
                      <button
                        onClick={() => setViewMode('annotation')}
                        className={`px-2 py-1 ${citationData ? '' : 'rounded-l-lg'} transition-colors ${
                          viewMode === 'annotation' 
                            ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-600' 
                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        📝 Annotations
                      </button>
                      {citationData && (
                        <button
                          onClick={() => setViewMode('both')}
                          className={`px-2 py-1 rounded-r-lg transition-colors ${
                            viewMode === 'both' 
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-300 dark:border-green-600' 
                              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          🔄 Both
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-3">
                {citationData && (
                  <div className="text-sm text-yellow-700 dark:text-yellow-200 flex items-center bg-yellow-50 dark:bg-yellow-900 px-2 py-1 rounded">
                    <MapPin className="h-4 w-4 mr-1" />
                    Page {citationData.pageNumber}
                  </div>
                )}
                {annotations.length > 0 && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                    <MessageSquare className="h-4 w-4 mr-1" />
                    {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
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
            <div 
              ref={pdfContainerRef}
              className="flex-1 overflow-y-auto overflow-x-hidden p-4 relative"
              style={{ 
                height: '100%',
                maxHeight: 'calc(100vh - 200px)' // Account for header and footer
              }}
              onMouseUp={handleMouseUp}
              onMouseDown={() => {
                if (showSelectionPopup) {
                  setShowSelectionPopup(false)
                  setCurrentSelection(null)
                }
              }}
            >
              <div className="flex justify-center">
                <div className="relative bg-white dark:bg-gray-800 shadow-lg">
                  <Document
                    file={`/api/documents/${documentId}/pdf`}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={(error) => {
                      console.error('PDF load error:', error)
                      setError('Failed to load PDF')
                    }}
                    loading={
                      <div className="flex items-center justify-center p-8">
                        <div className="h-6 w-6 border-2 border-indigo-300 dark:border-indigo-600 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mr-3"></div>
                        <span className="text-gray-900 dark:text-gray-100">Loading PDF...</span>
                      </div>
                    }
                  >
                    {Array.from(new Array(numPages), (el, index) => (
                      <div key={`page_${index + 1}`} className="relative mb-4">
                        <Page
                          pageNumber={index + 1}
                          onLoadSuccess={onPageLoadSuccess}
                          width={pageWidth}
                          renderTextLayer={true}
                          renderAnnotationLayer={true}
                        />
                        
                        {/* SVG Overlay for highlights */}
                        <div 
                          className="absolute inset-0 pointer-events-none"
                          style={{ width: pageWidth, height: pageHeight }}
                        >
                          <svg
                            width={pageWidth}
                            height={pageHeight}
                            className="absolute inset-0 pointer-events-none"
                            style={{ 
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%'
                            }}
                          >
                            {/* Render search citations (yellow highlights) */}
                            {(viewMode === 'search' || viewMode === 'both') && citationHighlights
                              .filter(citation => citation.pageNumber === (index + 1))
                              .map((citation) => (
                                <rect
                                  key={`citation-${citation.citationId}`}
                                  x={citation.x}
                                  y={citation.y}
                                  width={citation.width}
                                  height={citation.height}
                                  fill="#FFD700"
                                  fillOpacity={0.5}
                                  stroke="#FFD700"
                                  strokeWidth={2}
                                  strokeOpacity={0.8}
                                  className="pointer-events-auto cursor-pointer hover:fill-opacity-70 transition-all"
                                  onClick={() => scrollToCitation(citation.citationId)}
                                  data-citation-id={citation.citationId}
                                  title={`Search Citation: ${citationData?.text?.substring(0, 100)}...`}
                                />
                              ))
                            }
                            
                            {/* Render user annotations (colored highlights) */}
                            {(viewMode === 'annotation' || viewMode === 'both') && annotations
                              .filter(annotation => {
                                // Show annotations for this page
                                return annotation.position.boundingRect.pageNumber === (index + 1)
                              })
                              .map((annotation) => (
                                <g key={annotation.id}>
                                  {/* Render each rect for this annotation */}
                                  {annotation.position.rects.map((rect, rectIndex) => (
                                    <rect
                                      key={`${annotation.id}-${rectIndex}`}
                                      x={rect.x1}
                                      y={rect.y1}
                                      width={rect.x2 - rect.x1}
                                      height={rect.y2 - rect.y1}
                                      fill={annotation.color}
                                      fillOpacity={0.3}
                                      stroke={annotation.color}
                                      strokeWidth={1}
                                      strokeOpacity={0.8}
                                      className="pointer-events-auto cursor-pointer hover:fill-opacity-50 transition-all"
                                      onClick={() => handleHighlightClick(annotation.id)}
                                      data-annotation-id={annotation.id}
                                      title={`${annotation.content.text} ${annotation.comment ? '- ' + annotation.comment : ''}`}
                                    />
                                  ))}
                                </g>
                              ))
                            }
                          </svg>
                        </div>
                      </div>
                    ))}
                  </Document>
                </div>
              </div>
            </div>
            
            {/* PDF Controls */}
            {numPages && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex items-center justify-center space-x-4">
                  <button
                    onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
                    disabled={pageNumber <= 1}
                    className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Page {pageNumber} of {numPages}
                  </span>
                  <button
                    onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))}
                    disabled={pageNumber >= numPages}
                    className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Selection Popup */}
            {showSelectionPopup && currentSelection && (
              <div 
                className="absolute z-10 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-300 dark:border-gray-600 p-4 animate-in fade-in duration-200"
                style={{
                  left: Math.min(popupPosition.x, (pdfContainerRef.current?.clientWidth || 800) - 320),
                  top: Math.max(10, popupPosition.y),
                  maxWidth: '320px',
                  minWidth: '280px'
                }}
              >
                <div className="mb-3">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Create Highlight</h4>
                    <button
                      onClick={handleSelectionClear}
                      className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600">
                    "{currentSelection.text.substring(0, 100)}{currentSelection.text.length > 100 ? '...' : ''}"
                  </p>
                </div>
                
                {/* Color Options */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Choose highlight color:
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {COLOR_OPTIONS.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => createAnnotationFromSelection(color.value, '')}
                        className="w-8 h-8 rounded-md border-2 border-gray-300 dark:border-gray-600 hover:border-gray-800 dark:hover:border-gray-200 hover:scale-110 transition-all duration-150 shadow-sm"
                        style={{ backgroundColor: color.value }}
                        title={`Highlight with ${color.name}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      const comment = prompt('Add a comment (optional):')
                      if (comment !== null) { // Allow empty string but not null (cancelled)
                        createAnnotationFromSelection('#FFFF00', comment)
                      }
                    }}
                    className="flex-1 px-3 py-2 text-xs text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 rounded-md transition-colors font-medium"
                  >
                    <MessageSquare className="h-3 w-3 inline mr-1" />
                    With Comment
                  </button>
                </div>
                
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                  Click a color for quick highlight, or add a comment
                </p>
              </div>
            )}
          </div>

          {/* Annotation Sidebar */}
          <AnnotationSidebar
            documentId={documentId}
            annotations={annotations}
            onAnnotationClick={(annotation) => {
              console.log('📍 Sidebar annotation clicked:', annotation.id)
              scrollToAnnotation(annotation.id)
            }}
            onAnnotationUpdate={updateAnnotation}
            onAnnotationDelete={deleteAnnotation}
            className="w-80"
            citationData={citationData}
            onCitationClick={(citationId) => {
              console.log('🔍 Sidebar citation clicked:', citationId)
              scrollToCitation(citationId)
            }}
            viewMode={viewMode}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            ✅ Custom PDF Annotation System - All Features Active & Ready
          </p>
        </div>
      </div>
    </div>
  )
}