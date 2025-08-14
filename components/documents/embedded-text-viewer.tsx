'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Search, FileText, ChevronUp, ChevronDown, Globe, Link } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export interface EmbeddedTextViewerProps {
  documentId: string
  documentTitle: string
  highlightText?: string
}

export function EmbeddedTextViewer({ 
  documentId, 
  documentTitle, 
  highlightText
}: EmbeddedTextViewerProps) {
  const [content, setContent] = useState<string>('')
  const [sourceType, setSourceType] = useState<string>('PDF')
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [searchText, setSearchText] = useState<string>(highlightText || '')
  const [debouncedSearchText, setDebouncedSearchText] = useState<string>(highlightText || '')
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0)
  const [totalMatches, setTotalMatches] = useState<number>(0)
  const [matchPositions, setMatchPositions] = useState<Array<{start: number, end: number, sectionIndex: number}>>([])
  const [processedSections, setProcessedSections] = useState<string[]>([])
  const contentRef = useRef<HTMLDivElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isLargeDocument = content.length > 100000 // 100KB threshold
  const isVeryLargeDocument = content.length > 500000 // 500KB threshold for viewport optimization

  // Memoize sections for large documents to avoid re-splitting
  const sections = useMemo(() => {
    if (!content) return []
    return content.split(/\n\s*\n/).filter(section => section.trim().length > 0)
  }, [content])

  // Pre-compute search matches for performance
  const searchMatches = useMemo(() => {
    if (!debouncedSearchText || debouncedSearchText.length < 2) return []
    
    const searchLower = debouncedSearchText.toLowerCase().trim()
    const searchRegex = new RegExp(searchLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const matches: Array<{start: number, end: number, sectionIndex: number, text: string}> = []
    
    sections.forEach((section, sectionIndex) => {
      const sectionLower = section.toLowerCase()
      let match
      while ((match = searchRegex.exec(sectionLower)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          sectionIndex,
          text: section.substring(match.index, match.index + match[0].length)
        })
        // Prevent infinite loop on zero-length matches
        if (match.index === searchRegex.lastIndex) {
          searchRegex.lastIndex++
        }
      }
    })
    
    return matches
  }, [debouncedSearchText, sections])

  // Update total matches and reset current index when search changes
  useEffect(() => {
    setTotalMatches(searchMatches.length)
    setCurrentMatchIndex(0)
  }, [searchMatches])

  // Debounce search text to improve performance
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    const debounceDelay = isVeryLargeDocument ? 800 : isLargeDocument ? 500 : 300 // Longer delay for very large documents
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchText(searchText)
    }, debounceDelay)
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchText, isLargeDocument])

  useEffect(() => {
    const fetchDocumentContent = async () => {
      try {
        console.log('Fetching text content for document:', documentId)
        const response = await fetch(`/api/documents/${documentId}/text`)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch document: ${response.statusText}`)
        }
        
        const data = await response.json()
        console.log('Text content loaded, length:', data.content.length, 'sourceType:', data.sourceType)
        setContent(data.content)
        setSourceType(data.sourceType || 'PDF')
        setSourceUrl(data.sourceUrl || null)
        setLoading(false)
        
        // If we have highlight text, scroll to it after content renders
        if (highlightText) {
          setTimeout(() => scrollToHighlight(highlightText), 500)
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
    setTimeout(() => {
      const element = document.getElementById(`search-match-${currentMatchIndex}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
  }

  // Global match index for tracking across all markdown elements
  const [globalMatchIndex, setGlobalMatchIndex] = useState({ current: 0 })

  const renderHighlightedText = useCallback((text: string, sectionIndex: number, globalMatchIndex: { current: number }) => {
    if (!debouncedSearchText || searchMatches.length === 0) {
      return text
    }

    // Find matches for this specific section
    const sectionMatches = searchMatches.filter(match => match.sectionIndex === sectionIndex)
    
    if (sectionMatches.length === 0) {
      return text
    }
    
    // Build the highlighted text efficiently
    const elements = []
    let lastIndex = 0
    
    sectionMatches.forEach((match, index) => {
      // Add text before the match
      if (lastIndex < match.start) {
        elements.push(
          <React.Fragment key={`text-before-${sectionIndex}-${index}`}>
            {text.substring(lastIndex, match.start)}
          </React.Fragment>
        )
      }
      
      const isCurrentMatch = globalMatchIndex.current === currentMatchIndex
      
      // Add highlighted match
      elements.push(
        <mark 
          key={`mark-${sectionIndex}-${globalMatchIndex.current}`}
          id={`search-match-${globalMatchIndex.current}`}
          className={`px-1 rounded font-medium transition-colors ${
            isCurrentMatch 
              ? 'bg-orange-400 dark:bg-orange-600 border-2 border-orange-600 dark:border-orange-400 text-gray-900 dark:text-gray-100' 
              : 'bg-yellow-200 dark:bg-yellow-900/60 text-gray-900 dark:text-yellow-100'
          }`}
        >
          {match.text}
        </mark>
      )
      
      globalMatchIndex.current++
      lastIndex = match.end
    })
    
    // Add remaining text
    if (lastIndex < text.length) {
      elements.push(
        <React.Fragment key={`text-after-${sectionIndex}`}>
          {text.substring(lastIndex)}
        </React.Fragment>
      )
    }
    
    return <>{elements}</>
  }, [debouncedSearchText, searchMatches, currentMatchIndex])

  const processMarkdownChildren = useCallback((children: React.ReactNode, sectionIndex: number = 0): React.ReactNode => {
    if (typeof children === 'string') {
      return renderHighlightedText(children, sectionIndex, globalMatchIndex)
    }
    
    if (React.isValidElement(children)) {
      const processedChildren = React.Children.map(children.props.children, (child, index) => (
        <React.Fragment key={index}>{processMarkdownChildren(child, sectionIndex)}</React.Fragment>
      ))
      return React.cloneElement(children, children.props, processedChildren)
    }
    
    if (Array.isArray(children)) {
      return children.map((child, index) => (
        <React.Fragment key={index}>{processMarkdownChildren(child, sectionIndex)}</React.Fragment>
      ))
    }
    
    return children
  }, [renderHighlightedText, globalMatchIndex])

  // Update total matches for markdown content using pre-computed matches
  useEffect(() => {
    if (sourceType === 'URL' || sourceType === 'PDF_URL') {
      // For markdown content, use the global match count from searchMatches
      const globalMatches = searchMatches.length
      if (globalMatches !== totalMatches) {
        setTotalMatches(globalMatches)
        setCurrentMatchIndex(0)
      }
    }
  }, [searchMatches, sourceType, totalMatches])

  const renderMarkdownContent = (text: string) => {
    // Reset global match index for each render
    globalMatchIndex.current = 0

    // For markdown content, use ReactMarkdown with search highlighting
    return (
      <div className="prose prose-lg max-w-none dark:prose-invert">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
          // Custom components for styling with search highlighting
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 mt-8 pb-3 border-b-2 border-indigo-200 dark:border-indigo-700">
              {processMarkdownChildren(children)}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 mt-6 pb-2 border-b border-gray-200 dark:border-gray-700">
              {processMarkdownChildren(children)}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 mt-5">
              {processMarkdownChildren(children)}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-gray-800 dark:text-gray-200 leading-7 mb-4">
              {processMarkdownChildren(children)}
            </p>
          ),
          li: ({ children }) => (
            <li className="text-gray-800 dark:text-gray-200">
              {processMarkdownChildren(children)}
            </li>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside text-gray-800 dark:text-gray-200 mb-4 space-y-1">
              {processMarkdownChildren(children)}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside text-gray-800 dark:text-gray-200 mb-4 space-y-1">
              {processMarkdownChildren(children)}
            </ol>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900 dark:text-gray-100">
              {processMarkdownChildren(children)}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-800 dark:text-gray-200">
              {processMarkdownChildren(children)}
            </em>
          ),
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline"
            >
              {processMarkdownChildren(children)}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-indigo-200 dark:border-indigo-700 pl-4 py-2 mb-4 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              {processMarkdownChildren(children)}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-1 py-0.5 rounded text-sm font-mono">
              {processMarkdownChildren(children)}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 p-4 rounded-lg mb-4 overflow-x-auto text-sm font-mono">
              {processMarkdownChildren(children)}
            </pre>
          ),
          td: ({ children }) => (
            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm">
              {processMarkdownChildren(children)}
            </td>
          ),
          th: ({ children }) => (
            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold bg-gray-100 dark:bg-gray-800">
              {processMarkdownChildren(children)}
            </th>
          ),
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
    )
  }

  const renderFormattedContent = (text: string) => {
    // Check if this is markdown content from a scraped URL
    if (sourceType === 'URL' || sourceType === 'PDF_URL') {
      return renderMarkdownContent(text)
    }

    // Original plain text formatting for PDFs
    // Reset match counter for each render
    globalMatchIndex.current = 0
    
    // For very large documents, implement basic viewport optimization
    if (isVeryLargeDocument && sections.length > 100) {
      // Only render sections that might be visible or contain search matches
      const visibleSections = sections.filter((section, sectionIndex) => {
        // Always render sections with search matches
        if (debouncedSearchText) {
          const sectionMatches = searchMatches.filter(match => match.sectionIndex === sectionIndex)
          if (sectionMatches.length > 0) return true
        }
        
        // For sections without matches, only render a subset for performance
        return sectionIndex < 50 || sectionIndex > sections.length - 20
      })
      
      return visibleSections.map((section, visibleIndex) => {
        const originalSectionIndex = sections.indexOf(section)
        return renderSection(section, originalSectionIndex)
      })
    }
    
    return sections.map((section, sectionIndex) => {
      return renderSection(section, sectionIndex)
    })
  }

  const renderSection = useCallback((section: string, sectionIndex: number) => {
    const trimmedSection = section.trim()
    
    // Header detection
    const isMainHeader = (
      trimmedSection.length < 150 && 
      (trimmedSection.match(/^[A-Z][A-Z\s\d\.\-\(\)]{5,}$/) || 
       trimmedSection.match(/^\d+\.\s*[A-Z][A-Z\s]+/) ||
       trimmedSection.match(/^[A-Z][A-Z\s]{10,}$/) ||
       trimmedSection.match(/^(SECTION|CHAPTER|PART|ARTICLE)\s+/i))
    )
    
    const isSubHeader = (
      !isMainHeader &&
      trimmedSection.length < 120 && 
      (trimmedSection.match(/^\d+\.\d+/) ||
       trimmedSection.match(/^[a-z]\)\s+[A-Z]/) ||
       trimmedSection.match(/^\([a-z]\)\s+[A-Z]/) ||
       trimmedSection.match(/^[A-Z][a-z]+:\s*$/) ||
       trimmedSection.match(/^[A-Z][a-z\s]+:(?!.*[a-z]{10})/))
    )
    
    if (isMainHeader) {
      return (
        <div key={sectionIndex} className="mb-8 mt-8">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 pb-3 border-b-2 border-indigo-200 dark:border-indigo-700 tracking-wide">
            {renderHighlightedText(trimmedSection, sectionIndex, globalMatchIndex)}
          </h1>
        </div>
      )
    } else if (isSubHeader) {
      return (
        <div key={sectionIndex} className="mb-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
            {renderHighlightedText(trimmedSection, sectionIndex, globalMatchIndex)}
          </h2>
        </div>
      )
    } else {
      return (
        <div key={sectionIndex} className="mb-5">
          <p className="text-gray-800 dark:text-gray-200 leading-8 text-justify text-base font-normal break-words overflow-wrap-anywhere">
            {renderHighlightedText(trimmedSection, sectionIndex, globalMatchIndex)}
          </p>
        </div>
      )
    }
  }, [renderHighlightedText, globalMatchIndex])

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-indigo-300 dark:border-indigo-700 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading document...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <FileText className="h-16 w-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Error Loading Document</h3>
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Document Source Info */}
      {(sourceType === 'URL' || sourceType === 'PDF_URL') && sourceUrl && (
        <div className="flex-shrink-0 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {sourceType === 'URL' ? (
                <Globe className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Link className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              )}
              <span className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">
                {sourceType === 'URL' ? 'Scraped from web page' : 'Downloaded PDF'}
              </span>
            </div>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline"
            >
              View Source
            </a>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={sourceType === 'URL' || sourceType === 'PDF_URL' ? "Search in scraped content..." : "Search in document..."}
              className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
          </div>
          
          {/* Navigation controls - for all content types */}
          {debouncedSearchText && totalMatches > 0 && (
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
          
          {debouncedSearchText && totalMatches === 0 && (
            <span className="text-sm text-gray-500 dark:text-gray-400 px-2">No matches</span>
          )}
          
          {searchText && searchText !== debouncedSearchText && (
            <span className="text-sm text-blue-500 dark:text-blue-400 px-2">Searching...</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
        <div className="p-8">
          <div className="w-full">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-10">
              <div 
                ref={contentRef}
                className="document-content prose prose-lg max-w-none overflow-x-auto"
              >
                {renderFormattedContent(content)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}