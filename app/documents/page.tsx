'use client'

import { ModernDocumentLibrary } from '@/components/documents/modern-document-library'
import { Library } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function DocumentsContent() {
  const searchParams = useSearchParams()
  const viewDocumentId = searchParams.get('view')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Document Library</h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Browse and access your compliance documents library.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-8">
          <div>
            <div className="flex items-center mb-6">
              <Library className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Document Collection</h2>
            </div>
            <ModernDocumentLibrary viewDocumentId={viewDocumentId} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DocumentsContent />
    </Suspense>
  )
}