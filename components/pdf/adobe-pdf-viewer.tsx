'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { X, AlertTriangle } from 'lucide-react'

export interface AdobePdfViewerProps {
  documentId: string
  documentTitle: string
  onClose?: () => void
  width?: string
  height?: string
  className?: string
}

export interface AnnotationData {
  id: string
  type: string
  content: any
  pageNumber: number
  position: any
  color?: string
  comment?: string
  userId: string
  createdAt: string
}

export function AdobePdfViewer({
  documentId,
  documentTitle,
  onClose,
  width = '100%',
  height = '600px',
  className = ''
}: AdobePdfViewerProps) {
  const { data: session } = useSession()
  const viewerRef = useRef<HTMLDivElement>(null)
  const adobeViewRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [isScriptLoaded, setIsScriptLoaded] = useState(false)

  // Load user's existing annotations
  const loadAnnotations = useCallback(async () => {
    if (!session?.user?.id) return []
    
    try {
      const response = await fetch(`/api/documents/${documentId}/annotations`)
      if (response.ok) {
        const annotations = await response.json()
        return annotations
      }
    } catch (error) {
      console.error('Failed to load annotations:', error)
    }
    return []
  }, [documentId, session?.user?.id])

  // Save annotation to backend
  const saveAnnotation = useCallback(async (annotationData: any) => {
    if (!session?.user?.id) {
      console.warn('User not logged in, cannot save annotation')
      return
    }

    try {
      const response = await fetch(`/api/documents/${documentId}/annotations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: annotationData.type || 'highlight',
          content: annotationData.content,
          pageNumber: annotationData.position?.pageNumber || 1,
          position: annotationData.position,
          color: annotationData.color || '#FFFF00',
          comment: annotationData.comment || '',
          userId: session.user.id
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save annotation')
      }

      console.log('Annotation saved successfully')
    } catch (error) {
      console.error('Error saving annotation:', error)
    }
  }, [documentId, session?.user?.id])

  // Save user preferences
  const saveUserPreferences = useCallback(async (preferences: any) => {
    if (!session?.user?.id) return

    try {
      const response = await fetch(`/api/users/${session.user.id}/annotation-preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      })

      if (!response.ok) {
        throw new Error('Failed to save preferences')
      }
    } catch (error) {
      console.error('Error saving user preferences:', error)
    }
  }, [session?.user?.id])

  // Load user preferences
  const loadUserPreferences = useCallback(async () => {
    if (!session?.user?.id) return null

    try {
      const response = await fetch(`/api/users/${session.user.id}/annotation-preferences`)
      if (response.ok) {
        return await response.json()
      }
    } catch (error) {
      console.error('Error loading user preferences:', error)
    }
    return null
  }, [session?.user?.id])

  // Initialize Adobe PDF Embed API
  const initializeAdobeViewer = useCallback(async () => {
    if (!window.AdobeDC || !viewerRef.current) return

    try {
      setIsLoading(true)
      setError('')

      // Check if we already have a viewer instance for this container
      if (adobeViewRef.current) {
        console.log('Adobe viewer already initialized, skipping')
        setIsLoading(false)
        return
      }

      // Load existing annotations and user preferences (only if authenticated)
      let annotations = []
      let userPreferences = null
      
      if (session?.user?.id) {
        try {
          const [annotationsResult, userPreferencesResult] = await Promise.all([
            loadAnnotations(),
            loadUserPreferences()
          ])
          annotations = annotationsResult || []
          userPreferences = userPreferencesResult
        } catch (error) {
          console.warn('Could not load user data, proceeding without annotations:', error)
        }
      } else {
        console.log('No session found, proceeding without user annotations')
      }

      console.log('Initializing Adobe PDF viewer for document:', documentId)
      
      // Test PDF accessibility first
      try {
        const pdfUrl = `/api/documents/${documentId}/pdf`
        console.log('Testing PDF URL accessibility:', pdfUrl)
        
        const testResponse = await fetch(pdfUrl, { method: 'HEAD' })
        console.log('PDF URL test response:', testResponse.status, testResponse.statusText)
        
        if (!testResponse.ok) {
          throw new Error(`PDF not accessible: ${testResponse.status} ${testResponse.statusText}`)
        }
      } catch (urlError) {
        console.error('Error accessing PDF URL:', urlError)
        throw new Error('Cannot access PDF file')
      }

      // Initialize Adobe View SDK using the recommended approach
      console.log('Creating Adobe DC View with client ID:', process.env.NEXT_PUBLIC_ADOBE_PDF_EMBED_CLIENT_ID)
      
      let adobeDCView: any
      try {
        adobeDCView = new window.AdobeDC.View({
          clientId: process.env.NEXT_PUBLIC_ADOBE_PDF_EMBED_CLIENT_ID || "0d529443db6d4c58849fa3696e1ba2ff",
          divId: viewerRef.current.id
        })

        adobeViewRef.current = adobeDCView
        console.log('Adobe DC View created successfully')
      } catch (initError) {
        console.error('Error creating Adobe DC View:', initError)
        throw new Error('Failed to initialize Adobe PDF viewer')
      }

      // Configure viewer with annotation support
      const previewConfig = {
        embedMode: "FULL_WINDOW",
        enableAnnotationAPIs: true,
        includePDFAnnotations: true,
        showAnnotationTools: true,
        showToolbar: true,
        showCommentsPanel: true,
        showPageControls: true,
        showDownloadPDF: false,
        showPrintPDF: true,
        showZoomControl: true,
        showBookmarks: true,
        showThumbnails: true,
        defaultViewMode: "FIT_PAGE"
      }

      // Preview file
      await adobeDCView.previewFile({
        content: { 
          location: { 
            url: `/api/documents/${documentId}/pdf` 
          }
        },
        metaData: { 
          fileName: documentTitle,
          id: documentId
        }
      }, previewConfig)

      // Register callbacks for annotation events
      adobeDCView.registerCallback(
        window.AdobeDC.View.Enum.CallbackType.SAVE_API,
        async (metaData: any, content: any, options: any) => {
          console.log('Save callback triggered', { metaData, options })
          // This callback is triggered when user saves the PDF with annotations
          // We could save the entire PDF with annotations here if needed
        }
      )

      // Register callback for user settings
      adobeDCView.registerCallback(
        window.AdobeDC.View.Enum.CallbackType.GET_USER_SETTING_API,
        async () => {
          console.log('Getting user settings...')
          return userPreferences?.preferences || {}
        }
      )

      adobeDCView.registerCallback(
        window.AdobeDC.View.Enum.CallbackType.SET_USER_SETTING_API,
        async (settings: any) => {
          console.log('Setting user preferences:', settings)
          await saveUserPreferences({ preferences: settings })
        }
      )

      // Adobe PDF Embed API will handle annotations natively
      // The built-in annotation tools will be available in the PDF toolbar
      console.log('Adobe PDF viewer initialized successfully with built-in annotation support')

      setIsLoading(false)
    } catch (err) {
      console.error('Error initializing Adobe viewer:', err)
      setError('Failed to initialize PDF viewer')
      setIsLoading(false)
    }
  }, [documentId, documentTitle, loadAnnotations, loadUserPreferences, saveAnnotation, saveUserPreferences])

  // Load Adobe PDF Embed API script
  useEffect(() => {
    const loadAdobeScript = () => {
      // Check if script already exists
      const existingScript = document.querySelector('script[src="https://acrobatservices.adobe.com/view-sdk/viewer.js"]')
      if (existingScript) {
        // Script already exists, listen for the ready event
        const handleAdobeReady = () => {
          console.log('Adobe DC View SDK ready')
          setIsScriptLoaded(true)
        }
        
        // Check if already ready
        if (window.AdobeDC) {
          handleAdobeReady()
        } else {
          // Listen for the ready event
          document.addEventListener('adobe_dc_view_sdk.ready', handleAdobeReady, { once: true })
        }
        return () => {}
      }

      // Create and load the script
      const script = document.createElement('script')
      script.src = 'https://acrobatservices.adobe.com/view-sdk/viewer.js'
      script.async = true
      
      const handleAdobeReady = () => {
        console.log('Adobe DC View SDK ready')
        setIsScriptLoaded(true)
      }
      
      // Listen for the ready event (Adobe's recommended approach)
      document.addEventListener('adobe_dc_view_sdk.ready', handleAdobeReady, { once: true })
      
      script.onerror = () => {
        setError('Failed to load Adobe PDF Embed API')
      }
      
      document.head.appendChild(script)
      return () => {}
    }

    return loadAdobeScript()
  }, [])

  // Initialize viewer when script is loaded
  useEffect(() => {
    if (isScriptLoaded && viewerRef.current) {
      // Clear any existing content first
      if (viewerRef.current) {
        viewerRef.current.innerHTML = ''
      }
      
      // Add a timeout to prevent infinite loading
      const timeout = setTimeout(() => {
        if (isLoading) {
          console.error('Adobe PDF viewer initialization timed out')
          setError('PDF viewer initialization timed out. Please try refreshing the page.')
          setIsLoading(false)
        }
      }, 10000) // 10 second timeout
      
      try {
        initializeAdobeViewer().finally(() => {
          clearTimeout(timeout)
        })
      } catch (err) {
        clearTimeout(timeout)
        console.error('Error initializing Adobe viewer:', err)
        setError('Failed to initialize PDF viewer')
        setIsLoading(false)
      }

      return () => {
        clearTimeout(timeout)
      }
    }
  }, [isScriptLoaded, initializeAdobeViewer])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (adobeViewRef.current) {
        try {
          // Clean up Adobe viewer instance
          adobeViewRef.current = null
        } catch (err) {
          console.warn('Error cleaning up Adobe viewer:', err)
        }
      }
      
      // Clear the viewer container
      if (viewerRef.current) {
        viewerRef.current.innerHTML = ''
      }
    }
  }, [])

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-8 ${className}`}>
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
            PDF Viewer Error
          </h3>
          <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md hover:shadow-lg transition-shadow"
          title="Close PDF Viewer"
        >
          <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white dark:bg-gray-900 flex items-center justify-center z-40">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-indigo-300 dark:border-indigo-700 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading PDF viewer...</p>
          </div>
        </div>
      )}

      {/* Adobe PDF Viewer Container */}
      <div
        id={`adobe-pdf-viewer-${documentId}`}
        ref={viewerRef}
        className="w-full h-full rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800"
      />
    </div>
  )
}

// Type declarations for Adobe DC View SDK
declare global {
  interface Window {
    AdobeDC: {
      View: {
        (config: { clientId: string; divId: string }): {
          previewFile: (file: any, config: any) => Promise<any>
          registerCallback: (type: any, callback: Function) => void
          getAnnotationManager: () => Promise<any>
        }
        Enum: {
          CallbackType: {
            SAVE_API: string
            GET_USER_SETTING_API: string
            SET_USER_SETTING_API: string
          }
        }
      }
    }
  }
}