'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ChevronLeft, Maximize2, Minimize2, FileText, Eye, MessageSquare } from 'lucide-react'
import { EmbeddedTextViewer } from './embedded-text-viewer'
import { EmbeddedCitationViewer } from './embedded-citation-viewer'
import { AdobePdfViewer } from '../pdf/adobe-pdf-viewer'
import { SimplePDFViewer } from '../pdf/simple-pdf-viewer'
import type { CitationData } from './embedded-citation-viewer'

interface SlideOutDocumentViewerProps {
  isOpen: boolean
  documentId: string
  documentTitle: string
  viewerType: 'text' | 'citation' | 'pdf'
  citation?: CitationData
  highlightText?: string
  onClose: () => void
  width?: number // Percentage width (default 70)
  showBackButton?: boolean
  backButtonLabel?: string
  onBack?: () => void
  showViewerTypeToggle?: boolean
  onViewerTypeChange?: (viewerType: 'text' | 'pdf') => void
  documentSourceType?: string
  hasGeneratedPdf?: boolean
}

export function SlideOutDocumentViewer({
  isOpen,
  documentId,
  documentTitle,
  viewerType,
  citation,
  highlightText,
  onClose,
  width = 85,
  showBackButton = false,
  backButtonLabel = 'Back',
  onBack,
  showViewerTypeToggle = false,
  onViewerTypeChange,
  documentSourceType,
  hasGeneratedPdf
}: SlideOutDocumentViewerProps) {
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [pdfViewerType, setPdfViewerType] = useState<'simple' | 'adobe'>('adobe')

  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Handle open/close animations
  useEffect(() => {
    if (isOpen) {
      // Start animation
      setIsAnimating(true)
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        if (panelRef.current) {
          panelRef.current.style.transform = 'translateX(0)'
        }
      }, 10)
    } else {
      // Close animation
      if (panelRef.current) {
        panelRef.current.style.transform = 'translateX(100%)'
      }
      // Wait for animation to complete before hiding
      setTimeout(() => {
        setIsAnimating(false)
      }, 300)
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Don't render if not open and not animating
  if (!isOpen && !isAnimating) return null

  // Calculate panel width based on screen size
  const getPanelWidth = () => {
    if (isFullScreen) return '100%'
    if (isMobile) return '100%'
    if (window.innerWidth < 1024) return '80%' // Tablet
    return `${width}%`
  }

  // Render the appropriate viewer component
  const renderViewer = () => {
    switch (viewerType) {
      case 'citation':
        return (
          <EmbeddedCitationViewer
            documentId={documentId}
            documentTitle={documentTitle}
            citation={citation}
          />
        )
      
      case 'pdf':
        if (pdfViewerType === 'adobe') {
          return (
            <AdobePdfViewer
              documentId={documentId}
              documentTitle={documentTitle}
              width="100%"
              height="100%"
              className="h-full"
            />
          )
        } else {
          return (
            <SimplePDFViewer
              documentId={documentId}
              documentTitle={documentTitle}
              onClose={() => {}} // Don't close the main viewer
            />
          )
        }
      
      case 'text':
      default:
        return (
          <EmbeddedTextViewer
            documentId={documentId}
            documentTitle={documentTitle}
            highlightText={highlightText}
          />
        )
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black dark:bg-black transition-opacity duration-300 z-40 ${
          isOpen ? 'bg-opacity-50 dark:bg-opacity-60' : 'bg-opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Slide-out Panel */}
      <div
        ref={panelRef}
        className={`fixed inset-y-0 right-0 z-50 bg-white dark:bg-gray-900 shadow-2xl transition-transform duration-300 ease-out transform translate-x-full ${
          isMobile ? 'w-full' : ''
        }`}
        style={{
          width: !isMobile ? getPanelWidth() : undefined,
          willChange: 'transform'
        }}
      >
        {/* Custom Header for Slide-out */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 z-10">
          <div className="flex items-center space-x-3">
            {showBackButton && onBack && (
              <button
                onClick={onBack}
                className="flex items-center space-x-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{backButtonLabel}</span>
              </button>
            )}
            
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate" title={documentTitle}>
                {documentTitle}
              </h2>
              {citation && (
                <p className="text-xs text-indigo-600 dark:text-indigo-400">
                  Citation on page {citation.source.pageNumber}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Viewer Type Toggle */}
            {showViewerTypeToggle && onViewerTypeChange && (
              <>
                <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 p-1 bg-white dark:bg-gray-700">
                  <button
                    onClick={() => onViewerTypeChange('text')}
                    className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                      viewerType === 'text'
                        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                    title="View as text"
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Text
                  </button>
                  <button
                    onClick={() => onViewerTypeChange('pdf')}
                    className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                      viewerType === 'pdf'
                        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                    title="View as PDF"
                    disabled={!hasGeneratedPdf}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    PDF
                    {!hasGeneratedPdf && (
                      <span className="ml-1 text-xs opacity-50">(generating...)</span>
                    )}
                  </button>
                </div>
                
                {/* PDF Viewer Type Toggle - only show when viewing PDF */}
                {viewerType === 'pdf' && (
                  <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 p-1 bg-white dark:bg-gray-700">
                    <button
                      onClick={() => setPdfViewerType('simple')}
                      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                        pdfViewerType === 'simple'
                          ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                      title="Simple PDF viewer"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Simple
                    </button>
                    <button
                      onClick={() => setPdfViewerType('adobe')}
                      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                        pdfViewerType === 'adobe'
                          ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                      title="Adobe PDF viewer with annotations"
                    >
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Annotate
                    </button>
                  </div>
                )}
              </>
            )}
            
            {!isMobile && (
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={isFullScreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullScreen ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5" />
                )}
              </button>
            )}
            
            <button
              onClick={onClose}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Close (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Viewer Content */}
        <div className="h-full pt-16">
          {renderViewer()}
        </div>
      </div>
    </>
  )
}