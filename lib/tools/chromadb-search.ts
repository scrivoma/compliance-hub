import { llamaIndexDocumentService } from '@/lib/services/llamaindex-document-service'

export interface ChromaDBSearchParams {
  query: string
  states?: string[]
  topK?: number
}

export interface ChromaDBSearchResult {
  answer: string
  citations: Array<{
    id: string
    title: string
    url: string
    page?: number
    source?: {
      title: string
      type: string
    }
  }>
  searchResults: Array<{
    content: string
    metadata: any
    score: number
  }>
  query: string
  states?: string[]
}

export class ChromaDBSearchTool {
  static async search(params: ChromaDBSearchParams): Promise<ChromaDBSearchResult> {
    const { query, states = [], topK = 5 } = params

    console.log('ChromaDB search tool called:', { query, states, topK })

    try {
      // Use the existing document service to search
      const searchOptions = {
        topK,
        states: states.length > 0 ? states : undefined
      }

      const searchResults = await llamaIndexDocumentService.searchWithCitations(query, searchOptions)

      if (searchResults.results.length === 0) {
        // Provide more specific responses based on the query context
        let answer = "I don't have information about that in my compliance database."
        
        if (states && states.length > 0) {
          const stateList = states.join(', ')
          answer = `I don't currently have regulatory information for ${stateList} in my database. I may have information for other states - would you like to check a different state?`
        } else if (query.toLowerCase().includes('license') || query.toLowerCase().includes('fee') || query.toLowerCase().includes('requirement')) {
          answer = "I couldn't find specific information about that in my compliance database. Please specify which state you're interested in, as regulations vary by state."
        }
        
        return {
          answer,
          citations: [],
          searchResults: [],
          query,
          states
        }
      }

      // Format the response for voice consumption
      const voiceFormattedAnswer = this.formatAnswerForVoice(searchResults.answer)

      return {
        answer: voiceFormattedAnswer,
        citations: searchResults.citations || [],
        searchResults: searchResults.results || [],
        query,
        states
      }

    } catch (error) {
      console.error('ChromaDB search tool error:', error)
      
      return {
        answer: "I encountered an error while searching the compliance documents. Please try again.",
        citations: [],
        searchResults: [],
        query,
        states
      }
    }
  }

  /**
   * Format answer text to be more voice-friendly
   */
  private static formatAnswerForVoice(answer: string): string {
    // Convert markdown citation format to voice-friendly format
    let voiceText = answer.replace(/\[(\\d+)\]/g, (match, num) => {
      return ` (according to source ${num})`
    })

    // Clean up any remaining markdown
    voiceText = voiceText
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
      .replace(/\*(.*?)\*/g, '$1')     // Remove italic formatting
      .replace(/`(.*?)`/g, '$1')       // Remove code formatting

    // Keep it concise for voice - limit to 3 sentences if too long
    if (voiceText.length > 500) {
      const sentences = voiceText.split('. ')
      if (sentences.length > 3) {
        voiceText = sentences.slice(0, 3).join('. ') + '.'
        voiceText += ' I can provide more details if you\'d like.'
      }
    }

    return voiceText
  }

  /**
   * Detect state mentions in queries and return state codes
   */
  static detectStatesFromQuery(query: string): string[] {
    const stateMap: Record<string, string> = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
      'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
      'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
      'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
      'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH',
      'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
      'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA',
      'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', 'tennessee': 'TN',
      'texas': 'TX', 'utah': 'UT', 'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA',
      'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
    }

    const lowercaseQuery = query.toLowerCase()
    const detectedStates: string[] = []

    // Check for full state names
    for (const [stateName, stateCode] of Object.entries(stateMap)) {
      if (lowercaseQuery.includes(stateName)) {
        detectedStates.push(stateCode)
      }
    }

    // Check for state codes
    const stateCodes = Object.values(stateMap)
    for (const stateCode of stateCodes) {
      const patterns = [
        stateCode.toLowerCase(),
        stateCode.toLowerCase().replace('', '.'), // e.g., "n.y."
        stateCode.toUpperCase(),
        stateCode.toUpperCase().replace('', '.') // e.g., "N.Y."
      ]
      
      for (const pattern of patterns) {
        if (lowercaseQuery.includes(pattern) && !detectedStates.includes(stateCode)) {
          detectedStates.push(stateCode)
        }
      }
    }

    // Check for common abbreviations
    const abbreviations: Record<string, string> = {
      'mich': 'MI', 'colo': 'CO', 'calif': 'CA', 'penn': 'PA',
      'ill': 'IL', 'tenn': 'TN', 'ariz': 'AZ', 'conn': 'CT', 'ind': 'IN'
    }

    for (const [abbrev, stateCode] of Object.entries(abbreviations)) {
      if (lowercaseQuery.includes(abbrev) && !detectedStates.includes(stateCode)) {
        detectedStates.push(stateCode)
      }
    }

    return detectedStates
  }

  /**
   * Helper method to parse function call arguments from OpenAI Realtime API
   */
  static parseFunctionCall(functionCall: any): ChromaDBSearchParams {
    console.log('Parsing function call:', functionCall)
    
    // OpenAI function calls can have different structures
    const args = functionCall.parameters || functionCall.arguments || functionCall.args || functionCall
    
    console.log('Extracted args:', args)
    
    // Auto-detect states if not provided
    let states = args.states || []
    if (states.length === 0 && args.query) {
      states = this.detectStatesFromQuery(args.query)
      console.log('Auto-detected states:', states)
    }

    const parsed = {
      query: args.query || '',
      states: states.length > 0 ? states : undefined,
      topK: args.topK || 5
    }
    
    console.log('Parsed ChromaDB params:', parsed)
    return parsed
  }
}