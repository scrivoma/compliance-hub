'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Send } from 'lucide-react'
import { StateDropdown } from './StateDropdown'
import { 
  parseQueryMentions, 
  getCurrentMention, 
  filterStates, 
  completeMention,
  type MentionState
} from '@/lib/utils/mention-parser'
import { getStateDisplayName } from '@/lib/constants/states'

interface InlineMentionInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (query: string, states: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function InlineMentionInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Ask about compliance requirements... Use @state to filter by jurisdiction",
  disabled = false,
  className = ''
}: InlineMentionInputProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [filteredStates, setFilteredStates] = useState<Array<{ code: string; name: string; abbreviation: string }>>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [currentMention, setCurrentMention] = useState<string>('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const [isComposing, setIsComposing] = useState(false)
  
  const editableRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse the current query to extract mentions and clean query
  const parsedQuery = parseQueryMentions(value)

  // Convert text with @ mentions to a display string (without React elements in contentEditable)
  const getDisplayValue = useCallback(() => {
    if (!value) return ''
    
    // For contentEditable, we'll use a simpler approach
    // We'll style the text but not insert React components
    return value
  }, [value])

  // Handle content change in contentEditable
  const handleContentChange = useCallback(() => {
    if (!editableRef.current || isComposing) return
    
    const textContent = editableRef.current.textContent || ''
    const selection = window.getSelection()
    const cursorPos = selection ? selection.anchorOffset : 0
    
    onChange(textContent)
    setCursorPosition(cursorPos)
    
    // Check if we're typing a mention
    const mention = getCurrentMention(textContent, cursorPos)
    
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
  }, [onChange, isComposing])

  // Update dropdown position based on cursor
  const updateDropdownPosition = useCallback((mentionStart: number) => {
    if (!editableRef.current || !containerRef.current) return

    const editable = editableRef.current
    const container = containerRef.current
    
    // Create a range to measure text width up to mention start
    const range = document.createRange()
    const textNode = editable.firstChild
    
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      range.setStart(textNode, Math.min(mentionStart, textNode.textContent?.length || 0))
      range.setEnd(textNode, Math.min(mentionStart, textNode.textContent?.length || 0))
      
      const rect = range.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      
      setDropdownPosition({
        top: rect.bottom - containerRect.top + 5,
        left: rect.left - containerRect.left
      })
    }
  }, [])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (showDropdown && filteredStates.length > 0) {
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
      return
    }
    
    // Handle form submission
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [showDropdown, filteredStates, selectedIndex])

  // Select a state from dropdown
  const selectState = useCallback((state: { code: string; name: string; abbreviation: string }) => {
    if (!editableRef.current) return

    const textContent = editableRef.current.textContent || ''
    const mention = getCurrentMention(textContent, cursorPosition)
    
    if (!mention) return

    const result = completeMention(textContent, mention, state.code, state.name)
    
    onChange(result.newQuery)
    setShowDropdown(false)
    setCurrentMention('')
    
    // Focus back to editable
    setTimeout(() => {
      if (editableRef.current) {
        editableRef.current.focus()
        // Set cursor position after the completed mention
        const range = document.createRange()
        const selection = window.getSelection()
        const textNode = editableRef.current.firstChild
        
        if (textNode && selection) {
          const newPos = Math.min(result.newCursorPosition, textNode.textContent?.length || 0)
          range.setStart(textNode, newPos)
          range.setEnd(textNode, newPos)
          selection.removeAllRanges()
          selection.addRange(range)
        }
      }
    }, 0)
  }, [cursorPosition, onChange])

  // Handle removing a mention pill
  const handleRemoveMention = useCallback((stateCode: string) => {
    // Find and remove the mention from the query
    let newQuery = value
    
    parsedQuery.mentions
      .filter(m => m.code === stateCode)
      .forEach(mention => {
        newQuery = newQuery.replace(mention.raw, '').replace(/\s+/g, ' ').trim()
      })
    
    onChange(newQuery)
    
    // Focus back to editable
    setTimeout(() => {
      if (editableRef.current) {
        editableRef.current.focus()
      }
    }, 0)
  }, [value, onChange, parsedQuery.mentions])

  // Handle form submission
  const handleSubmit = useCallback(() => {
    if (!value.trim()) return
    
    const parsed = parseQueryMentions(value)
    onSubmit(parsed.cleanQuery, parsed.stateCodes)
  }, [value, onSubmit])

  // Update content when value changes externally
  useEffect(() => {
    if (editableRef.current && editableRef.current.textContent !== value) {
      editableRef.current.textContent = value
      // Apply styling to @ mentions without React components
      styleContentEditable()
    }
  }, [value])

  // Style @ mentions in contentEditable without React components
  const styleContentEditable = useCallback(() => {
    if (!editableRef.current) return
    
    const element = editableRef.current
    const text = element.textContent || ''
    
    // Clear any existing HTML and set plain text
    element.innerHTML = ''
    
    if (!text) {
      element.innerHTML = `<span style="color: #9ca3af;">${placeholder}</span>`
      return
    }
    
    // Parse mentions and create styled HTML
    let html = ''
    let lastIndex = 0
    const sortedMentions = [...parsedQuery.mentions].sort((a, b) => a.position - b.position)
    
    sortedMentions.forEach((mention) => {
      // Add text before mention
      if (mention.position > lastIndex) {
        const textBefore = text.slice(lastIndex, mention.position)
        html += textBefore
      }
      
      // Add styled mention (as styled text, not React component)
      html += `<span style="display: inline-flex; align-items: center; padding: 2px 8px; margin: 0 2px; border-radius: 9999px; font-size: 12px; font-weight: 500; background-color: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe;" data-mention-code="${mention.code}">${getStateDisplayName(mention.code)}<button style="margin-left: 4px; color: #4f46e5; cursor: pointer;" onclick="window.removeMention?.('${mention.code}')" contenteditable="false">×</button></span>`
      
      lastIndex = mention.position + mention.length
    })
    
    // Add remaining text
    if (lastIndex < text.length) {
      html += text.slice(lastIndex)
    }
    
    element.innerHTML = html
  }, [parsedQuery.mentions, placeholder])

  // Expose remove mention function globally for onclick handlers
  useEffect(() => {
    (window as any).removeMention = handleRemoveMention
    return () => {
      delete (window as any).removeMention
    }
  }, [handleRemoveMention])

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
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="relative">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <Search className="h-6 w-6 text-gray-400 dark:text-gray-500" />
          </div>
          <div className="relative flex-1">
            <div
              ref={editableRef}
              contentEditable={!disabled}
              suppressContentEditableWarning={true}
              onInput={handleContentChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => {
                setIsComposing(false)
                handleContentChange()
              }}
              className="block w-full min-h-[3.5rem] pl-4 pr-12 py-4 border border-gray-300 dark:border-gray-600 rounded-lg text-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm hover:border-gray-400 dark:hover:border-gray-500 transition-colors focus:outline-none"
              style={{ lineHeight: '1.4' }}
              dangerouslySetInnerHTML={{ __html: value ? '' : `<span style="color: #9ca3af;">${placeholder}</span>` }}
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