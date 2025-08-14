'use client'

import { useState } from 'react'
import { 
  Download, 
  Star, 
  Trash2, 
  FileText, 
  X,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'

interface Document {
  id: string
  title: string
  state: string
  fileSize: number
}

interface BulkActionsProps {
  selectedDocuments: Document[]
  onDownloadSelected: (documents: Document[]) => void
  onFavoriteSelected: (documents: Document[]) => void
  onClearSelection: () => void
  favoriteDocuments: string[]
}

interface BulkDownloadStatus {
  isDownloading: boolean
  completed: number
  total: number
  failed: string[]
  currentFile?: string
}

export function BulkActions({
  selectedDocuments,
  onDownloadSelected,
  onFavoriteSelected,
  onClearSelection,
  favoriteDocuments
}: BulkActionsProps) {
  const [downloadStatus, setDownloadStatus] = useState<BulkDownloadStatus>({
    isDownloading: false,
    completed: 0,
    total: 0,
    failed: []
  })

  const handleBulkDownload = async () => {
    if (selectedDocuments.length === 0) return

    setDownloadStatus({
      isDownloading: true,
      completed: 0,
      total: selectedDocuments.length,
      failed: [],
      currentFile: selectedDocuments[0].title
    })

    try {
      // Create a zip file with all selected documents
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      
      let completed = 0
      const failed: string[] = []

      for (const doc of selectedDocuments) {
        try {
          setDownloadStatus(prev => ({
            ...prev,
            currentFile: doc.title
          }))

          const response = await fetch(`/api/documents/${doc.id}/pdf`)
          if (response.ok) {
            const blob = await response.blob()
            const sanitizedTitle = doc.title.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim()
            zip.file(`${sanitizedTitle}_${doc.state}.pdf`, blob)
            completed++
          } else {
            failed.push(doc.title)
          }
        } catch (error) {
          failed.push(doc.title)
        }

        setDownloadStatus(prev => ({
          ...prev,
          completed: completed,
          failed: failed
        }))
      }

      // Generate and download the zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = window.URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `compliance-documents-${new Date().toISOString().split('T')[0]}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setDownloadStatus({
        isDownloading: false,
        completed: completed,
        total: selectedDocuments.length,
        failed: failed
      })

      // Clear status after 5 seconds
      setTimeout(() => {
        setDownloadStatus({
          isDownloading: false,
          completed: 0,
          total: 0,
          failed: []
        })
      }, 5000)

    } catch (error) {
      console.error('Bulk download failed:', error)
      setDownloadStatus({
        isDownloading: false,
        completed: 0,
        total: selectedDocuments.length,
        failed: selectedDocuments.map(doc => doc.title)
      })
    }
  }

  const handleBulkFavorite = () => {
    onFavoriteSelected(selectedDocuments)
  }

  const calculateTotalSize = () => {
    return selectedDocuments.reduce((total, doc) => total + doc.fileSize, 0)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFavoriteStats = () => {
    const favoriteCount = selectedDocuments.filter(doc => 
      favoriteDocuments.includes(doc.id)
    ).length
    const notFavoriteCount = selectedDocuments.length - favoriteCount
    
    return { favoriteCount, notFavoriteCount }
  }

  const { favoriteCount, notFavoriteCount } = getFavoriteStats()

  if (selectedDocuments.length === 0 && !downloadStatus.isDownloading && downloadStatus.completed === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {/* Download Status */}
      {downloadStatus.isDownloading && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center space-x-3">
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-900">
                Downloading {downloadStatus.total} document{downloadStatus.total > 1 ? 's' : ''}...
              </h4>
              <p className="text-sm text-blue-700 mt-1">
                {downloadStatus.currentFile && `Processing: ${downloadStatus.currentFile}`}
              </p>
              <div className="mt-2 bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(downloadStatus.completed / downloadStatus.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-blue-600 mt-1">
                {downloadStatus.completed} of {downloadStatus.total} completed
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Download Complete Status */}
      {!downloadStatus.isDownloading && downloadStatus.completed > 0 && (
        <div className={`mb-4 p-4 rounded-lg border ${
          downloadStatus.failed.length === 0 
            ? 'bg-green-50 border-green-200' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-start space-x-3">
            {downloadStatus.failed.length === 0 ? (
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h4 className={`text-sm font-medium ${
                downloadStatus.failed.length === 0 ? 'text-green-900' : 'text-yellow-900'
              }`}>
                {downloadStatus.failed.length === 0 
                  ? `Successfully downloaded ${downloadStatus.completed} document${downloadStatus.completed > 1 ? 's' : ''}!`
                  : `Downloaded ${downloadStatus.completed} document${downloadStatus.completed > 1 ? 's' : ''} with ${downloadStatus.failed.length} error${downloadStatus.failed.length > 1 ? 's' : ''}`
                }
              </h4>
              {downloadStatus.failed.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-yellow-700">Failed to download:</p>
                  <ul className="text-sm text-yellow-600 mt-1 ml-4">
                    {downloadStatus.failed.map(title => (
                      <li key={title} className="truncate">• {title}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedDocuments.length > 0 && (
        <div className="space-y-4">
          {/* Selection Summary */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="h-5 w-5 text-indigo-600" />
              <div>
                <h3 className="text-sm font-medium text-gray-900">
                  {selectedDocuments.length} document{selectedDocuments.length > 1 ? 's' : ''} selected
                </h3>
                <p className="text-sm text-gray-500">
                  Total size: {formatFileSize(calculateTotalSize())}
                </p>
              </div>
            </div>
            <button
              onClick={onClearSelection}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleBulkDownload}
              disabled={downloadStatus.isDownloading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Download className="h-4 w-4 mr-2" />
              {downloadStatus.isDownloading ? 'Downloading...' : 'Download All as ZIP'}
            </button>

            <button
              onClick={handleBulkFavorite}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Star className="h-4 w-4 mr-2" />
              {notFavoriteCount > 0 && favoriteCount > 0 
                ? `Update Favorites (${notFavoriteCount} to add, ${favoriteCount} to remove)`
                : favoriteCount > 0 
                  ? `Remove from Favorites (${favoriteCount})`
                  : `Add to Favorites (${notFavoriteCount})`
              }
            </button>
          </div>

          {/* Selected Documents List */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Selected Documents:</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedDocuments.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                      <p className="text-xs text-gray-500">
                        {doc.state} • {formatFileSize(doc.fileSize)}
                      </p>
                    </div>
                  </div>
                  {favoriteDocuments.includes(doc.id) && (
                    <Star className="h-4 w-4 text-yellow-500 fill-current flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}