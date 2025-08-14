'use client'

import React from 'react'
import { X, Folder, FileText } from 'lucide-react'
import { type CategoryItem } from '@/lib/constants/categories'

interface CategoryPillProps {
  category: CategoryItem
  onRemove: () => void
  isEditable?: boolean
  className?: string
}

export function CategoryPill({ 
  category, 
  onRemove, 
  isEditable = true, 
  className = '' 
}: CategoryPillProps) {
  const isVertical = category.type === 'vertical'
  const Icon = isVertical ? Folder : FileText
  
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
      isVertical 
        ? 'bg-purple-100 text-purple-800 border border-purple-200' 
        : 'bg-blue-100 text-blue-800 border border-blue-200'
    } ${className}`}>
      <Icon className="h-3 w-3 mr-1 flex-shrink-0" />
      <span className="truncate max-w-24">{category.displayName}</span>
      {isEditable && (
        <button
          onClick={onRemove}
          className={`ml-1 p-0.5 rounded-full transition-colors ${
            isVertical
              ? 'hover:bg-purple-200 text-purple-600 hover:text-purple-800'
              : 'hover:bg-blue-200 text-blue-600 hover:text-blue-800'
          }`}
          title={`Remove ${category.displayName}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

interface InlineCategoryPillProps {
  category: CategoryItem
  onRemove: () => void
  position: 'start' | 'middle' | 'end'
}

export function InlineCategoryPill({ 
  category, 
  onRemove, 
  position 
}: InlineCategoryPillProps) {
  const isVertical = category.type === 'vertical'
  const Icon = isVertical ? Folder : FileText
  
  return (
    <span 
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium transition-all duration-200 ${
        isVertical 
          ? 'bg-purple-100 text-purple-800 border border-purple-200' 
          : 'bg-blue-100 text-blue-800 border border-blue-200'
      } ${position === 'start' ? 'mr-1' : position === 'end' ? 'ml-1' : 'mx-1'}`}
      contentEditable={false}
      suppressContentEditableWarning={true}
    >
      <Icon className="h-2.5 w-2.5 mr-1 flex-shrink-0" />
      <span className="truncate max-w-20">{category.displayName}</span>
      <button
        onClick={onRemove}
        className={`ml-1 p-0.5 rounded-full transition-colors ${
          isVertical
            ? 'hover:bg-purple-200 text-purple-600 hover:text-purple-800'
            : 'hover:bg-blue-200 text-blue-600 hover:text-blue-800'
        }`}
        title={`Remove ${category.displayName}`}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  )
}