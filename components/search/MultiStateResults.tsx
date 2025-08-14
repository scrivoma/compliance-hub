'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, FileText, Clock, MapPin } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { StateAnswerSection } from './StateAnswerSection'
import type { CitationData } from '@/components/documents/citation-text-viewer'

interface StateAnswer {
  state: string
  answer: string
  citations: CitationData[]
  sourceCount: number
  processingTime: number
}

interface MultiStateResultsProps {
  query: string
  stateAnswers: StateAnswer[]
  summary?: string
  totalProcessingTime: number
  onCitationClick: (citation: CitationData) => void
}

export function MultiStateResults({
  query,
  stateAnswers,
  summary,
  totalProcessingTime,
  onCitationClick
}: MultiStateResultsProps) {
  const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set())
  const [showSummary, setShowSummary] = useState(false)

  // Initially expand all states
  useEffect(() => {
    setExpandedStates(new Set(stateAnswers.map(sa => sa.state)))
  }, [stateAnswers])

  const toggleState = (state: string) => {
    setExpandedStates(prev => {
      const newSet = new Set(prev)
      if (newSet.has(state)) {
        newSet.delete(state)
      } else {
        newSet.add(state)
      }
      return newSet
    })
  }

  const expandAll = () => {
    setExpandedStates(new Set(stateAnswers.map(sa => sa.state)))
  }

  const collapseAll = () => {
    setExpandedStates(new Set())
  }

  const totalSources = stateAnswers.reduce((sum, sa) => sum + sa.sourceCount, 0)

  return (
    <div className="space-y-6">
      {/* Multi-State Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950 rounded-lg p-6 border border-indigo-200 dark:border-indigo-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Multi-State Analysis
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={expandAll}
              className="px-3 py-1 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Collapse All
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-indigo-500 dark:bg-indigo-400 rounded-full"></div>
            <span className="text-gray-700 dark:text-gray-300">
              <strong>{stateAnswers.length}</strong> states analyzed
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-slate-500 dark:bg-slate-400 rounded-full"></div>
            <span className="text-gray-700 dark:text-gray-300">
              <strong>{totalSources}</strong> sources reviewed
            </span>
          </div>
        </div>

        {/* State Pills */}
        <div className="mt-4 flex flex-wrap gap-2">
          {stateAnswers.map(stateAnswer => (
            <button
              key={stateAnswer.state}
              onClick={() => toggleState(stateAnswer.state)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                expandedStates.has(stateAnswer.state)
                  ? 'bg-indigo-600 dark:bg-indigo-700 text-white'
                  : 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-600'
              }`}
            >
              {stateAnswer.state}
              <span className="ml-1 text-xs opacity-75">
                ({stateAnswer.sourceCount})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* State-Specific Results */}
      <div className="space-y-4">
        {stateAnswers.map(stateAnswer => (
          <StateAnswerSection
            key={stateAnswer.state}
            stateAnswer={stateAnswer}
            isExpanded={expandedStates.has(stateAnswer.state)}
            onToggle={() => toggleState(stateAnswer.state)}
            onCitationClick={onCitationClick}
          />
        ))}
      </div>

      {/* Summary Section */}
      {summary && (
        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <button
            onClick={() => setShowSummary(!showSummary)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <FileText className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Comparative Summary
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Analysis of differences and similarities across selected states
                </p>
              </div>
            </div>
            {showSummary ? (
              <ChevronUp className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            )}
          </button>
          
          {showSummary && (
            <div className="px-6 pb-6">
              <div className="prose prose-sm max-w-none">
                <div className="markdown-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Style headings appropriately
                      h1: ({ children }) => <h1 className="text-xl font-bold mb-4 mt-6 text-gray-900 dark:text-gray-100">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-bold mb-3 mt-5 text-gray-900 dark:text-gray-100">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-4 text-gray-900 dark:text-gray-100">{children}</h3>,
                      h4: ({ children }) => <h4 className="text-sm font-bold mb-2 mt-3 text-gray-900 dark:text-gray-100">{children}</h4>,
                      // Style paragraphs
                      p: ({ children }) => <p className="mb-4 text-gray-800 dark:text-gray-200 leading-relaxed">{children}</p>,
                      // Style lists
                      ul: ({ children }) => <ul className="list-disc ml-6 mb-4 text-gray-800 dark:text-gray-200">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal ml-6 mb-4 text-gray-800 dark:text-gray-200">{children}</ol>,
                      li: ({ children }) => <li className="mb-1 text-gray-800 dark:text-gray-200">{children}</li>,
                      // Style emphasis
                      strong: ({ children }) => <strong className="font-bold text-gray-900 dark:text-gray-100">{children}</strong>,
                      em: ({ children }) => <em className="italic text-gray-800 dark:text-gray-200">{children}</em>,
                      // Style code
                      code: ({ children }) => <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono text-gray-900 dark:text-gray-100">{children}</code>,
                      pre: ({ children }) => <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm font-mono overflow-x-auto mb-4 text-gray-900 dark:text-gray-100">{children}</pre>,
                      // Style blockquotes
                      blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic mb-4 text-gray-800 dark:text-gray-200">{children}</blockquote>,
                      // Style tables
                      table: ({ children }) => (
                        <div className="overflow-x-auto mb-4">
                          <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>,
                      tbody: ({ children }) => <tbody>{children}</tbody>,
                      tr: ({ children }) => <tr className="border-b border-gray-200 dark:border-gray-700">{children}</tr>,
                      th: ({ children }) => (
                        <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-800 dark:text-gray-200">
                          {children}
                        </td>
                      ),
                    }}
                  >
                    {summary}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
          This analysis is based on available regulatory documents and should be verified with current official sources. 
          Each state's answer is generated independently to ensure accuracy and prevent cross-contamination.
        </p>
      </div>
    </div>
  )
}