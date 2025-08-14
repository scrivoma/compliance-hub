'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LibraryRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/documents')
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to document library...</p>
      </div>
    </div>
  )
}