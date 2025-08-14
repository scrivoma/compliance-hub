'use client'

import { useState, useEffect } from 'react'
import { FileText, LayoutDashboard, Library, ToggleLeft, ToggleRight, Eye, FileType } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { SlideOutDocumentViewer } from './slide-out-document-viewer'
import { DocumentMentionInput } from './DocumentMentionInput'
import { DocumentViewOptions, sortDocuments, ViewMode, SortField, SortOrder } from './document-view-options'
import { type DocumentParseResult } from '@/lib/utils/document-mention-parser'
import { EnhancedDocumentCard } from './enhanced-document-card'
import { DocumentTableView } from './document-table-view'
import { DocumentDashboard } from './document-dashboard'
import { trackDocumentView } from '@/lib/tracking'

interface Document {
  id: string
  title: string
  description: string | null
  state: string
  fileSize: number
  processingStatus: string
  processingProgress: number
  createdAt: string
  sourceType: string
  hasGeneratedPdf: boolean
  pdfGeneratedAt: string | null
  content: string | null
  verticals: Array<{
    vertical: {
      id: string
      name: string
      displayName: string
    }
  }>
  documentTypes: Array<{
    documentType: {
      id: string
      name: string
      displayName: string
    }
  }>
}

interface Vertical {
  id: string
  name: string
  displayName: string
}

interface DocumentType {
  id: string
  name: string
  displayName: string
}

interface ModernDocumentLibraryProps {
  refreshKey?: number
  viewDocumentId?: string | null
}

type MainView = 'dashboard' | 'documents'

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

export function ModernDocumentLibrary({ refreshKey, viewDocumentId }: ModernDocumentLibraryProps) {
  const { data: session } = useSession()
  const [documents, setDocuments] = useState<Document[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([])
  const [verticals, setVerticals] = useState<Vertical[]>([])
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Main view state
  const [mainView, setMainView] = useState<MainView>('dashboard')
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedState, setSelectedState] = useState<string>('')
  const [selectedVerticals, setSelectedVerticals] = useState<string[]>([])
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  
  // New unified search states
  const [unifiedSearchValue, setUnifiedSearchValue] = useState('')
  const [activeFilters, setActiveFilters] = useState<DocumentParseResult>({
    cleanQuery: '',
    stateMentions: [],
    categoryMentions: [],
    stateCodes: [],
    categoryIds: [],
    verticalIds: [],
    documentTypeIds: []
  })
  
  // Search mode toggle
  const [searchMode, setSearchMode] = useState<'mentions' | 'legacy'>('mentions')
  
  const handleModeToggle = () => {
    const newMode = searchMode === 'mentions' ? 'legacy' : 'mentions'
    setSearchMode(newMode)
    
    // Clear filters when switching modes to avoid confusion
    if (newMode === 'mentions') {
      // Switching to mentions mode - clear legacy filters
      setSearchTerm('')
      setSelectedState('')
      setSelectedVerticals([])
      setSelectedDocTypes([])
      setShowFilters(false)
    } else {
      // Switching to legacy mode - clear mentions filters
      setUnifiedSearchValue('')
      setActiveFilters({
        cleanQuery: '',
        stateMentions: [],
        categoryMentions: [],
        stateCodes: [],
        categoryIds: [],
        verticalIds: [],
        documentTypeIds: []
      })
    }
  }
  
  // View options
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [sortConfig, setSortConfig] = useState<{ field: SortField; order: SortOrder }>({
    field: 'createdAt',
    order: 'desc'
  })
  
  // Favorites
  const [favoriteDocuments, setFavoriteDocuments] = useState<string[]>([])
  const [favoriteStates, setFavoriteStates] = useState<string[]>([])
  
  // Viewer state
  const [viewingDocument, setViewingDocument] = useState<{
    id: string
    title: string
    sourceType: string
    hasGeneratedPdf: boolean
    content: string | null
  } | null>(null)
  const [viewerType, setViewerType] = useState<'text' | 'pdf'>('text')

  useEffect(() => {
    fetchDocuments()
    fetchFilters()
    loadUserPreferences()
  }, [refreshKey])

  useEffect(() => {
    filterDocuments()
  }, [documents, searchTerm, selectedState, selectedVerticals, selectedDocTypes, activeFilters, searchMode])

  // Handle viewDocumentId from URL parameter
  useEffect(() => {
    if (viewDocumentId && documents.length > 0) {
      const docToView = documents.find(doc => doc.id === viewDocumentId)
      if (docToView) {
        handleView(docToView)
      }
    }
  }, [viewDocumentId, documents])

  // Auto-refresh for processing documents - only for admin users
  useEffect(() => {
    const hasProcessingDocs = filteredDocuments.some(doc => 
      doc.processingStatus !== 'COMPLETED' && doc.processingStatus !== 'FAILED'
    )
    
    // Only auto-refresh for admin users to avoid disrupting regular users
    const isAdmin = session?.user?.role === 'ADMIN'
    
    if (hasProcessingDocs && isAdmin) {
      const interval = setInterval(() => {
        fetchDocuments()
      }, 3000)
      
      return () => clearInterval(interval)
    }
  }, [filteredDocuments, session?.user?.role])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/documents/v2')
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents)
      } else {
        setError('Failed to fetch documents')
      }
    } catch (error) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const fetchFilters = async () => {
    try {
      const [verticalsRes, typesRes] = await Promise.all([
        fetch('/api/verticals'),
        fetch('/api/document-types')
      ])
      
      if (verticalsRes.ok) {
        const data = await verticalsRes.json()
        setVerticals(data.verticals)
      }
      
      if (typesRes.ok) {
        const data = await typesRes.json()
        setDocumentTypes(data.documentTypes)
      }
    } catch (error) {
      console.error('Failed to fetch filters:', error)
    }
  }

  const loadUserPreferences = async () => {
    // Load bookmarks from API
    try {
      const response = await fetch('/api/user/bookmarks')
      if (response.ok) {
        const data = await response.json()
        const bookmarkIds = data.bookmarks.map((bookmark: any) => bookmark.documentId)
        setFavoriteDocuments(bookmarkIds)
      } else {
        // If API fails, start with empty bookmarks
        setFavoriteDocuments([])
      }
    } catch (error) {
      console.error('Error loading bookmarks:', error)
      // Start with empty bookmarks if API fails
      setFavoriteDocuments([])
    }
    
    const storedStateFavorites = localStorage.getItem('stateFavorites')
    if (storedStateFavorites) {
      setFavoriteStates(JSON.parse(storedStateFavorites))
    }
    
    // Load view preferences
    const storedViewMode = localStorage.getItem('documentViewMode')
    if (storedViewMode) {
      setViewMode(storedViewMode as ViewMode)
    }
  }

  const filterDocuments = () => {
    let filtered = [...documents]

    if (searchMode === 'mentions') {
      // @Mentions Mode - use unified search filters
      
      // Search query filter
      if (activeFilters.cleanQuery) {
        const search = activeFilters.cleanQuery.toLowerCase()
        filtered = filtered.filter(doc => 
          doc.title.toLowerCase().includes(search) ||
          doc.description?.toLowerCase().includes(search) ||
          doc.state.toLowerCase().includes(search) ||
          STATE_NAMES[doc.state]?.toLowerCase().includes(search)
        )
      }

      // Hierarchical filtering with proper AND/OR logic
      if (activeFilters.stateCodes.length > 0 || activeFilters.verticalIds.length > 0 || activeFilters.documentTypeIds.length > 0) {
        const statesToFilter = activeFilters.stateCodes
        const verticalsToFilter = activeFilters.verticalIds
        const docTypesToFilter = activeFilters.documentTypeIds
        
        filtered = filtered.filter(doc => {
          // Get document categories by name (since our constants use names as IDs)
          const docVerticalNames = doc.verticals.map(v => v.vertical.name)
          const docTypeNames = doc.documentTypes.map(t => t.documentType.name)
          
          // Apply AND logic between groups, OR logic within groups
          let passesFilter = true
          
          // States filter (OR within states)
          if (statesToFilter.length > 0) {
            const matchesState = statesToFilter.includes(doc.state)
            passesFilter = passesFilter && matchesState
          }
          
          // Verticals filter (OR within verticals)  
          if (verticalsToFilter.length > 0) {
            const matchesVertical = docVerticalNames.some(name => verticalsToFilter.includes(name))
            passesFilter = passesFilter && matchesVertical
          }
          
          // Document Types filter (OR within document types)
          if (docTypesToFilter.length > 0) {
            const matchesDocType = docTypeNames.some(name => docTypesToFilter.includes(name))
            passesFilter = passesFilter && matchesDocType
          }
          
          return passesFilter
        })
      }
    } else {
      // Legacy Mode - use traditional filters
      
      // Search query filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        filtered = filtered.filter(doc => 
          doc.title.toLowerCase().includes(search) ||
          doc.description?.toLowerCase().includes(search) ||
          doc.state.toLowerCase().includes(search) ||
          STATE_NAMES[doc.state]?.toLowerCase().includes(search)
        )
      }

      // State filter
      if (selectedState) {
        filtered = filtered.filter(doc => doc.state === selectedState)
      }

      // Verticals filter
      if (selectedVerticals.length > 0) {
        filtered = filtered.filter(doc => 
          doc.verticals.some(v => selectedVerticals.includes(v.vertical.id))
        )
      }

      // Document types filter
      if (selectedDocTypes.length > 0) {
        filtered = filtered.filter(doc => 
          doc.documentTypes.some(t => selectedDocTypes.includes(t.documentType.id))
        )
      }
    }

    // Sort documents
    filtered = sortDocuments(filtered, sortConfig)

    setFilteredDocuments(filtered)
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedState('')
    setSelectedVerticals([])
    setSelectedDocTypes([])
    setUnifiedSearchValue('')
    setActiveFilters({
      cleanQuery: '',
      stateMentions: [],
      categoryMentions: [],
      stateCodes: [],
      categoryIds: [],
      verticalIds: [],
      documentTypeIds: []
    })
  }

  const toggleVertical = (verticalId: string) => {
    setSelectedVerticals(prev => 
      prev.includes(verticalId) 
        ? prev.filter(id => id !== verticalId)
        : [...prev, verticalId]
    )
  }

  const toggleDocType = (typeId: string) => {
    setSelectedDocTypes(prev => 
      prev.includes(typeId) 
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    )
  }

  const toggleDocumentFavorite = async (doc: Document) => {
    const isCurrentlyFavorite = favoriteDocuments.includes(doc.id)
    
    try {
      if (isCurrentlyFavorite) {
        // Remove from API
        const response = await fetch(`/api/user/bookmarks?documentId=${doc.id}`, {
          method: 'DELETE'
        })
        
        if (response.ok) {
          // Update local state only if API call succeeds
          const newFavorites = favoriteDocuments.filter(id => id !== doc.id)
          setFavoriteDocuments(newFavorites)
        } else {
          console.error('Failed to remove bookmark:', await response.text())
        }
      } else {
        // Add to API
        const response = await fetch('/api/user/bookmarks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            documentId: doc.id,
            title: doc.title,
            state: doc.state,
            type: doc.documentTypes[0]?.documentType?.displayName || 'Document'
          })
        })
        
        if (response.ok) {
          // Update local state only if API call succeeds
          const newFavorites = [...favoriteDocuments, doc.id]
          setFavoriteDocuments(newFavorites)
        } else {
          const errorText = await response.text()
          console.error('Failed to add bookmark:', errorText)
          // If it's already bookmarked, just update local state
          if (errorText.includes('already bookmarked')) {
            const newFavorites = [...favoriteDocuments, doc.id]
            setFavoriteDocuments(newFavorites)
          }
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }

  const toggleStateFavorite = (state: string) => {
    const newFavorites = favoriteStates.includes(state)
      ? favoriteStates.filter(s => s !== state)
      : [...favoriteStates, state]
    
    setFavoriteStates(newFavorites)
    localStorage.setItem('stateFavorites', JSON.stringify(newFavorites))
  }


  const handleDownload = async (doc: Document) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}/pdf`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${doc.title}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Download error:', error)
    }
  }

  const handleView = (doc: Document) => {
    setViewingDocument({ 
      id: doc.id, 
      title: doc.title,
      sourceType: doc.sourceType,
      hasGeneratedPdf: doc.hasGeneratedPdf,
      content: doc.content
    })
    
    // Set default viewer type based on document capabilities
    if (doc.sourceType === 'PDF' || doc.sourceType === 'PDF_URL' || (doc.sourceType === 'URL' && doc.hasGeneratedPdf)) {
      setViewerType('pdf') // Default to PDF for PDF documents and URL documents with generated PDFs
    } else {
      setViewerType('text') // Default to text for other documents
    }
    
    // Track document view
    const documentType = doc.documentTypes.length > 0 ? doc.documentTypes[0].documentType.displayName : 'Document'
    trackDocumentView(doc.id, doc.title, doc.state, documentType)
  }

  const activeFilterCount = searchMode === 'mentions' 
    ? activeFilters.stateCodes.length + activeFilters.verticalIds.length + activeFilters.documentTypeIds.length
    : (selectedState ? 1 : 0) + selectedVerticals.length + selectedDocTypes.length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-indigo-300 dark:border-indigo-600 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading documents...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* Main Navigation */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setMainView('dashboard')}
            className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
              mainView === 'dashboard'
                ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <LayoutDashboard className="h-5 w-5 mr-2" />
            Dashboard
          </button>
          <button
            onClick={() => setMainView('documents')}
            className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
              mainView === 'documents'
                ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Library className="h-5 w-5 mr-2" />
            Documents
          </button>
        </div>

        {/* Dashboard View */}
        {mainView === 'dashboard' && (
          <DocumentDashboard
            documents={filteredDocuments}
            selectedState={selectedState}
            onStateChange={setSelectedState}
            onView={handleView as any}
            onDownload={handleDownload as any}
          />
        )}

        {/* Documents View */}
        {mainView === 'documents' && (
          <div className="space-y-6">
            {/* Search & Controls Header */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Search & Filter Documents</h3>
                
                {/* Mode Toggle */}
                <div className="flex items-center space-x-3">
                  <span className={`text-sm font-medium ${searchMode === 'mentions' ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'}`}>
                    @Mentions
                  </span>
                  <button
                    onClick={handleModeToggle}
                    className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    style={{
                      backgroundColor: searchMode === 'mentions' ? '#4f46e5' : '#d1d5db'
                    }}
                  >
                    <span 
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        searchMode === 'mentions' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className={`text-sm font-medium ${searchMode === 'legacy' ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'}`}>
                    Legacy
                  </span>
                </div>
              </div>

              {/* @Mentions Mode */}
              {searchMode === 'mentions' && (
                <>
                  <DocumentMentionInput
                    value={unifiedSearchValue}
                    onChange={setUnifiedSearchValue}
                    onFilter={setActiveFilters}
                    placeholder="Search documents... Use @state (e.g., @michigan) and #category (e.g., #regulation)"
                    className="w-full"
                  />
                  
                  {/* Filter Summary */}
                  {(activeFilters.stateCodes.length > 0 || activeFilters.verticalIds.length > 0 || activeFilters.documentTypeIds.length > 0 || activeFilters.cleanQuery) && (
                    <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {activeFilters.cleanQuery && (
                          <span>Searching for: <span className="font-medium">{activeFilters.cleanQuery}</span></span>
                        )}
                        {activeFilters.stateCodes.length > 0 && (
                          <span className="ml-2">• {activeFilters.stateCodes.length} state{activeFilters.stateCodes.length !== 1 ? 's' : ''}</span>
                        )}
                        {activeFilters.verticalIds.length > 0 && (
                          <span className="ml-2">• {activeFilters.verticalIds.length} vertical{activeFilters.verticalIds.length !== 1 ? 's' : ''}</span>
                        )}
                        {activeFilters.documentTypeIds.length > 0 && (
                          <span className="ml-2">• {activeFilters.documentTypeIds.length} document type{activeFilters.documentTypeIds.length !== 1 ? 's' : ''}</span>
                        )}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Legacy Mode */}
              {searchMode === 'legacy' && (
                <div className="space-y-4">
                  {/* Legacy Search Bar */}
                  <div className="flex items-center space-x-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search documents..."
                        className="block w-full pl-4 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                      />
                    </div>
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`inline-flex items-center px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium transition-colors ${
                        showFilters 
                          ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-600' 
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      Filters
                      {activeFilterCount > 0 && (
                        <span className="ml-2 bg-indigo-600 dark:bg-indigo-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {activeFilterCount}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Advanced Filters Panel */}
                  {showFilters && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                      <div className="space-y-6">
                        {/* State Filter */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">State</h4>
                          <select
                            value={selectedState}
                            onChange={(e) => setSelectedState(e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          >
                            <option value="">All States</option>
                            {Object.entries(STATE_NAMES).map(([code, name]) => (
                              <option key={code} value={code}>{name} ({code})</option>
                            ))}
                          </select>
                        </div>

                        {/* Verticals Filter */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Verticals</h4>
                          <div className="flex flex-wrap gap-2">
                            {verticals.map(vertical => (
                              <button
                                key={vertical.id}
                                onClick={() => toggleVertical(vertical.id)}
                                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                                  selectedVerticals.includes(vertical.id)
                                    ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-600'
                                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                }`}
                              >
                                {vertical.displayName}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Document Types Filter */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Document Types</h4>
                          <div className="flex flex-wrap gap-2">
                            {documentTypes.map(type => (
                              <button
                                key={type.id}
                                onClick={() => toggleDocType(type.id)}
                                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                                  selectedDocTypes.includes(type.id)
                                    ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-600'
                                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                }`}
                              >
                                {type.displayName}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Clear Filters */}
                        {activeFilterCount > 0 && (
                          <div>
                            <button
                              onClick={clearFilters}
                              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
                            >
                              Clear all filters
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* View Options & Results Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* View Mode Buttons */}
                <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 p-1 bg-white dark:bg-gray-800">
                  <button
                    onClick={() => {
                      setViewMode('card')
                      localStorage.setItem('documentViewMode', 'card')
                    }}
                    className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'card'
                        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    <div className="grid grid-cols-2 gap-0.5 h-3 w-3 mr-2">
                      <div className="bg-current rounded-sm"></div>
                      <div className="bg-current rounded-sm"></div>
                      <div className="bg-current rounded-sm"></div>
                      <div className="bg-current rounded-sm"></div>
                    </div>
                    Cards
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('list')
                      localStorage.setItem('documentViewMode', 'list')
                    }}
                    className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'list'
                        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    <div className="flex flex-col space-y-0.5 h-3 w-3 mr-2">
                      <div className="bg-current h-0.5 w-full rounded-sm"></div>
                      <div className="bg-current h-0.5 w-full rounded-sm"></div>
                      <div className="bg-current h-0.5 w-full rounded-sm"></div>
                    </div>
                    List
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('table')
                      localStorage.setItem('documentViewMode', 'table')
                    }}
                    className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'table'
                        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    <div className="grid grid-cols-3 gap-0.5 h-3 w-3 mr-2">
                      <div className="bg-current rounded-sm"></div>
                      <div className="bg-current rounded-sm"></div>
                      <div className="bg-current rounded-sm"></div>
                      <div className="bg-current rounded-sm"></div>
                      <div className="bg-current rounded-sm"></div>
                      <div className="bg-current rounded-sm"></div>
                    </div>
                    Table
                  </button>
                </div>

                {/* Sort Options */}
                <select
                  value={`${sortConfig.field}-${sortConfig.order}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-') as [SortField, SortOrder]
                    setSortConfig({ field, order })
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="createdAt-desc">Sort by Date (Newest)</option>
                  <option value="createdAt-asc">Sort by Date (Oldest)</option>
                  <option value="title-asc">Sort by Title (A-Z)</option>
                  <option value="title-desc">Sort by Title (Z-A)</option>
                  <option value="state-asc">Sort by State (A-Z)</option>
                  <option value="state-desc">Sort by State (Z-A)</option>
                </select>
              </div>

              {/* Results Count */}
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredDocuments.length} of {documents.length} documents
                {filteredDocuments.length !== documents.length && <span className="text-indigo-600 dark:text-indigo-400 ml-1">(filtered)</span>}
              </div>
            </div>

            {/* Document List */}
            {filteredDocuments.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">No documents match your criteria</p>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="mt-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm font-medium"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Table View */}
                {viewMode === 'table' && (
                  <DocumentTableView
                    documents={filteredDocuments}
                    favoriteDocuments={favoriteDocuments}
                    onView={handleView}
                    onDownload={handleDownload}
                    onToggleFavorite={toggleDocumentFavorite}
                  />
                )}

                {/* Card and List Views */}
                {(viewMode === 'card' || viewMode === 'list') && (
                  <div className={viewMode === 'card' 
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' 
                    : 'space-y-2'
                  }>
                    {filteredDocuments.map((doc) => (
                      <EnhancedDocumentCard
                        key={doc.id}
                        document={doc}
                        isFavorite={favoriteDocuments.includes(doc.id)}
                        onView={handleView}
                        onDownload={handleDownload}
                        onToggleFavorite={toggleDocumentFavorite}
                        compact={viewMode === 'list'}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Document Viewer - Slide-out panel */}
      {viewingDocument && (
        <SlideOutDocumentViewer
          isOpen={true}
          documentId={viewingDocument.id}
          documentTitle={viewingDocument.title}
          viewerType={viewerType}
          onClose={() => setViewingDocument(null)}
          showViewerTypeToggle={viewingDocument.sourceType === 'PDF' || viewingDocument.sourceType === 'PDF_URL' || (viewingDocument.sourceType === 'URL' && !!viewingDocument.content)}
          onViewerTypeChange={setViewerType}
          documentSourceType={viewingDocument.sourceType}
          hasGeneratedPdf={viewingDocument.hasGeneratedPdf}
        />
      )}
    </>
  )
}