'use client'

import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Download, 
  Eye, 
  Star,
  FileText,
  Tag,
  ChevronRight
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

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

interface DocumentTableViewProps {
  documents: Document[]
  favoriteDocuments: string[]
  onView: (doc: Document) => void
  onDownload: (doc: Document) => void
  onToggleFavorite: (doc: Document) => void
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

export function DocumentTableView({
  documents,
  favoriteDocuments,
  onView,
  onDownload,
  onToggleFavorite
}: DocumentTableViewProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-slate-600 dark:text-slate-400" />
      case 'FAILED':
        return <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
      default:
        return <Clock className="h-4 w-4 text-slate-600 dark:text-slate-400 animate-spin" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'Ready'
      case 'FAILED':
        return 'Failed'
      case 'EXTRACTING':
        return 'Extracting'
      case 'CHUNKING':
        return 'Chunking'
      case 'EMBEDDING':
        return 'Embedding'
      default:
        return 'Processing'
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Document
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                State
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Type & Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {documents.map((doc, index) => {
              const isFavorite = favoriteDocuments.includes(doc.id)
              const isRecent = new Date(doc.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

              return (
                <tr 
                  key={doc.id} 
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                    index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700/50'
                  }`}
                  onClick={() => onView(doc)}
                >
                  
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center space-x-2">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 max-w-xs truncate">
                            {doc.title}
                          </div>
                          {isFavorite && (
                            <Star className="h-4 w-4 text-yellow-500 dark:text-yellow-400 fill-current" />
                          )}
                          {isRecent && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200">
                              New
                            </span>
                          )}
                        </div>
                        {doc.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                            {doc.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">{STATE_NAMES[doc.state] || doc.state}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{doc.state}</div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {doc.documentTypes.map(t => (
                        <span
                          key={t.documentType.id}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mr-1"
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          {t.documentType.displayName}
                        </span>
                      ))}
                      {doc.verticals.map(v => (
                        <span
                          key={v.vertical.id}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mr-1"
                        >
                          <Tag className="h-3 w-3 mr-1" />
                          {v.vertical.displayName}
                        </span>
                      ))}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(doc.processingStatus)}
                      <span className="ml-2 text-sm text-gray-900 dark:text-gray-100">
                        {getStatusText(doc.processingStatus)}
                      </span>
                    </div>
                    {doc.processingStatus !== 'COMPLETED' && doc.processingStatus !== 'FAILED' && doc.processingProgress > 0 && (
                      <div className="mt-1">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div 
                            className="bg-slate-600 dark:bg-slate-400 h-1.5 rounded-full"
                            style={{ width: `${doc.processingProgress}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {doc.processingProgress}%
                        </div>
                      </div>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatFileSize(doc.fileSize)}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleFavorite(doc)
                        }}
                        className={`p-1 rounded ${
                          isFavorite 
                            ? 'text-yellow-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300' 
                            : 'text-gray-400 dark:text-gray-500 hover:text-yellow-500 dark:hover:text-yellow-400'
                        }`}
                        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onView(doc)
                        }}
                        className="p-1 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded"
                        title="View Document"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDownload(doc)
                        }}
                        className="p-1 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded"
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
      {documents.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No documents to display</p>
        </div>
      )}
    </div>
  )
}