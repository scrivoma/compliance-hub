'use client'

import React from 'react'
import { X, MapPin } from 'lucide-react'

interface StatePillProps {
  code: string
  name: string
  onRemove: () => void
  isEditable?: boolean
  className?: string
}

export function StatePill({ 
  code, 
  name, 
  onRemove, 
  isEditable = true, 
  className = '' 
}: StatePillProps) {
  const isSpecial = code === 'ALL' || code === 'MULTIPLE'
  
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
      isSpecial 
        ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700' 
        : 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700'
    } ${className}`}>
      <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
      <span className="truncate max-w-24">{name}</span>
      {isEditable && (
        <button
          onClick={onRemove}
          className={`ml-1 p-0.5 rounded-full transition-colors ${
            isSpecial
              ? 'hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200'
              : 'hover:bg-indigo-200 dark:hover:bg-indigo-800 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200'
          }`}
          title={`Remove ${name}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

interface InlineStatePillProps {
  code: string
  name: string
  onRemove: () => void
  position: 'start' | 'middle' | 'end'
}

export function InlineStatePill({ 
  code, 
  name, 
  onRemove, 
  position 
}: InlineStatePillProps) {
  const isSpecial = code === 'ALL' || code === 'MULTIPLE'
  
  return (
    <span 
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium transition-all duration-200 ${
        isSpecial 
          ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700' 
          : 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700'
      } ${position === 'start' ? 'mr-1' : position === 'end' ? 'ml-1' : 'mx-1'}`}
      contentEditable={false}
      suppressContentEditableWarning={true}
    >
      <span className="truncate max-w-20">{name}</span>
      <button
        onClick={onRemove}
        className={`ml-1 p-0.5 rounded-full transition-colors ${
          isSpecial
            ? 'hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200'
            : 'hover:bg-indigo-200 dark:hover:bg-indigo-800 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200'
        }`}
        title={`Remove ${name}`}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  )
}