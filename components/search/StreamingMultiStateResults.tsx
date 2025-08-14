'use client'

import { useState } from 'react'
import React from 'react'
import { FileText, MapPin, Loader2, CheckCircle2, Circle, ChevronDown, ChevronUp, MessageCircle, Plus } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { CitationData } from '@/components/documents/citation-text-viewer'
import { getStateDisplayName } from '@/lib/constants/states'

interface StateAnswer {
  state: string
  answer: string
  citations: CitationData[]
  sourceCount: number
  processingTime: number
  status?: 'queued' | 'processing' | 'streaming' | 'complete'
}

interface StreamingMultiStateResultsProps {
  query: string
  totalStates: string[]
  streamingStates: Set<string>
  currentStateAnswers: { [state: string]: StateAnswer }
  completedStates: StateAnswer[]
  summary?: string
  isStreamingSummary?: boolean
  onCitationClick: (citation: CitationData) => void
  // Follow-up props
  followUpQuestion?: string
  onFollowUpChange?: (value: string) => void
  onFollowUpSubmit?: (e: React.FormEvent) => void
  followUpLoading?: boolean
}

export function StreamingMultiStateResults({
  query,
  totalStates,
  streamingStates,
  currentStateAnswers,
  completedStates,
  summary,
  isStreamingSummary,
  onCitationClick,
  followUpQuestion,
  onFollowUpChange,
  onFollowUpSubmit,
  followUpLoading
}: StreamingMultiStateResultsProps) {
  // State for collapsible citations per state
  const [expandedCitations, setExpandedCitations] = useState<Set<string>>(new Set())

  // Calculate progress - use both completed states and current streaming answers
  const totalStatesCount = totalStates.length
  const currentStateKeys = Object.keys(currentStateAnswers)
  const actualCompletedCount = completedStates.length > 0 ? completedStates.length : currentStateKeys.length
  const streamingCount = streamingStates.size
  const progressPercentage = totalStatesCount > 0 ? (actualCompletedCount / totalStatesCount) * 100 : 0


  const toggleCitations = (state: string) => {
    setExpandedCitations(prev => {
      const newSet = new Set(prev)
      if (newSet.has(state)) {
        newSet.delete(state)
      } else {
        newSet.add(state)
      }
      return newSet
    })
  }

  // Generate different background colors for each state (deterministic by state name)
  const getStateColors = (state: string, isComplete: boolean, isStreaming: boolean) => {
    // Use subtle slate colors for all states to maintain consistency
    const baseColor = { 
      bg: 'bg-slate-50 dark:bg-slate-800/50', 
      border: 'border-slate-200 dark:border-slate-700', 
      accent: 'text-slate-700 dark:text-slate-300' 
    }
    
    if (isComplete) {
      return { ...baseColor, border: 'border-slate-300 dark:border-slate-600' }
    } else if (isStreaming) {
      return { ...baseColor, border: 'border-blue-300 dark:border-blue-700/50' }
    }
    
    return baseColor
  }

  // Citation linking functions
  const renderAnswerWithCitationLinks = (answer: string, citations: CitationData[]) => {
    if (!citations || citations.length === 0) {
      return answer
    }

    // Enhanced regex to handle all citation formats:
    // [1], [2(3)(a)], [Citation 1], [1, 2], [2(3)(a), 4], etc.
    const citationRegex = /\[(?:Citation\s+)?([^\]]+)\]/g
    const parts = []
    let lastIndex = 0
    let match

    while ((match = citationRegex.exec(answer)) !== null) {
      // Add text before the citation
      if (match.index > lastIndex) {
        parts.push(answer.substring(lastIndex, match.index))
      }
      
      // Parse citation content - handle both simple numbers and complex legal citations
      const citationContent = match[1].trim()
      const citationParts = citationContent.split(',').map(part => part.trim())
      
      // Create clickable links for each valid citation
      const citationLinks = []
      citationParts.forEach((citationText, index) => {
        // Extract the base citation number for matching (e.g., "2" from "2(3)(a)")
        const baseNumberMatch = citationText.match(/^(\d+)/)
        const baseNumber = baseNumberMatch ? parseInt(baseNumberMatch[1]) : null
        const citationIndex = baseNumber ? baseNumber - 1 : -1
        
        // Only create link if citation exists
        if (citationIndex >= 0 && citationIndex < citations.length) {
          if (index > 0) {
            citationLinks.push(<span key={`comma-${match.index}-${index}`}>, </span>)
          }
          
          citationLinks.push(
            <button
              key={`citation-${citationText}-${match.index}-${index}`}
              onClick={() => onCitationClick(citations[citationIndex])}
              className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium hover:underline cursor-pointer"
              title={`Jump to citation ${citationText}`}
            >
              {citationText}
            </button>
          )
        } else {
          // Still show the citation but not as a link
          if (index > 0) {
            citationLinks.push(<span key={`comma-${match.index}-${index}`}>, </span>)
          }
          citationLinks.push(<span key={`invalid-citation-${citationText}-${match.index}-${index}`}>{citationText}</span>)
        }
      })
      
      // Wrap all citation links in brackets
      if (citationLinks.length > 0) {
        parts.push(<span key={`bracket-${match.index}`}>[</span>)
        parts.push(...citationLinks)
        parts.push(<span key={`bracket-close-${match.index}`}>]</span>)
      } else {
        // If no valid citations found, keep original text
        parts.push(match[0])
      }
      
      lastIndex = match.index + match[0].length
    }
    
    // Add remaining text after the last citation
    if (lastIndex < answer.length) {
      parts.push(answer.substring(lastIndex))
    }
    
    return parts.length > 0 ? parts : answer
  }

  // Process children nodes recursively to handle fragmented citations
  const processChildrenForCitations = (children: React.ReactNode, citations: CitationData[]): React.ReactNode => {
    if (typeof children === 'string') {
      return renderAnswerWithCitationLinks(children, citations)
    }
    
    if (React.isValidElement(children)) {
      // If it's a React element, process its children recursively
      const processedChildren = React.Children.map(children.props.children, (child) => processChildrenForCitations(child, citations))
      return React.cloneElement(children, children.props, processedChildren)
    }
    
    if (Array.isArray(children)) {
      // For arrays, we need to be more careful about fragmented citations
      // First, check if this looks like fragmented text that might contain citations
      const hasOnlyStrings = children.every(child => typeof child === 'string')
      
      if (hasOnlyStrings) {
        // If all children are strings, combine them and process as one
        const combinedText = children.join('')
        return renderAnswerWithCitationLinks(combinedText, citations)
      } else {
        // If mixed content, process each child individually
        // DON'T wrap in spans for table elements to avoid HTML structure violations
        return children.map((child, index) => {
          if (typeof child === 'string') {
            return renderAnswerWithCitationLinks(child, citations)
          } else {
            return processChildrenForCitations(child, citations)
          }
        })
      }
    }
    
    return children
  }

  // Real-time Markdown renderer with citation processing
  const renderStreamingMarkdownWithCitations = (answer: string, citations: CitationData[]) => {
    return (
      <div className="markdown-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Style headings appropriately
            h1: ({ children }) => <h1 className="text-xl font-bold mb-4 mt-6 text-gray-900 dark:text-gray-100">{processChildrenForCitations(children, citations)}</h1>,
            h2: ({ children }) => <h2 className="text-lg font-bold mb-3 mt-5 text-gray-900 dark:text-gray-100">{processChildrenForCitations(children, citations)}</h2>,
            h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-4 text-gray-900 dark:text-gray-100">{processChildrenForCitations(children, citations)}</h3>,
            h4: ({ children }) => <h4 className="text-sm font-bold mb-2 mt-3 text-gray-900 dark:text-gray-100">{processChildrenForCitations(children, citations)}</h4>,
            // Style paragraphs with citation processing
            p: ({ children }) => <p className="mb-4 text-gray-800 dark:text-gray-200 leading-relaxed">{processChildrenForCitations(children, citations)}</p>,
            // Style lists with citation processing
            ul: ({ children }) => <ul className="list-disc ml-6 mb-4 text-gray-800 dark:text-gray-200">{processChildrenForCitations(children, citations)}</ul>,
            ol: ({ children }) => <ol className="list-decimal ml-6 mb-4 text-gray-800 dark:text-gray-200">{processChildrenForCitations(children, citations)}</ol>,
            li: ({ children }) => <li className="mb-1 text-gray-800 dark:text-gray-200">{processChildrenForCitations(children, citations)}</li>,
            // Style emphasis with citation processing
            strong: ({ children }) => <strong className="font-bold text-gray-900 dark:text-gray-100">{processChildrenForCitations(children, citations)}</strong>,
            em: ({ children }) => <em className="italic text-gray-800 dark:text-gray-200">{processChildrenForCitations(children, citations)}</em>,
            // Style code
            code: ({ children }) => <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono text-gray-900 dark:text-gray-100">{children}</code>,
            pre: ({ children }) => <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm font-mono overflow-x-auto mb-4 text-gray-900 dark:text-gray-100">{children}</pre>,
            // Style blockquotes with citation processing
            blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic mb-4 text-gray-800 dark:text-gray-200">{processChildrenForCitations(children, citations)}</blockquote>,
            // Style tables with citation processing
            table: ({ children }) => (
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">{processChildrenForCitations(children, citations)}</table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-gray-50 dark:bg-gray-800">{processChildrenForCitations(children, citations)}</thead>,
            tbody: ({ children }) => <tbody>{processChildrenForCitations(children, citations)}</tbody>,
            tr: ({ children }) => <tr className="border-b border-gray-200 dark:border-gray-700">{processChildrenForCitations(children, citations)}</tr>,
            th: ({ children }) => (
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                {processChildrenForCitations(children, citations)}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-800 dark:text-gray-200">
                {processChildrenForCitations(children, citations)}
              </td>
            ),
          }}
        >
          {answer}
        </ReactMarkdown>
      </div>
    )
  }

  // Legacy markdown renderer (kept for backwards compatibility)
  const renderMarkdownWithCitations = (answer: string, citations: CitationData[]) => {
    return renderStreamingMarkdownWithCitations(answer, citations)
  }

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950 rounded-lg p-6 border border-indigo-200 dark:border-indigo-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <MapPin className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Multi-State Analysis
            </h2>
            {streamingCount > 0 && (
              <div className="flex items-center space-x-2 text-sm text-indigo-600 dark:text-indigo-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </div>
            )}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {actualCompletedCount} of {totalStatesCount} states complete
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
          <div 
            className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* State Status Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {totalStates.map(state => {
            const isComplete = completedStates.some(cs => cs.state === state)
            const isStreaming = streamingStates.has(state)
            const hasStarted = isComplete || isStreaming || currentStateAnswers[state]
            
            return (
              <div 
                key={state}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-all ${
                  isComplete 
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600' 
                    : isStreaming 
                    ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50 animate-pulse'
                    : hasStarted
                    ? 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                ) : isStreaming ? (
                  <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
                ) : (
                  <Circle className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                )}
                <span className={`text-sm font-medium ${
                  isComplete ? 'text-slate-700 dark:text-slate-300' : isStreaming ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {getStateDisplayName(state)}
                </span>
                {(isComplete || currentStateAnswers[state]) && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({currentStateAnswers[state]?.sourceCount || completedStates.find(cs => cs.state === state)?.sourceCount || 0})
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* State Answers - Show for all states (queued, processing, streaming, complete) */}
      <div className="space-y-4">
        {totalStates.map((state, index) => {
          const stateAnswer = currentStateAnswers[state]
          const isComplete = completedStates.some(cs => cs.state === state)
          const isStreaming = streamingStates.has(state) && stateAnswer?.status !== 'queued'
          const isQueued = stateAnswer?.status === 'queued'
          const isProcessing = stateAnswer?.status === 'processing'

          const finalAnswer = isComplete 
            ? completedStates.find(cs => cs.state === state) 
            : stateAnswer

          // Show card for all states when multi-state search is active
          if (!finalAnswer) return null

          const colors = getStateColors(state, isComplete, isStreaming || isProcessing)
          const citationsExpanded = expandedCitations.has(state)

          return (
            <div 
              key={state}
              className={`${colors.bg} rounded-lg shadow border transition-all ${colors.border}`}
            >
              <div className={`px-6 py-4 border-b ${colors.border}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <h3 className={`text-lg font-semibold ${colors.accent}`}>
                      {getStateDisplayName(state)}
                    </h3>
                    {isQueued && (
                      <div className="flex items-center space-x-1">
                        <Circle className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Queued</span>
                      </div>
                    )}
                    {isProcessing && (
                      <div className="flex items-center space-x-1">
                        <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
                        <span className="text-xs text-blue-600 dark:text-blue-400">Processing</span>
                      </div>
                    )}
                    {isStreaming && (
                      <div className="flex items-center space-x-1">
                        <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
                        <span className="text-xs text-blue-600 dark:text-blue-400">Streaming</span>
                      </div>
                    )}
                    {isComplete && (
                      <div className="flex items-center space-x-1">
                        <CheckCircle2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        <span className="text-xs text-slate-600 dark:text-slate-400">Complete</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>{finalAnswer.sourceCount} sources</span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4">
                <div className="prose prose-sm max-w-none">
                  {finalAnswer.answer ? (
                    renderMarkdownWithCitations(finalAnswer.answer, finalAnswer.citations)
                  ) : isQueued ? (
                    <div className="flex items-center space-x-2">
                      <Circle className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">Preparing to search {getStateDisplayName(state)}...</p>
                    </div>
                  ) : isProcessing ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
                      <p className="text-blue-700 dark:text-blue-300 leading-relaxed">Searching {getStateDisplayName(state)} documents...</p>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 text-yellow-600 dark:text-yellow-400 animate-spin" />
                      <p className="text-yellow-700 dark:text-yellow-300 leading-relaxed">Generating answer for {getStateDisplayName(state)}...</p>
                    </div>
                  )}
                </div>

                {/* Citations - Collapsible */}
                {finalAnswer.citations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => toggleCitations(state)}
                      className="w-full flex items-center justify-between text-left hover:bg-white dark:hover:bg-gray-800 hover:bg-opacity-50 rounded p-2 transition-colors">
                    >
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Citations ({finalAnswer.citations.length})
                      </h4>
                      {citationsExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      )}
                    </button>
                    
                    {citationsExpanded && (
                      <div className="mt-3 space-y-2">
                        {finalAnswer.citations.map((citation, idx) => (
                          <button
                            key={`${state}-citation-${idx}`}
                            onClick={() => onCitationClick(citation)}
                            className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                          >
                            <div className="flex items-start space-x-3">
                              <span className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 rounded-full text-xs font-semibold">
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                                  {citation.title}
                                </p>
                                {citation.text && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                    {citation.text}
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>


      {/* Follow-up Questions - Show when we have completed states */}
      {completedStates.length > 0 && onFollowUpSubmit && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-4">
            <MessageCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ask a Follow-up Question</h3>
          </div>
          <form onSubmit={onFollowUpSubmit} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={followUpQuestion || ''}
                onChange={(e) => onFollowUpChange?.(e.target.value)}
                placeholder="Ask a follow-up question about these states..."
                className="block w-full pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                disabled={followUpLoading}
              />
              <button
                type="submit"
                disabled={followUpLoading || !followUpQuestion?.trim()}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:text-gray-400 dark:disabled:text-gray-500"
              >
                {followUpLoading ? (
                  <div className="h-4 w-4 border-2 border-indigo-300 dark:border-indigo-600 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}