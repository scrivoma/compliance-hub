'use client'

import { useEffect, useRef } from 'react'

export default function TestAdobePDFPage() {
  const viewerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load Adobe PDF Embed API
    const script = document.createElement('script')
    script.src = 'https://acrobatservices.adobe.com/view-sdk/viewer.js'
    script.onload = () => {
      if (window.AdobeDC) {
        window.AdobeDC.View({
          clientId: process.env.NEXT_PUBLIC_ADOBE_PDF_EMBED_CLIENT_ID || "0d529443db6d4c58849fa3696e1ba2ff",
          divId: "adobe-pdf-viewer"
        }).previewFile({
          content: { location: { url: "https://acrobatservices.adobe.com/view-sdk-demo/PDFs/Bodea Brochure.pdf" }},
          metaData: { fileName: "Test PDF Document" }
        }, {
          embedMode: "FULL_WINDOW",
          enableAnnotationAPIs: true,
          includePDFAnnotations: true,
          showToolbar: true,
          showCommentsPanel: true,
          showPageControls: true,
          showDownloadPDF: true,
          showPrintPDF: true,
        })
      }
    }
    document.head.appendChild(script)

    return () => {
      // Clean up script
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Adobe PDF Embed API Test
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Testing Adobe PDF Embed API with annotations and comments
          </p>
        </div>
      </div>

      {/* PDF Viewer Container */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div 
            id="adobe-pdf-viewer"
            ref={viewerRef}
            className="w-full"
            style={{ height: 'calc(100vh - 200px)' }}
          >
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="h-8 w-8 border-4 border-indigo-300 dark:border-indigo-700 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading Adobe PDF Viewer...</p>
              </div>
            </div>
          </div>
        </div>

        {/* Test Info */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Test Features:</h3>
          <ul className="text-blue-800 dark:text-blue-200 text-sm space-y-1">
            <li>• Annotation tools enabled (highlighting, comments, sticky notes)</li>
            <li>• Full window embed mode</li>
            <li>• Comments panel visible</li>
            <li>• Download and print controls enabled</li>
            <li>• Using demo PDF from Adobe</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

