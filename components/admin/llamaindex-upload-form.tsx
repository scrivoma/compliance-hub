'use client'

import { useState, useEffect } from 'react'
import { Upload, CheckCircle, AlertCircle, Link, FileText } from 'lucide-react'
import { getVerticals, getDocumentTypes } from '@/lib/constants/reference-data'

interface TestResult {
  success: boolean
  message: string
  data?: any
  error?: string
}

interface ProcessingStatus {
  documentId: string
  title: string
  status: string
  progress: number
  error?: string
  totalChunks?: number
  processedChunks?: number
}

interface Vertical {
  id: string
  name: string
  displayName: string
  description?: string
}

interface DocumentType {
  id: string
  name: string
  displayName: string
  description?: string
}

interface LlamaIndexUploadFormProps {
  onUploadSuccess?: () => void
}

export function LlamaIndexUploadForm({ onUploadSuccess }: LlamaIndexUploadFormProps) {
  const [inputMode, setInputMode] = useState<'file' | 'url'>('file')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedState, setSelectedState] = useState('AL')
  const [selectedVerticals, setSelectedVerticals] = useState<string[]>([])
  const [selectedDocumentTypes, setSelectedDocumentTypes] = useState<string[]>([])
  const [verticals, setVerticals] = useState<Vertical[]>([])
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [uploadResult, setUploadResult] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [processingDocuments, setProcessingDocuments] = useState<ProcessingStatus[]>([])
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null)
  const [dataLoadingStatus, setDataLoadingStatus] = useState<{
    verticalsSource: 'api' | 'static' | null
    documentTypesSource: 'api' | 'static' | null
    hasErrors: boolean
  }>({
    verticalsSource: null,
    documentTypesSource: null,
    hasErrors: false
  })

  useEffect(() => {
    loadReferenceData()
  }, [])

  const loadReferenceData = async () => {
    try {
      const [verticalsResult, documentTypesResult] = await Promise.all([
        getVerticals(),
        getDocumentTypes()
      ])
      
      setVerticals(verticalsResult.data)
      setDocumentTypes(documentTypesResult.data)
      
      setDataLoadingStatus({
        verticalsSource: verticalsResult.source,
        documentTypesSource: documentTypesResult.source,
        hasErrors: Boolean(verticalsResult.error || documentTypesResult.error)
      })
      
      // Log information about data sources
      if (verticalsResult.source === 'static' || documentTypesResult.source === 'static') {
        console.log('ℹ️ Reference data status:', {
          verticals: `${verticalsResult.source}${verticalsResult.error ? ` (${verticalsResult.error})` : ''}`,
          documentTypes: `${documentTypesResult.source}${documentTypesResult.error ? ` (${documentTypesResult.error})` : ''}`
        })
      }
      
    } catch (error) {
      console.error('❌ Failed to load reference data:', error)
      setDataLoadingStatus({
        verticalsSource: 'static',
        documentTypesSource: 'static',
        hasErrors: true
      })
    }
  }

  useEffect(() => {
    if (file && !title) {
      setTitle(file.name.replace('.pdf', ''))
    }
  }, [file, title])

  // Extract title from URL when URL changes
  useEffect(() => {
    if (url && !title && inputMode === 'url') {
      try {
        const urlObj = new URL(url)
        const pathname = urlObj.pathname
        const filename = pathname.split('/').pop() || ''
        if (filename) {
          setTitle(filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_ ]/g, ' ').trim())
        } else {
          setTitle(`Document from ${urlObj.hostname}`)
        }
      } catch {
        // Invalid URL, ignore
      }
    }
  }, [url, title, inputMode])


  const handleUpload = async () => {
    if (inputMode === 'file' && !file) return
    if (inputMode === 'url' && !url.trim()) return
    if (!title.trim() || selectedVerticals.length === 0 || selectedDocumentTypes.length === 0) return

    setLoading(true)
    setUploadResult(null)

    try {
      let response: Response
      
      if (inputMode === 'file' && file) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('title', title.trim())
        formData.append('description', description.trim() || 'Document uploaded via LlamaIndex processing')
        formData.append('state', selectedState)
        formData.append('verticals', JSON.stringify(selectedVerticals))
        formData.append('documentTypes', JSON.stringify(selectedDocumentTypes))

        response = await fetch('/api/documents/upload-async-llamaindex', {
          method: 'POST',
          body: formData
        })
      } else {
        // URL mode
        response = await fetch('/api/documents/upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: url.trim(),
            title: title.trim(),
            description: description.trim() || undefined,
            state: selectedState,
            verticals: selectedVerticals,
            documentTypes: selectedDocumentTypes,
          })
        })
      }

      const result = await response.json()

      if (response.ok) {
        setUploadResult({
          success: true,
          message: `Upload successful! Processing started in background.`,
          data: result
        })
        
        // Add to processing documents list
        if (result.documentId) {
          const newProcessingDoc: ProcessingStatus = {
            documentId: result.documentId,
            title: title,
            status: 'UPLOADED',
            progress: 0
          }
          setProcessingDocuments(prev => [...prev, newProcessingDoc])
          startProgressPolling(result.documentId)
        }
        
        // Reset form
        setFile(null)
        setUrl('')
        setTitle('')
        setDescription('')
        setSelectedVerticals([])
        setSelectedDocumentTypes([])
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

  const startProgressPolling = (documentId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}/progress`)
        if (response.ok) {
          const status: ProcessingStatus = await response.json()
          
          setProcessingDocuments(prev => 
            prev.map(doc => 
              doc.documentId === documentId ? status : doc
            )
          )
          
          // Stop polling if completed or failed
          if (status.status === 'COMPLETED' || status.status === 'FAILED') {
            clearInterval(interval)
            if (status.status === 'COMPLETED') {
              onUploadSuccess?.() // Trigger refresh
              // Remove from processing list after a delay
              setTimeout(() => {
                setProcessingDocuments(prev => 
                  prev.filter(doc => doc.documentId !== documentId)
                )
              }, 5000)
            }
          }
        }
      } catch (error) {
        console.error('Error polling progress:', error)
      }
    }, 2000) // Poll every 2 seconds
    
    setPollInterval(interval)
  }

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [pollInterval])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-slate-600 dark:text-slate-400'
      case 'FAILED': return 'text-red-600 dark:text-red-400'
      case 'EXTRACTING': return 'text-slate-600 dark:text-slate-400'
      case 'CHUNKING': return 'text-slate-600 dark:text-slate-400'
      case 'EMBEDDING': return 'text-slate-600 dark:text-slate-400'
      default: return 'text-slate-600 dark:text-slate-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'UPLOADED': return 'Uploaded'
      case 'EXTRACTING': return 'Extracting text'
      case 'CHUNKING': return 'Creating chunks'
      case 'EMBEDDING': return 'Generating embeddings'
      case 'COMPLETED': return 'Completed'
      case 'FAILED': return 'Failed'
      default: return status
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
      <div className="flex items-center space-x-3 mb-6">
        <Upload className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Add Document</h2>
          <p className="text-gray-600 dark:text-gray-400">Upload PDF documents or scrape content from URLs</p>
        </div>
      </div>

      {/* Input Mode Toggle */}
      <div className="mb-6">
        <div className="flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            onClick={() => {
              setInputMode('file')
              setUrl('')
              setTitle('')
            }}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-l-lg border ${
              inputMode === 'file'
                ? 'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-700 dark:border-indigo-700'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Upload PDF</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setInputMode('url')
              setFile(null)
              setTitle('')
            }}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-r-lg border-t border-r border-b ${
              inputMode === 'url'
                ? 'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-700 dark:border-indigo-700'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <Link className="h-4 w-4" />
              <span>Add URL</span>
            </div>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Document Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter document title"
              className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              State *
            </label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="AL">Alabama</option>
              <option value="AK">Alaska</option>
              <option value="AZ">Arizona</option>
              <option value="AR">Arkansas</option>
              <option value="CA">California</option>
              <option value="CO">Colorado</option>
              <option value="CT">Connecticut</option>
              <option value="DE">Delaware</option>
              <option value="FL">Florida</option>
              <option value="GA">Georgia</option>
              <option value="HI">Hawaii</option>
              <option value="ID">Idaho</option>
              <option value="IL">Illinois</option>
              <option value="IN">Indiana</option>
              <option value="IA">Iowa</option>
              <option value="KS">Kansas</option>
              <option value="KY">Kentucky</option>
              <option value="LA">Louisiana</option>
              <option value="ME">Maine</option>
              <option value="MD">Maryland</option>
              <option value="MA">Massachusetts</option>
              <option value="MI">Michigan</option>
              <option value="MN">Minnesota</option>
              <option value="MS">Mississippi</option>
              <option value="MO">Missouri</option>
              <option value="MT">Montana</option>
              <option value="NE">Nebraska</option>
              <option value="NV">Nevada</option>
              <option value="NH">New Hampshire</option>
              <option value="NJ">New Jersey</option>
              <option value="NM">New Mexico</option>
              <option value="NY">New York</option>
              <option value="NC">North Carolina</option>
              <option value="ND">North Dakota</option>
              <option value="OH">Ohio</option>
              <option value="OK">Oklahoma</option>
              <option value="OR">Oregon</option>
              <option value="PA">Pennsylvania</option>
              <option value="PR">Puerto Rico</option>
              <option value="RI">Rhode Island</option>
              <option value="SC">South Carolina</option>
              <option value="SD">South Dakota</option>
              <option value="TN">Tennessee</option>
              <option value="TX">Texas</option>
              <option value="UT">Utah</option>
              <option value="VT">Vermont</option>
              <option value="VA">Virginia</option>
              <option value="WA">Washington</option>
              <option value="DC">Washington DC</option>
              <option value="WV">West Virginia</option>
              <option value="WI">Wisconsin</option>
              <option value="WY">Wyoming</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Verticals *
            </label>
            {dataLoadingStatus.verticalsSource === 'static' && (
              <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-800">
                Using offline data
              </span>
            )}
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md p-3 bg-white dark:bg-gray-700">
            {verticals.map((vertical) => (
              <label key={vertical.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedVerticals.includes(vertical.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedVerticals([...selectedVerticals, vertical.id])
                    } else {
                      setSelectedVerticals(selectedVerticals.filter(id => id !== vertical.id))
                    }
                  }}
                  className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 bg-white dark:bg-gray-700"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{vertical.displayName}</span>
              </label>
            ))}
          </div>
          {selectedVerticals.length === 0 && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">Please select at least one vertical</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Document Types *
            </label>
            {dataLoadingStatus.documentTypesSource === 'static' && (
              <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-800">
                Using offline data
              </span>
            )}
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md p-3 bg-white dark:bg-gray-700">
            {documentTypes.map((docType) => (
              <label key={docType.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedDocumentTypes.includes(docType.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedDocumentTypes([...selectedDocumentTypes, docType.id])
                    } else {
                      setSelectedDocumentTypes(selectedDocumentTypes.filter(id => id !== docType.id))
                    }
                  }}
                  className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 bg-white dark:bg-gray-700"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{docType.displayName}</span>
              </label>
            ))}
          </div>
          {selectedDocumentTypes.length === 0 && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">Please select at least one document type</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional description of the document"
            className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* File Upload Input */}
        {inputMode === 'file' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select PDF File *
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              value="" // Reset input when file is cleared
              className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-900 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-800"
            />
            {file && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Selected: {file.name} ({Math.round(file.size / 1024)} KB)
              </p>
            )}
          </div>
        )}

        {/* URL Input */}
        {inputMode === 'url' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Document URL *
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/document or https://example.com/file.pdf"
              className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Enter a URL to scrape content or a direct link to a PDF file
            </p>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={
            (inputMode === 'file' && !file) ||
            (inputMode === 'url' && !url.trim()) ||
            !title.trim() ||
            selectedVerticals.length === 0 ||
            selectedDocumentTypes.length === 0 ||
            loading
          }
          className="w-full px-4 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-medium"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>{inputMode === 'url' ? 'Scraping URL...' : 'Processing with LlamaIndex...'}</span>
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              <span>{inputMode === 'url' ? 'Scrape & Process URL' : 'Upload & Process Document'}</span>
            </>
          )}
        </button>

        {uploadResult && (
          <div className={`p-4 rounded-lg ${uploadResult.success ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-700'}`}>
            <div className="flex items-center space-x-2">
              {uploadResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
              <span className={uploadResult.success ? 'text-green-800 dark:text-green-200 font-medium' : 'text-red-800 dark:text-red-200 font-medium'}>
                {uploadResult.message}
              </span>
            </div>
            {uploadResult.error && (
              <p className="text-red-600 dark:text-red-400 text-sm mt-2">{uploadResult.error}</p>
            )}
            {uploadResult.success && uploadResult.data && (
              <div className="mt-3 text-sm text-green-700 dark:text-green-300">
                <p>• Document ID: {uploadResult.data.documentId}</p>
                <p>• Processing Method: LlamaIndex with coordinate tracking</p>
                <p>• Ready for citation-aware search</p>
              </div>
            )}
          </div>
        )}

        {/* Processing Status */}
        {processingDocuments.length > 0 && (
          <div className="mt-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Processing Status</h3>
            {processingDocuments.map((doc) => (
              <div key={doc.documentId} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">{doc.title}</h4>
                  <span className={`text-sm font-medium ${getStatusColor(doc.status)}`}>
                    {getStatusText(doc.status)}
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-2">
                  <div 
                    className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${doc.progress}%` }}
                  ></div>
                </div>
                
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{doc.progress}% complete</span>
                  {doc.totalChunks && doc.processedChunks !== undefined && (
                    <span>{doc.processedChunks}/{doc.totalChunks} chunks</span>
                  )}
                </div>
                
                {doc.error && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-2">{doc.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-700">
        <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Processing Features:</h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Advanced PDF text extraction with coordinate tracking</li>
          <li>• Web content scraping with Firecrawl integration</li>
          <li>• Automatic conversion to clean markdown format</li>
          <li>• Character-level precision for perfect citation highlighting</li>
          <li>• Optimized chunking for better search relevance</li>
          <li>• Citation-aware search results with precise document references</li>
        </ul>
      </div>
    </div>
  )
}