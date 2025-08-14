'use client'

import React, { useEffect, useRef } from 'react'
import { Tag, CheckCircle, Folder, FileText } from 'lucide-react'
import { type CategoryItem } from '@/lib/constants/categories'

interface CategoryDropdownProps {
  isOpen: boolean
  categories: CategoryItem[]
  selectedIndex: number
  onSelect: (category: CategoryItem) => void
  onClose: () => void
  position: { top: number; left: number }
  searchText: string
}

export function CategoryDropdown({
  isOpen,
  categories,
  selectedIndex,
  onSelect,
  onClose,
  position,
  searchText
}: CategoryDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selectedItemRef = useRef<HTMLButtonElement>(null)

  // Auto-scroll to selected item
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      })
    }
  }, [selectedIndex])

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Group categories by type
  const verticals = categories.filter(cat => cat.type === 'vertical')
  const documentTypes = categories.filter(cat => cat.type === 'documentType')

  return (
    <div
      ref={dropdownRef}
      className="absolute z-50 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="p-2 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
          <Tag className="h-3 w-3" />
          <span>
            {searchText ? `Categories matching "${searchText}"` : 'Select a category'}
          </span>
        </div>
      </div>

      <div className="py-1">
        {categories.length === 0 ? (
          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
            No categories found matching "{searchText}"
          </div>
        ) : (
          <>
            {/* Verticals */}
            {verticals.length > 0 && (
              <>
                <div className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 uppercase tracking-wide">
                  Verticals
                </div>
                {verticals.map((category, index) => {
                  const globalIndex = categories.findIndex(c => c.id === category.id)
                  return (
                    <button
                      key={category.id}
                      ref={globalIndex === selectedIndex ? selectedItemRef : null}
                      onClick={() => onSelect(category)}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 focus:bg-gray-50 dark:focus:bg-gray-700 focus:outline-none transition-colors ${
                        globalIndex === selectedIndex ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="flex-shrink-0">
                            <div className="h-4 w-4 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                              <Folder className="h-2 w-2 text-purple-600 dark:text-purple-400" />
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium">
                              {highlightMatch(category.displayName, searchText)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              #{category.name}
                            </div>
                          </div>
                        </div>
                        {globalIndex === selectedIndex && (
                          <CheckCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </>
            )}

            {/* Document Types */}
            {documentTypes.length > 0 && (
              <>
                {verticals.length > 0 && <div className="border-t border-gray-100 dark:border-gray-700"></div>}
                <div className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 uppercase tracking-wide">
                  Document Types
                </div>
                {documentTypes.map((category, index) => {
                  const globalIndex = categories.findIndex(c => c.id === category.id)
                  return (
                    <button
                      key={category.id}
                      ref={globalIndex === selectedIndex ? selectedItemRef : null}
                      onClick={() => onSelect(category)}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 focus:bg-gray-50 dark:focus:bg-gray-700 focus:outline-none transition-colors ${
                        globalIndex === selectedIndex ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="flex-shrink-0">
                            <div className="h-4 w-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <FileText className="h-2 w-2 text-blue-600 dark:text-blue-400" />
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium">
                              {highlightMatch(category.displayName, searchText)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              #{category.name}
                            </div>
                          </div>
                        </div>
                        {globalIndex === selectedIndex && (
                          <CheckCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </>
            )}
          </>
        )}
      </div>

      {categories.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              {categories.length === 1 ? 'Press TAB to select' : 'Use ↑↓ arrows to navigate'}
            </span>
            <span>ESC to cancel</span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Highlight matching text in category name
 */
function highlightMatch(text: string, searchText: string): React.ReactNode {
  if (!searchText) return text

  const regex = new RegExp(`(${searchText})`, 'gi')
  const parts = text.split(regex)

  return parts.map((part, index) => {
    if (part.toLowerCase() === searchText.toLowerCase()) {
      return (
        <span key={index} className="bg-yellow-200 dark:bg-yellow-900/60 text-yellow-800 dark:text-yellow-200 font-semibold">
          {part}
        </span>
      )
    }
    return part
  })
}