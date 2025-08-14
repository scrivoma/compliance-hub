'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Send } from 'lucide-react'
import { StateDropdown } from './StateDropdown'
import { StatePill } from './StatePill'
import { 
  parseQueryMentions, 
  getCurrentMention, 
  filterStates, 
  completeMention,
  insertMention,
  type MentionState
} from '@/lib/utils/mention-parser'

interface MentionInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (query: string, states: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function MentionInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Ask about compliance requirements... Use @state to filter by jurisdiction",
  disabled = false,
  className = ''
}: MentionInputProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [filteredStates, setFilteredStates] = useState<Array<{ code: string; name: string; abbreviation: string }>>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [currentMention, setCurrentMention] = useState<string>('')
  const [cursorPosition, setCursorPosition] = useState(0)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse the current query to extract mentions and clean query
  const parsedQuery = parseQueryMentions(value)

  // Update dropdown position based on cursor
  const updateDropdownPosition = useCallback((mentionStart: number) => {
    if (!inputRef.current || !containerRef.current) return

    const input = inputRef.current
    const container = containerRef.current
    
    // Create a temporary span to measure text width
    const tempSpan = document.createElement('span')
    tempSpan.style.cssText = window.getComputedStyle(input).cssText
    tempSpan.style.position = 'absolute'
    tempSpan.style.visibility = 'hidden'
    tempSpan.style.whiteSpace = 'pre'
    tempSpan.textContent = value.slice(0, mentionStart)
    
    document.body.appendChild(tempSpan)
    const textWidth = tempSpan.offsetWidth
    document.body.removeChild(tempSpan)
    
    const containerRect = container.getBoundingClientRect()
    const inputRect = input.getBoundingClientRect()
    
    setDropdownPosition({
      top: inputRect.bottom - containerRect.top + 5,
      left: inputRect.left - containerRect.left + textWidth + 10
    })
  }, [value])

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    const newCursorPosition = e.target.selectionStart || 0
    
    onChange(newValue)
    setCursorPosition(newCursorPosition)
    
    // Check if we're typing a mention
    const mention = getCurrentMention(newValue, newCursorPosition)
    
    if (mention && mention.isTyping) {
      // Show dropdown and filter states
      setCurrentMention(mention.mention)
      setFilteredStates(filterStates(mention.mention, 10))
      setSelectedIndex(0)
      setShowDropdown(true)
      
      // Calculate dropdown position
      updateDropdownPosition(mention.startPosition)
    } else {
      // Hide dropdown
      setShowDropdown(false)
      setCurrentMention('')
    }
  }, [onChange, updateDropdownPosition])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || filteredStates.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % filteredStates.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev === 0 ? filteredStates.length - 1 : prev - 1)
        break
      case 'Tab':
      case 'Enter':
        if (e.key === 'Tab') {
          e.preventDefault()
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
        }
        if (filteredStates[selectedIndex]) {
          selectState(filteredStates[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowDropdown(false)
        setCurrentMention('')
        break
    }
  }, [showDropdown, filteredStates, selectedIndex])

  // Select a state from dropdown
  const selectState = useCallback((state: { code: string; name: string; abbreviation: string }) => {
    if (!inputRef.current) return

    const mention = getCurrentMention(value, cursorPosition)
    if (!mention) return

    const result = completeMention(value, mention, state.code, state.name)
    
    onChange(result.newQuery)
    setShowDropdown(false)
    setCurrentMention('')
    
    // Set cursor position after the completed mention
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(result.newCursorPosition, result.newCursorPosition)
      }
    }, 0)
  }, [value, cursorPosition, onChange])

  // Handle form submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    
    if (!value.trim()) return
    
    const parsed = parseQueryMentions(value)
    onSubmit(parsed.cleanQuery, parsed.stateCodes)
  }, [value, onSubmit])

  // Handle removing a state pill
  const handleRemoveState = useCallback((stateCode: string) => {
    // Find and remove the mention from the query
    const mentions = parsedQuery.mentions.filter(m => m.code !== stateCode)
    let newQuery = value
    
    // Remove the mention from the query by finding it and replacing it
    parsedQuery.mentions
      .filter(m => m.code === stateCode)
      .forEach(mention => {
        newQuery = newQuery.replace(mention.raw, '').replace(/\s+/g, ' ').trim()
      })
    
    onChange(newQuery)
  }, [value, onChange, parsedQuery.mentions])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <Search className="h-6 w-6 text-gray-400 dark:text-gray-500" />
          </div>
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="block w-full pl-4 pr-12 py-4 border border-gray-300 dark:border-gray-600 rounded-lg text-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
            />
            <button
              type="submit"
              disabled={disabled || !value.trim()}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:text-gray-400 dark:disabled:text-gray-500 transition-colors"
            >
              {disabled ? (
                <div className="h-5 w-5 border-2 border-indigo-300 dark:border-indigo-600 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* State Pills - Show selected states above input */}
        {parsedQuery.stateCodes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {parsedQuery.stateCodes.map((stateCode) => {
              const mention = parsedQuery.mentions.find(m => m.code === stateCode)
              return (
                <StatePill
                  key={stateCode}
                  code={stateCode}
                  name={mention?.name || stateCode}
                  onRemove={() => handleRemoveState(stateCode)}
                  isEditable={!disabled}
                />
              )
            })}
          </div>
        )}
      </form>

      {/* Dropdown */}
      <StateDropdown
        isOpen={showDropdown}
        states={filteredStates}
        selectedIndex={selectedIndex}
        onSelect={selectState}
        onClose={() => setShowDropdown(false)}
        position={dropdownPosition}
        searchText={currentMention}
      />
    </div>
  )
}