import { US_STATES, SPECIAL_STATE_OPTIONS, getStateByCode } from '@/lib/constants/states'

export interface MentionState {
  code: string
  name: string
  position: number // Position in text where @ mention appears
  length: number // Length of the mention text
  raw: string // Raw text that was matched (e.g., "@cal", "@california")
}

export interface ParseResult {
  cleanQuery: string // Query with @ mentions removed
  mentions: MentionState[]
  stateCodes: string[] // Array of state codes for API
}

/**
 * Parse a query string to extract @ mentions and clean the query
 */
export function parseQueryMentions(query: string): ParseResult {
  const mentions: MentionState[] = []
  const stateCodes: string[] = []
  
  // Regex to match @ mentions - matches @word (letters only, no spaces)
  const mentionRegex = /@([a-zA-Z]+)/g
  
  let cleanQuery = query
  let match
  
  // Track offset for position adjustments as we remove mentions
  let offset = 0
  
  while ((match = mentionRegex.exec(query)) !== null) {
    const mentionText = match[1].trim()
    const fullMatch = match[0]
    const position = match.index
    
    // Find matching state
    const matchedState = findStateMatch(mentionText)
    
    if (matchedState) {
      mentions.push({
        code: matchedState.code,
        name: matchedState.name,
        position: position - offset,
        length: fullMatch.length,
        raw: fullMatch
      })
      
      // Add to state codes if not already present
      if (!stateCodes.includes(matchedState.code)) {
        stateCodes.push(matchedState.code)
      }
      
      // Remove the mention from the clean query
      const beforeMention = cleanQuery.slice(0, position - offset)
      const afterMention = cleanQuery.slice(position - offset + fullMatch.length)
      cleanQuery = beforeMention + afterMention
      
      // Update offset for next iteration
      offset += fullMatch.length
    }
  }
  
  // Clean up extra whitespace
  cleanQuery = cleanQuery.replace(/\s+/g, ' ').trim()
  
  return {
    cleanQuery,
    mentions,
    stateCodes
  }
}

/**
 * Find a state that matches the given text (fuzzy matching)
 */
function findStateMatch(text: string): { code: string; name: string } | null {
  const searchText = text.toLowerCase()
  
  // Check all states (US states + special options)
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
 * Get current @ mention being typed at cursor position
 */
export function getCurrentMention(query: string, cursorPosition: number): {
  mention: string
  startPosition: number
  isTyping: boolean
} | null {
  // Find the @ symbol before the cursor
  let atPosition = -1
  for (let i = cursorPosition - 1; i >= 0; i--) {
    if (query[i] === '@') {
      atPosition = i
      break
    }
    if (query[i] === ' ') {
      break // Space before @ means we're not in a mention
    }
  }
  
  if (atPosition === -1) {
    return null
  }
  
  // Find the end of the mention (next space, @, or end of string)
  let endPosition = cursorPosition
  for (let i = atPosition + 1; i < query.length; i++) {
    if (query[i] === ' ' || query[i] === '@' || !/[a-zA-Z]/.test(query[i])) {
      endPosition = i
      break
    }
    if (i === query.length - 1) {
      endPosition = i + 1
      break
    }
  }
  
  const mention = query.slice(atPosition + 1, endPosition)
  
  return {
    mention,
    startPosition: atPosition,
    isTyping: cursorPosition > atPosition
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
  const allStates = US_STATES
  
  const results: Array<{ code: string; name: string; abbreviation: string; score: number }> = []
  
  for (const state of allStates) {
    let score = 0
    
    // Exact matches get highest score
    if (state.code.toLowerCase() === search || 
        state.name.toLowerCase() === search ||
        state.abbreviation?.toLowerCase() === search) {
      score = 100
    }
    // Starts with matches get high score
    else if (state.name.toLowerCase().startsWith(search) ||
             state.code.toLowerCase().startsWith(search) ||
             state.abbreviation?.toLowerCase().startsWith(search)) {
      score = 80
    }
    // Contains matches get lower score
    else if (state.name.toLowerCase().includes(search)) {
      score = 60
    }
    
    if (score > 0) {
      results.push({ ...state, score })
    }
  }
  
  // Sort by score descending, then by name
  results.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score
    }
    return a.name.localeCompare(b.name)
  })
  
  return results.slice(0, limit)
}

/**
 * Insert a completed mention into the query at the specified position
 */
export function insertMention(
  query: string,
  mentionStartPosition: number,
  mentionEndPosition: number,
  stateCode: string,
  stateName: string
): string {
  const before = query.slice(0, mentionStartPosition)
  const after = query.slice(mentionEndPosition)
  
  return `${before}@${stateName.toLowerCase().replace(/\s+/g, '')} ${after}`.trim()
}

/**
 * Replace the current partial mention with a completed one
 */
export function completeMention(
  query: string,
  currentMention: { mention: string; startPosition: number },
  stateCode: string,
  stateName: string
): { newQuery: string; newCursorPosition: number } {
  const before = query.slice(0, currentMention.startPosition)
  const after = query.slice(currentMention.startPosition + currentMention.mention.length + 1) // +1 for @
  
  const completedMention = `@${stateCode.toLowerCase()}`
  const newQuery = `${before}${completedMention} ${after}`.trim()
  const newCursorPosition = before.length + completedMention.length + 1 // +1 for space
  
  return { newQuery, newCursorPosition }
}