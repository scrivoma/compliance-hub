import { firecrawlClient } from './client'

export interface ScrapedDocument {
  content: string
  title: string
  description?: string
  sourceUrl: string
  isPdf: boolean
  metadata?: Record<string, any>
}

export class FirecrawlScraper {
  /**
   * Scrape a URL and return the content as markdown
   */
  async scrapeUrl(url: string): Promise<ScrapedDocument> {
    console.log('📄 Starting URL scrape:', url)
    
    // Check if this is a direct PDF URL
    const isPdfUrl = this.isPdfUrl(url)
    
    if (isPdfUrl) {
      console.log('📄 Detected PDF URL, will handle as PDF download')
      // For PDF URLs, we'll return metadata and let the API endpoint handle the download
      return {
        content: '',
        title: this.extractFilenameFromUrl(url),
        description: `PDF document from ${new URL(url).hostname}`,
        sourceUrl: url,
        isPdf: true,
        metadata: {
          sourceType: 'pdf-url',
          originalUrl: url,
        }
      }
    }
    
    // For HTML pages, use Firecrawl to scrape
    console.log('📄 Scraping HTML page with Firecrawl')
    const result = await firecrawlClient.scrape({
      url,
      formats: ['markdown'],
      onlyMainContent: true,
      timeout: 60000, // 60 second timeout for large pages
      parsePdf: true, // Enable PDF parsing for better content extraction
      maxAge: 14400000, // 4 hours cache (matches online version)
      // Additional options for better markdown quality
      excludeTags: ['nav', 'footer', 'aside', 'script', 'style', 'iframe', 'noscript'],
    })
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to scrape URL')
    }
    
    const { markdown, metadata } = result.data
    
    if (!markdown) {
      throw new Error('No content extracted from URL')
    }
    
    // Clean up the markdown content
    const cleanedContent = this.cleanMarkdown(markdown)
    
    // Extract title and description
    const title = metadata?.ogTitle || metadata?.title || this.extractTitleFromMarkdown(cleanedContent) || 'Untitled Document'
    const description = metadata?.ogDescription || metadata?.description || this.extractDescriptionFromMarkdown(cleanedContent)
    
    console.log('📄 Scrape complete:', {
      contentLength: cleanedContent.length,
      title,
      hasDescription: !!description,
    })
    
    return {
      content: cleanedContent,
      title,
      description,
      sourceUrl: url,
      isPdf: false,
      metadata: {
        ...metadata,
        sourceType: 'web-scrape',
        scrapedAt: new Date().toISOString(),
      }
    }
  }
  
  /**
   * Check if a URL points to a PDF file
   */
  private isPdfUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname.toLowerCase()
      
      // Check file extension
      if (pathname.endsWith('.pdf')) {
        return true
      }
      
      // Check query parameters that might indicate PDF
      const contentType = urlObj.searchParams.get('type')?.toLowerCase()
      if (contentType === 'pdf' || contentType === 'application/pdf') {
        return true
      }
      
      return false
    } catch {
      return false
    }
  }
  
  /**
   * Extract filename from a URL
   */
  private extractFilenameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const filename = pathname.split('/').pop() || 'document.pdf'
      return filename.replace('.pdf', '').replace(/[^a-zA-Z0-9-_ ]/g, ' ').trim()
    } catch {
      return 'Downloaded Document'
    }
  }
  
  /**
   * Clean up markdown content
   */
  private cleanMarkdown(markdown: string): string {
    return markdown
      // Remove excessive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Remove excessive spaces
      .replace(/ {2,}/g, ' ')
      // Trim lines
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      // Final trim
      .trim()
  }
  
  /**
   * Extract title from markdown content (first H1 or H2)
   */
  private extractTitleFromMarkdown(markdown: string): string | null {
    const lines = markdown.split('\n')
    for (const line of lines) {
      const h1Match = line.match(/^#\s+(.+)$/)
      if (h1Match) return h1Match[1].trim()
      
      const h2Match = line.match(/^##\s+(.+)$/)
      if (h2Match) return h2Match[1].trim()
    }
    return null
  }
  
  /**
   * Extract description from markdown content (first paragraph)
   */
  private extractDescriptionFromMarkdown(markdown: string): string | null {
    // Skip headers and empty lines to find first paragraph
    const lines = markdown.split('\n')
    let foundContent = false
    let description = ''
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      
      // Skip headers and empty lines
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        if (foundContent) break // End of first paragraph
        continue
      }
      
      // Found content
      foundContent = true
      description += (description ? ' ' : '') + trimmedLine
      
      // Limit description length
      if (description.length > 200) {
        return description.substring(0, 197) + '...'
      }
    }
    
    return description || null
  }
  
  /**
   * Download a PDF from a URL
   */
  async downloadPdf(url: string): Promise<Buffer> {
    console.log('📥 Downloading PDF from:', url)
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ComplianceHub/1.0)',
        },
      })
      
      if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`)
      }
      
      const contentType = response.headers.get('content-type')
      if (contentType && !contentType.includes('pdf')) {
        console.warn('⚠️ Response content-type is not PDF:', contentType)
      }
      
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      
      console.log('📥 PDF downloaded successfully, size:', buffer.length, 'bytes')
      return buffer
    } catch (error) {
      console.error('📥 Failed to download PDF:', error)
      throw new Error(`Failed to download PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// Export singleton instance
export const firecrawlScraper = new FirecrawlScraper()