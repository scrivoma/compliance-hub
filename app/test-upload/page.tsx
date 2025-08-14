'use client'

import { useState } from 'react'

export default function TestUploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<string>('')

  const handleUpload = async () => {
    if (!file) return
    
    setUploading(true)
    setResult('')
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', 'Test Upload: ' + file.name)
      formData.append('state', 'CO')
      formData.append('categoryId', 'cmd0fqk9e00028ch7fvfg9jic') // Use existing category ID
      
      console.log('Starting upload...')
      
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Upload failed: ${response.status} - ${errorText}`)
      }
      
      const data = await response.json()
      setResult(`Success! Document uploaded: ${JSON.stringify(data, null, 2)}`)
      console.log('Upload successful:', data)
      
    } catch (error) {
      console.error('Upload error:', error)
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Test Document Upload</h1>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select PDF File
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-medium
                file:bg-indigo-50 file:text-indigo-700
                hover:file:bg-indigo-100"
            />
          </div>
          
          {file && (
            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-sm text-gray-700">
                <strong>File:</strong> {file.name} ({Math.round(file.size / 1024)} KB)
              </p>
            </div>
          )}
          
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md 
              hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
              font-medium"
          >
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
          
          {result && (
            <div className={`p-4 rounded-md ${
              result.startsWith('Error') 
                ? 'bg-red-50 border border-red-200 text-red-700' 
                : 'bg-green-50 border border-green-200 text-green-700'
            }`}>
              <pre className="text-sm whitespace-pre-wrap">{result}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}