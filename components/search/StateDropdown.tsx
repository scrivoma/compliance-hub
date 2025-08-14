'use client'

import React, { useEffect, useRef } from 'react'
import { MapPin, CheckCircle } from 'lucide-react'

interface StateOption {
  code: string
  name: string
  abbreviation: string
}

interface StateDropdownProps {
  isOpen: boolean
  states: StateOption[]
  selectedIndex: number
  onSelect: (state: StateOption) => void
  onClose: () => void
  position: { top: number; left: number }
  searchText: string
}

export function StateDropdown({
  isOpen,
  states,
  selectedIndex,
  onSelect,
  onClose,
  position,
  searchText
}: StateDropdownProps) {
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
          <MapPin className="h-3 w-3" />
          <span>
            {searchText ? `States matching "${searchText}"` : 'Select a state'}
          </span>
        </div>
      </div>

      <div className="py-1">
        {states.length === 0 ? (
          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
            No states found matching "{searchText}"
          </div>
        ) : (
          states.map((state, index) => (
            <button
              key={state.code}
              ref={index === selectedIndex ? selectedItemRef : null}
              onClick={() => onSelect(state)}
              className={`w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 focus:bg-gray-50 dark:focus:bg-gray-700 focus:outline-none transition-colors ${
                index === selectedIndex ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100' : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="flex-shrink-0">
                    {state.code === 'ALL' ? (
                      <div className="h-4 w-4 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400"></div>
                      </div>
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400"></div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {highlightMatch(state.name, searchText)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {state.abbreviation}
                    </div>
                  </div>
                </div>
                {index === selectedIndex && (
                  <CheckCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {states.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              {states.length === 1 ? 'Press TAB to select' : 'Use ↑↓ arrows to navigate'}
            </span>
            <span>ESC to cancel</span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Highlight matching text in state name
 */
function highlightMatch(text: string, searchText: string): React.ReactNode {
  if (!searchText) return text

  const regex = new RegExp(`(${searchText})`, 'gi')
  const parts = text.split(regex)

  return parts.map((part, index) => {
    if (part.toLowerCase() === searchText.toLowerCase()) {
      return (
        <span key={index} className="bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 font-semibold">
          {part}
        </span>
      )
    }
    return part
  })
}