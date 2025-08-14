'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Filter } from 'lucide-react'
import { StateDropdown } from '../search/StateDropdown'
import { StatePill } from '../search/StatePill'
import { CategoryDropdown } from './CategoryDropdown'
import { CategoryPill } from './CategoryPill'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { 
  parseDocumentQuery, 
  getCurrentDocumentMention, 
  filterStates, 
  filterCategories,
  completeDocumentMention,
  type MentionState,
  type MentionCategory,
  type DocumentParseResult
} from '@/lib/utils/document-mention-parser'
import { type CategoryItem } from '@/lib/constants/categories'

interface DocumentMentionInputProps {
  value: string
  onChange: (value: string) => void
  onFilter: (filters: DocumentParseResult) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  showPills?: boolean
}

export function DocumentMentionInput({
  value,
  onChange,
  onFilter,
  placeholder = "Search documents... Use @state and #category to filter",
  disabled = false,
  className = '',
  showPills = true
}: DocumentMentionInputProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [filteredStates, setFilteredStates] = useState<Array<{ code: string; name: string; abbreviation: string }>>([])
  const [filteredCategories, setFilteredCategories] = useState<CategoryItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [currentMention, setCurrentMention] = useState<string>('')
  const [currentSymbol, setCurrentSymbol] = useState<'@' | '#' | null>(null)
  const [cursorPosition, setCursorPosition] = useState(0)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse the current query to extract mentions and clean query
  const parsedQuery = parseDocumentQuery(value)

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
    
    // Trigger filtering
    const parsed = parseDocumentQuery(newValue)
    onFilter(parsed)
    
    // Check if we're typing a mention
    const mention = getCurrentDocumentMention(newValue, newCursorPosition)
    
    if (mention && mention.isTyping) {
      setCurrentMention(mention.mention)
      setCurrentSymbol(mention.symbol)
      
      if (mention.symbol === '@') {
        // Filter states
        setFilteredStates(filterStates(mention.mention, 10))
        setFilteredCategories([])
      } else if (mention.symbol === '#') {
        // Filter categories
        setFilteredCategories(filterCategories(mention.mention, 10))
        setFilteredStates([])
      }
      
      setSelectedIndex(0)
      setShowDropdown(true)
      updateDropdownPosition(mention.startPosition)
    } else {
      // Hide dropdown
      setShowDropdown(false)
      setCurrentMention('')
      setCurrentSymbol(null)
    }
  }, [onChange, onFilter, updateDropdownPosition])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return
    
    const items = currentSymbol === '@' ? filteredStates : filteredCategories
    if (items.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % items.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev === 0 ? items.length - 1 : prev - 1)
        break
      case 'Tab':
      case 'Enter':
        if (e.key === 'Tab') {
          e.preventDefault()
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
        }
        if (currentSymbol === '@' && filteredStates[selectedIndex]) {
          selectState(filteredStates[selectedIndex])
        } else if (currentSymbol === '#' && filteredCategories[selectedIndex]) {
          selectCategory(filteredCategories[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowDropdown(false)
        setCurrentMention('')
        setCurrentSymbol(null)
        break
    }
  }, [showDropdown, filteredStates, filteredCategories, selectedIndex, currentSymbol])

  // Select a state from dropdown
  const selectState = useCallback((state: { code: string; name: string; abbreviation: string }) => {
    if (!inputRef.current) return

    const mention = getCurrentDocumentMention(value, cursorPosition)
    if (!mention) return

    const result = completeDocumentMention(value, mention, { code: state.code, name: state.name })
    
    onChange(result.newQuery)
    setShowDropdown(false)
    setCurrentMention('')
    setCurrentSymbol(null)
    
    // Trigger filtering with new query
    const parsed = parseDocumentQuery(result.newQuery)
    onFilter(parsed)
    
    // Set cursor position after the completed mention
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(result.newCursorPosition, result.newCursorPosition)
      }
    }, 0)
  }, [value, cursorPosition, onChange, onFilter])

  // Select a category from dropdown
  const selectCategory = useCallback((category: CategoryItem) => {
    if (!inputRef.current) return

    const mention = getCurrentDocumentMention(value, cursorPosition)
    if (!mention) return

    const result = completeDocumentMention(value, mention, { 
      id: category.id, 
      name: category.name, 
      displayName: category.displayName 
    })
    
    onChange(result.newQuery)
    setShowDropdown(false)
    setCurrentMention('')
    setCurrentSymbol(null)
    
    // Trigger filtering with new query
    const parsed = parseDocumentQuery(result.newQuery)
    onFilter(parsed)
    
    // Set cursor position after the completed mention
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(result.newCursorPosition, result.newCursorPosition)
      }
    }, 0)
  }, [value, cursorPosition, onChange, onFilter])

  // Handle removing a state pill
  const handleRemoveState = useCallback((stateCode: string) => {
    const mentions = parsedQuery.stateMentions.filter(m => m.code !== stateCode)
    let newQuery = value
    
    // Remove the mention from the query
    parsedQuery.stateMentions
      .filter(m => m.code === stateCode)
      .forEach(mention => {
        newQuery = newQuery.replace(mention.raw, '').replace(/\s+/g, ' ').trim()
      })
    
    onChange(newQuery)
    
    // Trigger filtering with new query
    const parsed = parseDocumentQuery(newQuery)
    onFilter(parsed)
  }, [value, onChange, onFilter, parsedQuery.stateMentions])

  // Handle removing a category pill
  const handleRemoveCategory = useCallback((categoryId: string) => {
    const mentions = parsedQuery.categoryMentions.filter(m => m.id !== categoryId)
    let newQuery = value
    
    // Remove the mention from the query
    parsedQuery.categoryMentions
      .filter(m => m.id === categoryId)
      .forEach(mention => {
        newQuery = newQuery.replace(mention.raw, '').replace(/\s+/g, ' ').trim()
      })
    
    onChange(newQuery)
    
    // Trigger filtering with new query
    const parsed = parseDocumentQuery(newQuery)
    onFilter(parsed)
  }, [value, onChange, onFilter, parsedQuery.categoryMentions])

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
      <div className="relative">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(
                "pl-4 pr-12 py-3 text-base h-auto",
                className
              )}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <Filter className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Pills - Show selected states and categories */}
        {showPills && (parsedQuery.stateCodes.length > 0 || parsedQuery.categoryIds.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {/* State Pills */}
            {parsedQuery.stateCodes.map((stateCode) => {
              const mention = parsedQuery.stateMentions.find(m => m.code === stateCode)
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
            
            {/* Category Pills */}
            {parsedQuery.categoryIds.map((categoryId) => {
              const mention = parsedQuery.categoryMentions.find(m => m.id === categoryId)
              if (!mention) return null
              
              return (
                <CategoryPill
                  key={categoryId}
                  category={mention}
                  onRemove={() => handleRemoveCategory(categoryId)}
                  isEditable={!disabled}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* State Dropdown */}
      <StateDropdown
        isOpen={showDropdown && currentSymbol === '@'}
        states={filteredStates}
        selectedIndex={selectedIndex}
        onSelect={selectState}
        onClose={() => setShowDropdown(false)}
        position={dropdownPosition}
        searchText={currentMention}
      />

      {/* Category Dropdown */}
      <CategoryDropdown
        isOpen={showDropdown && currentSymbol === '#'}
        categories={filteredCategories}
        selectedIndex={selectedIndex}
        onSelect={selectCategory}
        onClose={() => setShowDropdown(false)}
        position={dropdownPosition}
        searchText={currentMention}
      />
    </div>
  )
}