'use client'

import { useState } from 'react'
import { Upload, Search, FileText, Zap, CheckCircle, AlertCircle } from 'lucide-react'
import { CitationTextViewer, type CitationData } from '../documents/citation-text-viewer'

interface TestResult {
  success: boolean
  message: string
  data?: any
  error?: string
}

export function LlamaIndexTest() {
  const [file, setFile] = useState<File | null>(null)
  const [uploadResult, setUploadResult] = useState<TestResult | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedCitation, setSelectedCitation] = useState<CitationData | null>(null)
  const [viewerDocument, setViewerDocument] = useState<{id: string, title: string} | null>(null)

  const handleUpload = async () => {
    if (!file) return

    setLoading(true)
    setUploadResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', `Test Upload - ${file.name}`)
      formData.append('description', 'LlamaIndex test upload')
      formData.append('state', 'MI')

      const response = await fetch('/api/documents/upload-llamaindex', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok) {
        setUploadResult({
          success: true,
          message: `Upload successful! Created ${result.chunksCreated} citation-ready chunks`,
          data: result
        })
      } else {
        setUploadResult({
          success: false,
          message: 'Upload failed',
          error: result.error || 'Unknown error'
        })
      }
    } catch (error) {
      setUploadResult({
        success: false,
        message: 'Upload failed',
        error: error instanceof Error ? error.message : 'Network error'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setLoading(true)
    setSearchResult(null)

    try {
      const response = await fetch('/api/search-citations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: searchQuery,
          options: { topK: 5 }
        })
      })

      const result = await response.json()

      if (response.ok) {
        setSearchResult({
          success: true,
          message: `Found ${result.citations?.length || 0} citations`,
          data: result
        })
      } else {
        setSearchResult({
          success: false,
          message: 'Search failed',
          error: result.error || 'Unknown error'
        })
      }
    } catch (error) {
      setSearchResult({
        success: false,
        message: 'Search failed',
        error: error instanceof Error ? error.message : 'Network error'
      })
    } finally {
      setLoading(false)
    }
  }

  const openCitation = (citation: CitationData) => {
    setSelectedCitation(citation)
    setViewerDocument({
      id: citation.source.documentId,
      title: `Document - Page ${citation.source.pageNumber}`
    })
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg border">
        <div className="flex items-center space-x-3">
          <Zap className="h-8 w-8 text-purple-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">LlamaIndex Citation Test</h2>
            <p className="text-gray-600">Test document upload and citation-aware search</p>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Upload className="h-5 w-5 mr-2" />
          Document Upload Test
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select PDF File
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
            />
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span>Upload & Process</span>
              </>
            )}
          </button>

          {uploadResult && (
            <div className={`p-4 rounded-lg ${uploadResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center space-x-2">
                {uploadResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                <span className={uploadResult.success ? 'text-green-800' : 'text-red-800'}>
                  {uploadResult.message}
                </span>
              </div>
              {uploadResult.error && (
                <p className="text-red-600 text-sm mt-2">{uploadResult.error}</p>
              )}
              {uploadResult.data && (
                <pre className="text-xs text-gray-600 mt-2 overflow-auto">
                  {JSON.stringify(uploadResult.data, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Search className="h-5 w-5 mr-2" />
          Citation Search Test
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Query
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter your search query..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={!searchQuery.trim() || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                <span>Search with Citations</span>
              </>
            )}
          </button>

          {searchResult && (
            <div className={`p-4 rounded-lg ${searchResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center space-x-2 mb-3">
                {searchResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                <span className={searchResult.success ? 'text-green-800' : 'text-red-800'}>
                  {searchResult.message}
                </span>
              </div>

              {searchResult.success && searchResult.data && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Answer:</h4>
                    <p className="text-gray-700 whitespace-pre-wrap">{searchResult.data.answer}</p>
                  </div>

                  {searchResult.data.citations && searchResult.data.citations.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Citations:</h4>
                      <div className="space-y-2">
                        {searchResult.data.citations.map((citation: CitationData, index: number) => (
                          <div 
                            key={citation.id} 
                            className="border border-gray-200 rounded p-3 cursor-pointer hover:bg-gray-50"
                            onClick={() => openCitation(citation)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-purple-600">
                                Citation {index + 1}
                              </span>
                              <span className="text-sm text-gray-500">
                                Page {citation.source.pageNumber}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mt-1">
                              {citation.text.substring(0, 200)}...
                            </p>
                            <button className="text-xs text-purple-600 hover:text-purple-800 mt-2 flex items-center">
                              <FileText className="h-3 w-3 mr-1" />
                              View in Document
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {searchResult.error && (
                <p className="text-red-600 text-sm mt-2">{searchResult.error}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Citation Viewer */}
      {selectedCitation && viewerDocument && (
        <CitationTextViewer
          documentId={viewerDocument.id}
          documentTitle={viewerDocument.title}
          citation={selectedCitation}
          onClose={() => {
            setSelectedCitation(null)
            setViewerDocument(null)
          }}
        />
      )}
    </div>
  )
}