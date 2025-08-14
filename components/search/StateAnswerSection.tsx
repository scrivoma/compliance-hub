'use client'

import { useState } from 'react'
import React from 'react'
import { ChevronDown, ChevronUp, MapPin, Clock, FileText, ExternalLink } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { CitationData } from '@/components/documents/citation-text-viewer'

interface StateAnswer {
  state: string
  answer: string
  citations: CitationData[]
  sourceCount: number
  processingTime: number
}

interface StateAnswerSectionProps {
  stateAnswer: StateAnswer
  isExpanded: boolean
  onToggle: () => void
  onCitationClick: (citation: CitationData) => void
}

// State name mappings for better display
const STATE_NAMES: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
}

export function StateAnswerSection({
  stateAnswer,
  isExpanded,
  onToggle,
  onCitationClick
}: StateAnswerSectionProps) {
  const [showCitations, setShowCitations] = useState(false)
  
  const stateName = STATE_NAMES[stateAnswer.state] || stateAnswer.state
  
  // Process citations in the answer text
  const processAnswerWithCitations = (text: string) => {
    // Enhanced regex to handle all citation formats:
    // [1], [2(a)], [2(3)(a)], [Citation 1], [1, 2], [2(a), 4(b)], etc.
    const citationRegex = /\[(?:Citation\s+)?([^\]]+)\]/g
    const parts = []
    let lastIndex = 0
    let match
    
    while ((match = citationRegex.exec(text)) !== null) {
      // Add text before the citation
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index))
      }
      
      // Parse citation content - handle both simple numbers and complex legal citations
      const citationContent = match[1].trim()
      const citationParts = citationContent.split(',').map(part => part.trim())
      
      // Create clickable links for each valid citation
      const citationLinks = []
      citationParts.forEach((citationText, index) => {
        // Extract the base citation number for matching (e.g., "2" from "2(a)")
        const baseNumberMatch = citationText.match(/^(\d+)/)
        const baseNumber = baseNumberMatch ? parseInt(baseNumberMatch[1]) : null
        const citationIndex = baseNumber ? baseNumber - 1 : -1
        
        // Only create link if citation exists
        if (citationIndex >= 0 && citationIndex < stateAnswer.citations.length) {
          if (index > 0) {
            citationLinks.push(<span key={`${stateAnswer.state}-comma-${match.index}-${index}`}>, </span>)
          }
          
          const citation = stateAnswer.citations[citationIndex]
          citationLinks.push(
            <button
              key={`${stateAnswer.state}-citation-${citationText}-${match.index}-${index}`}
              onClick={() => onCitationClick(citation)}
              className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium hover:underline cursor-pointer"
              title={`View citation from ${citation.source.title}`}
            >
              {citationText}
            </button>
          )
        } else {
          // Still show the citation but not as a link
          if (index > 0) {
            citationLinks.push(<span key={`${stateAnswer.state}-comma-${match.index}-${index}`}>, </span>)
          }
          citationLinks.push(<span key={`${stateAnswer.state}-invalid-citation-${citationText}-${match.index}-${index}`}>{citationText}</span>)
        }
      })
      
      // Wrap all citation links in brackets
      if (citationLinks.length > 0) {
        parts.push(<span key={`${stateAnswer.state}-bracket-${match.index}`}>[</span>)
        parts.push(...citationLinks)
        parts.push(<span key={`${stateAnswer.state}-bracket-close-${match.index}`}>]</span>)
      } else {
        // If no valid citations found, keep original text
        parts.push(match[0])
      }
      
      lastIndex = match.index + match[0].length
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }
    
    return parts
  }

  // Process children nodes recursively to handle fragmented citations
  const processChildrenForCitations = (children: React.ReactNode): React.ReactNode => {
    if (typeof children === 'string') {
      return processAnswerWithCitations(children)
    }
    
    if (React.isValidElement(children)) {
      // If it's a React element, process its children recursively
      const processedChildren = React.Children.map(children.props.children, processChildrenForCitations)
      return React.cloneElement(children, children.props, processedChildren)
    }
    
    if (Array.isArray(children)) {
      // For arrays, we need to be more careful about fragmented citations
      // First, check if this looks like fragmented text that might contain citations
      const hasOnlyStrings = children.every(child => typeof child === 'string')
      
      if (hasOnlyStrings) {
        // If all children are strings, combine them and process as one
        const combinedText = children.join('')
        return processAnswerWithCitations(combinedText)
      } else {
        // If mixed content, process each child individually
        // This preserves React elements while still processing text
        return children.map((child, index) => {
          if (typeof child === 'string') {
            return processAnswerWithCitations(child)
          } else {
            return processChildrenForCitations(child)
          }
        })
      }
    }
    
    return children
  }

  // Use consistent subtle styling for all states
  const stateClasses = 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'

  return (
    <div className={`border rounded-lg ${stateClasses}`}>
      {/* State Header */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-700 hover:bg-opacity-50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <MapPin className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          <div>
            <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
              {stateName}
            </h3>
            <div className="flex items-center space-x-4 text-sm text-slate-600 dark:text-slate-400">
              <span>{stateAnswer.sourceCount} sources</span>
              <span className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>{(stateAnswer.processingTime / 1000).toFixed(1)}s</span>
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {stateAnswer.citations.length} citations
          </span>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          )}
        </div>
      </button>

      {/* State Content */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t border-slate-200 dark:border-slate-700">
          {/* Answer Content */}
          <div className="prose prose-sm max-w-none mt-4">
            <div className="markdown-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Style headings appropriately
                  h1: ({ children }) => <h1 className="text-xl font-bold mb-3 mt-4 text-slate-900 dark:text-slate-100">{processChildrenForCitations(children)}</h1>,
                  h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3 text-slate-900 dark:text-slate-100">{processChildrenForCitations(children)}</h2>,
                  h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-3 text-slate-900 dark:text-slate-100">{processChildrenForCitations(children)}</h3>,
                  h4: ({ children }) => <h4 className="text-sm font-bold mb-1 mt-2 text-slate-900 dark:text-slate-100">{processChildrenForCitations(children)}</h4>,
                  // Style paragraphs
                  p: ({ children }) => <p className="mb-3 text-slate-800 dark:text-slate-200 leading-relaxed">{processChildrenForCitations(children)}</p>,
                  // Style lists
                  ul: ({ children }) => <ul className="list-disc ml-4 mb-3 text-slate-800 dark:text-slate-200">{processChildrenForCitations(children)}</ul>,
                  ol: ({ children }) => <ol className="list-decimal ml-4 mb-3 text-slate-800 dark:text-slate-200">{processChildrenForCitations(children)}</ol>,
                  li: ({ children }) => <li className="mb-1 text-slate-800 dark:text-slate-200">{processChildrenForCitations(children)}</li>,
                  // Style emphasis
                  strong: ({ children }) => <strong className="font-bold text-slate-900 dark:text-slate-100">{processChildrenForCitations(children)}</strong>,
                  em: ({ children }) => <em className="italic text-slate-800 dark:text-slate-200">{processChildrenForCitations(children)}</em>,
                  // Style code
                  code: ({ children }) => <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs font-mono text-slate-900 dark:text-slate-100">{children}</code>,
                  pre: ({ children }) => <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs font-mono overflow-x-auto mb-3 text-slate-900 dark:text-slate-100">{children}</pre>,
                  // Style blockquotes
                  blockquote: ({ children }) => <blockquote className="border-l-3 border-gray-300 dark:border-gray-600 pl-3 italic mb-3 text-slate-800 dark:text-slate-200">{processChildrenForCitations(children)}</blockquote>,
                }}
              >
                {stateAnswer.answer}
              </ReactMarkdown>
            </div>
          </div>

          {/* Citations Toggle */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setShowCitations(!showCitations)}
              className="flex items-center space-x-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:underline"
            >
              <FileText className="h-4 w-4" />
              <span>
                {showCitations ? 'Hide' : 'Show'} Citations ({stateAnswer.citations.length})
              </span>
              {showCitations ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {/* Citations List */}
            {showCitations && (
              <div className="mt-4 space-y-3">
                {stateAnswer.citations.map((citation, index) => (
                  <div
                    key={citation.id}
                    className="bg-white dark:bg-slate-700 bg-opacity-50 border border-slate-200 dark:border-slate-600 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white dark:bg-slate-600 bg-opacity-70 text-slate-900 dark:text-slate-100">
                            [{index + 1}]
                          </span>
                          <span className="font-medium text-sm text-slate-900 dark:text-slate-100">
                            {citation.source.title}
                          </span>
                          {citation.source.pageNumber && (
                            <span className="text-xs text-slate-600 dark:text-slate-400">
                              Page {citation.source.pageNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                          {citation.text.substring(0, 200)}
                          {citation.text.length > 200 && '...'}
                        </p>
                      </div>
                      <button
                        onClick={() => onCitationClick(citation)}
                        className="ml-3 p-1 hover:bg-white dark:hover:bg-slate-600 hover:bg-opacity-50 rounded transition-colors"
                        title="View full citation"
                      >
                        <ExternalLink className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}