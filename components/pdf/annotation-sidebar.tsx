'use client'

import { useState, useEffect } from 'react'
import { 
  MessageSquare, 
  User, 
  Calendar, 
  Trash2, 
  Edit3, 
  Search, 
  Filter,
  ChevronDown,
  ChevronRight,
  Palette,
  MapPin,
  Eye
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { formatDistanceToNow } from 'date-fns'

interface AnnotationData {
  id: string
  content: {
    text: string
    quote: string
  }
  position: {
    boundingRect: {
      x1: number
      y1: number
      x2: number
      y2: number
      width: number
      height: number
      pageNumber: number
    }
    rects: Array<{
      x1: number
      y1: number
      x2: number
      y2: number
      width: number
      height: number
      pageNumber: number
    }>
  }
  comment: string | null
  color: string
  createdAt: string
  updatedAt: string
  user: {
    id: string
    name: string
  }
}

interface CitationData {
  id: string
  text: string
  pageNumber: number
  startChar: number
  endChar: number
  coordinates: {
    page: number
    x: number
    y: number
    width: number
    height: number
  }
}

interface AnnotationSidebarProps {
  documentId: string
  annotations: AnnotationData[]
  onAnnotationClick?: (annotation: AnnotationData) => void
  onAnnotationUpdate?: (annotationId: string, data: { comment?: string; color?: string }) => void
  onAnnotationDelete?: (annotationId: string) => void
  className?: string
  // Citation support
  citationData?: CitationData
  onCitationClick?: (citationId: string) => void
  viewMode?: 'annotation' | 'search' | 'both'
}

const COLOR_OPTIONS = [
  { name: 'Yellow', value: '#FFFF00' },
  { name: 'Green', value: '#90EE90' },
  { name: 'Blue', value: '#87CEEB' },
  { name: 'Pink', value: '#FFB6C1' },
  { name: 'Orange', value: '#FFA500' },
  { name: 'Purple', value: '#DDA0DD' }
]

export function AnnotationSidebar({
  documentId,
  annotations,
  onAnnotationClick,
  onAnnotationUpdate,
  onAnnotationDelete,
  className = '',
  citationData,
  onCitationClick,
  viewMode = 'annotation'
}: AnnotationSidebarProps) {
  const { data: session } = useSession()
  const [searchText, setSearchText] = useState('')
  const [filterByUser, setFilterByUser] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'page'>('newest')
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null)
  const [editComment, setEditComment] = useState('')
  const [editColor, setEditColor] = useState('')
  const [expandedAnnotations, setExpandedAnnotations] = useState<Set<string>>(new Set())

  // Get unique users for filter
  const uniqueUsers = Array.from(
    new Set(annotations.map(a => a.user.id))
  ).map(userId => annotations.find(a => a.user.id === userId)?.user).filter(Boolean) as { id: string; name: string }[]

  // Filter and sort annotations
  const filteredAnnotations = annotations
    .filter(annotation => {
      // Filter by search text
      if (searchText) {
        const searchLower = searchText.toLowerCase()
        const matchesComment = annotation.comment?.toLowerCase().includes(searchLower)
        const matchesContent = annotation.content.text.toLowerCase().includes(searchLower)
        if (!matchesComment && !matchesContent) return false
      }

      // Filter by user
      if (filterByUser !== 'all' && annotation.user.id !== filterByUser) {
        return false
      }

      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'page':
          return a.position.boundingRect.pageNumber - b.position.boundingRect.pageNumber
        default:
          return 0
      }
    })

  const handleEditStart = (annotation: AnnotationData) => {
    setEditingAnnotation(annotation.id)
    setEditComment(annotation.comment || '')
    setEditColor(annotation.color)
  }

  const handleEditSave = (annotationId: string) => {
    if (onAnnotationUpdate) {
      onAnnotationUpdate(annotationId, {
        comment: editComment,
        color: editColor
      })
    }
    setEditingAnnotation(null)
    setEditComment('')
    setEditColor('')
  }

  const handleEditCancel = () => {
    setEditingAnnotation(null)
    setEditComment('')
    setEditColor('')
  }

  const toggleExpanded = (annotationId: string) => {
    const newExpanded = new Set(expandedAnnotations)
    if (newExpanded.has(annotationId)) {
      newExpanded.delete(annotationId)
    } else {
      newExpanded.add(annotationId)
    }
    setExpandedAnnotations(newExpanded)
  }

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  const isOwner = (annotation: AnnotationData) => {
    return session?.user?.id === annotation.user.id
  }

  return (
    <div className={`bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          {viewMode === 'search' && citationData 
            ? 'Search Citation'
            : viewMode === 'both' && citationData
            ? `Citation + ${annotations.length} Annotations`
            : `Annotations (${annotations.length})`
          }
        </h3>
        
        {/* Search */}
        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Search annotations..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
        </div>

        {/* Filters */}
        <div className="flex space-x-2">
          <select
            value={filterByUser}
            onChange={(e) => setFilterByUser(e.target.value)}
            className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Users</option>
            {uniqueUsers.map(user => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'page')}
            className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="page">By Page</option>
          </select>
        </div>
      </div>

      {/* Citation Section (if present) */}
      {citationData && (viewMode === 'search' || viewMode === 'both') && (
        <div className="border-b border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center text-sm font-medium text-yellow-800 dark:text-yellow-200">
                <MapPin className="h-4 w-4 mr-1" />
                <span>Search Citation - Page {citationData.pageNumber}</span>
              </div>
              <button
                onClick={() => onCitationClick?.(citationData.id)}
                className="p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200 transition-colors"
                title="Go to citation"
              >
                <Eye className="h-4 w-4" />
              </button>
            </div>
            <div className="bg-yellow-100 dark:bg-yellow-800 rounded p-2 border border-yellow-200 dark:border-yellow-600">
              <p className="text-sm text-yellow-900 dark:text-yellow-100 italic">
                "{citationData.text.length > 150 
                  ? citationData.text.substring(0, 150) + '...' 
                  : citationData.text}"
              </p>
            </div>
            <div className="mt-2 text-xs text-yellow-700 dark:text-yellow-300">
              Characters {citationData.startChar}-{citationData.endChar}
            </div>
          </div>
        </div>
      )}

      {/* Annotations List */}
      <div className="flex-1 overflow-y-auto">
        {filteredAnnotations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">
              {annotations.length === 0 
                ? 'No annotations yet. Start highlighting text to add annotations.'
                : 'No annotations match your search criteria.'
              }
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {filteredAnnotations.map((annotation) => {
              const isExpanded = expandedAnnotations.has(annotation.id)
              const isEditing = editingAnnotation === annotation.id
              
              return (
                <div
                  key={annotation.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:shadow-sm transition-shadow cursor-pointer bg-white dark:bg-gray-800"
                  onClick={() => onAnnotationClick?.(annotation)}
                  style={{ borderLeftColor: annotation.color, borderLeftWidth: '4px' }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <User className="h-3 w-3 mr-1" />
                      <span className="font-medium">{annotation.user.name}</span>
                      <span className="mx-1">•</span>
                      <span>Page {annotation.position.boundingRect.pageNumber}</span>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleExpanded(annotation.id)
                        }}
                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </button>
                      
                      {isOwner(annotation) && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditStart(annotation)
                            }}
                            className="p-1 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm('Delete this annotation?')) {
                                onAnnotationDelete?.(annotation.id)
                              }
                            }}
                            className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="text-sm">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded p-2 mb-2">
                      <p className="text-gray-700 dark:text-gray-300 italic">
                        "{isExpanded ? annotation.content.text : truncateText(annotation.content.text, 100)}"
                      </p>
                    </div>

                    {/* Comment */}
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editComment}
                          onChange={(e) => setEditComment(e.target.value)}
                          placeholder="Add a comment..."
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-sm resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          rows={3}
                          onClick={(e) => e.stopPropagation()}
                        />
                        
                        {/* Color picker */}
                        <div className="flex items-center space-x-2">
                          <Palette className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          <div className="flex space-x-1">
                            {COLOR_OPTIONS.map((color) => (
                              <button
                                key={color.value}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditColor(color.value)
                                }}
                                className={`w-4 h-4 rounded border-2 ${
                                  editColor === color.value ? 'border-gray-800 dark:border-gray-200' : 'border-gray-300 dark:border-gray-600'
                                }`}
                                style={{ backgroundColor: color.value }}
                                title={color.name}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditCancel()
                            }}
                            className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditSave(annotation.id)
                            }}
                            className="px-2 py-1 text-xs text-white bg-indigo-600 dark:bg-indigo-500 rounded hover:bg-indigo-700 dark:hover:bg-indigo-600"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      annotation.comment && (
                        <div className="text-gray-700 dark:text-gray-300">
                          <MessageSquare className="h-3 w-3 inline mr-1 text-gray-400 dark:text-gray-500" />
                          {annotation.comment}
                        </div>
                      )
                    )}
                  </div>

                  {/* Footer */}
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDistanceToNow(new Date(annotation.createdAt), { addSuffix: true })}
                        </span>
                        {annotation.updatedAt !== annotation.createdAt && (
                          <span>Updated</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}