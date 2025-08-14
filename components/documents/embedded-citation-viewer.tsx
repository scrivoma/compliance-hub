'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, FileText, MapPin } from 'lucide-react'

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

export interface EmbeddedCitationViewerProps {
  documentId: string
  documentTitle: string
  citation?: CitationData
}

export function EmbeddedCitationViewer({ 
  documentId, 
  documentTitle, 
  citation
}: EmbeddedCitationViewerProps) {
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
    
    setTimeout(() => {
      const citationElement = document.querySelector(`[data-citation-id="${citationData.id}"]`)
      console.log('🔍 Citation element search result:', {
        citationId: citationData.id,
        elementFound: !!citationElement,
        totalCitationElements: document.querySelectorAll('[data-citation-id]').length,
        allCitationIds: Array.from(document.querySelectorAll('[data-citation-id]')).map(el => el.getAttribute('data-citation-id'))
      })
      
      if (citationElement) {
        console.log('✅ SCROLL SUCCESS: Found citation element, scrolling:', {
          elementTag: citationElement.tagName,
          elementClass: citationElement.className,
          elementText: citationElement.textContent?.substring(0, 100) + '...'
        })
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
        console.log('❌ SCROLL FAILED: Citation element not found - Debug info:', {
          searchedForId: citationData.id,
          totalCitationElements: document.querySelectorAll('[data-citation-id]').length,
          allCitationIds: Array.from(document.querySelectorAll('[data-citation-id]')).map(el => el.getAttribute('data-citation-id')),
          documentTitle,
          timeAfterLoad: Date.now() - (window as any).pageLoadTime || 'unknown'
        })
      }
    }, 100)
  }

  const renderFormattedContent = (text: string) => {
    console.log('🎯 Phase 2: Citation-First Architecture Started')
    
    // PHASE 2: Process citations FIRST, before any section splitting or formatting
    let htmlContent = text
    
    if (citation && citation.source.startChar >= 0 && citation.source.endChar <= text.length) {
      let citationStartInFullText = citation.source.startChar
      let citationEndInFullText = citation.source.endChar
      
      console.log('📍 Phase 3: Starting citation text validation and correction')
      
      // Extract the citation text using the original positions
      let citationText = text.substring(citationStartInFullText, citationEndInFullText)
      
      console.log('📍 Phase 3: Original citation extraction:', {
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
        // Normalize both texts for comparison (remove extra whitespace, normalize line breaks)
        const normalizeText = (str: string) => str.replace(/\\s+/g, ' ').trim().toLowerCase()
        const extractedNormalized = normalizeText(citationText)
        const expectedNormalized = normalizeText(citation.text)
        
        // Check for exact match or if one contains the other (allowing for slight differences)
        isValidCitation = extractedNormalized === expectedNormalized ||
                         extractedNormalized.includes(expectedNormalized.substring(0, 50)) ||
                         expectedNormalized.includes(extractedNormalized.substring(0, 50))
        
        console.log('📍 Phase 3: Citation text validation:', {
          isValidCitation,
          extractedNormalized: extractedNormalized.substring(0, 100) + '...',
          expectedNormalized: expectedNormalized.substring(0, 100) + '...',
          exactMatch: extractedNormalized === expectedNormalized
        })
        
        // If validation fails, try to find the correct position using fuzzy search
        if (!isValidCitation && citation.text.length > 20) {
          console.log('⚠️ Phase 3: Citation position mismatch detected, attempting fuzzy search...')
          
          // Try to find the expected citation text in the document
          const searchText = citation.text.substring(0, Math.min(100, citation.text.length)).trim()
          const normalizedSearchText = normalizeText(searchText)
          const normalizedFullText = normalizeText(text)
          
          const fuzzyMatchIndex = normalizedFullText.indexOf(normalizedSearchText)
          
          if (fuzzyMatchIndex >= 0) {
            // Map the normalized position back to the original text
            // This is a simplified approach - we'll use the fuzzy match as a starting point
            const beforeNormalized = normalizedFullText.substring(0, fuzzyMatchIndex)
            const afterNormalized = normalizedFullText.substring(fuzzyMatchIndex + normalizedSearchText.length)
            
            // Estimate the position in the original text
            const estimatedStart = beforeNormalized.length * (text.length / normalizedFullText.length)
            const estimatedEnd = Math.min(text.length, estimatedStart + citation.text.length)
            
            // Fine-tune the position by searching around the estimated position
            const searchRadius = 500 // characters to search around the estimated position
            const searchStart = Math.max(0, Math.floor(estimatedStart) - searchRadius)
            const searchEnd = Math.min(text.length, Math.floor(estimatedEnd) + searchRadius)
            const searchRegion = text.substring(searchStart, searchEnd)
            
            // Look for the expected text in the search region
            const regionSearch = searchRegion.toLowerCase()
            const targetSearch = citation.text.substring(0, 50).toLowerCase().trim()
            const regionMatchIndex = regionSearch.indexOf(targetSearch)
            
            if (regionMatchIndex >= 0) {
              citationStartInFullText = searchStart + regionMatchIndex
              citationEndInFullText = Math.min(text.length, citationStartInFullText + citation.text.length)
              citationText = text.substring(citationStartInFullText, citationEndInFullText)
              
              console.log('✅ Phase 3: Fuzzy search successful - corrected citation position:', {
                originalStart: citation.source.startChar,
                originalEnd: citation.source.endChar,
                correctedStart: citationStartInFullText,
                correctedEnd: citationEndInFullText,
                correctedText: citationText.substring(0, 100) + '...'
              })
              
              isValidCitation = true
            } else {
              console.log('❌ Phase 3: Fuzzy search failed to find citation text')
            }
          } else {
            console.log('❌ Phase 3: Citation text not found in document')
          }
        }
      } else {
        // No expected text provided, assume original positions are correct
        isValidCitation = true
        console.log('📍 Phase 3: No expected citation text provided, using original positions')
      }
      
      if (isValidCitation) {
        // Extract citation parts with corrected positions
        const beforeCitation = text.substring(0, citationStartInFullText)
        const afterCitation = text.substring(citationEndInFullText)
        
        console.log('📍 Phase 3: Final citation extraction:', {
          beforeLength: beforeCitation.length,
          citationLength: citationText.length,
          afterLength: afterCitation.length,
          citationPreview: citationText.substring(0, 100) + (citationText.length > 100 ? '...' : '')
        })
        
        // Create HTML with embedded citation element
        const citationHtml = `<mark class="citation-highlight" data-citation-id="${citation.id}" title="Citation: ${citation.id}">${citationText}</mark>`
        htmlContent = beforeCitation + citationHtml + afterCitation
        
        console.log('✅ Phase 3: Citation HTML created and embedded into full text')
        console.log(`  Original text length: ${text.length}`)
        console.log(`  HTML content length: ${htmlContent.length}`)
        console.log(`  Citation HTML: ${citationHtml.substring(0, 150)}...`)
      } else {
        console.log('❌ Phase 3: Citation validation failed, no valid citation found')
      }
    } else {
      console.log('❌ Citation position validation failed or no citation provided')
    }
    
    // Split HTML content into sections, but ensure citation HTML tags don't get split
    let sections = htmlContent.split(/\n\s*\n/).filter(section => section.trim().length > 0)
    
    // Check if citation HTML is split across sections and fix it
    if (citation) {
      const citationStartTag = `<mark class="citation-highlight" data-citation-id="${citation.id}"`
      const citationEndTag = `</mark>`
      
      // Find sections that contain start or end tags
      let startSectionIndex = -1
      let endSectionIndex = -1
      
      sections.forEach((section, index) => {
        if (section.includes(citationStartTag)) startSectionIndex = index
        if (section.includes(citationEndTag)) endSectionIndex = index
      })
      
      console.log('📍 Phase 2: Citation HTML boundary check:', {
        startSectionIndex,
        endSectionIndex,
        citationSpansMultipleSections: startSectionIndex !== endSectionIndex && startSectionIndex >= 0 && endSectionIndex >= 0
      })
      
      // If citation spans multiple sections, combine them
      if (startSectionIndex >= 0 && endSectionIndex >= 0 && startSectionIndex !== endSectionIndex) {
        console.log('📍 Phase 2: Citation HTML spans multiple sections, combining...')
        
        const sectionsToMerge = sections.slice(startSectionIndex, endSectionIndex + 1)
        const mergedSection = sectionsToMerge.join('\n\n')
        
        sections = [
          ...sections.slice(0, startSectionIndex),
          mergedSection,
          ...sections.slice(endSectionIndex + 1)
        ]
        
        console.log('📍 Phase 2: Merged citation sections:', {
          originalSectionCount: htmlContent.split(/\n\s*\n/).filter(s => s.trim().length > 0).length,
          newSectionCount: sections.length,
          mergedSectionLength: mergedSection.length
        })
      }
    }
    
    console.log('📍 Phase 2: Section splitting completed:', {
      totalSections: sections.length,
      citationId: citation?.id || 'none',
      sectionsWithCitation: sections.filter(s => s.includes(`data-citation-id="${citation?.id}"`)).length
    })
    
    const result = sections.map((section, index) => {
      const trimmedSection = section.trim()
      
      // Add section index to global scope for debugging
      ;(window as any).currentSectionIndex = index
      
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 pb-4 border-b-2 border-indigo-300 dark:border-indigo-600 tracking-wide leading-tight">
              {renderHighlightedText(headerText)}
            </h1>
          </div>
        )
      } else if (isSubHeader) {
        const headerText = isMarkdownH2 ? isMarkdownH2[1] : (isMarkdownH3 ? isMarkdownH3[1] : trimmedSection)
        return (
          <div key={index} className="mb-6 mt-7">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 pb-2 border-b border-gray-300 dark:border-gray-600 tracking-wide">
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
            <p className="text-gray-800 dark:text-gray-200 leading-8 text-justify text-base font-normal break-words overflow-wrap-anywhere">
              {renderHighlightedText(trimmedSection)}
            </p>
          </div>
        )
      }
    })
    
    // Final summary and DOM verification
    if (citation) {
      console.log('📍 Phase 2: Final processing summary:', {
        citationId: citation.id,
        totalSectionsProcessed: sections.length,
        renderResultLength: result.length
      })
      
      // Check DOM after render
      setTimeout(() => {
        const citationElements = document.querySelectorAll(`[data-citation-id="${citation.id}"]`)
        console.log('📍 Phase 2: POST-RENDER DOM CHECK:', {
          citationId: citation.id,
          domElementsFound: citationElements.length,
          elementDetails: Array.from(citationElements).map(el => ({
            tagName: el.tagName,
            className: el.className,
            textContent: el.textContent?.substring(0, 50) + '...'
          }))
        })
        
        if (citationElements.length > 0) {
          console.log('🎉 SUCCESS: Citation elements found in DOM with Phase 2 architecture!')
        } else {
          console.log('❌ FAILURE: No citation elements found even with Phase 2 architecture')
        }
      }, 100)
    }
    
    return result
  }

  const renderHighlightedText = (text: string) => {
    // Phase 2: Parse HTML content that may contain citation elements
    // Check if text contains citation HTML elements
    const hasCitationHtml = citation && text.includes(`data-citation-id="${citation.id}"`)
    
    if (hasCitationHtml) {
      console.log('📍 Phase 2: Processing section with citation HTML:', {
        citationId: citation.id,
        textLength: text.length,
        textPreview: text.substring(0, 150) + '...'
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
    
    console.log('📍 Phase 2: parseHtmlWithCitations called:', {
      citationId: citation.id,
      htmlTextLength: htmlText.length,
      htmlPreview: htmlText.substring(0, 200) + '...',
      containsCitationMarkup: htmlText.includes(`data-citation-id="${citation.id}"`),
      fullHtmlText: htmlText  // Show the complete HTML text for debugging
    })
    
    // More flexible pattern to handle any attributes in any order and multiline content
    const escapedCitationId = citation.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const citationPattern = new RegExp(
      `<mark[^>]*data-citation-id="${escapedCitationId}"[^>]*>([\\s\\S]*?)</mark>`,
      'g'
    )
    
    console.log('📍 Phase 2: Using regex pattern:', {
      pattern: citationPattern.source,
      flags: citationPattern.flags,
      escapedCitationId
    })
    
    // Debug: Test the pattern manually and show exact HTML structure
    const testMatch = citationPattern.exec(htmlText)
    console.log('📍 Phase 2: Manual test of regex:', {
      testMatch: testMatch ? {
        fullMatch: testMatch[0],
        capturedGroup: testMatch[1],
        index: testMatch.index
      } : null,
      htmlTextContainsStartTag: htmlText.includes('<mark'),
      htmlTextContainsEndTag: htmlText.includes('</mark>'),
      markTagPositions: {
        startPos: htmlText.indexOf('<mark'),
        endPos: htmlText.indexOf('</mark>')
      }
    })
    
    // If we have mark tags but no match, let's examine the exact HTML structure
    if (htmlText.includes('<mark') && !testMatch) {
      const startPos = htmlText.indexOf('<mark')
      const hasEndTag = htmlText.includes('</mark>')
      const endPos = hasEndTag ? htmlText.indexOf('</mark>') + 7 : htmlText.length
      const extractedMarkTag = htmlText.substring(startPos, endPos)
      
      console.log('🔍 Phase 2: Failed match analysis:', {
        extractedMarkTag,
        markTagLength: extractedMarkTag.length,
        hasEndTag,
        citationIdInTag: extractedMarkTag.includes(`data-citation-id="${citation.id}"`),
        actualDataCitationId: extractedMarkTag.match(/data-citation-id="([^"]+)"/)?.[1] || 'not found',
        expectedCitationId: citation.id,
        regexPattern: citationPattern.source,
        htmlTextLength: htmlText.length,
        startPos,
        endPos
      })
    }
    
    // Reset regex for the actual loop
    citationPattern.lastIndex = 0
    
    const parts = []
    let lastIndex = 0
    let match
    let matchCount = 0
    
    // Reset regex lastIndex to ensure fresh search
    citationPattern.lastIndex = 0
    
    while ((match = citationPattern.exec(htmlText)) !== null) {
      matchCount++
      console.log(`📍 Phase 2: Found citation match ${matchCount}:`, {
        matchIndex: match.index,
        matchLength: match[0].length,
        capturedText: match[1].substring(0, 50) + '...',
        fullMatch: match[0].substring(0, 100) + '...'
      })
      
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
      
      console.log('📍 Phase 2: Created React citation element:', {
        citationId: citation.id,
        citationText: citationText.substring(0, 50) + '...',
        elementKey: `citation-${citation.id}-${match.index}`
      })
      
      lastIndex = citationPattern.lastIndex
    }
    
    console.log('📍 Phase 2: parseHtmlWithCitations results:', {
      totalMatches: matchCount,
      totalParts: parts.length,
      lastIndex,
      htmlTextLength: htmlText.length
    })
    
    // Add remaining text
    if (lastIndex < htmlText.length) {
      const remainingText = htmlText.substring(lastIndex)
      if (remainingText.trim()) {
        parts.push(remainingText)
      }
    }
    
    // If no matches found, try a more lenient approach including truncated HTML
    if (matchCount === 0 && htmlText.includes('<mark')) {
      console.log('⚠️ Phase 2: No regex matches, trying fallback parsing...')
      
      // Fallback: manually parse the HTML when regex fails (including truncated cases)
      const startPos = htmlText.indexOf('<mark')
      const hasEndTag = htmlText.includes('</mark>')
      
      if (startPos >= 0) {
        let beforeMark, markElement, afterMark, citationText
        
        if (hasEndTag) {
          // Complete HTML case
          const endPos = htmlText.indexOf('</mark>') + 7
          beforeMark = htmlText.substring(0, startPos)
          markElement = htmlText.substring(startPos, endPos)
          afterMark = htmlText.substring(endPos)
          
          // Extract content between tags
          const startContent = markElement.indexOf('>') + 1
          const endContent = markElement.lastIndexOf('</mark>')
          citationText = startContent > 0 && endContent > startContent 
            ? markElement.substring(startContent, endContent)
            : 'Citation text'
        } else {
          // Truncated HTML case - everything after the opening tag is citation content
          const openTagEnd = htmlText.indexOf('>', startPos) + 1
          
          if (openTagEnd > startPos) {
            beforeMark = htmlText.substring(0, startPos)
            citationText = htmlText.substring(openTagEnd)
            afterMark = ''
            
            console.log('📍 Phase 2: Handling truncated HTML citation:', {
              startPos,
              openTagEnd,
              truncatedCitationLength: citationText.length,
              citationPreview: citationText.substring(0, 100) + '...'
            })
          } else {
            console.log('❌ Phase 2: Could not parse truncated HTML')
            return htmlText
          }
        }
        
        console.log('📍 Phase 2: Fallback parsing successful:', {
          hasEndTag,
          beforeLength: beforeMark.length,
          citationTextLength: citationText.length,
          afterLength: afterMark.length,
          citationPreview: citationText.substring(0, 50) + '...'
        })
        
        const fallbackParts = []
        if (beforeMark.trim()) fallbackParts.push(beforeMark)
        
        fallbackParts.push(
          <mark
            key={`fallback-citation-${citation.id}`}
            className="bg-yellow-300 dark:bg-yellow-900/60 px-2 py-1 rounded font-medium border-2 border-yellow-400 dark:border-yellow-600 text-gray-900 dark:text-yellow-100"
            data-citation-id={citation.id}
            title={`Citation: ${citation.id}`}
          >
            {citationText}
          </mark>
        )
        
        if (afterMark.trim()) fallbackParts.push(afterMark)
        
        console.log('✅ Phase 2: Fallback parsing created React elements')
        return <>{fallbackParts}</>
      }
    }
    
    // If no matches found and no fallback possible, return original text
    if (matchCount === 0) {
      console.log('⚠️ Phase 2: No citation matches found, returning original text')
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
      <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-7">
        {beforeSearch}
        <mark className="bg-blue-300 dark:bg-blue-900/60 px-1 rounded text-gray-900 dark:text-blue-100">
          {searchMatch}
        </mark>
        {afterSearch}
      </div>
    )
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
      {/* Citation Info & Search Bar */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {citation && (
          <div className="text-sm text-indigo-600 dark:text-indigo-400 mb-3 flex items-center space-x-2">
            <MapPin className="h-4 w-4" />
            <span>
              Citation on page {citation.source.pageNumber} (chars {citation.source.startChar}-{citation.source.endChar})
            </span>
          </div>
        )}
        
        <div className="relative">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search in document..."
            className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
        <div className="p-8">
          <div className="w-full">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
              <div 
                ref={contentRef}
                className="document-content prose prose-lg max-w-none overflow-x-auto"
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
      </div>
    </div>
  )
}