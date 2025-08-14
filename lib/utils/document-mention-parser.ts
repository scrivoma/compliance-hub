import { US_STATES, getStateByCode } from '@/lib/constants/states'
import { ALL_CATEGORIES, getCategoryByName, type CategoryItem } from '@/lib/constants/categories'

export interface MentionState {
  code: string
  name: string
  position: number
  length: number
  raw: string
}

export interface MentionCategory {
  id: string
  name: string
  displayName: string
  type: 'vertical' | 'documentType'
  position: number
  length: number
  raw: string
}

export interface DocumentParseResult {
  cleanQuery: string
  stateMentions: MentionState[]
  categoryMentions: MentionCategory[]
  stateCodes: string[]
  categoryIds: string[] // deprecated - use verticalIds and documentTypeIds instead
  verticalIds: string[]
  documentTypeIds: string[]
}

/**
 * Parse a query string to extract @ mentions (states) and # mentions (categories)
 */
export function parseDocumentQuery(query: string): DocumentParseResult {
  const stateMentions: MentionState[] = []
  const categoryMentions: MentionCategory[] = []
  const stateCodes: string[] = []
  const categoryIds: string[] = []
  const verticalIds: string[] = []
  const documentTypeIds: string[] = []
  
  // Regex to match @ mentions and # mentions
  const mentionRegex = /[@#]([a-zA-Z-]+)/g
  
  let cleanQuery = query
  let match
  let offset = 0
  
  while ((match = mentionRegex.exec(query)) !== null) {
    const mentionText = match[1].trim()
    const fullMatch = match[0]
    const position = match.index
    const symbol = fullMatch[0] // @ or #
    
    if (symbol === '@') {
      // Handle state mentions
      const matchedState = findStateMatch(mentionText)
      if (matchedState) {
        stateMentions.push({
          code: matchedState.code,
          name: matchedState.name,
          position: position - offset,
          length: fullMatch.length,
          raw: fullMatch
        })
        
        if (!stateCodes.includes(matchedState.code)) {
          stateCodes.push(matchedState.code)
        }
        
        // Remove the mention from the clean query
        const beforeMention = cleanQuery.slice(0, position - offset)
        const afterMention = cleanQuery.slice(position - offset + fullMatch.length)
        cleanQuery = beforeMention + afterMention
        
        offset += fullMatch.length
      }
    } else if (symbol === '#') {
      // Handle category mentions
      const matchedCategory = findCategoryMatch(mentionText)
      if (matchedCategory) {
        categoryMentions.push({
          id: matchedCategory.id,
          name: matchedCategory.name,
          displayName: matchedCategory.displayName,
          type: matchedCategory.type,
          position: position - offset,
          length: fullMatch.length,
          raw: fullMatch
        })
        
        // Add to appropriate category array and legacy categoryIds
        if (!categoryIds.includes(matchedCategory.id)) {
          categoryIds.push(matchedCategory.id)
        }
        
        if (matchedCategory.type === 'vertical') {
          if (!verticalIds.includes(matchedCategory.id)) {
            verticalIds.push(matchedCategory.id)
          }
        } else if (matchedCategory.type === 'documentType') {
          if (!documentTypeIds.includes(matchedCategory.id)) {
            documentTypeIds.push(matchedCategory.id)
          }
        }
        
        // Remove the mention from the clean query
        const beforeMention = cleanQuery.slice(0, position - offset)
        const afterMention = cleanQuery.slice(position - offset + fullMatch.length)
        cleanQuery = beforeMention + afterMention
        
        offset += fullMatch.length
      }
    }
  }
  
  // Clean up extra whitespace
  cleanQuery = cleanQuery.replace(/\s+/g, ' ').trim()
  
  return {
    cleanQuery,
    stateMentions,
    categoryMentions,
    stateCodes,
    categoryIds,
    verticalIds,
    documentTypeIds
  }
}

/**
 * Find a state that matches the given text (fuzzy matching)
 */
function findStateMatch(text: string): { code: string; name: string } | null {
  const searchText = text.toLowerCase()
  
  const allStates = US_STATES
  
  // Exact matches first
  for (const state of allStates) {
    if (state.code.toLowerCase() === searchText || 
        state.name.toLowerCase() === searchText ||
        state.abbreviation?.toLowerCase() === searchText ||
        state.name.toLowerCase().replace(/\s+/g, '') === searchText) {
      return { code: state.code, name: state.name }
    }
  }
  
  // Partial matches
  for (const state of allStates) {
    if (state.name.toLowerCase().startsWith(searchText) ||
        state.code.toLowerCase().startsWith(searchText) ||
        state.abbreviation?.toLowerCase().startsWith(searchText)) {
      return { code: state.code, name: state.name }
    }
  }
  
  // Fuzzy matches (contains)
  for (const state of allStates) {
    if (state.name.toLowerCase().includes(searchText)) {
      return { code: state.code, name: state.name }
    }
  }
  
  return null
}

/**
 * Find a category that matches the given text (fuzzy matching)
 */
function findCategoryMatch(text: string): CategoryItem | null {
  const searchText = text.toLowerCase()
  
  // Exact matches first
  for (const category of ALL_CATEGORIES) {
    if (category.name.toLowerCase() === searchText || 
        category.displayName.toLowerCase() === searchText ||
        category.displayName.toLowerCase().replace(/\s+/g, '') === searchText ||
        category.displayName.toLowerCase().replace(/\s+/g, '-') === searchText) {
      return category
    }
  }
  
  // Partial matches
  for (const category of ALL_CATEGORIES) {
    if (category.displayName.toLowerCase().startsWith(searchText) ||
        category.name.toLowerCase().startsWith(searchText)) {
      return category
    }
  }
  
  // Fuzzy matches (contains)
  for (const category of ALL_CATEGORIES) {
    if (category.displayName.toLowerCase().includes(searchText) ||
        category.name.toLowerCase().includes(searchText)) {
      return category
    }
  }
  
  return null
}

/**
 * Get current mention being typed at cursor position
 */
export function getCurrentDocumentMention(query: string, cursorPosition: number): {
  mention: string
  startPosition: number
  isTyping: boolean
  symbol: '@' | '#'
} | null {
  // Find the symbol before the cursor
  let symbolPosition = -1
  let symbol: '@' | '#' | null = null
  
  for (let i = cursorPosition - 1; i >= 0; i--) {
    if (query[i] === '@' || query[i] === '#') {
      symbolPosition = i
      symbol = query[i] as '@' | '#'
      break
    }
    if (query[i] === ' ') {
      break // Space before symbol means we're not in a mention
    }
  }
  
  if (symbolPosition === -1 || !symbol) {
    return null
  }
  
  // Find the end of the mention
  let endPosition = cursorPosition
  for (let i = symbolPosition + 1; i < query.length; i++) {
    if (query[i] === ' ' || query[i] === '@' || query[i] === '#' || !/[a-zA-Z-]/.test(query[i])) {
      endPosition = i
      break
    }
    if (i === query.length - 1) {
      endPosition = i + 1
      break
    }
  }
  
  const mention = query.slice(symbolPosition + 1, endPosition)
  
  return {
    mention,
    startPosition: symbolPosition,
    isTyping: cursorPosition > symbolPosition,
    symbol
  }
}

/**
 * Filter states based on search text
 */
export function filterStates(searchText: string, limit: number = 10): Array<{ code: string; name: string; abbreviation: string }> {
  if (!searchText) {
    return US_STATES.slice(0, limit)
  }
  
  const search = searchText.toLowerCase()
  const results: Array<{ code: string; name: string; abbreviation: string; score: number }> = []
  
  for (const state of US_STATES) {
    let score = 0
    
    if (state.code.toLowerCase() === search || 
        state.name.toLowerCase() === search ||
        state.abbreviation?.toLowerCase() === search) {
      score = 100
    }
    else if (state.name.toLowerCase().startsWith(search) ||
             state.code.toLowerCase().startsWith(search) ||
             state.abbreviation?.toLowerCase().startsWith(search)) {
      score = 80
    }
    else if (state.name.toLowerCase().includes(search)) {
      score = 60
    }
    
    if (score > 0) {
      results.push({ ...state, score })
    }
  }
  
  results.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score
    }
    return a.name.localeCompare(b.name)
  })
  
  return results.slice(0, limit)
}

/**
 * Filter categories based on search text
 */
export function filterCategories(searchText: string, limit: number = 10): CategoryItem[] {
  if (!searchText) {
    return ALL_CATEGORIES.slice(0, limit)
  }
  
  const search = searchText.toLowerCase()
  const results: Array<CategoryItem & { score: number }> = []
  
  for (const category of ALL_CATEGORIES) {
    let score = 0
    
    if (category.name.toLowerCase() === search || 
        category.displayName.toLowerCase() === search) {
      score = 100
    }
    else if (category.displayName.toLowerCase().startsWith(search) ||
             category.name.toLowerCase().startsWith(search)) {
      score = 80
    }
    else if (category.displayName.toLowerCase().includes(search) ||
             category.name.toLowerCase().includes(search)) {
      score = 60
    }
    
    if (score > 0) {
      results.push({ ...category, score })
    }
  }
  
  results.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score
    }
    return a.displayName.localeCompare(b.displayName)
  })
  
  return results.slice(0, limit)
}

/**
 * Complete a mention at the specified position
 */
export function completeDocumentMention(
  query: string,
  currentMention: { mention: string; startPosition: number; symbol: '@' | '#' },
  item: { code?: string; name?: string; id?: string; displayName?: string }
): { newQuery: string; newCursorPosition: number } {
  const before = query.slice(0, currentMention.startPosition)
  const after = query.slice(currentMention.startPosition + currentMention.mention.length + 1) // +1 for symbol
  
  let completedMention: string
  if (currentMention.symbol === '@') {
    // State mention
    completedMention = `@${item.code?.toLowerCase()}`
  } else {
    // Category mention
    completedMention = `#${item.name?.toLowerCase()}`
  }
  
  const newQuery = `${before}${completedMention} ${after}`.trim()
  const newCursorPosition = before.length + completedMention.length + 1 // +1 for space
  
  return { newQuery, newCursorPosition }
}