interface FirecrawlScrapeOptions {
  url: string
  formats?: ('markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot' | 'screenshot@fullPage')[]
  onlyMainContent?: boolean
  includeTags?: string[]
  excludeTags?: string[]
  waitFor?: number
  timeout?: number
  parsePdf?: boolean
  maxAge?: number
  actions?: Array<{
    type: string
    [key: string]: any
  }>
}

interface FirecrawlScrapeResponse {
  success: boolean
  data?: {
    markdown?: string
    html?: string
    rawHtml?: string
    links?: string[]
    screenshot?: string
    metadata?: {
      title?: string
      description?: string
      language?: string
      keywords?: string
      robots?: string
      ogTitle?: string
      ogDescription?: string
      ogUrl?: string
      ogImage?: string
      ogLocaleAlternate?: string[]
      ogSiteName?: string
      sourceURL?: string
      statusCode?: number
    }
  }
  error?: string
}

export class FirecrawlClient {
  private apiUrl: string
  private apiKey?: string

  constructor(apiUrl?: string) {
    this.apiUrl = apiUrl || process.env.FIRECRAWL_API_URL || 'http://localhost:3002'
    this.apiKey = process.env.FIRECRAWL_API_KEY
  }

  async scrape(options: FirecrawlScrapeOptions): Promise<FirecrawlScrapeResponse> {
    try {
      console.log('🔥 Firecrawl: Starting scrape for URL:', options.url)
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      
      // Add authorization header if API key is available
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`
      }
      
      const response = await fetch(`${this.apiUrl}/v1/scrape`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url: options.url,
          formats: options.formats || ['markdown'],
          onlyMainContent: options.onlyMainContent !== false, // Default to true
          ...(options.includeTags && { includeTags: options.includeTags }),
          ...(options.excludeTags && { excludeTags: options.excludeTags }),
          ...(options.waitFor && { waitFor: options.waitFor }),
          ...(options.timeout && { timeout: options.timeout }),
          // Only include advanced options if explicitly set
          ...(options.parsePdf !== undefined && { parsePdf: options.parsePdf }),
          ...(options.maxAge !== undefined && { maxAge: options.maxAge }),
          ...(options.actions && { actions: options.actions }),
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('🔥 Firecrawl: API error:', response.status, errorText)
        return {
          success: false,
          error: `Firecrawl API error: ${response.status} - ${errorText}`,
        }
      }

      const result = await response.json()
      console.log('🔥 Firecrawl: Scrape successful, received:', {
        hasMarkdown: !!result.data?.markdown,
        markdownLength: result.data?.markdown?.length || 0,
        hasMetadata: !!result.data?.metadata,
        title: result.data?.metadata?.title,
      })

      return {
        success: true,
        data: result.data,
      }
    } catch (error) {
      console.error('🔥 Firecrawl: Network or parsing error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const headers: Record<string, string> = {}
      
      // Add authorization header if API key is available  
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`
      }
      
      const response = await fetch(`${this.apiUrl}/health`, {
        method: 'GET',
        headers,
      })
      return response.ok
    } catch (error) {
      console.error('🔥 Firecrawl: Health check failed:', error)
      return false
    }
  }
}

// Export a singleton instance
export const firecrawlClient = new FirecrawlClient()