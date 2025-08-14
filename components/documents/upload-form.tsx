'use client'

import { useState, useEffect } from 'react'
import { Upload, File, AlertCircle, CheckCircle, Clock, Loader } from 'lucide-react'

interface Category {
  id: string
  name: string
  description?: string
}

interface UploadFormProps {
  onUploadSuccess?: () => void
}

interface ProcessingDocument {
  id: string
  title: string
  processingStatus: string
  processingProgress: number
  processingError?: string
  totalChunks?: number
  processedChunks: number
  createdAt: string
  updatedAt: string
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
]

const STATUS_LABELS = {
  'UPLOADED': 'Queued for processing',
  'EXTRACTING': 'Extracting text from PDF',
  'CHUNKING': 'Preparing text chunks',
  'EMBEDDING': 'Creating embeddings',
  'COMPLETED': 'Processing complete',
  'FAILED': 'Processing failed'
}

const STATUS_COLORS = {
  'UPLOADED': 'bg-yellow-500',
  'EXTRACTING': 'bg-blue-500',
  'CHUNKING': 'bg-indigo-500',
  'EMBEDDING': 'bg-purple-500',
  'COMPLETED': 'bg-green-500',
  'FAILED': 'bg-red-500'
}

export function UploadForm({ onUploadSuccess }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [state, setState] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [processingDocuments, setProcessingDocuments] = useState<ProcessingDocument[]>([])

  useEffect(() => {
    fetchCategories()
    fetchProcessingStatus()
    
    // Poll for processing status updates every 2 seconds
    const interval = setInterval(fetchProcessingStatus, 2000)
    return () => clearInterval(interval)
  }, [])

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

  const fetchProcessingStatus = async () => {
    try {
      const response = await fetch('/api/documents/processing-status')
      if (response.ok) {
        const data = await response.json()
        setProcessingDocuments(data.processingDocuments)
      }
    } catch (error) {
      console.error('Failed to fetch processing status:', error)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile)
      if (!title) {
        setTitle(selectedFile.name.replace('.pdf', ''))
      }
      setError('')
    } else {
      setError('Please select a PDF file')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!file || !title || !state || !categoryId) {
      setError('Please fill in all required fields')
      return
    }

    setUploading(true)
    setError('')
    setSuccess(false)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title)
      formData.append('description', description)
      formData.append('state', state)
      formData.append('categoryId', categoryId)

      const response = await fetch('/api/documents/upload-async', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const result = await response.json()
        setSuccess(true)
        setFile(null)
        setTitle('')
        setDescription('')
        setState('')
        setCategoryId('')
        
        // Refresh processing status
        fetchProcessingStatus()
        
        if (onUploadSuccess) {
          onUploadSuccess()
        }
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Upload failed')
      }
    } catch (error) {
      setError('Network error. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
    
    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`
  }

  return (
    <div className="space-y-8">
      {/* Upload Form */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Upload New Document</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Upload PDF documents for processing and analysis. Large files will be processed in the background.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              PDF Document *
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
              <div className="space-y-1 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                <div className="flex text-sm text-gray-600 dark:text-gray-400">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 dark:focus-within:ring-offset-gray-800 focus-within:ring-indigo-500"
                  >
                    <span>Upload a file</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      accept=".pdf"
                      className="sr-only"
                      onChange={handleFileChange}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">PDF up to 200MB</p>
              </div>
            </div>
            {file && (
              <div className="mt-2 flex items-center text-sm text-gray-600 dark:text-gray-400">
                <File className="h-4 w-4 mr-2" />
                <span>{file.name} ({formatFileSize(file.size)})</span>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Document Title *
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter document title"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter document description (optional)"
            />
          </div>

          {/* State and Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                State *
              </label>
              <select
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
                className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select a state</option>
                {US_STATES.map(stateCode => (
                  <option key={stateCode} value={stateCode}>{stateCode}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category *
              </label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select a category</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-950 p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400 dark:text-red-300" />
                <div className="ml-3">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="rounded-md bg-green-50 dark:bg-green-950 p-4">
              <div className="flex">
                <CheckCircle className="h-5 w-5 text-green-400 dark:text-green-300" />
                <div className="ml-3">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Document uploaded successfully! Processing will continue in the background.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={uploading || !file}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <div className="flex items-center">
                  <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Uploading...
                </div>
              ) : (
                'Upload Document'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Processing Status */}
      {processingDocuments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Processing Status</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Documents currently being processed in the background.
            </p>
          </div>

          <div className="space-y-4">
            {processingDocuments.map((doc) => (
              <div key={doc.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate flex-1 mr-4">
                    {doc.title}
                  </h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {getTimeAgo(doc.updatedAt)}
                  </span>
                </div>

                <div className="flex items-center space-x-3 mb-2">
                  <div className={`h-2 w-2 rounded-full ${STATUS_COLORS[doc.processingStatus as keyof typeof STATUS_COLORS]}`} />
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {STATUS_LABELS[doc.processingStatus as keyof typeof STATUS_LABELS]}
                  </span>
                  {doc.totalChunks && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({doc.processedChunks}/{doc.totalChunks} chunks)
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      doc.processingStatus === 'FAILED' ? 'bg-red-500' : 'bg-indigo-600 dark:bg-indigo-500'
                    }`}
                    style={{ width: `${doc.processingProgress}%` }}
                  />
                </div>

                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{doc.processingProgress}% complete</span>
                  {doc.processingStatus === 'EMBEDDING' && doc.totalChunks && (
                    <span>Processing chunk {doc.processedChunks} of {doc.totalChunks}</span>
                  )}
                </div>

                {doc.processingError && (
                  <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 p-2 rounded">
                    Error: {doc.processingError}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}