'use client'

import { useState, useEffect } from 'react'
import { Star } from 'lucide-react'
import { addBookmark, removeBookmark, isBookmarked } from '@/lib/tracking'

interface BookmarkButtonProps {
  documentId: string
  title: string
  state?: string
  type?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function BookmarkButton({ 
  documentId, 
  title, 
  state, 
  type, 
  className = '', 
  size = 'md' 
}: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const checkBookmarkStatus = async () => {
      const status = await isBookmarked(documentId)
      setBookmarked(status)
    }
    
    checkBookmarkStatus()
  }, [documentId])

  const handleToggleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (loading) return
    
    setLoading(true)
    
    try {
      if (bookmarked) {
        await removeBookmark(documentId)
        setBookmarked(false)
      } else {
        await addBookmark(documentId, title, state, type)
        setBookmarked(true)
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error)
    } finally {
      setLoading(false)
    }
  }

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  }

  return (
    <button
      onClick={handleToggleBookmark}
      disabled={loading}
      className={`p-1 rounded-full hover:bg-gray-100 transition-colors ${className} ${
        loading ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      title={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
    >
      <Star
        className={`${sizeClasses[size]} transition-colors ${
          bookmarked 
            ? 'fill-yellow-400 text-yellow-400' 
            : 'text-gray-400 hover:text-yellow-400'
        }`}
      />
    </button>
  )
}