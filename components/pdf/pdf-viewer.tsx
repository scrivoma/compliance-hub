'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X, Search, FileText } from 'lucide-react'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

// Dynamically import react-pdf components to avoid SSR issues
const Document = dynamic(
  () => import('react-pdf').then(mod => mod.Document),
  { ssr: false }
)
const Page = dynamic(
  () => import('react-pdf').then(mod => mod.Page),
  { ssr: false }
)

// Set up PDF.js worker on client side only
if (typeof window !== 'undefined') {
  import('react-pdf').then(({ pdfjs }) => {
    // Use local worker file with correct version
    pdfjs.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js'
    console.log('PDF.js worker configured with local file')
  }).catch((error) => {
    // Fallback if dynamic import fails
    console.error('React-PDF dynamic import failed:', error)
  })
}

export interface PDFViewerProps {
  documentId: string
  documentTitle: string
  filePath: string
  highlightText?: string
  chunkIndex?: number
  pageNumber?: number
  onClose: () => void
}

export function PDFViewer({ 
  documentId, 
  documentTitle, 
  filePath, 
  highlightText, 
  chunkIndex,
  pageNumber: initialPage,
  onClose 
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(initialPage || 1)
  const [scale, setScale] = useState<number>(1.2)
  const [searchText, setSearchText] = useState<string>(highlightText || '')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [currentSearchIndex, setCurrentSearchIndex] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
    setLoading(false)
    
    // If we have highlight text, set it up for searching across all pages
    if (highlightText) {
      // Extract first few words for better matching
      const searchTerms = highlightText.split(' ').slice(0, 5).join(' ')
      setSearchText(searchTerms)
      console.log('PDF loaded with', numPages, 'pages, will search for:', searchTerms)
      
      // Start searching from page 1
      searchAllPagesForText(searchTerms, numPages)
    }
  }
  
  // Function to search through all pages for the highlight text using PDF.js
  const searchAllPagesForText = async (searchTerms: string, totalPages: number) => {
    console.log('Searching all pages for:', searchTerms)
    const searchWords = searchTerms.toLowerCase().split(' ').filter(word => word.length > 2)
    
    try {
      // Import PDF.js for text extraction using react-pdf's version
      const { pdfjs } = await import('react-pdf')
      
      // Set worker source if not already set
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js'
      }
      
      const pdf = await pdfjs.getDocument(`/api/documents/${documentId}/pdf`).promise
      
      // Search through all pages
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum)
          const textContent = await page.getTextContent()
          
          // Combine all text items into a single string
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .toLowerCase()
          
          // Check if any search words are found on this page
          const hasMatch = searchWords.some(word => pageText.includes(word))
          
          if (hasMatch) {
            console.log('Found match on page', pageNum, '- navigating there')
            
            // Navigate to the page with the match
            setPageNumber(pageNum)
            
            // Wait a moment for the page to render, then highlight
            setTimeout(() => {
              highlightTextOnCurrentPage(searchWords)
            }, 1000)
            
            break // Stop searching once we find the first match
          }
        } catch (pageError) {
          console.error('Error searching page', pageNum, ':', pageError)
        }
      }
    } catch (error) {
      console.error('Error during PDF text search:', error)
      // Fallback to the old method if PDF.js text extraction fails
      fallbackPageSearch(searchWords, totalPages)
    }
  }
  
  // Fallback search method (the original approach)
  const fallbackPageSearch = (searchWords: string[], totalPages: number) => {
    console.log('Using fallback search method')
    
    for (let page = 1; page <= totalPages; page++) {
      setTimeout(() => {
        setPageNumber(page)
        
        setTimeout(() => {
          const textSpans = document.querySelectorAll('.react-pdf__Page__textContent span')
          let foundOnThisPage = false
          
          textSpans.forEach(span => {
            const text = (span.textContent || '').toLowerCase()
            const hasMatch = searchWords.some(word => text.includes(word))
            if (hasMatch) {
              foundOnThisPage = true
              console.log('Found match on page', page, ':', span.textContent)
            }
          })
          
          if (foundOnThisPage) {
            console.log('Text found on page', page, '- stopping search')
            highlightTextOnCurrentPage(searchWords)
            return
          }
        }, 500)
      }, 1000 * page)
    }
  }
  
  // Function to highlight text on the current page
  const highlightTextOnCurrentPage = (searchWords: string[]) => {
    setTimeout(() => {
      const textSpans = document.querySelectorAll('.react-pdf__Page__textContent span')
      console.log('Highlighting on page', pageNumber, 'found spans:', textSpans.length)
      
      // Get all text content to look for the full phrase
      const allPageText = Array.from(textSpans)
        .map(span => span.textContent || '')
        .join(' ')
        .toLowerCase()
      
      // Try to find the original highlight text in the page
      const originalText = (highlightText || '').toLowerCase()
      
      // Clean up the text to handle line breaks and extra spaces
      const cleanedOriginalText = originalText.replace(/\s+/g, ' ').trim()
      const cleanedPageText = allPageText.replace(/\s+/g, ' ')
      
      // Try to find exact match first, then try partial matches
      const exactMatch = cleanedPageText.includes(cleanedOriginalText)
      const firstWords = cleanedOriginalText.split(' ').slice(0, 5).join(' ')
      const partialMatch = cleanedPageText.includes(firstWords)
      
      console.log('Looking for phrase:', cleanedOriginalText)
      console.log('First few words:', firstWords)
      console.log('Exact match found:', exactMatch)
      console.log('Partial match found:', partialMatch)
      console.log('Page text preview:', cleanedPageText.substring(0, 500))
      
      let highlightCount = 0
      let foundMainPhrase = false
      
      // First pass: look for spans that contain parts of the original phrase
      if ((exactMatch || partialMatch) && originalText) {
        const phraseWords = cleanedOriginalText.split(' ').filter(word => word.length > 2)
        
        textSpans.forEach((span, index) => {
          const spanText = (span.textContent || '').toLowerCase().trim()
          const cleanedSpanText = spanText.replace(/\s+/g, ' ')
          
          // Check if this span contains a significant portion of the citation
          let matchScore = 0
          
          // Check for consecutive words from the citation
          for (let i = 0; i < phraseWords.length - 1; i++) {
            const wordPair = phraseWords[i] + ' ' + phraseWords[i + 1]
            if (cleanedSpanText.includes(wordPair)) {
              matchScore += 2
            }
          }
          
          // Also check for individual important words
          const importantWords = phraseWords.filter(word => word.length > 4)
          importantWords.forEach(word => {
            if (cleanedSpanText.includes(word)) {
              matchScore += 1
            }
          })
          
          // Consider it a match if we have a good score
          const isSignificantMatch = matchScore >= 3
          
          if (isSignificantMatch && !foundMainPhrase) {
            const element = span as HTMLElement
            element.style.backgroundColor = 'yellow'
            element.style.color = 'black' 
            element.style.opacity = '1'
            element.style.padding = '2px'
            element.style.borderRadius = '3px'
            element.style.boxShadow = '0 0 0 1px rgba(255, 193, 7, 0.5)'
            element.style.zIndex = '10'
            highlightCount++
            foundMainPhrase = true
            console.log('Highlighted main phrase span:', index, span.textContent)
            console.log('Match score:', matchScore)
            
            // Scroll to this element
            setTimeout(() => {
              element.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'center'
              })
            }, 200)
          }
        })
      }
      
      // Fallback: if no main phrase found, highlight the most relevant single words
      if (highlightCount === 0) {
        console.log('No main phrase found, using fallback highlighting')
        console.log('Original citation:', cleanedOriginalText)
        
        // Use words from the original citation text
        const citationWords = cleanedOriginalText.split(' ').filter(word => word.length > 4)
        console.log('Looking for citation words:', citationWords)
        
        textSpans.forEach((span, index) => {
          const spanText = (span.textContent || '').toLowerCase()
          const cleanedSpanText = spanText.replace(/\s+/g, ' ')
          
          // Count how many citation words appear in this span
          const matchingWords = citationWords.filter(word => cleanedSpanText.includes(word))
          const hasImportantMatch = matchingWords.length >= 2 || 
            (matchingWords.length >= 1 && matchingWords.some(word => word.length > 6))
          
          if (hasImportantMatch && highlightCount < 3) { // Limit to first 3 matches
            const element = span as HTMLElement
            element.style.backgroundColor = 'yellow'
            element.style.color = 'black' 
            element.style.opacity = '1'
            element.style.padding = '2px'
            element.style.borderRadius = '3px'
            element.style.boxShadow = '0 0 0 1px rgba(255, 193, 7, 0.5)'
            element.style.zIndex = '10'
            highlightCount++
            console.log('Highlighted fallback span:', index, span.textContent)
            console.log('Matching words found:', matchingWords)
            
            // Scroll to the first match
            if (highlightCount === 1) {
              setTimeout(() => {
                element.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'center',
                  inline: 'center'
                })
              }, 200)
            }
          }
        })
      }
      
      console.log('Applied', highlightCount, 'highlights on page', pageNumber)
    }, 800)
  }
  
  // Initialize PDF viewer
  useEffect(() => {
    console.log('PDF Viewer ready for document:', documentId)
    console.log('PDF URL:', `/api/documents/${documentId}/pdf`)
    
    // Test if URL is accessible
    fetch(`/api/documents/${documentId}/pdf`, { method: 'HEAD' })
      .then(response => {
        console.log('PDF available:', response.status, response.statusText)
        setLoading(false) // Ready to show buttons
      })
      .catch(error => {
        console.error('PDF not available:', error)
        setError('PDF not accessible')
        setLoading(false)
      })
  }, [documentId])

  function onDocumentLoadError(error: Error) {
    console.error('PDF load error:', error)
    console.error('PDF URL:', `/api/documents/${documentId}/pdf`)
    setError(`Failed to load PDF: ${error.message}`)
    setLoading(false)
  }

  const performSearch = async (text: string) => {
    if (!text.trim()) {
      setSearchResults([])
      return
    }
    
    try {
      // This is a simplified search - in a real implementation,
      // you'd want to use PDF.js text extraction for more accurate results
      setSearchText(text)
      // For now, we'll rely on the chunk information to navigate to the right page
      if (initialPage) {
        setPageNumber(initialPage)
      }
    } catch (error) {
      console.error('Search error:', error)
    }
  }

  const nextPage = () => {
    if (pageNumber < numPages) {
      setPageNumber(pageNumber + 1)
    }
  }

  const prevPage = () => {
    if (pageNumber > 1) {
      setPageNumber(pageNumber - 1)
    }
  }

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3.0))
  }

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.5))
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    performSearch(searchText)
  }

  // Add styles dynamically
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      .react-pdf__Page__textContent span.highlight-text {
        background-color: yellow !important;
        color: black !important;
        opacity: 1 !important;
        padding: 2px;
        border-radius: 3px;
      }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {documentTitle}
            </h2>
            {highlightText && (
              <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-1">
                Highlighting: "{highlightText}"
              </p>
            )}
          </div>
          
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2 mx-4">
            <div className="relative">
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search in document..."
                className="pl-8 pr-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            </div>
          </form>

          <button
            onClick={onClose}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center space-x-2">
            <button
              onClick={prevPage}
              disabled={pageNumber <= 1}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:text-gray-300 dark:disabled:text-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[120px] text-center">
              Page {pageNumber} of {numPages}
            </span>
            
            <button
              onClick={nextPage}
              disabled={pageNumber >= numPages}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:text-gray-300 dark:disabled:text-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={zoomOut}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            
            <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            
            <button
              onClick={zoomIn}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* PDF Content */}
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 p-4">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="h-8 w-8 border-4 border-indigo-300 dark:border-indigo-600 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading PDF...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-red-600 dark:text-red-400 mb-2">Error loading PDF</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{error}</p>
                <div className="mt-4 text-xs text-gray-400 dark:text-gray-500">
                  <p>Make sure the PDF file was uploaded correctly</p>
                  <p>Document ID: {documentId}</p>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && (
            <div className="flex justify-center w-full h-full">
              <div className="w-full h-full flex flex-col">
                {/* PDF Viewer using react-pdf */}
                <div className="flex-1 bg-gray-100 dark:bg-gray-900 overflow-auto">
                  {typeof window !== 'undefined' && (
                    <Document
                      file={`/api/documents/${documentId}/pdf`}
                      onLoadSuccess={onDocumentLoadSuccess}
                      onLoadError={onDocumentLoadError}
                      loading={
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <div className="h-8 w-8 border-4 border-indigo-300 dark:border-indigo-600 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-600 dark:text-gray-400">Loading PDF...</p>
                          </div>
                        </div>
                      }
                      error={
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center bg-white dark:bg-gray-800 rounded-lg p-8 shadow-lg max-w-md">
                            <FileText className="h-16 w-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">PDF Loading Failed</h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">Unable to display PDF in browser</p>
                            <button
                              onClick={() => window.open(`/api/documents/${documentId}/pdf`, '_blank')}
                              className="bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
                            >
                              Open in New Tab
                            </button>
                          </div>
                        </div>
                      }
                    >
                      <div className="flex justify-center p-4">
                        <Page
                          pageNumber={pageNumber}
                          scale={scale}
                          renderAnnotationLayer={false}
                          renderTextLayer={true}
                          className="shadow-lg"
                          customTextRenderer={({ str }) => {
                            // Highlight search text
                            if (searchText && str.toLowerCase().includes(searchText.toLowerCase())) {
                              return str
                            }
                            return str
                          }}
                          onGetTextSuccess={(textItems) => {
                            console.log('Page', pageNumber, 'text loaded')
                            // The highlighting is now handled by the page search function
                          }}
                        />
                      </div>
                    </Document>
                  )}
                </div>
                
                {/* Search overlay if highlight text is provided */}
                {highlightText && (
                  <div className="absolute top-4 left-4 bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-600 rounded-lg p-3 max-w-xs">
                    <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                      <strong>Highlighting:</strong> "{highlightText.substring(0, 100)}{highlightText.length > 100 ? '...' : ''}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Use the search box to find specific text. Click and drag to pan when zoomed in.
          </p>
        </div>
      </div>
    </div>
  )
}