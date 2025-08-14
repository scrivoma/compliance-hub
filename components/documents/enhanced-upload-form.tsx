'use client'

import { useState, useEffect } from 'react'
import { Upload, File, AlertCircle, CheckCircle, Loader, X } from 'lucide-react'

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

interface EnhancedUploadFormProps {
  onUploadSuccess?: () => void
}

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
]

export function EnhancedUploadForm({ onUploadSuccess }: EnhancedUploadFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [state, setState] = useState('')
  const [selectedVerticals, setSelectedVerticals] = useState<string[]>([])
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([])
  
  const [verticals, setVerticals] = useState<Vertical[]>([])
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchOptions()
  }, [])


  const fetchOptions = async () => {
    try {
      const [verticalsRes, typesRes] = await Promise.all([
        fetch('/api/verticals'),
        fetch('/api/document-types')
      ])
      
      if (verticalsRes.ok) {
        const data = await verticalsRes.json()
        setVerticals(data.verticals || [])
      }
      
      if (typesRes.ok) {
        const data = await typesRes.json()
        setDocumentTypes(data.documentTypes || [])
      }
    } catch (error) {
      console.error('Failed to fetch options:', error)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!file || !title || !state) {
      setError('Please fill in required fields (file, title, state)')
      return
    }

    if (selectedVerticals.length === 0) {
      setError('Please select at least one vertical')
      return
    }

    if (selectedDocTypes.length === 0) {
      setError('Please select at least one document type')
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
      formData.append('verticals', JSON.stringify(selectedVerticals))
      formData.append('documentTypes', JSON.stringify(selectedDocTypes))

      const response = await fetch('/api/documents/upload-enhanced', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        setSuccess(true)
        setFile(null)
        setTitle('')
        setDescription('')
        setState('')
        setSelectedVerticals([])
        setSelectedDocTypes([])
        
        if (onUploadSuccess) {
          onUploadSuccess()
        }
        
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Upload Compliance Document</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Add a new document to your compliance library with proper categorization.
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
                  className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
                >
                  <span>Upload a file</span>
                  <input
                    id="file-upload"
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

        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
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

          <div className="md:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Brief description of the document content (optional)"
            />
          </div>

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
              {US_STATES.map(({ code, name }) => (
                <option key={code} value={code}>{name} ({code})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Verticals */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Verticals * <span className="text-gray-500 dark:text-gray-400">(Select all that apply)</span>
          </label>
          {verticals.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Loading verticals...</p>
          )}
          <div className="flex flex-wrap gap-2">
            {verticals.map(vertical => (
              <button
                key={vertical.id}
                type="button"
                onClick={() => toggleVertical(vertical.id)}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  selectedVerticals.includes(vertical.id)
                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200 border-indigo-300 dark:border-indigo-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {vertical.displayName}
                {selectedVerticals.includes(vertical.id) && (
                  <X className="h-3 w-3 ml-1 inline" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Document Types */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Document Types * <span className="text-gray-500 dark:text-gray-400">(Select all that apply)</span>
          </label>
          {documentTypes.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Loading document types...</p>
          )}
          <div className="flex flex-wrap gap-2">
            {documentTypes.map(type => (
              <button
                key={type.id}
                type="button"
                onClick={() => toggleDocType(type.id)}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  selectedDocTypes.includes(type.id)
                    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 border-green-300 dark:border-green-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {type.displayName}
                {selectedDocTypes.includes(type.id) && (
                  <X className="h-3 w-3 ml-1 inline" />
                )}
              </button>
            ))}
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
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <div className="flex items-center">
                <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                Uploading Document...
              </div>
            ) : (
              'Upload Document'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}