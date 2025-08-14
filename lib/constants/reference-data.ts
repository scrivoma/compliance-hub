/**
 * Static reference data for dropdowns
 * Used as fallback when API calls fail or return empty data
 */

export interface Vertical {
  id: string
  name: string
  displayName: string
  description?: string
}

export interface DocumentType {
  id: string
  name: string
  displayName: string
  description?: string
}

export const STATIC_VERTICALS: Vertical[] = [
  { 
    id: 'fantasy-sports', 
    name: 'fantasy-sports', 
    displayName: 'Fantasy Sports', 
    description: 'Daily and season-long fantasy sports' 
  },
  { 
    id: 'igaming', 
    name: 'igaming', 
    displayName: 'iGaming', 
    description: 'Online casino and gaming' 
  },
  { 
    id: 'ilottery', 
    name: 'ilottery', 
    displayName: 'iLottery', 
    description: 'Online lottery services' 
  },
  { 
    id: 'landbased', 
    name: 'landbased', 
    displayName: 'Landbased', 
    description: 'Physical casino operations' 
  },
  { 
    id: 'lottery', 
    name: 'lottery', 
    displayName: 'Lottery', 
    description: 'Traditional lottery operations' 
  },
  { 
    id: 'sports-online', 
    name: 'sports-online', 
    displayName: 'Sports (Online)', 
    description: 'Online sports betting operations' 
  },
  { 
    id: 'sports-retail', 
    name: 'sports-retail', 
    displayName: 'Sports (Retail)', 
    description: 'Retail/land-based sports betting' 
  }
]

export const STATIC_DOCUMENT_TYPES: DocumentType[] = [
  { 
    id: 'aml', 
    name: 'aml', 
    displayName: 'Anti-Money Laundering', 
    description: 'AML compliance requirements' 
  },
  { 
    id: 'data', 
    name: 'data', 
    displayName: 'Data', 
    description: 'Data protection and privacy requirements' 
  },
  { 
    id: 'formal-guidance', 
    name: 'formal-guidance', 
    displayName: 'Formal Guidance', 
    description: 'Official guidance documents' 
  },
  { 
    id: 'informal-guidance', 
    name: 'informal-guidance', 
    displayName: 'Informal Guidance', 
    description: 'Unofficial guidance and interpretations' 
  },
  { 
    id: 'licensing-forms', 
    name: 'licensing-forms', 
    displayName: 'Licensing Forms / Instructions', 
    description: 'License application forms and instructions' 
  },
  { 
    id: 'other', 
    name: 'other', 
    displayName: 'Other', 
    description: 'Other document types' 
  },
  { 
    id: 'regulation', 
    name: 'regulation', 
    displayName: 'Regulation', 
    description: 'Administrative rules and regulations' 
  },
  { 
    id: 'statute', 
    name: 'statute', 
    displayName: 'Statute', 
    description: 'Legislative acts and laws' 
  },
  { 
    id: 'technical-bulletin', 
    name: 'technical-bulletin', 
    displayName: 'Technical Bulletin', 
    description: 'Technical specifications and bulletins' 
  }
]

/**
 * Retry function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries) {
        throw error
      }
      
      const delay = baseDelay * Math.pow(2, attempt)
      console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw new Error('All retry attempts failed')
}

/**
 * Get verticals with API fallback to static data
 */
export async function getVerticals(): Promise<{ data: Vertical[], source: 'api' | 'static', error?: string }> {
  try {
    const result = await retryWithBackoff(async () => {
      const response = await fetch('/api/verticals', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      if (!data.verticals || !Array.isArray(data.verticals) || data.verticals.length === 0) {
        throw new Error('Empty or invalid verticals data received')
      }
      
      return data.verticals
    })
    
    console.log('✅ Successfully loaded verticals from API')
    return { data: result, source: 'api' }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.warn('⚠️ API call failed, using static verticals data:', errorMessage)
    
    return { 
      data: STATIC_VERTICALS, 
      source: 'static',
      error: errorMessage
    }
  }
}

/**
 * Get document types with API fallback to static data
 */
export async function getDocumentTypes(): Promise<{ data: DocumentType[], source: 'api' | 'static', error?: string }> {
  try {
    const result = await retryWithBackoff(async () => {
      const response = await fetch('/api/document-types', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      if (!data.documentTypes || !Array.isArray(data.documentTypes) || data.documentTypes.length === 0) {
        throw new Error('Empty or invalid document types data received')
      }
      
      return data.documentTypes
    })
    
    console.log('✅ Successfully loaded document types from API')
    return { data: result, source: 'api' }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.warn('⚠️ API call failed, using static document types data:', errorMessage)
    
    return { 
      data: STATIC_DOCUMENT_TYPES, 
      source: 'static',
      error: errorMessage
    }
  }
}