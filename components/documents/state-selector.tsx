'use client'

import { useState, useEffect } from 'react'
import { MapPin, ChevronDown, Star, Clock } from 'lucide-react'

interface Document {
  id: string
  state: string
  processingStatus: string
  createdAt: string
}

interface StateInfo {
  code: string
  name: string
  totalDocs: number
  recentDocs: number
  processingDocs: number
  isFavorite: boolean
}

interface StateSelectorProps {
  documents: Document[]
  selectedState: string
  onStateChange: (state: string) => void
  favorites: string[]
  onToggleFavorite: (state: string) => void
}

// State abbreviation to full name mapping
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

export function StateSelector({ 
  documents, 
  selectedState, 
  onStateChange, 
  favorites, 
  onToggleFavorite 
}: StateSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [stateStats, setStateStats] = useState<StateInfo[]>([])

  useEffect(() => {
    calculateStateStats()
  }, [documents, favorites])

  const calculateStateStats = () => {
    const stateMap = new Map<string, StateInfo>()
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Initialize all states present in documents
    documents.forEach(doc => {
      if (!stateMap.has(doc.state)) {
        stateMap.set(doc.state, {
          code: doc.state,
          name: STATE_NAMES[doc.state] || doc.state,
          totalDocs: 0,
          recentDocs: 0,
          processingDocs: 0,
          isFavorite: favorites.includes(doc.state)
        })
      }
      
      const state = stateMap.get(doc.state)!
      state.totalDocs++
      
      if (new Date(doc.createdAt) > sevenDaysAgo) {
        state.recentDocs++
      }
      
      if (doc.processingStatus !== 'COMPLETED' && doc.processingStatus !== 'FAILED') {
        state.processingDocs++
      }
    })

    // Sort states: favorites first, then by total docs, then alphabetically
    const sortedStates = Array.from(stateMap.values()).sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1
      if (!a.isFavorite && b.isFavorite) return 1
      if (a.totalDocs !== b.totalDocs) return b.totalDocs - a.totalDocs
      return a.name.localeCompare(b.name)
    })

    setStateStats(sortedStates)
  }

  const handleStateSelect = (stateCode: string) => {
    onStateChange(stateCode === selectedState ? '' : stateCode)
    setIsExpanded(false)
  }

  const favoriteStates = stateStats.filter(state => state.isFavorite)
  const regularStates = stateStats.filter(state => !state.isFavorite)
  const selectedStateInfo = stateStats.find(state => state.code === selectedState)

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <MapPin className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">State Navigator</h2>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Current Selection */}
      <div className="px-6 py-4">
        {selectedState ? (
          <div className="bg-indigo-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-indigo-900">
                  {selectedStateInfo?.name} ({selectedState})
                </h3>
                <div className="flex items-center space-x-4 mt-1 text-sm text-indigo-700">
                  <span>{selectedStateInfo?.totalDocs} documents</span>
                  {(selectedStateInfo?.recentDocs || 0) > 0 && (
                    <span className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{selectedStateInfo?.recentDocs || 0} recent</span>
                    </span>
                  )}
                  {(selectedStateInfo?.processingDocs || 0) > 0 && (
                    <span className="text-yellow-600">
                      {selectedStateInfo?.processingDocs || 0} processing
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onToggleFavorite(selectedState)}
                  className={`p-1 rounded ${
                    selectedStateInfo?.isFavorite 
                      ? 'text-yellow-500 hover:text-yellow-600' 
                      : 'text-gray-400 hover:text-yellow-500'
                  }`}
                  title={selectedStateInfo?.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star className={`h-4 w-4 ${selectedStateInfo?.isFavorite ? 'fill-current' : ''}`} />
                </button>
                <button
                  onClick={() => onStateChange('')}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  View All States
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500">Select a state to view its documents</p>
            <p className="text-sm text-gray-400 mt-1">
              {stateStats.length} states • {documents.length} total documents
            </p>
          </div>
        )}
      </div>

      {/* State List */}
      {isExpanded && (
        <div className="px-6 pb-6">
          {/* Favorite States */}
          {favoriteStates.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center space-x-2">
                <Star className="h-4 w-4 text-yellow-500 fill-current" />
                <span>Favorite States</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {favoriteStates.map((state) => (
                  <button
                    key={state.code}
                    onClick={() => handleStateSelect(state.code)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      selectedState === state.code
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{state.name}</div>
                        <div className="text-xs text-gray-500">{state.code}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{state.totalDocs}</div>
                        <div className="text-xs text-gray-500">docs</div>
                      </div>
                    </div>
                    {(state.recentDocs > 0 || state.processingDocs > 0) && (
                      <div className="mt-2 flex items-center space-x-2 text-xs">
                        {state.recentDocs > 0 && (
                          <span className="text-blue-600 flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{state.recentDocs}</span>
                          </span>
                        )}
                        {state.processingDocs > 0 && (
                          <span className="text-yellow-600">{state.processingDocs} processing</span>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All States */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">All States</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {regularStates.map((state) => (
                <button
                  key={state.code}
                  onClick={() => handleStateSelect(state.code)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    selectedState === state.code
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{state.name}</div>
                      <div className="text-xs text-gray-500">{state.code}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{state.totalDocs}</div>
                      <div className="text-xs text-gray-500">docs</div>
                    </div>
                  </div>
                  {(state.recentDocs > 0 || state.processingDocs > 0) && (
                    <div className="mt-2 flex items-center space-x-2 text-xs">
                      {state.recentDocs > 0 && (
                        <span className="text-blue-600 flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>{state.recentDocs}</span>
                        </span>
                      )}
                      {state.processingDocs > 0 && (
                        <span className="text-yellow-600">{state.processingDocs} processing</span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}