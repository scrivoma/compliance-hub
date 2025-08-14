'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Search, FileText, MapPin } from 'lucide-react'

export interface CitationData {
  id: string
  text: string
  source: {
    documentId: string
    title: string
    pageNumber: number
    coordinates: {
      page: number
      x: number
      y: number
      width: number
      height: number
    }
    startChar: number
    endChar: number
  }
}


export interface CitationTextViewerProps {
  documentId: string
  documentTitle: string
  citation?: CitationData
  onClose: () => void
}

export function CitationTextViewer({ 
  documentId, 
  documentTitle, 
  citation,
  onClose 
}: CitationTextViewerProps) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [searchText, setSearchText] = useState<string>('')
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchDocumentContent = async () => {
      try {
        console.log('📄 Fetching content for document:', documentId)
        const response = await fetch(`/api/documents/${documentId}/text`)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch document: ${response.statusText}`)
        }
        
        const data = await response.json()
        setContent(data.content)
        setLoading(false)
      } catch (error) {
        console.error('❌ Error fetching document content:', error)
        setError(error instanceof Error ? error.message : 'Failed to load document')
        setLoading(false)
      }
    }

    fetchDocumentContent()
  }, [documentId])

  // Separate effect to handle citation scrolling when content is loaded
  useEffect(() => {
    if (content && citation && !loading) {
      setTimeout(() => scrollToCitation(citation), 500)
    }
  }, [content, citation, loading])

  const scrollToCitation = (citationData: CitationData) => {
    console.log('🎯 Scrolling to citation:', citationData.id)
    
    // Use the precise character positions from LlamaIndex
    const startChar = citationData.source.startChar
    const endChar = citationData.source.endChar
    
    console.log('📍 Citation details:')
    console.log('  - Start char:', startChar)
    console.log('  - End char:', endChar)
    console.log('  - Document content length:', content.length)
    
    if (startChar >= 0 && endChar > startChar && content.length > 0) {
      // Check if positions are valid
      if (endChar > content.length) {
        console.log('❌ Citation positions exceed document length')
        return
      }
      
      // Find the citation text in the document
      const citationText = content.substring(startChar, endChar)
      
      console.log('  - Citation text preview:', citationText.substring(0, 100))
      console.log('  - Citation text length:', citationText.length)
      
      // The text should be automatically highlighted by renderCitationContent
      // Now scroll to the highlighted element
      setTimeout(() => {
        const citationElement = document.querySelector(`[data-citation-id="${citationData.id}"]`)
        if (citationElement) {
          console.log('✅ Found citation element, scrolling')
          citationElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest' 
          })
          
          // Add temporary emphasis
          citationElement.classList.add('animate-pulse')
          setTimeout(() => {
            citationElement.classList.remove('animate-pulse')
          }, 2000)
        } else {
          console.log('❌ Citation element not found in DOM')
          console.log('Available citation elements:', document.querySelectorAll('[data-citation-id]').length)
        }
      }, 100)
    } else {
      console.log('❌ Invalid citation positions or empty content')
    }
  }

  const renderFormattedContent = (text: string) => {
    console.log('🎯 Phase 2: Citation-First Architecture Started (Citation Text Viewer)')
    
    // PHASE 2: Process citations FIRST, before any section splitting or formatting
    let htmlContent = text
    
    if (citation && citation.source.startChar >= 0 && citation.source.endChar <= text.length) {
      let citationStartInFullText = citation.source.startChar
      let citationEndInFullText = citation.source.endChar
      
      console.log('📍 Phase 3: Starting citation text validation and correction (Citation Text Viewer)')
      
      // Extract the citation text using the original positions
      let citationText = text.substring(citationStartInFullText, citationEndInFullText)
      
      console.log('📍 Phase 3: Original citation extraction (Citation Text Viewer):', {
        citationId: citation.id,
        originalStartChar: citationStartInFullText,
        originalEndChar: citationEndInFullText,
        extractedText: citationText.substring(0, 100) + (citationText.length > 100 ? '...' : ''),
        extractedLength: citationText.length,
        expectedText: citation.text ? citation.text.substring(0, 100) + '...' : 'not provided'
      })
      
      // Validate if the extracted text matches the expected citation text
      let isValidCitation = false
      if (citation.text) {
        // Normalize both texts for comparison
        const normalizeText = (str: string) => str.replace(/\\s+/g, ' ').trim().toLowerCase()
        const extractedNormalized = normalizeText(citationText)
        const expectedNormalized = normalizeText(citation.text)
        
        // Check for match
        isValidCitation = extractedNormalized === expectedNormalized ||
                         extractedNormalized.includes(expectedNormalized.substring(0, 50)) ||
                         expectedNormalized.includes(extractedNormalized.substring(0, 50))
        
        console.log('📍 Phase 3: Citation text validation (Citation Text Viewer):', {
          isValidCitation,
          extractedNormalized: extractedNormalized.substring(0, 100) + '...',
          expectedNormalized: expectedNormalized.substring(0, 100) + '...'
        })
        
        // If validation fails, try fuzzy search
        if (!isValidCitation && citation.text.length > 20) {
          console.log('⚠️ Phase 3: Citation position mismatch detected, attempting fuzzy search (Citation Text Viewer)...')
          
          const searchText = citation.text.substring(0, Math.min(100, citation.text.length)).trim()
          const normalizedSearchText = normalizeText(searchText)
          const normalizedFullText = normalizeText(text)
          
          const fuzzyMatchIndex = normalizedFullText.indexOf(normalizedSearchText)
          
          if (fuzzyMatchIndex >= 0) {
            const beforeNormalized = normalizedFullText.substring(0, fuzzyMatchIndex)
            const estimatedStart = beforeNormalized.length * (text.length / normalizedFullText.length)
            const estimatedEnd = Math.min(text.length, estimatedStart + citation.text.length)
            
            const searchRadius = 500
            const searchStart = Math.max(0, Math.floor(estimatedStart) - searchRadius)
            const searchEnd = Math.min(text.length, Math.floor(estimatedEnd) + searchRadius)
            const searchRegion = text.substring(searchStart, searchEnd)
            
            const regionSearch = searchRegion.toLowerCase()
            const targetSearch = citation.text.substring(0, 50).toLowerCase().trim()
            const regionMatchIndex = regionSearch.indexOf(targetSearch)
            
            if (regionMatchIndex >= 0) {
              citationStartInFullText = searchStart + regionMatchIndex
              citationEndInFullText = Math.min(text.length, citationStartInFullText + citation.text.length)
              citationText = text.substring(citationStartInFullText, citationEndInFullText)
              
              console.log('✅ Phase 3: Fuzzy search successful - corrected citation position (Citation Text Viewer):', {
                originalStart: citation.source.startChar,
                originalEnd: citation.source.endChar,
                correctedStart: citationStartInFullText,
                correctedEnd: citationEndInFullText,
                correctedText: citationText.substring(0, 100) + '...'
              })
              
              isValidCitation = true
            }
          }
        }
      } else {
        isValidCitation = true
        console.log('📍 Phase 3: No expected citation text provided, using original positions (Citation Text Viewer)')
      }
      
      if (isValidCitation) {
        // Extract citation parts with corrected positions
        const beforeCitation = text.substring(0, citationStartInFullText)
        const afterCitation = text.substring(citationEndInFullText)
        
        // Create HTML with embedded citation element
        const citationHtml = `<mark class="citation-highlight" data-citation-id="${citation.id}" title="Citation: ${citation.id}">${citationText}</mark>`
        htmlContent = beforeCitation + citationHtml + afterCitation
        
        console.log('✅ Phase 3: Citation HTML created and embedded into full text (Citation Text Viewer)')
      } else {
        console.log('❌ Phase 3: Citation validation failed, no valid citation found (Citation Text Viewer)')
      }
    }
    
    // Split the HTML content into sections for formatting
    const sections = htmlContent.split(/\n\s*\n/).filter(section => section.trim().length > 0)
    
    return sections.map((section, index) => {
      const trimmedSection = section.trim()
      
      // Markdown header detection (primary)
      const isMarkdownH1 = trimmedSection.match(/^#\s+(.+)$/)
      const isMarkdownH2 = trimmedSection.match(/^##\s+(.+)$/)
      const isMarkdownH3 = trimmedSection.match(/^###\s+(.+)$/)
      
      // Enhanced header detection with better patterns for legal documents
      const isMainHeader = (
        isMarkdownH1 ||
        (trimmedSection.length < 200 && 
        (trimmedSection.match(/^[A-Z][A-Z\s\d\.\-\(\)]{8,}$/) || // All caps headers (longer requirement)
         trimmedSection.match(/^\d+\.\s*[A-Z][A-Z\s]+/) || // Numbered headers like "1. INTRODUCTION"
         trimmedSection.match(/^[A-Z\s]{15,}$/) || // Long all caps (minimum 15 chars)
         trimmedSection.match(/^(SECTION|CHAPTER|PART|ARTICLE|RULE|BASIS|PURPOSE|POWERS|DUTIES)\s+/i) || // Section keywords
         trimmedSection.match(/^[A-Z\s]+AND\s+[A-Z\s]+/) || // "POWERS AND DUTIES" pattern
         trimmedSection.match(/^[A-Z\s]+(Effective|EFFECTIVE)\s+\d+/) // Headers with "Effective" dates
        ))
      )
      
      // Sub-header detection with better legal document patterns
      const isSubHeader = (
        isMarkdownH2 || isMarkdownH3 ||
        (!isMainHeader &&
        trimmedSection.length < 150 && 
        (trimmedSection.match(/^\d+\.\d+/) || // 1.1, 2.3 etc
         trimmedSection.match(/^\d+\.\d+\.\d+/) || // 1.1.1, 2.3.4 etc
         trimmedSection.match(/^[a-z]\)\s+[A-Z]/) || // a) Something
         trimmedSection.match(/^\([a-z]\)\s+[A-Z]/) || // (a) Something
         trimmedSection.match(/^[A-Z][a-z]+\s+action\.?$/) || // "Commission action."
         trimmedSection.match(/^[A-Z][a-z\s]+:(?!.*[a-z]{15})/) || // Titles with colon (shorter content)
         trimmedSection.match(/^\d+\.\d+\s+[A-Z][a-z]/) // "2.1 Commission action"
        ))
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
        const headerText = isMarkdownH1 ? isMarkdownH1[1] : trimmedSection
        return (
          <div key={index} className="mb-8 mt-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6 pb-4 border-b-2 border-indigo-300 dark:border-indigo-600 tracking-wide leading-tight">
              {renderHighlightedText(headerText)}
            </h1>
          </div>
        )
      } else if (isSubHeader) {
        const headerText = isMarkdownH2 ? isMarkdownH2[1] : (isMarkdownH3 ? isMarkdownH3[1] : trimmedSection)
        return (
          <div key={index} className="mb-6 mt-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4 pb-2 border-b border-gray-300 dark:border-gray-600 tracking-wide">
              {renderHighlightedText(headerText)}
            </h2>
          </div>
        )
      } else if (isTable) {
        return (
          <div key={index} className="mb-6">
            <div className="overflow-x-auto bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <pre className="font-mono text-sm text-gray-700 dark:text-gray-300 whitespace-pre">
                {renderHighlightedText(trimmedSection)}
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
                      {renderHighlightedText(cleanItem)}
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
                {renderHighlightedText(trimmedSection)}
              </pre>
            </div>
          </div>
        )
      } else if (isQuote) {
        return (
          <div key={index} className="mb-6">
            <blockquote className="bg-yellow-50 dark:bg-yellow-950 border-l-4 border-yellow-400 dark:border-yellow-500 p-4 rounded-r-lg">
              <p className="text-gray-800 dark:text-gray-200 leading-7 italic">
                {renderHighlightedText(trimmedSection)}
              </p>
            </blockquote>
          </div>
        )
      } else {
        // Enhanced paragraph with better line height and spacing
        return (
          <div key={index} className="mb-5">
            <p className="text-gray-800 dark:text-gray-200 leading-8 text-justify text-base font-normal">
              {renderHighlightedText(trimmedSection)}
            </p>
          </div>
        )
      }
    })
  }

  const renderHighlightedText = (text: string) => {
    // Phase 2: Parse HTML content that may contain citation elements
    const hasCitationHtml = citation && text.includes(`data-citation-id="${citation.id}"`)
    
    if (hasCitationHtml) {
      console.log('📍 Phase 2: Processing section with citation HTML (Citation Text Viewer):', {
        citationId: citation.id,
        textLength: text.length
      })
      
      // Parse the HTML and convert to React elements
      return parseHtmlWithCitations(text)
    }
    
    // Apply search highlighting for non-citation text
    if (searchText && searchText.trim().length > 0) {
      const searchLower = searchText.toLowerCase().trim()
      const textLower = text.toLowerCase()
      const searchIndex = textLower.indexOf(searchLower)
      
      if (searchIndex !== -1) {
        const beforeSearch = text.substring(0, searchIndex)
        const searchMatch = text.substring(searchIndex, searchIndex + searchText.length)
        const afterSearch = text.substring(searchIndex + searchText.length)
        
        return (
          <>
            {beforeSearch}
            <mark className="bg-blue-300 dark:bg-blue-900/60 px-1 rounded text-gray-900 dark:text-blue-100">
              {searchMatch}
            </mark>
            {afterSearch}
          </>
        )
      }
    }
    
    return text
  }
  
  // Helper function to parse HTML with citations and convert to React elements
  const parseHtmlWithCitations = (htmlText: string) => {
    if (!citation) return htmlText
    
    console.log('📍 Phase 2: parseHtmlWithCitations called (Citation Text Viewer):', {
      citationId: citation.id,
      htmlTextLength: htmlText.length,
      containsCitationMarkup: htmlText.includes(`data-citation-id="${citation.id}"`)
    })
    
    // More flexible pattern to handle any attributes in any order and multiline content
    const escapedCitationId = citation.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const citationPattern = new RegExp(
      `<mark[^>]*data-citation-id="${escapedCitationId}"[^>]*>([\\s\\S]*?)</mark>`,
      'g'
    )
    
    const parts = []
    let lastIndex = 0
    let match
    let matchCount = 0
    
    // Reset regex lastIndex to ensure fresh search
    citationPattern.lastIndex = 0
    
    while ((match = citationPattern.exec(htmlText)) !== null) {
      matchCount++
      
      // Add text before the citation
      if (lastIndex < match.index) {
        const beforeText = htmlText.substring(lastIndex, match.index)
        if (beforeText.trim()) {
          parts.push(beforeText)
        }
      }
      
      // Add the citation as a React element
      const citationText = match[1] // The captured group
      parts.push(
        <mark
          key={`citation-${citation.id}-${match.index}`}
          className="bg-yellow-300 dark:bg-yellow-900/60 px-2 py-1 rounded font-medium border-2 border-yellow-400 dark:border-yellow-600 text-gray-900 dark:text-yellow-100"
          data-citation-id={citation.id}
          title={`Citation: ${citation.id}`}
        >
          {citationText}
        </mark>
      )
      
      console.log('📍 Phase 2: Created React citation element (Citation Text Viewer):', {
        citationId: citation.id,
        citationText: citationText.substring(0, 50) + '...'
      })
      
      lastIndex = citationPattern.lastIndex
    }
    
    // Add remaining text
    if (lastIndex < htmlText.length) {
      const remainingText = htmlText.substring(lastIndex)
      if (remainingText.trim()) {
        parts.push(remainingText)
      }
    }
    
    // If no matches found, return original text
    if (matchCount === 0) {
      console.log('⚠️ Phase 2: No citation matches found (Citation Text Viewer), returning original text')
      return htmlText
    }
    
    return <>{parts}</>
  }

  const renderCitationContent = (text: string) => {
    return renderFormattedContent(text)
  }

  const renderSearchContent = (text: string) => {
    if (!searchText) {
      return renderCitationContent(text)
    }

    const searchLower = searchText.toLowerCase()
    const textLower = text.toLowerCase()
    const searchIndex = textLower.indexOf(searchLower)

    if (searchIndex === -1) {
      return renderCitationContent(text)
    }

    // Simple search highlighting
    const beforeSearch = text.substring(0, searchIndex)
    const searchMatch = text.substring(searchIndex, searchIndex + searchText.length)
    const afterSearch = text.substring(searchIndex + searchText.length)

    return (
      <div className="whitespace-pre-wrap text-gray-800 leading-7">
        {beforeSearch}
        <mark className="bg-blue-300 px-1 rounded">
          {searchMatch}
        </mark>
        {afterSearch}
      </div>
    )
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
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-full max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-xl font-semibold text-gray-900 truncate" title={documentTitle}>
              {documentTitle}
            </h2>
            {citation && (
              <div className="text-sm text-indigo-600 mt-1 flex items-center space-x-2">
                <MapPin className="h-4 w-4" />
                <span>
                  Citation on page {citation.source.pageNumber} (chars {citation.source.startChar}-{citation.source.endChar})
                </span>
              </div>
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
                placeholder="Search in document..."
                className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-64"
              />
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-50">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="h-8 w-8 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading document...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Document</h3>
                <p className="text-red-600 mb-4">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && content && (
            <div className="p-8 relative">
              <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
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
                      .citation-highlight {
                        background-color: #fef3c7;
                        padding: 0.5rem;
                        border-radius: 0.375rem;
                        font-weight: 500;
                        border: 2px solid #f59e0b;
                        color: #111827;
                      }
                      .dark .citation-highlight {
                        background-color: rgba(251, 191, 36, 0.2);
                        border-color: #d97706;
                        color: #fef3c7;
                      }
                    `}</style>
                    {searchText ? renderSearchContent(content) : renderCitationContent(content)}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 text-center">
          <p className="text-xs text-gray-500">
            {citation 
              ? `📍 Showing citation with precise text highlighting`
              : `📄 Document viewer with search support`
            }
          </p>
        </div>
      </div>
    </div>
  )
}