'use client'

import { useState } from 'react'
import { 
  FileText, 
  Download, 
  Eye, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Star,
  MoreVertical,
  Calendar,
  HardDrive,
  MapPin,
  Tag,
  Share2,
  Copy
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { BookmarkButton } from '@/components/common/BookmarkButton'
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

interface EnhancedDocumentCardProps {
  document: Document
  isFavorite?: boolean
  onView: (doc: Document) => void
  onDownload: (doc: Document) => void
  onToggleFavorite?: (doc: Document) => void
  compact?: boolean
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

export function EnhancedDocumentCard({
  document,
  isFavorite = false,
  onView,
  onDownload,
  onToggleFavorite,
  compact = false
}: EnhancedDocumentCardProps) {
  const [showActions, setShowActions] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return {
          icon: CheckCircle,
          color: 'text-slate-700 dark:text-slate-300',
          bg: 'bg-slate-100 dark:bg-slate-800',
          text: 'Ready'
        }
      case 'FAILED':
        return {
          icon: AlertCircle,
          color: 'text-red-600 dark:text-red-400',
          bg: 'bg-red-100 dark:bg-red-900/20',
          text: 'Failed'
        }
      case 'EXTRACTING':
        return {
          icon: Clock,
          color: 'text-slate-600 dark:text-slate-400',
          bg: 'bg-slate-100 dark:bg-slate-800',
          text: 'Extracting'
        }
      case 'CHUNKING':
        return {
          icon: Clock,
          color: 'text-slate-600 dark:text-slate-400',
          bg: 'bg-slate-100 dark:bg-slate-800',
          text: 'Chunking'
        }
      case 'EMBEDDING':
        return {
          icon: Clock,
          color: 'text-slate-600 dark:text-slate-400',
          bg: 'bg-slate-100 dark:bg-slate-800',
          text: 'Embedding'
        }
      default:
        return {
          icon: Clock,
          color: 'text-slate-600 dark:text-slate-400',
          bg: 'bg-slate-100 dark:bg-slate-800',
          text: 'Processing'
        }
    }
  }

  const statusConfig = getStatusConfig(document.processingStatus)
  const StatusIcon = statusConfig.icon
  const isProcessing = document.processingStatus !== 'COMPLETED' && document.processingStatus !== 'FAILED'
  const isRecent = new Date(document.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('button') && !target.closest('input')) {
      trackDocumentView(document.id, document.title, document.state, document.documentTypes[0]?.documentType?.displayName)
      onView(document)
    }
  }

  if (compact) {
    return (
      <div 
        className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all duration-200 cursor-pointer"
        onClick={handleCardClick}
      >        
        <div className="flex-1 min-w-0 flex items-center space-x-4">
          <div className="flex-shrink-0">
            <div className={`p-2 rounded-lg ${statusConfig.bg}`}>
              <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate" title={document.title}>
              {document.title}
            </h3>
            <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
              <span>{STATE_NAMES[document.state] || document.state}</span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(document.createdAt), { addSuffix: true })}</span>
              {isFavorite && (
                <>
                  <span>•</span>
                  <Star className="h-3 w-3 text-yellow-500 dark:text-yellow-400 fill-current" />
                </>
              )}
              {isRecent && (
                <>
                  <span>•</span>
                  <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-full">New</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 ml-4">
          <button
            onClick={(e) => {
              e.stopPropagation()
              trackDocumentView(document.id, document.title, document.state, document.documentTypes[0]?.documentType?.displayName)
              onView(document)
            }}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            title="View Document"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDownload(document)
            }}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            title="Download PDF"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg transition-all duration-200 cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <div className="flex-1 min-w-0">
              <div className="mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg line-clamp-2 leading-tight" title={document.title}>
                  {document.title}
                </h3>
              </div>
              
              <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                <div className="flex items-center space-x-1">
                  <MapPin className="h-4 w-4" />
                  <span className="font-medium">{STATE_NAMES[document.state] || document.state}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDistanceToNow(new Date(document.createdAt), { addSuffix: true })}</span>
                </div>
                {isFavorite && (
                  <div className="flex items-center space-x-1">
                    <Star className="h-4 w-4 text-yellow-500 dark:text-yellow-400 fill-current" />
                    <span className="text-yellow-600 dark:text-yellow-400">Favorite</span>
                  </div>
                )}
                {isRecent && (
                  <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-full">
                    New
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Status Badge */}
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bg} ${statusConfig.color}`}>
              <StatusIcon className={`h-4 w-4 mr-1 ${isProcessing ? 'animate-spin' : ''}`} />
              {statusConfig.text}
            </div>
            
            {/* Actions Menu */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowActions(!showActions)
                }}
                className={`p-1 rounded-full transition-colors ${
                  showActions || isHovered ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              
              {showActions && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-700">
                  <div className="py-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        trackDocumentView(document.id, document.title, document.state, document.documentTypes[0]?.documentType?.displayName)
                        onView(document)
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Document
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDownload(document)
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </button>
                    {onToggleFavorite && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleFavorite(document)
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Star className={`h-4 w-4 mr-2 ${isFavorite ? 'text-yellow-500 dark:text-yellow-400 fill-current' : ''}`} />
                        {isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigator.clipboard.writeText(document.title)
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Title
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="px-6 pb-4">
        <div className="space-y-2">
          {document.verticals.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {document.verticals.map(v => (
                <span
                  key={v.vertical.id}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  <Tag className="h-3 w-3 mr-1" />
                  {v.vertical.displayName}
                </span>
              ))}
            </div>
          )}
          {document.documentTypes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {document.documentTypes.map(t => (
                <span
                  key={t.documentType.id}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  <FileText className="h-3 w-3 mr-1" />
                  {t.documentType.displayName}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>


      {/* Processing Progress */}
      {isProcessing && document.processingProgress > 0 && (
        <div className="px-6 pb-4">
          <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-slate-600 dark:bg-slate-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${document.processingProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Processing: {document.processingProgress}% complete
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={(e) => {
                e.stopPropagation()
                trackDocumentView(document.id, document.title, document.state, document.documentTypes[0]?.documentType?.displayName)
                onView(document)
              }}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors"
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDownload(document)
              }}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600/20 rounded-md transition-colors"
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </button>
          </div>
          
          <div className="text-xs text-gray-500 dark:text-gray-400">
            ID: {document.id.substring(0, 8)}
          </div>
        </div>
      </div>
    </div>
  )
}