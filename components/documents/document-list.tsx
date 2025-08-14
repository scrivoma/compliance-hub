'use client'

import { useState, useEffect } from 'react'
import { FileText, Trash2, Edit, Eye, Calendar, User, Tag, Search, Filter, ArrowUpDown, Download, Link, Globe } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { SlideOutDocumentViewer } from './slide-out-document-viewer'

interface Document {
  id: string
  title: string
  description: string | null
  state: string
  fileSize: number
  vectorId: string | null
  processingStatus: string
  processingProgress: number
  processingError: string | null
  sourceUrl: string | null
  sourceType: 'PDF' | 'URL' | 'PDF_URL'
  createdAt: string
  updatedAt: string
  category: {
    id: string
    name: string
  }
}

interface Category {
  id: string
  name: string
}

interface DocumentListProps {
  refreshKey?: number
}

type SortField = 'title' | 'state' | 'category' | 'createdAt' | 'fileSize'
type SortDirection = 'asc' | 'desc'

export function DocumentList({ refreshKey }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  
  // Filtering and search state
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedState, setSelectedState] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [showFilters, setShowFilters] = useState(false)
  
  // Text viewer state
  const [viewingDocument, setViewingDocument] = useState<{id: string, title: string} | null>(null)

  useEffect(() => {
    fetchDocuments()
    fetchCategories()
  }, [refreshKey])

  // Auto-refresh for documents that are still processing
  useEffect(() => {
    const hasProcessingDocs = filteredDocuments.some(doc => 
      doc.processingStatus !== 'COMPLETED' && doc.processingStatus !== 'FAILED'
    )
    
    if (hasProcessingDocs) {
      const interval = setInterval(() => {
        fetchDocuments()
      }, 3000) // Refresh every 3 seconds if there are processing documents
      
      return () => clearInterval(interval)
    }
  }, [filteredDocuments])

  useEffect(() => {
    filterAndSortDocuments()
  }, [documents, searchTerm, selectedState, selectedCategory, sortField, sortDirection])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/documents')
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

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const filterAndSortDocuments = () => {
    let filtered = [...documents]

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(doc => 
        doc.title.toLowerCase().includes(search) ||
        doc.description?.toLowerCase().includes(search) ||
        doc.state.toLowerCase().includes(search) ||
        doc.category?.name.toLowerCase().includes(search)
      )
    }

    // Apply state filter
    if (selectedState) {
      filtered = filtered.filter(doc => doc.state === selectedState)
    }

    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(doc => doc.category?.id === selectedCategory)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'title':
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
        case 'state':
          aValue = a.state
          bValue = b.state
          break
        case 'category':
          aValue = a.category?.name?.toLowerCase() || 'z'
          bValue = b.category?.name?.toLowerCase() || 'z'
          break
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        case 'fileSize':
          aValue = a.fileSize
          bValue = b.fileSize
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    setFilteredDocuments(filtered)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedState('')
    setSelectedCategory('')
    setSortField('createdAt')
    setSortDirection('desc')
  }

  const getUniqueStates = () => {
    return Array.from(new Set(documents.map(doc => doc.state))).sort()
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return
    }

    try {
      setDeleting(id)
      const response = await fetch(`/api/documents?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setDocuments(documents.filter(doc => doc.id !== id))
      } else {
        const data = await response.json()
        alert(`Failed to delete document: ${data.error}`)
      }
    } catch (error) {
      alert('Network error while deleting document')
    } finally {
      setDeleting(null)
    }
  }

  const handleViewDocument = (doc: Document) => {
    setViewingDocument({ id: doc.id, title: doc.title })
  }

  const handleDownloadDocument = async (doc: Document) => {
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
      } else {
        alert('Failed to download document')
      }
    } catch (error) {
      alert('Network error while downloading document')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const SortButton = ({ field, children }: { field: SortField, children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center space-x-1 text-sm font-medium transition-colors ${
        sortField === field 
          ? 'text-indigo-600 dark:text-indigo-400' 
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
      }`}
    >
      <span>{children}</span>
      <ArrowUpDown className="h-3 w-3" />
    </button>
  )

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="text-red-600 dark:text-red-400 text-center">
          <p>{error}</p>
          <button 
            onClick={fetchDocuments}
            className="mt-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        {/* Header with Search and Filters */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Document Library ({filteredDocuments.length} of {documents.length})
              </h3>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="Search documents by title, description, state, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">All States</option>
                    {getUniqueStates().map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">All Categories</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            )}

            {/* Sort Controls */}
            <div className="flex items-center space-x-6 text-sm">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Sort by:</span>
              <SortButton field="title">Title</SortButton>
              <SortButton field="state">State</SortButton>
              <SortButton field="category">Category</SortButton>
              <SortButton field="createdAt">Date</SortButton>
              <SortButton field="fileSize">Size</SortButton>
            </div>
          </div>
        </div>
        
        {filteredDocuments.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            <FileText className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
            {documents.length === 0 ? (
              <>
                <p>No documents uploaded yet.</p>
                <p className="text-sm">Upload your first compliance document to get started.</p>
              </>
            ) : (
              <>
                <p>No documents match your search criteria.</p>
                <p className="text-sm">Try adjusting your filters or search terms.</p>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredDocuments.map((doc) => (
              <div key={doc.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      {doc.sourceType === 'URL' ? (
                        <Globe className="h-5 w-5 text-green-500 dark:text-green-400 flex-shrink-0" title="Scraped from URL" />
                      ) : doc.sourceType === 'PDF_URL' ? (
                        <Link className="h-5 w-5 text-blue-500 dark:text-blue-400 flex-shrink-0" title="Downloaded PDF" />
                      ) : (
                        <FileText className="h-5 w-5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" title="Uploaded PDF" />
                      )}
                      <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 truncate">
                        {doc.title}
                      </h4>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        {doc.state}
                      </span>
                      {doc.processingStatus === 'COMPLETED' ? (
                        <div className="h-2 w-2 rounded-full bg-green-400 dark:bg-green-500" title="Ready for search" />
                      ) : doc.processingStatus === 'FAILED' ? (
                        <div className="h-2 w-2 rounded-full bg-red-400 dark:bg-red-500" title={`Processing failed: ${doc.processingError || 'Unknown error'}`} />
                      ) : (
                        <div className="flex items-center space-x-1">
                          <div className="h-2 w-2 rounded-full bg-yellow-400 dark:bg-yellow-500 animate-pulse" title={`Processing: ${doc.processingProgress}%`} />
                          <span className="text-xs text-gray-500 dark:text-gray-400">{doc.processingProgress}%</span>
                        </div>
                      )}
                    </div>
                    
                    {doc.description && (
                      <p className="text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">{doc.description}</p>
                    )}
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <Tag className="h-4 w-4 mr-1" />
                        {doc.category?.name || 'No Category'}
                      </div>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                      </div>
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 mr-1" />
                        {formatFileSize(doc.fileSize)}
                      </div>
                      {doc.sourceUrl && (
                        <a
                          href={doc.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                          title="View source"
                        >
                          <Globe className="h-4 w-4 mr-1" />
                          Source
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleViewDocument(doc)}
                      className="inline-flex items-center p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      title="View Document"
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => handleDownloadDocument(doc)}
                      className="inline-flex items-center p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      title="Download PDF"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={() => handleDelete(doc.id, doc.title)}
                      disabled={deleting === doc.id}
                      className="inline-flex items-center p-2 border border-red-300 dark:border-red-600 rounded-md shadow-sm text-sm font-medium text-red-700 dark:text-red-400 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-950 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                      title="Delete Document"
                    >
                      {deleting === doc.id ? (
                        <div className="h-4 w-4 border-2 border-red-300 dark:border-red-600 border-t-red-600 dark:border-t-red-400 rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Document Viewer - Slide-out panel */}
      {viewingDocument && (
        <SlideOutDocumentViewer
          isOpen={true}
          documentId={viewingDocument.id}
          documentTitle={viewingDocument.title}
          viewerType="text"
          onClose={() => setViewingDocument(null)}
        />
      )}
    </>
  )
}