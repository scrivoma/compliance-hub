'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { DocumentList } from '@/components/documents/document-list'
import { LlamaIndexUploadForm } from '@/components/admin/llamaindex-upload-form'
import { Upload, Database, Shield, AlertCircle, Settings } from 'lucide-react'

export default function AdminPage() {
  const { data: session, status } = useSession()
  const [activeTab, setActiveTab] = useState<'upload' | 'manage'>('upload')
  const [refreshKey, setRefreshKey] = useState(0)
  const [seedingStatus, setSeedingStatus] = useState<{loading: boolean, message: string}>({loading: false, message: ''})

  const handleUploadSuccess = () => {
    setRefreshKey(prev => prev + 1)
  }

  const handleSeedDropdowns = async () => {
    setSeedingStatus({loading: true, message: 'Checking database connection...'})
    
    try {
      // First, test if we can access the API endpoints at all
      setSeedingStatus({loading: true, message: 'Testing API connectivity...'})
      
      const testResponse = await fetch('/api/verticals', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!testResponse.ok) {
        setSeedingStatus({loading: false, message: 'API endpoints are protected. Dropdowns will use built-in fallback data automatically.'})
        setTimeout(() => setSeedingStatus({loading: false, message: ''}), 7000)
        return
      }
      
      // Check if data already exists
      const data = await testResponse.json()
      if (data.verticals && data.verticals.length > 0) {
        setSeedingStatus({loading: false, message: 'Database already contains reference data. No seeding needed.'})
        setTimeout(() => setSeedingStatus({loading: false, message: ''}), 5000)
        return
      }
      
      // Attempt to seed
      setSeedingStatus({loading: true, message: 'Seeding reference data...'})
      
      const [verticalsResponse, docTypesResponse] = await Promise.all([
        fetch('/api/verticals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'seed', key: 'dev-only' })
        }),
        fetch('/api/document-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'seed', key: 'dev-only' })
        })
      ])
      
      if (!verticalsResponse.ok || !docTypesResponse.ok) {
        throw new Error('Seeding endpoints are protected by Vercel')
      }
      
      setSeedingStatus({loading: false, message: 'Database seeded successfully! Dropdowns will now use live data.'})
      setTimeout(() => setSeedingStatus({loading: false, message: ''}), 5000)
      
    } catch (error) {
      console.error('Seeding process failed:', error)
      setSeedingStatus({
        loading: false, 
        message: 'Unable to seed database. Dropdowns will automatically use built-in fallback data.'
      })
      setTimeout(() => setSeedingStatus({loading: false, message: ''}), 7000)
    }
  }

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Check if user is authenticated and has admin role
  if (!session?.user || session.user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center mb-4">
            <AlertCircle className="h-12 w-12 text-red-500 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
            You need administrator privileges to access this page.
          </p>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
            <div className="flex">
              <Shield className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                This section is restricted to administrators only. Please contact your system administrator if you need access.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Document Administration</h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Upload PDFs or scrape content from URLs with advanced citation tracking and manage your document collection.
              </p>
            </div>
            <div className="flex flex-col items-end space-y-2">
              <button
                onClick={handleSeedDropdowns}
                disabled={seedingStatus.loading}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {seedingStatus.loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 dark:border-gray-300 mr-2"></div>
                    Seeding...
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4 mr-2" />
                    Check Database
                  </>
                )}
              </button>
              {seedingStatus.message && (
                <p className={`text-xs ${seedingStatus.message.includes('success') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {seedingStatus.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('upload')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'upload'
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Upload className="h-5 w-5" />
                  <span>Upload Documents</span>
                </div>
              </button>
              
              <button
                onClick={() => setActiveTab('manage')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'manage'
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Database className="h-5 w-5" />
                  <span>Manage Documents</span>
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {activeTab === 'upload' && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Upload Document</h2>
                <p className="mt-1 text-gray-600 dark:text-gray-400">
                  Upload PDF documents with advanced citation tracking
                </p>
              </div>
              <LlamaIndexUploadForm onUploadSuccess={handleUploadSuccess} />
            </div>
          )}

          {activeTab === 'manage' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Document Collection</h2>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload New Document
                </button>
              </div>
              <DocumentList refreshKey={refreshKey} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}