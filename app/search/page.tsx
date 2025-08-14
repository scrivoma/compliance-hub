'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { Search, Send, FileText, MapPin, Clock, ExternalLink, ChevronDown, ChevronUp, MessageCircle, Plus, Filter, Settings, Globe } from 'lucide-react'
import { SlideOutDocumentViewer } from '@/components/documents/slide-out-document-viewer'
import { MultiStateResults } from '@/components/search/MultiStateResults'
import { StreamingMultiStateResults } from '@/components/search/StreamingMultiStateResults'
import type { CitationData } from '@/components/documents/citation-text-viewer'
import { US_STATES, SPECIAL_STATE_OPTIONS, getStateDisplayName } from '@/lib/constants/states'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { trackSearch } from '@/lib/tracking'
import { useSearchParams } from 'next/navigation'
import { MentionInput } from '@/components/search/MentionInput'
import { parseQueryMentions } from '@/lib/utils/mention-parser'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

function SearchContent() {
  const searchParams = useSearchParams()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<{
    query: string
    answer: string
    citations: CitationData[]
  } | null>(null)
  const [multiStateResult, setMultiStateResult] = useState<{
    query: string
    stateAnswers: Array<{
      state: string
      answer: string
      citations: CitationData[]
      sourceCount: number
      processingTime: number
    }>
    summary?: string
    totalProcessingTime: number
  } | null>(null)
  const [currentStateAnswers, setCurrentStateAnswers] = useState<{[state: string]: {
    state: string
    answer: string
    citations: CitationData[]
    sourceCount: number
    processingTime: number
  }}>({})
  const [streamingStates, setStreamingStates] = useState<Set<string>>(new Set())
  const [isMultiStateSearch, setIsMultiStateSearch] = useState(false) // Persistent flag for multi-state searches
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedCitation, setSelectedCitation] = useState<CitationData | null>(null)
  const [viewerDocument, setViewerDocument] = useState<{id: string, title: string} | null>(null)
  const [citationsVisible, setCitationsVisible] = useState(false)
  const [followUpQuestion, setFollowUpQuestion] = useState('')
  const [followUpLoading, setFollowUpLoading] = useState(false)
  const [streamingAnswer, setStreamingAnswer] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [selectedStates, setSelectedStates] = useState<string[]>(['CO']) // Default to Colorado
  const [showStateSelector, setShowStateSelector] = useState(false)
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [recentStates, setRecentStates] = useState<string[]>([])
  const [urlParamsProcessed, setUrlParamsProcessed] = useState(false)
  const [useMentionInput, setUseMentionInput] = useState(true) // Toggle for @ mention system

  // Debug: Track page refresh events
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.warn('🚨 Page refresh detected during search')
    }
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.warn('🚨 Page hidden during search')
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Load saved state preferences on mount
  useEffect(() => {
    const savedStates = localStorage.getItem('compliance-hub-selected-states')
    const savedMultiMode = localStorage.getItem('compliance-hub-multi-mode')
    const savedRecentStates = localStorage.getItem('compliance-hub-recent-states')
    
    if (savedStates) {
      try {
        const states = JSON.parse(savedStates)
        if (Array.isArray(states) && states.length > 0) {
          setSelectedStates(states)
        }
      } catch (e) {
        console.error('Failed to parse saved states:', e)
      }
    }
    
    if (savedMultiMode) {
      setMultiSelectMode(savedMultiMode === 'true')
    }
    
    if (savedRecentStates) {
      try {
        const recent = JSON.parse(savedRecentStates)
        if (Array.isArray(recent)) {
          setRecentStates(recent)
        }
      } catch (e) {
        console.error('Failed to parse recent states:', e)
      }
    }
  }, [])

  // Save state preferences when they change
  useEffect(() => {
    localStorage.setItem('compliance-hub-selected-states', JSON.stringify(selectedStates))
  }, [selectedStates])

  useEffect(() => {
    localStorage.setItem('compliance-hub-multi-mode', multiSelectMode.toString())
  }, [multiSelectMode])

  useEffect(() => {
    localStorage.setItem('compliance-hub-recent-states', JSON.stringify(recentStates))
  }, [recentStates])

  // Handle URL parameters from recent searches
  useEffect(() => {
    if (urlParamsProcessed) return
    
    const queryParam = searchParams.get('q')
    const statesParam = searchParams.get('states')
    
    if (queryParam) {
      setQuery(queryParam)
      
      // If states parameter is provided, use it
      if (statesParam) {
        try {
          const states = JSON.parse(statesParam)
          if (Array.isArray(states) && states.length > 0) {
            setSelectedStates(states)
            setMultiSelectMode(states.length > 1)
          }
        } catch (e) {
          console.error('Failed to parse states from URL:', e)
        }
      }
      
      // Auto-run the search after a brief delay to ensure state is set
      setTimeout(() => {
        const form = document.querySelector('form') as HTMLFormElement
        if (form) {
          form.requestSubmit()
        }
      }, 100)
    }
    
    setUrlParamsProcessed(true)
  }, [searchParams, urlParamsProcessed])

  // Add state to recent states when selected
  const addToRecentStates = (stateCode: string) => {
    if (!['ALL', 'MULTIPLE'].includes(stateCode)) {
      setRecentStates(prev => {
        const filtered = prev.filter(s => s !== stateCode)
        return [stateCode, ...filtered].slice(0, 5) // Keep only 5 recent states
      })
    }
  }

  const openCitation = (citation: CitationData) => {
    console.log('🔍 Opening citation in text viewer:', citation)
    setSelectedCitation(citation)
    setViewerDocument({
      id: citation.source.documentId,
      title: citation.source.title
    })
  }

  const closeCitationViewer = () => {
    setSelectedCitation(null)
    setViewerDocument(null)
  }

  // Handle search from @ mention system
  const handleMentionSearch = async (cleanQuery: string, stateCodes: string[]) => {
    if (!cleanQuery.trim()) return
    
    // Update selectedStates to match the @ mentions
    const finalStates = stateCodes.length > 0 ? stateCodes : selectedStates
    setSelectedStates(finalStates)
    
    // Perform the search
    await performSearch(cleanQuery.trim(), finalStates)
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!query.trim()) return
    
    // If using mention input, parse the query for @ mentions
    if (useMentionInput) {
      const parsed = parseQueryMentions(query)
      const finalStates = parsed.stateCodes.length > 0 ? parsed.stateCodes : selectedStates
      setSelectedStates(finalStates)
      await performSearch(parsed.cleanQuery, finalStates)
    } else {
      await performSearch(query.trim(), selectedStates)
    }
  }

  // Extracted search logic for reuse
  const performSearch = async (searchQuery: string, searchStates: string[]) => {
    setLoading(true)
    setError('')
    setResult(null)
    setMultiStateResult(null)
    setCurrentStateAnswers({})
    setStreamingStates(new Set())
    setStreamingAnswer('')
    setIsStreaming(true)
    
    // Set persistent multi-state flag
    const isMultiState = searchStates.length > 1 && !searchStates.includes('ALL')
    setIsMultiStateSearch(isMultiState)
    
    // For multi-state searches, immediately initialize UI with queued states
    if (isMultiState) {
      setLoading(false) // Hide generic loading spinner
      
      // Initialize multi-state result container immediately
      setMultiStateResult({
        query: searchQuery,
        stateAnswers: [],
        totalProcessingTime: 0
      })
      
      // Initialize current state answers with "queued" status
      const queuedStateAnswers: { [state: string]: any } = {}
      searchStates.forEach(state => {
        queuedStateAnswers[state] = {
          state: state,
          answer: '',
          citations: [],
          sourceCount: 0,
          processingTime: 0,
          status: 'queued' // Add status field to track lifecycle
        }
      })
      setCurrentStateAnswers(queuedStateAnswers)
      
      // Mark all states as "preparing" (not yet streaming, but will be processed)
      setStreamingStates(new Set(searchStates))
    }
    
    // Capture states for use in callbacks
    const statesForTracking = searchStates
    
    try {
      const response = await fetch('/api/search-citations-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          query: searchQuery,
          options: {},
          states: searchStates
        })
      })
      
      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Search failed')
        setLoading(false)
        return
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let metadata: any = null

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        
        // Process complete lines  
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim() === '') continue // Skip empty lines
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim()
              if (jsonStr === '') continue // Skip empty data
              
              // Additional safety check for malformed JSON
              if (!jsonStr.startsWith('{') || !jsonStr.endsWith('}')) {
                console.warn('Skipping malformed JSON chunk:', jsonStr)
                continue
              }
              
              const data = JSON.parse(jsonStr)
              
              if (data.type === 'metadata') {
                metadata = data
                setResult({
                  query: data.query,
                  answer: '',
                  citations: data.citations
                })
                // Clear multi-state result for single-state searches
                setMultiStateResult(null)
                setLoading(false)
              } else if (data.type === 'citations') {
                // Handle separate citations chunk for large metadata
                setResult(prev => prev ? { ...prev, citations: data.citations } : null)
              } else if (data.type === 'content') {
                setStreamingAnswer(prev => prev + data.content)
              } else if (data.type === 'multi-state-metadata') {
                // Initialize multi-state result
                setMultiStateResult({
                  query: data.query,
                  stateAnswers: [],
                  totalProcessingTime: 0
                })
                setLoading(false)
              } else if (data.type === 'state-queued') {
                // Update state status to queued (already set in performSearch, but ensure consistency)
                setCurrentStateAnswers(prev => ({
                  ...prev,
                  [data.state]: {
                    ...prev[data.state],
                    status: 'queued'
                  }
                }))
              } else if (data.type === 'state-processing') {
                // Update state status to processing
                setCurrentStateAnswers(prev => ({
                  ...prev,
                  [data.state]: {
                    ...prev[data.state],
                    status: 'processing'
                  }
                }))
              } else if (data.type === 'state-header') {
                // Initialize state answer and mark as streaming
                setCurrentStateAnswers(prev => ({
                  ...prev,
                  [data.state]: {
                    ...prev[data.state],
                    state: data.state,
                    answer: '',
                    citations: [],
                    sourceCount: data.sourceCount,
                    processingTime: data.processingTime,
                    status: 'streaming'
                  }
                }))
                setStreamingStates(prev => new Set(Array.from(prev).concat(data.state)))
                console.log('📍 Starting state:', data.state)
              } else if (data.type === 'state-citations') {
                // Add citations for this state
                setCurrentStateAnswers(prev => ({
                  ...prev,
                  [data.state]: {
                    ...prev[data.state],
                    citations: data.citations
                  }
                }))
                console.log('📚 Received citations for', data.state, ':', data.citations.length)
              } else if (data.type === 'state-content') {
                // Append content to this state's answer
                setCurrentStateAnswers(prev => ({
                  ...prev,
                  [data.state]: {
                    ...prev[data.state],
                    answer: prev[data.state].answer + data.content
                  }
                }))
              } else if (data.type === 'state-complete') {
                // State is complete, add to multi-state result
                setCurrentStateAnswers(prev => {
                  const stateAnswer = prev[data.state]
                  if (stateAnswer) {
                    // Update status to complete
                    const completedStateAnswer = {
                      ...stateAnswer,
                      status: 'complete'
                    }
                    setMultiStateResult(multiResult => {
                      if (multiResult) {
                        // Check if this state already exists to prevent duplicates
                        const existingStateIndex = multiResult.stateAnswers.findIndex(sa => sa.state === data.state)
                        if (existingStateIndex === -1) {
                          const updatedStateAnswers = [...multiResult.stateAnswers, completedStateAnswer]
                          return {
                            ...multiResult,
                            stateAnswers: updatedStateAnswers
                          }
                        }
                        // If state already exists, update it
                        const updatedStateAnswers = multiResult.stateAnswers.map(sa => 
                          sa.state === data.state ? completedStateAnswer : sa
                        )
                        return {
                          ...multiResult,
                          stateAnswers: updatedStateAnswers
                        }
                      }
                      return multiResult
                    })
                    
                    // Return updated state answers with completed status
                    return {
                      ...prev,
                      [data.state]: completedStateAnswer
                    }
                  }
                  return prev
                })
                // Remove from streaming states when complete
                setStreamingStates(prev => {
                  const newSet = new Set(prev)
                  newSet.delete(data.state)
                  return newSet
                })
                console.log('✅ State complete:', data.state)
              } else if (data.type === 'summary-header') {
                console.log('📝 Starting summary generation...')
              } else if (data.type === 'summary-content') {
                // Append to summary
                setMultiStateResult(prev => {
                  if (prev) {
                    return {
                      ...prev,
                      summary: (prev.summary || '') + data.content
                    }
                  }
                  return prev
                })
              } else if (data.type === 'summary-complete') {
                console.log('📝 Summary complete')
              } else if (data.type === 'done') {
                // Use persistent flag for reliable multi-state detection
                if (isMultiStateSearch) {
                  // For multi-state searches, finalize the multi-state result first, then stop streaming
                  setMultiStateResult(prev => {
                    if (prev) {
                      // If stateAnswers is empty but we have currentStateAnswers, populate it
                      if (prev.stateAnswers.length === 0 && Object.keys(currentStateAnswers).length > 0) {
                        const stateAnswersFromCurrent = Object.values(currentStateAnswers)
                        const updatedResult = {
                          ...prev,
                          stateAnswers: stateAnswersFromCurrent
                        }
                        
                        // Track multi-state search
                        const totalCitations = updatedResult.stateAnswers.reduce((sum, sa) => sum + sa.citations.length, 0)
                        trackSearch(updatedResult.query, totalCitations, 'ai-search', JSON.stringify(statesForTracking))
                        
                        // Clear all streaming states and set streaming to false
                        setStreamingStates(new Set())
                        setTimeout(() => setIsStreaming(false), 100)
                        return updatedResult
                      }
                      
                      // Track multi-state search
                      const totalCitations = prev.stateAnswers.reduce((sum, sa) => sum + sa.citations.length, 0)
                      trackSearch(prev.query, totalCitations, 'ai-search', JSON.stringify(statesForTracking))
                      
                      // Clear all streaming states and set streaming to false
                      setStreamingStates(new Set())
                      setTimeout(() => setIsStreaming(false), 100)
                      return prev
                    }
                    // Clear all streaming states and set streaming to false if no result
                    setStreamingStates(new Set())
                    setIsStreaming(false)
                    return null
                  })
                  console.log('✅ Multi-state search streaming completed')
                } else {
                  // For single-state searches, finalize the result
                  setStreamingAnswer(finalAnswer => {
                    setResult(prev => {
                      if (prev) {
                        // Track the search when it's completed
                        trackSearch(prev.query, prev.citations.length, 'ai-search', JSON.stringify(statesForTracking))
                        return { ...prev, answer: finalAnswer }
                      }
                      return null
                    })
                    return finalAnswer
                  })
                  setIsStreaming(false)
                  console.log('✅ Single-state search streaming completed')
                }
              } else if (data.type === 'error') {
                setError(data.error || 'Stream failed')
                setIsStreaming(false)
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e)
              console.error('Line:', line)
              console.error('JSON string:', JSON.stringify(line.slice(6)))
              console.error('JSON length:', line.slice(6).length)
            }
          }
        }
      }
    } catch (error) {
      setError('Network error. Please try again.')
      setLoading(false)
      setIsStreaming(false)
    }
  }

  const renderAnswerWithCitationLinks = (answer: string) => {
    // Only render citation links if we have citations available
    if (!result?.citations || result.citations.length === 0) {
      console.log('⚠️ No citations available for linking')
      return answer
    }
    
    console.log('🔗 Starting citation linking with', result.citations.length, 'available citations')
    
    // Regular expression to find citation references like [1], [2, 3], [5, 9], etc.
    // Updated to handle potential spaces around numbers
    // Updated regex to handle [1], [1, 2], [Citation 3], [Citation 1, 5], etc.
    const citationRegex = /\[(?:Citation\s+)?([0-9]+(?:\s*,\s*[0-9]+)*)\]/g
    const parts = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    let totalMatches = 0

    while ((match = citationRegex.exec(answer)) !== null) {
      totalMatches++
      
      // Add text before the citation
      if (match?.index || 0 > lastIndex) {
        parts.push(answer.substring(lastIndex, match?.index || 0))
      }
      
      // Parse multiple citation numbers (e.g., "1", "2, 3", "5, 9")
      const citationNumbersStr = match[1]
      const citationNumbers = citationNumbersStr
        .split(',')
        .map(num => parseInt(num.trim()))
        .filter(num => !isNaN(num))
      
      console.log(`📎 Found citation: [${citationNumbersStr}] -> parsed as:`, citationNumbers)
      
      // Create clickable links for each valid citation
      const citationLinks: React.ReactNode[] = []
      citationNumbers.forEach((citationNumber, index) => {
        const citationIndex = citationNumber - 1 // Convert to 0-based index
        
        // Only create link if citation exists
        if (citationIndex >= 0 && citationIndex < result.citations.length) {
          if (index > 0) {
            citationLinks.push(<span key={`comma-${match?.index || 0}-${index}`}>, </span>)
          }
          
          citationLinks.push(
            <button
              key={`citation-${citationNumber}-${match?.index || 0}-${index}`}
              onClick={() => scrollToCitation(citationIndex)}
              className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium hover:underline cursor-pointer"
              title={`Jump to citation ${citationNumber}`}
            >
              {citationNumber}
            </button>
          )
        } else {
          console.warn(`⚠️ Citation ${citationNumber} not found! Available: 1-${result.citations.length}`)
          // Still show the number but not as a link
          if (index > 0) {
            citationLinks.push(<span key={`comma-${match?.index || 0}-${index}`}>, </span>)
          }
          citationLinks.push(<span key={`invalid-citation-${citationNumber}-${match?.index || 0}-${index}`}>{citationNumber}</span>)
        }
      })
      
      // Wrap all citation links in brackets
      if (citationLinks.length > 0) {
        parts.push(<span key={`bracket-${match?.index || 0}`}>[</span>)
        parts.push(...citationLinks)
        parts.push(<span key={`bracket-close-${match?.index || 0}`}>]</span>)
      } else {
        // If no valid citations found, keep original text
        parts.push(match[0])
      }
      
      lastIndex = match?.index || 0 + match[0].length
    }
    
    // Add remaining text after the last citation
    if (lastIndex < answer.length) {
      parts.push(answer.substring(lastIndex))
    }
    
    console.log(`✅ Citation linking complete: Found ${totalMatches} citation references in answer`)
    
    return parts.length > 0 ? parts : answer
  }

  const scrollToCitation = (citationIndex: number) => {
    // Get the citation data and open it directly in the document viewer
    if (result && result.citations && result.citations[citationIndex]) {
      const citation = result.citations[citationIndex]
      openCitation(citation)
    }
  }

  // Shared citation processing function used by both streaming and markdown renderers
  const processCitationsInText = (text: string, keyPrefix: string = '') => {
    if (!result?.citations || result.citations.length === 0) {
      return text
    }

    // Updated regex to handle [1], [1, 2], [Citation 3], [Citation 1, 5], etc.
    const citationRegex = /\[(?:Citation\s+)?([0-9]+(?:\s*,\s*[0-9]+)*)\]/g
    const parts = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = citationRegex.exec(text)) !== null) {
      // Add text before the citation
      if (match?.index || 0 > lastIndex) {
        parts.push(text.substring(lastIndex, match?.index || 0))
      }

      // Parse multiple citation numbers
      const citationNumbersStr = match[1]
      const citationNumbers = citationNumbersStr
        .split(',')
        .map(num => parseInt(num.trim()))
        .filter(num => !isNaN(num))

      // Create clickable links for each valid citation
      const citationLinks: React.ReactNode[] = []
      citationNumbers.forEach((citationNumber, index) => {
        const citationIndex = citationNumber - 1

        if (citationIndex >= 0 && citationIndex < result.citations.length) {
          if (index > 0) {
            citationLinks.push(<span key={`${keyPrefix}comma-${match?.index || 0}-${index}`}>, </span>)
          }
          
          citationLinks.push(
            <button
              key={`${keyPrefix}citation-${citationNumber}-${match?.index || 0}-${index}`}
              onClick={() => scrollToCitation(citationIndex)}
              className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium hover:underline cursor-pointer"
              title={`Jump to citation ${citationNumber}`}
            >
              {citationNumber}
            </button>
          )
        } else {
          if (index > 0) {
            citationLinks.push(<span key={`${keyPrefix}comma-${match?.index || 0}-${index}`}>, </span>)
          }
          citationLinks.push(<span key={`${keyPrefix}invalid-citation-${citationNumber}-${match?.index || 0}-${index}`}>{citationNumber}</span>)
        }
      })

      // Wrap all citation links in brackets
      if (citationLinks.length > 0) {
        parts.push(<span key={`${keyPrefix}bracket-${match?.index || 0}`}>[</span>)
        parts.push(...citationLinks)
        parts.push(<span key={`${keyPrefix}bracket-close-${match?.index || 0}`}>]</span>)
      } else {
        parts.push(match[0])
      }

      lastIndex = match?.index || 0 + match[0].length
    }

    // Add remaining text after the last citation
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }

    return parts.length > 0 ? parts : text
  }

  // Process text to convert citation references to JSX elements
  const processCitationLinksInText = (text: string) => {
    if (!result?.citations || result.citations.length === 0) {
      return text
    }

    // Updated regex to handle [1], [1, 2], [Citation 3], [Citation 1, 5], etc.
    const citationRegex = /\[(?:Citation\s+)?([0-9]+(?:\s*,\s*[0-9]+)*)\]/g
    const parts = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    let elementKey = 0

    while ((match = citationRegex.exec(text)) !== null) {
      // Add text before the citation
      if (match?.index || 0 > lastIndex) {
        parts.push(text.substring(lastIndex, match?.index || 0))
      }

      // Parse multiple citation numbers
      const citationNumbersStr = match[1]
      const citationNumbers = citationNumbersStr
        .split(',')
        .map(num => parseInt(num.trim()))
        .filter(num => !isNaN(num))

      // Create a placeholder for the citation that we'll replace later
      const placeholder = `CITATION_PLACEHOLDER_${elementKey++}`
      parts.push(placeholder)

      lastIndex = match?.index || 0 + match[0].length
    }

    // Add remaining text after the last citation
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }

    return parts.join('')
  }


  // Render answer with real-time markdown formatting and citation links
  const renderStreamingMarkdownWithCitations = (answer: string) => {
    return (
      <div className="markdown-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Style headings appropriately
            h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 mt-6">{processChildrenForCitations(children)}</h1>,
            h2: ({ children }) => <h2 className="text-xl font-bold mb-3 mt-5">{processChildrenForCitations(children)}</h2>,
            h3: ({ children }) => <h3 className="text-lg font-bold mb-2 mt-4">{processChildrenForCitations(children)}</h3>,
            h4: ({ children }) => <h4 className="text-base font-bold mb-2 mt-3">{processChildrenForCitations(children)}</h4>,
            // Style paragraphs
            p: ({ children }) => <p className="mb-4">{processChildrenForCitations(children)}</p>,
            // Style lists
            ul: ({ children }) => <ul className="list-disc ml-6 mb-4">{processChildrenForCitations(children)}</ul>,
            ol: ({ children }) => <ol className="list-decimal ml-6 mb-4">{processChildrenForCitations(children)}</ol>,
            li: ({ children }) => <li className="mb-1">{processChildrenForCitations(children)}</li>,
            // Style emphasis
            strong: ({ children }) => <strong className="font-bold">{processChildrenForCitations(children)}</strong>,
            em: ({ children }) => <em className="italic">{processChildrenForCitations(children)}</em>,
            // Style code
            code: ({ children }) => <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
            pre: ({ children }) => <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm font-mono overflow-x-auto mb-4">{children}</pre>,
            // Style blockquotes
            blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic mb-4">{processChildrenForCitations(children)}</blockquote>,
            // Style tables
            table: ({ children }) => (
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">{processChildrenForCitations(children)}</table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-gray-50 dark:bg-gray-800">{processChildrenForCitations(children)}</thead>,
            tbody: ({ children }) => <tbody>{processChildrenForCitations(children)}</tbody>,
            tr: ({ children }) => <tr className="border-b border-gray-200 dark:border-gray-700">{processChildrenForCitations(children)}</tr>,
            th: ({ children }) => (
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                {processChildrenForCitations(children)}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-800 dark:text-gray-200">
                {processChildrenForCitations(children)}
              </td>
            ),
          }}
        >
          {answer}
        </ReactMarkdown>
      </div>
    )
  }

  // Legacy render answer function (kept for backwards compatibility)
  const renderMarkdownAnswer = (answer: string) => {
    return renderStreamingMarkdownWithCitations(answer)
  }


  // Post-process rendered markdown to add citation links
  const addCitationLinksToMarkdown = (markdownElement: React.ReactElement) => {
    // After markdown is rendered, we need to find citation references and make them clickable
    // This is a simplified version - we'll use the existing citation link logic
    return (
      <div 
        dangerouslySetInnerHTML={{ 
          __html: renderAnswerWithCitationLinks((markdownElement.props as any)?.children || '').toString()
        }} 
      />
    )
  }

  // Process children nodes recursively to handle fragmented citations
  const processChildrenForCitations = (children: React.ReactNode): React.ReactNode => {
    if (typeof children === 'string') {
      return renderAnswerWithCitationLinks(children)
    }
    
    if (React.isValidElement(children)) {
      // If it's a React element, process its children recursively
      const processedChildren = React.Children.map((children.props as any).children, processChildrenForCitations)
      return React.cloneElement(children, (children.props as any), processedChildren)
    }
    
    if (Array.isArray(children)) {
      // For arrays, we need to be more careful about fragmented citations
      // First, check if this looks like fragmented text that might contain citations
      const hasOnlyStrings = children.every(child => typeof child === 'string')
      
      if (hasOnlyStrings) {
        // If all children are strings, combine them and process as one
        const combinedText = children.join('')
        return renderAnswerWithCitationLinks(combinedText)
      } else {
        // If mixed content, process each child individually
        // This preserves React elements while still processing text
        return children.map((child, index) => {
          if (typeof child === 'string') {
            return renderAnswerWithCitationLinks(child)
          } else {
            return processChildrenForCitations(child)
          }
        })
      }
    }
    
    return children
  }

  // Simple markdown renderer that processes citations after markdown
  const renderMarkdownWithCitations = (answer: string) => {
    if (!result?.citations || result.citations.length === 0) {
      return renderMarkdownAnswer(answer)
    }

    // Direct approach - render markdown first, then process citations
    return (
      <div className="markdown-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Style headings appropriately
            h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 mt-6">{processChildrenForCitations(children)}</h1>,
            h2: ({ children }) => <h2 className="text-xl font-bold mb-3 mt-5">{processChildrenForCitations(children)}</h2>,
            h3: ({ children }) => <h3 className="text-lg font-bold mb-2 mt-4">{processChildrenForCitations(children)}</h3>,
            h4: ({ children }) => <h4 className="text-base font-bold mb-2 mt-3">{processChildrenForCitations(children)}</h4>,
            // Style paragraphs and process citations
            p: ({ children }) => <p className="mb-4">{processChildrenForCitations(children)}</p>,
            // Style lists
            ul: ({ children }) => <ul className="list-disc ml-6 mb-4">{processChildrenForCitations(children)}</ul>,
            ol: ({ children }) => <ol className="list-decimal ml-6 mb-4">{processChildrenForCitations(children)}</ol>,
            li: ({ children }) => <li className="mb-1">{processChildrenForCitations(children)}</li>,
            // Style emphasis
            strong: ({ children }) => <strong className="font-bold">{processChildrenForCitations(children)}</strong>,
            em: ({ children }) => <em className="italic">{processChildrenForCitations(children)}</em>,
            // Style code
            code: ({ children }) => <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
            pre: ({ children }) => <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm font-mono overflow-x-auto mb-4">{children}</pre>,
            // Style blockquotes
            blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic mb-4">{processChildrenForCitations(children)}</blockquote>,
            // Style tables
            table: ({ children }) => (
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">{processChildrenForCitations(children)}</table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-gray-50 dark:bg-gray-800">{processChildrenForCitations(children)}</thead>,
            tbody: ({ children }) => <tbody>{processChildrenForCitations(children)}</tbody>,
            tr: ({ children }) => <tr className="border-b border-gray-200 dark:border-gray-700">{processChildrenForCitations(children)}</tr>,
            th: ({ children }) => (
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                {processChildrenForCitations(children)}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-800 dark:text-gray-200">
                {processChildrenForCitations(children)}
              </td>
            ),
          }}
        >
          {answer}
        </ReactMarkdown>
      </div>
    )
  }

  // Helper to get current citations for rendering links
  const getCurrentCitations = () => {
    return result?.citations || []
  }

  // Group citations by state for multi-state results
  const groupCitationsByState = (citations: CitationData[]) => {
    const groups: { [state: string]: CitationData[] } = {}
    
    citations.forEach(citation => {
      const state = (citation.source as any)?.state || 'Unknown'
      if (!groups[state]) {
        groups[state] = []
      }
      groups[state].push(citation)
    })
    
    return groups
  }

  // Smart placeholder text based on selected states
  const getSmartPlaceholder = () => {
    if (useMentionInput) {
      return "Ask about compliance requirements... Use @state to filter by jurisdiction"
    } else if (selectedStates.includes('ALL')) {
      return "Compare regulations across all states..."
    } else if (selectedStates.length === 1) {
      return `Ask about ${getStateDisplayName(selectedStates[0])} compliance requirements...`
    } else if (selectedStates.length > 1) {
      return `Compare requirements across ${selectedStates.length} selected states...`
    }
    return "Ask about compliance requirements..."
  }

  // Quick search handler for action buttons
  const handleQuickSearch = async (mode: 'single' | 'all' | 'selected') => {
    if (!query.trim()) return
    
    // Update selected states based on mode
    let searchStates = selectedStates
    if (mode === 'all') {
      searchStates = ['ALL']
      setSelectedStates(['ALL'])
    } else if (mode === 'single' && selectedStates.length > 1) {
      searchStates = [selectedStates[0]]
      setSelectedStates([selectedStates[0]])
    }
    // For 'selected' mode, use current selectedStates
    
    // Use the common performSearch function
    await performSearch(query.trim(), searchStates)
  }

  const handleFollowUpSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!followUpQuestion.trim()) return
    
    // Check if we have either single-state result or multi-state result
    if (!result && !multiStateResult) return
    
    // Special handling for follow-up with conversation context
    const contextData = result ? {
      // Single-state context
      previousQuery: result.query,
      previousAnswer: result.answer,
      previousStates: selectedStates,
      stateContext: `single state (${selectedStates[0]})`
    } : {
      // Multi-state context
      previousQuery: multiStateResult!.query,
      previousAnswer: multiStateResult!.summary || multiStateResult!.stateAnswers.map(sa => `${sa.state}: ${sa.answer}`).join('\n\n'),
      previousStates: selectedStates,
      stateContext: `multi-state comparison (${selectedStates.join(', ')})`
    }
    
    await performFollowUpSearch(followUpQuestion.trim(), selectedStates, contextData)
    
    setQuery(followUpQuestion)
    setFollowUpQuestion('')
    setCitationsVisible(false)
  }

  // Special search function for follow-up questions with conversation context
  const performFollowUpSearch = async (searchQuery: string, searchStates: string[], conversationContext: any) => {
    setFollowUpLoading(true)
    setError('')
    setMultiStateResult(null)
    setCurrentStateAnswers({})
    setStreamingStates(new Set())
    setStreamingAnswer('')
    setIsStreaming(true)
    
    // Capture states for use in callbacks
    const statesForTracking = searchStates
    
    try {
      const requestBody = { 
        query: searchQuery,
        options: {},
        conversationContext,
        states: searchStates
      }
      
      console.log('🔄 Follow-up request:', requestBody)
      console.log('📍 Selected states for follow-up:', searchStates)
      
      const response = await fetch('/api/search-citations-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })
      
      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Follow-up search failed')
        setFollowUpLoading(false)
        return
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let metadata: any = null

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        
        // Process complete lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim() === '') continue // Skip empty lines
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim()
              if (jsonStr === '') continue // Skip empty data
              
              // Additional safety check for malformed JSON
              if (!jsonStr.startsWith('{') || !jsonStr.endsWith('}')) {
                console.warn('Skipping malformed JSON chunk:', jsonStr)
                continue
              }
              
              const data = JSON.parse(jsonStr)
              
              if (data.type === 'metadata') {
                metadata = data
                console.log('🔄 Follow-up metadata received with', data.citations.length, 'citations')
                setResult({
                  query: searchQuery,
                  answer: '',
                  citations: data.citations
                })
                // Clear multi-state result for single-state searches
                setMultiStateResult(null)
                setFollowUpLoading(false)
              } else if (data.type === 'citations') {
                // Handle separate citations chunk for large metadata
                console.log('📚 Follow-up received separate citations chunk:', data.citations.length, 'citations')
                setResult(prev => prev ? { ...prev, citations: data.citations } : null)
              } else if (data.type === 'content') {
                setStreamingAnswer(prev => prev + data.content)
              } else if (data.type === 'multi-state-metadata') {
                // Initialize multi-state result
                setMultiStateResult({
                  query: data.query,
                  stateAnswers: [],
                  totalProcessingTime: 0
                })
                setFollowUpLoading(false)
                console.log('🏛️ Multi-state follow-up search detected, processing', data.stateCount, 'states')
              } else if (data.type === 'state-header') {
                // Initialize state answer and mark as streaming
                setCurrentStateAnswers(prev => ({
                  ...prev,
                  [data.state]: {
                    state: data.state,
                    answer: '',
                    citations: [],
                    sourceCount: data.sourceCount,
                    processingTime: data.processingTime
                  }
                }))
                setStreamingStates(prev => new Set(Array.from(prev).concat(data.state)))
                console.log('📍 Starting state:', data.state)
              } else if (data.type === 'state-citations') {
                // Add citations for this state
                setCurrentStateAnswers(prev => ({
                  ...prev,
                  [data.state]: {
                    ...prev[data.state],
                    citations: data.citations
                  }
                }))
                console.log('📚 Received citations for', data.state, ':', data.citations.length)
              } else if (data.type === 'state-content') {
                // Append content to this state's answer
                setCurrentStateAnswers(prev => ({
                  ...prev,
                  [data.state]: {
                    ...prev[data.state],
                    answer: prev[data.state].answer + data.content
                  }
                }))
              } else if (data.type === 'state-complete') {
                // State is complete, add to multi-state result
                setCurrentStateAnswers(prev => {
                  const stateAnswer = prev[data.state]
                  if (stateAnswer) {
                    // Update status to complete
                    const completedStateAnswer = {
                      ...stateAnswer,
                      status: 'complete'
                    }
                    setMultiStateResult(multiResult => {
                      if (multiResult) {
                        // Check if this state already exists to prevent duplicates
                        const existingStateIndex = multiResult.stateAnswers.findIndex(sa => sa.state === data.state)
                        if (existingStateIndex === -1) {
                          const updatedStateAnswers = [...multiResult.stateAnswers, completedStateAnswer]
                          return {
                            ...multiResult,
                            stateAnswers: updatedStateAnswers
                          }
                        }
                        // If state already exists, update it
                        const updatedStateAnswers = multiResult.stateAnswers.map(sa => 
                          sa.state === data.state ? completedStateAnswer : sa
                        )
                        return {
                          ...multiResult,
                          stateAnswers: updatedStateAnswers
                        }
                      }
                      return multiResult
                    })
                    
                    // Return updated state answers with completed status
                    return {
                      ...prev,
                      [data.state]: completedStateAnswer
                    }
                  }
                  return prev
                })
                // Remove from streaming states when complete
                setStreamingStates(prev => {
                  const newSet = new Set(prev)
                  newSet.delete(data.state)
                  return newSet
                })
                console.log('✅ State complete:', data.state)
              } else if (data.type === 'summary-header') {
                console.log('📝 Starting summary generation...')
              } else if (data.type === 'summary-content') {
                // Append to summary
                setMultiStateResult(prev => {
                  if (prev) {
                    return {
                      ...prev,
                      summary: (prev.summary || '') + data.content
                    }
                  }
                  return prev
                })
              } else if (data.type === 'summary-complete') {
                console.log('📝 Summary complete')
              } else if (data.type === 'done') {
                // Use persistent flag for reliable multi-state detection
                if (isMultiStateSearch) {
                  // For multi-state searches, finalize the multi-state result first, then stop streaming
                  setMultiStateResult(prev => {
                    if (prev) {
                      // If stateAnswers is empty but we have currentStateAnswers, populate it
                      if (prev.stateAnswers.length === 0 && Object.keys(currentStateAnswers).length > 0) {
                        const stateAnswersFromCurrent = Object.values(currentStateAnswers)
                        const updatedResult = {
                          ...prev,
                          stateAnswers: stateAnswersFromCurrent
                        }
                        
                        // Track multi-state search
                        const totalCitations = updatedResult.stateAnswers.reduce((sum, sa) => sum + sa.citations.length, 0)
                        trackSearch(updatedResult.query, totalCitations, 'ai-search', JSON.stringify(statesForTracking))
                        
                        // Set streaming to false after state is updated
                        setTimeout(() => setIsStreaming(false), 100)
                        return updatedResult
                      }
                      
                      // Track multi-state search
                      const totalCitations = prev.stateAnswers.reduce((sum, sa) => sum + sa.citations.length, 0)
                      trackSearch(prev.query, totalCitations, 'ai-search', JSON.stringify(statesForTracking))
                      
                      // Set streaming to false after state is updated
                      setTimeout(() => setIsStreaming(false), 100)
                      return prev
                    }
                    // Set streaming to false if no result
                    setIsStreaming(false)
                    return null
                  })
                  console.log('✅ Multi-state follow-up search streaming completed')
                } else {
                  // For single-state searches, finalize the result
                  setStreamingAnswer(finalAnswer => {
                    setResult(prev => {
                      if (prev) {
                        // Track the search when it's completed
                        trackSearch(prev.query, prev.citations.length, 'ai-search', JSON.stringify(statesForTracking))
                        return { ...prev, answer: finalAnswer }
                      }
                      return null
                    })
                    return finalAnswer
                  })
                  setIsStreaming(false)
                  console.log('✅ Single-state follow-up search streaming completed')
                }
              } else if (data.type === 'error') {
                setError(data.error || 'Stream failed')
                setIsStreaming(false)
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e)
              console.error('Line:', line)
              console.error('JSON string:', JSON.stringify(line.slice(6)))
              console.error('JSON length:', line.slice(6).length)
            }
          }
        }
      }
    } catch (error) {
      setError('Network error. Please try again.')
      setFollowUpLoading(false)
      setIsStreaming(false)
    }
  }

  // Handle generating summary for multi-state results
  const handleGenerateSummary = async () => {
    if (!multiStateResult || !multiStateResult.stateAnswers.length) {
      return
    }

    try {
      const response = await fetch('/api/search-citations-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          query: multiStateResult.query,
          options: { summaryOnly: true },
          states: multiStateResult.stateAnswers.map(sa => sa.state),
          stateAnswers: multiStateResult.stateAnswers
        })
      })
      
      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Summary generation failed')
        return
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                
                if (data.type === 'summary-header') {
                  console.log('📝 Starting summary generation...')
                } else if (data.type === 'summary-content') {
                  // Append to summary
                  setMultiStateResult(prev => {
                    if (prev) {
                      return {
                        ...prev,
                        summary: (prev.summary || '') + data.content
                      }
                    }
                    return prev
                  })
                } else if (data.type === 'summary-complete') {
                  console.log('📝 Summary complete')
                } else if (data.type === 'error') {
                  setError(data.error || 'Summary generation failed')
                }
              } catch (e) {
                console.error('Failed to parse summary SSE data:', e)
              }
            }
          }
        }
      }
    } catch (error) {
      setError('Network error during summary generation. Please try again.')
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">AI Compliance Search</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mb-6">
          Ask questions about sports betting compliance requirements. Get AI-powered answers with citations from regulatory documents.
        </p>
        <div className="flex items-center justify-center space-x-6 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-1">
            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">@</kbd>
            <span>to select jurisdiction</span>
          </div>
          <div className="flex items-center space-x-1">
            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Enter</kbd>
            <span>to search</span>
          </div>
        </div>
      </div>

      {/* Always Visible State Pills */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Jurisdiction:</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setUseMentionInput(!useMentionInput)}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
              title={useMentionInput ? "Switch to legacy state selector" : "Switch to @ mention system"}
            >
              <span>{useMentionInput ? "@ Mentions" : "Legacy Mode"}</span>
              <div className={`w-8 h-4 rounded-full transition-colors ${useMentionInput ? 'bg-blue-500' : 'bg-gray-300'}`}>
                <div className={`w-3 h-3 rounded-full bg-white transition-transform ${useMentionInput ? 'translate-x-4' : 'translate-x-0.5'} mt-0.5`} />
              </div>
            </button>
            {!useMentionInput && (
              <button
                onClick={() => setShowStateSelector(!showStateSelector)}
                className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
              >
                <Settings className="h-4 w-4" />
                <span>Manage States</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Selected States Pills - Show differently based on input mode */}
        {!useMentionInput && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedStates.map(stateCode => (
              <span key={stateCode} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                {getStateDisplayName(stateCode)}
                {selectedStates.length > 1 && (
                  <button
                    onClick={() => setSelectedStates(prev => prev.filter(s => s !== stateCode))}
                    className="ml-2 text-indigo-600 hover:text-indigo-800"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        
        
        {/* Quick State Shortcuts */}
        {recentStates.length > 0 && (
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-gray-500">Quick switch:</span>
            <div className="flex flex-wrap gap-1">
              {recentStates.slice(0, 3).map(stateCode => (
                <button
                  key={`quick-${stateCode}`}
                  onClick={() => {
                    setSelectedStates([stateCode])
                    setMultiSelectMode(false)
                  }}
                  className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {getStateDisplayName(stateCode)}
                </button>
              ))}
              {recentStates.length > 3 && (
                <span className="text-gray-400">+{recentStates.length - 3} more</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* State Management Modal - Only show in legacy mode */}
      {!useMentionInput && showStateSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Manage Jurisdictions</h3>
              <button
                onClick={() => setShowStateSelector(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={multiSelectMode}
                    onChange={(e) => {
                      setMultiSelectMode(e.target.checked)
                      if (!e.target.checked && selectedStates.length > 1) {
                        setSelectedStates([selectedStates[0]])
                      }
                    }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Compare multiple states</span>
                </label>
              </div>
              
              {/* Quick Recent States */}
              {recentStates.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Recent</h4>
                  <div className="flex flex-wrap gap-2">
                    {recentStates.map(stateCode => (
                      <button
                        key={`recent-${stateCode}`}
                        onClick={() => {
                          setSelectedStates([stateCode])
                          setMultiSelectMode(false)
                          setShowStateSelector(false)
                        }}
                        className="px-3 py-1 text-xs rounded-full border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                      >
                        {getStateDisplayName(stateCode)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                {/* Special Options */}
                {SPECIAL_STATE_OPTIONS.map(option => (
                  <button
                    key={option.code}
                    onClick={() => {
                      if (option.code === 'ALL') {
                        setSelectedStates(['ALL'])
                        setMultiSelectMode(false)
                      } else if (option.code === 'MULTIPLE') {
                        setMultiSelectMode(true)
                      }
                      addToRecentStates(option.code)
                      setShowStateSelector(false)
                    }}
                    className={`text-left p-2 text-sm rounded border transition-colors ${
                      selectedStates.includes(option.code)
                        ? 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-300'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {option.name}
                  </button>
                ))}
                
                {/* US States */}
                {US_STATES.map(state => {
                  const isSelected = selectedStates.includes(state.code)
                  return (
                    <button
                      key={state.code}
                      onClick={() => {
                        if (multiSelectMode) {
                          if (isSelected) {
                            setSelectedStates(prev => prev.filter(s => s !== state.code))
                          } else {
                            setSelectedStates(prev => [...prev.filter(s => !['ALL'].includes(s)), state.code])
                          }
                        } else {
                          setSelectedStates([state.code])
                          setShowStateSelector(false)
                        }
                        addToRecentStates(state.code)
                      }}
                      className={`text-left p-2 text-sm rounded border transition-colors ${
                        isSelected
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-300'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {state.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Form with Quick Actions */}
      <div className="mb-8">
        {useMentionInput ? (
          <MentionInput
            value={query}
            onChange={setQuery}
            onSubmit={handleMentionSearch}
            placeholder={getSmartPlaceholder()}
            disabled={loading}
          />
        ) : (
          <form onSubmit={handleSearch}>
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <Search className="h-6 w-6 text-gray-400" />
              </div>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={getSmartPlaceholder()}
                  className="block w-full pl-4 pr-12 py-4 border border-gray-300 dark:border-gray-600 rounded-lg text-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:text-gray-400 dark:disabled:text-gray-500 transition-colors"
                >
                  {loading ? (
                    <div className="h-5 w-5 border-2 border-indigo-300 dark:border-indigo-600 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
          
          {/* Search Tips */}
          {!query && !result && (
            <div className="mt-3 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {useMentionInput ? (
                  <>💡 Try: "What are the licensing requirements @colorado" or "Compare operator fees @california @nevada"</>
                ) : (
                  <>💡 Try asking: "What are the licensing requirements?" or "Compare operator fees"</>
                )}
              </p>
            </div>
          )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-5 w-5 text-red-400">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                <span className="font-medium">Search failed:</span> {error}
              </p>
              <p className="text-sm text-red-600 mt-1">
                Please try a different search term or check your connection.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-6">
          {/* Search Progress */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Searching...</h2>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <div className="h-4 w-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>
                <span>Analyzing documents</span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div className="bg-indigo-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
          
          {/* Answer Skeleton */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Answer</h2>
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 rounded w-4/6"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>

          {/* Citations Skeleton */}
          <div className="bg-white shadow rounded-lg">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Finding Citations</h3>
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-4">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded w-4/5"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-State Search Results */}
      {(multiStateResult || streamingStates.size > 0 || (isStreaming && selectedStates.length > 1)) && !loading && (
        <div className="space-y-6">
          {/* Show streaming progress OR completed results */}
          {(isStreaming && selectedStates.length > 1) || (streamingStates.size > 0) ? (
            <StreamingMultiStateResults
              query={query}
              totalStates={selectedStates.filter(s => s !== 'ALL')}
              streamingStates={streamingStates}
              currentStateAnswers={currentStateAnswers}
              completedStates={multiStateResult?.stateAnswers || []}
              summary={multiStateResult?.summary}
              isStreamingSummary={isStreaming && multiStateResult?.summary !== undefined}
              onCitationClick={openCitation}
              // onStartSummary={handleGenerateSummary}
              followUpQuestion={followUpQuestion}
              onFollowUpChange={setFollowUpQuestion}
              onFollowUpSubmit={handleFollowUpSearch}
              followUpLoading={followUpLoading}
            />
          ) : multiStateResult ? (
            <MultiStateResults
              query={multiStateResult.query}
              stateAnswers={multiStateResult.stateAnswers}
              summary={multiStateResult.summary}
              totalProcessingTime={multiStateResult.totalProcessingTime}
              onCitationClick={openCitation}
            />
          ) : null}
          
          {/* Follow-up Questions for Multi-State */}
          {multiStateResult && !isStreaming && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center mb-4">
                <MessageCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ask a Follow-up Question</h3>
              </div>
              <form onSubmit={handleFollowUpSearch} className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={followUpQuestion}
                    onChange={(e) => setFollowUpQuestion(e.target.value)}
                    placeholder="Ask a follow-up question about these states..."
                    className="block w-full pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={followUpLoading}
                  />
                  <button
                    type="submit"
                    disabled={followUpLoading || !followUpQuestion.trim()}
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
      )}

      {/* Single-State Search Results */}
      {result && !loading && !multiStateResult && (
        <div className="space-y-6">
          {/* Answer */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Answer</h2>
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedStates.length === 1 && selectedStates[0] === 'ALL' 
                    ? 'All States' 
                    : selectedStates.length === 1 
                    ? getStateDisplayName(selectedStates[0])
                    : `${selectedStates.length} States`}
                </span>
              </div>
            </div>
            <div className="prose max-w-none">
              <div className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {isStreaming ? (
                  <div className="streaming-markdown">
                    {renderStreamingMarkdownWithCitations(streamingAnswer)}
                    <span className="inline-block w-2 h-5 bg-gray-400 animate-pulse ml-1" />
                  </div>
                ) : (
                  renderMarkdownWithCitations(result.answer)
                )}
              </div>
            </div>
          </div>

          {/* Citations - Collapsible */}
          {result.citations && result.citations.length > 0 && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <button
                onClick={() => setCitationsVisible(!citationsVisible)}
                className="w-full p-6 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Citations ({result.citations.length})</h3>
                {citationsVisible ? (
                  <ChevronUp className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                )}
              </button>
              {citationsVisible && (
                <div className="px-6 pb-6 border-t border-gray-100 dark:border-gray-700">
                  <div className="pt-4">
                    {(() => {
                      // Check if we should group by state based on both current selection and actual citation states
                      const citationStates = Array.from(new Set(result.citations.map(c => (c.source as any)?.state).filter(Boolean)))
                      const shouldGroupByState = (selectedStates.length > 1 || selectedStates.includes('ALL')) || citationStates.length > 1
                      
                      console.log('🔍 Citation display logic:', {
                        selectedStates,
                        citationStates,
                        shouldGroupByState,
                        totalCitations: result.citations.length
                      })
                      
                      if (shouldGroupByState) {
                        const citationGroups = groupCitationsByState(result.citations)
                        const stateKeys = Object.keys(citationGroups).sort()
                        
                        console.log('📊 Citation groups:', citationGroups)
                        
                        return (
                          <div className="space-y-6">
                            {stateKeys.map(state => {
                              const stateCitations = citationGroups[state]
                              return (
                                <div key={state} className="border border-gray-200 dark:border-blue-500/30 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                                  <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                                    <div className="flex items-center space-x-2">
                                      <MapPin className="h-4 w-4 text-indigo-600" />
                                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                                        {getStateDisplayName(state)} ({stateCitations.length} citation{stateCitations.length !== 1 ? 's' : ''})
                                      </h4>
                                    </div>
                                  </div>
                                  <div className="p-4 space-y-3">
                                    {stateCitations.map((citation, index) => (
                                      <div 
                                        key={citation.id} 
                                        id={`citation-${state}-${index}`}
                                        className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-all duration-200"
                                        onClick={() => openCitation(citation)}
                                      >
                                        <div className="flex items-start justify-between mb-2">
                                          <h5 className="font-medium text-gray-900 dark:text-gray-100 text-sm">{citation.source.title}</h5>
                                          <span className="text-xs text-gray-500 dark:text-gray-400">
                                            Page {citation.source.pageNumber}
                                          </span>
                                        </div>
                                        <p className="text-gray-600 dark:text-gray-300 text-sm mb-2 line-clamp-2">{citation.text}</p>
                                        <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                                          <span>Citation {result.citations.indexOf(citation) + 1}</span>
                                          <span>• Characters {citation.source.startChar}-{citation.source.endChar}</span>
                                          <div className="flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300">
                                            <ExternalLink className="h-3 w-3 mr-1" />
                                            View in Document
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      } else {
                        // Single state - use original layout with state badge
                        return (
                          <div className="space-y-4">
                            {result.citations.map((citation, index) => (
                              <div 
                                key={citation.id} 
                                id={`citation-${index}`}
                                className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-all duration-200"
                                onClick={() => openCitation(citation)}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <h4 className="font-medium text-gray-900 dark:text-gray-100">{citation.source.title}</h4>
                                  <div className="flex items-center space-x-2">
                                    {(citation.source as any)?.state && (
                                      <span className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full">
                                        {getStateDisplayName((citation.source as any)?.state)}
                                      </span>
                                    )}
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      Page {citation.source.pageNumber}
                                    </span>
                                  </div>
                                </div>
                                <p className="text-gray-600 dark:text-gray-300 text-sm mb-2 line-clamp-2">{citation.text}</p>
                                <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                                  <span>Citation {index + 1}</span>
                                  <span>• Characters {citation.source.startChar}-{citation.source.endChar}</span>
                                  <div className="flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300">
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    View in Document
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      }
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Follow-up Questions */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex items-center mb-4">
              <MessageCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ask a Follow-up Question</h3>
            </div>
            <form onSubmit={handleFollowUpSearch} className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={followUpQuestion}
                  onChange={(e) => setFollowUpQuestion(e.target.value)}
                  placeholder="Ask a follow-up question based on this answer..."
                  className="block w-full pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={followUpLoading}
                />
                <button
                  type="submit"
                  disabled={followUpLoading || !followUpQuestion.trim()}
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
        </div>
      )}

      {/* Contextual Example Queries */}
      {!result && !loading && (
        <div className="bg-gradient-to-r from-gray-50 to-indigo-50 dark:from-gray-800 dark:to-indigo-900/20 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-4">
            <div className="h-8 w-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mr-3">
              <svg className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Example Questions
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              "What are the licensing requirements for sports betting operators?",
              "What compliance obligations do operators typically have?", 
              "What are common financial reporting requirements?",
              "What audit procedures are typically required?"
            ].map((example, index) => (
              <button
                key={index}
                onClick={() => setQuery(example)}
                className="text-left p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:shadow-md transition-all duration-200 group"
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    <div className="h-2 w-2 bg-indigo-400 rounded-full group-hover:bg-indigo-600 transition-colors"></div>
                  </div>
                  <p className="ml-3 text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">{example}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Click any question to get started, or type your own question above
            </p>
          </div>
        </div>
      )}

      {/* Citation Viewer - Slide-out panel for better UX */}
      {selectedCitation && viewerDocument && (
        <SlideOutDocumentViewer
          isOpen={true}
          documentId={viewerDocument.id}
          documentTitle={viewerDocument.title}
          viewerType="citation"
          citation={selectedCitation}
          onClose={closeCitationViewer}
          showBackButton={true}
          backButtonLabel="Back to Search"
          onBack={closeCitationViewer}
        />
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SearchContent />
    </Suspense>
  )
}