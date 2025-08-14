'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Search, FileText, ChevronUp, ChevronDown } from 'lucide-react'

export interface TextViewerProps {
  documentId: string
  documentTitle: string
  highlightText?: string
  onClose: () => void
}

export function TextViewer({ 
  documentId, 
  documentTitle, 
  highlightText,
  onClose 
}: TextViewerProps) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [searchText, setSearchText] = useState<string>(highlightText || '')
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0)
  const [totalMatches, setTotalMatches] = useState<number>(0)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchDocumentContent = async () => {
      try {
        console.log('Fetching text content for document:', documentId)
        const response = await fetch(`/api/documents/${documentId}/text`)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch document: ${response.statusText}`)
        }
        
        const data = await response.json()
        console.log('Text content loaded, length:', data.content.length)
        setContent(data.content)
        setLoading(false)
        
        // If we have highlight text, scroll to it after content renders
        if (highlightText) {
          // Use multiple attempts with increasing delays
          setTimeout(() => scrollToHighlight(highlightText), 500)
          setTimeout(() => scrollToHighlight(highlightText), 1000)
          setTimeout(() => scrollToHighlight(highlightText), 1500)
        }
      } catch (error) {
        console.error('Error fetching document content:', error)
        setError(error instanceof Error ? error.message : 'Failed to load document')
        setLoading(false)
      }
    }

    fetchDocumentContent()
  }, [documentId, highlightText])

  const scrollToHighlight = (text: string) => {
    console.log('Attempting to scroll to highlight:', text)
    
    // Wait for the DOM to be fully rendered
    setTimeout(() => {
      // Find all mark elements
      const markElements = document.querySelectorAll('mark')
      console.log(`Found ${markElements.length} mark elements`)
      
      let targetElement = null
      
      // First, try to find exact match by data-highlight attribute
      const normalizedSearchText = text.toLowerCase().replace(/\s+/g, '').replace(/[^\w]/g, '')
      
      for (const mark of Array.from(markElements)) {
        const dataHighlight = mark.getAttribute('data-highlight')
        if (dataHighlight && dataHighlight.includes(normalizedSearchText.substring(0, 15))) {
          targetElement = mark
          console.log('Found element by data-highlight:', mark)
          break
        }
      }
      
      // If not found, try to find by text content
      if (!targetElement) {
        for (const mark of Array.from(markElements)) {
          const markText = mark.textContent?.toLowerCase().replace(/\s+/g, '').replace(/[^\w]/g, '') || ''
          if (markText.includes(normalizedSearchText.substring(0, 15)) || 
              normalizedSearchText.includes(markText.substring(0, 15))) {
            targetElement = mark
            console.log('Found element by text content:', mark)
            break
          }
        }
      }
      
      // If still not found, try partial word matching
      if (!targetElement && markElements.length > 0) {
        const searchWords = text.toLowerCase().split(/\s+/).filter(word => word.length > 3)
        
        for (const mark of Array.from(markElements)) {
          const markText = mark.textContent?.toLowerCase() || ''
          const matchedWords = searchWords.filter(word => markText.includes(word))
          
          if (matchedWords.length >= Math.min(2, searchWords.length)) {
            targetElement = mark
            console.log('Found element by word matching:', mark)
            break
          }
        }
      }
      
      if (targetElement) {
        console.log('Scrolling to element:', targetElement)
        console.log('Element text:', targetElement.textContent)
        
        // Scroll with more prominent highlighting
        targetElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest' 
        })
        
        // Add temporary highlight animation
        targetElement.style.transition = 'all 0.3s ease'
        targetElement.style.backgroundColor = '#fbbf24' // More prominent yellow
        targetElement.style.boxShadow = '0 0 0 3px rgba(251, 191, 36, 0.3)'
        
        // Reset after animation
        setTimeout(() => {
          if (targetElement) {
            targetElement.style.backgroundColor = '#fef3c7' // Original yellow
            targetElement.style.boxShadow = 'none'
          }
        }, 2000)
        
      } else {
        console.log('No highlighted element found, scrolling to top')
        const contentContainer = document.querySelector('.document-content')
        if (contentContainer) {
          contentContainer.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    }, 100) // Small delay to ensure DOM is ready
  }


  const renderFormattedContent = (text: string) => {
    // Reset match counter for each render
    const globalMatchIndex = { current: 0 }
    
    // Count total matches first
    const searchTerm = searchText || highlightText
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase().trim()
      if (searchLower.length > 0) {
        const matches = (text.toLowerCase().match(new RegExp(searchLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
        if (matches !== totalMatches) {
          setTotalMatches(matches)
          setCurrentMatchIndex(0)
        }
      }
    }
    
    // Split content into sections and paragraphs with better detection
    const sections = text.split(/\n\s*\n/).filter(section => section.trim().length > 0)
    
    return sections.map((section, index) => {
      const trimmedSection = section.trim()
      
      // Enhanced header detection
      const isMainHeader = (
        trimmedSection.length < 150 && 
        (trimmedSection.match(/^[A-Z][A-Z\s\d\.\-\(\)]{5,}$/) || // All caps headers
         trimmedSection.match(/^\d+\.\s*[A-Z][A-Z\s]+/) || // Numbered headers like "1. INTRODUCTION"
         trimmedSection.match(/^[A-Z][A-Z\s]{10,}$/) || // Long all caps
         trimmedSection.match(/^(SECTION|CHAPTER|PART|ARTICLE)\s+/i)) // Section keywords
      )
      
      // Sub-header detection
      const isSubHeader = (
        !isMainHeader &&
        trimmedSection.length < 120 && 
        (trimmedSection.match(/^\d+\.\d+/) || // 1.1, 2.3 etc
         trimmedSection.match(/^[a-z]\)\s+[A-Z]/) || // a) Something
         trimmedSection.match(/^\([a-z]\)\s+[A-Z]/) || // (a) Something
         trimmedSection.match(/^[A-Z][a-z]+:\s*$/) || // Title:
         trimmedSection.match(/^[A-Z][a-z\s]+:(?!.*[a-z]{10})/) // Shorter titles with colon
        )
      )
      
      // List detection (improved)
      const isList = (
        trimmedSection.includes('....') || 
        trimmedSection.match(/^\d+\s+[A-Z]/) ||
        trimmedSection.includes('................................') ||
        trimmedSection.split('\n').length > 3 && 
        trimmedSection.split('\n').some(line => line.match(/^\s*[•·\-]\s+/) || line.match(/^\s*\d+\.\s+/) || line.match(/^\s*[a-z]\)\s+/))
      )
      
      // Bullet point detection
      const isBulletList = (
        trimmedSection.split('\n').filter(line => 
          line.match(/^\s*[•·\-]\s+/) || 
          line.match(/^\s*\*\s+/) ||
          line.match(/^\s*\d+\.\s+/) ||
          line.match(/^\s*[a-z]\)\s+/)
        ).length >= 2
      )
      
      // Table detection
      const isTable = (
        trimmedSection.includes('|') && 
        trimmedSection.split('\n').filter(line => line.includes('|')).length >= 2
      )
      
      // Quote or definition detection
      const isQuote = (
        trimmedSection.startsWith('"') || 
        trimmedSection.match(/^Definition:/i) ||
        trimmedSection.match(/^Note:/i) ||
        trimmedSection.match(/^Important:/i)
      )
      
      if (isMainHeader) {
        return (
          <div key={index} className="mb-8 mt-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 pb-3 border-b-2 border-indigo-200 dark:border-indigo-700 tracking-wide">
              {renderHighlightedText(trimmedSection, globalMatchIndex)}
            </h1>
          </div>
        )
      } else if (isSubHeader) {
        return (
          <div key={index} className="mb-6 mt-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
              {renderHighlightedText(trimmedSection, globalMatchIndex)}
            </h2>
          </div>
        )
      } else if (isTable) {
        return (
          <div key={index} className="mb-6">
            <div className="overflow-x-auto bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <pre className="font-mono text-sm text-gray-700 dark:text-gray-300 whitespace-pre">
                {renderHighlightedText(trimmedSection, globalMatchIndex)}
              </pre>
            </div>
          </div>
        )
      } else if (isBulletList) {
        const listItems = trimmedSection.split('\n').map(line => line.trim()).filter(line => line.length > 0)
        return (
          <div key={index} className="mb-6">
            <div className="space-y-2">
              {listItems.map((item, itemIndex) => {
                const cleanItem = item.replace(/^[•·\-\*]\s*/, '').replace(/^\d+\.\s*/, '').replace(/^[a-z]\)\s*/, '')
                return (
                  <div key={itemIndex} className="flex items-start space-x-3">
                    <span className="text-indigo-500 dark:text-indigo-400 font-bold mt-1">•</span>
                    <p className="text-gray-800 dark:text-gray-200 leading-6 flex-1">
                      {renderHighlightedText(cleanItem, globalMatchIndex)}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )
      } else if (isList) {
        return (
          <div key={index} className="mb-6">
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border-l-4 border-blue-400 dark:border-blue-500">
              <pre className="font-mono text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {renderHighlightedText(trimmedSection, globalMatchIndex)}
              </pre>
            </div>
          </div>
        )
      } else if (isQuote) {
        return (
          <div key={index} className="mb-6">
            <blockquote className="bg-yellow-50 dark:bg-yellow-950 border-l-4 border-yellow-400 dark:border-yellow-500 p-4 rounded-r-lg">
              <p className="text-gray-800 dark:text-gray-200 leading-7 italic">
                {renderHighlightedText(trimmedSection, globalMatchIndex)}
              </p>
            </blockquote>
          </div>
        )
      } else {
        // Enhanced paragraph with better line height and spacing
        return (
          <div key={index} className="mb-5">
            <p className="text-gray-800 dark:text-gray-200 leading-8 text-justify text-base font-normal">
              {renderHighlightedText(trimmedSection, globalMatchIndex)}
            </p>
          </div>
        )
      }
    })
  }

  // Navigation functions
  const navigateToMatch = (direction: 'next' | 'prev') => {
    if (totalMatches === 0) return
    
    let newIndex
    if (direction === 'next') {
      newIndex = currentMatchIndex >= totalMatches - 1 ? 0 : currentMatchIndex + 1
    } else {
      newIndex = currentMatchIndex <= 0 ? totalMatches - 1 : currentMatchIndex - 1
    }
    
    setCurrentMatchIndex(newIndex)
    
    // Scroll to the match
    setTimeout(() => {
      const element = document.getElementById(`search-match-${newIndex}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      navigateToMatch('next')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      navigateToMatch('prev')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      navigateToMatch('next')
    }
  }

  const renderHighlightedText = (text: string, globalMatchIndex: { current: number }) => {
    // Use searchText for interactive search, highlightText for citation highlighting
    const searchTerm = searchText || highlightText
    if (!searchTerm) {
      return text
    }

    const textLower = text.toLowerCase()
    const searchLower = searchTerm.toLowerCase().trim()
    
    if (searchLower.length === 0) {
      return text
    }
    
    // Find all occurrences of the search term
    const matches = []
    let searchIndex = 0
    
    while (searchIndex < text.length) {
      const foundIndex = textLower.indexOf(searchLower, searchIndex)
      if (foundIndex === -1) break
      
      matches.push({
        start: foundIndex,
        end: foundIndex + searchLower.length
      })
      
      searchIndex = foundIndex + 1
    }
    
    if (matches.length === 0) {
      return text
    }
    
    // Build the highlighted text with all matches
    const elements = []
    let lastIndex = 0
    
    matches.forEach((match, index) => {
      // Add text before the match
      if (lastIndex < match.start) {
        elements.push(text.substring(lastIndex, match.start))
      }
      
      const isCurrentMatch = globalMatchIndex.current === currentMatchIndex
      
      // Add highlighted match
      elements.push(
        <mark 
          key={`${globalMatchIndex.current}-${index}`}
          id={`search-match-${globalMatchIndex.current}`}
          className={`px-1 rounded font-medium highlight-target ${
            isCurrentMatch 
              ? 'bg-orange-400 border-2 border-orange-600' 
              : 'bg-yellow-200'
          }`}
          data-highlight={searchTerm}
          data-search-text={searchTerm}
          data-match-index={globalMatchIndex.current}
        >
          {text.substring(match.start, match.end)}
        </mark>
      )
      
      globalMatchIndex.current++
      lastIndex = match.end
    })
    
    // Add remaining text
    if (lastIndex < text.length) {
      elements.push(text.substring(lastIndex))
    }
    
    return <>{elements}</>
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-5xl h-full max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-gray-700 dark:to-gray-600">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 truncate" title={documentTitle}>
              {documentTitle}
            </h2>
            {highlightText && (
              <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-1">
                Highlighting: "{highlightText.substring(0, 100)}{highlightText.length > 100 ? '...' : ''}"
              </p>
            )}
          </div>
          
          {/* Controls */}
          <div className="flex items-center space-x-2 mx-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search in document..."
                className="pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-64"
              />
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            </div>
            
            {/* Navigation controls */}
            {searchText && totalMatches > 0 && (
              <div className="flex items-center space-x-1">
                <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
                  {currentMatchIndex + 1} of {totalMatches}
                </span>
                <button
                  onClick={() => navigateToMatch('prev')}
                  className="p-1 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded"
                  title="Previous match (↑)"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigateToMatch('next')}
                  className="p-1 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded"
                  title="Next match (↓ or Enter)"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            )}
            
            {searchText && totalMatches === 0 && (
              <span className="text-sm text-gray-500 dark:text-gray-400 px-2">No matches</span>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="h-8 w-8 border-4 border-indigo-300 dark:border-indigo-600 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading document...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="h-16 w-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Error Loading Document</h3>
                <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && content && (
            <div className="p-8 relative">
              <div className="max-w-4xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-10">
                  <div 
                    ref={contentRef}
                    className="document-content prose prose-lg max-w-none"
                  >
                    <style jsx>{`
                      .document-content {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        line-height: 1.7;
                        color: #374151;
                      }
                    `}</style>
                    {renderFormattedContent(content)}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Use the search box to find specific text. Highlighted sections show relevant citations.
          </p>
        </div>
      </div>
    </div>
  )
}