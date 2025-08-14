import { llamaParseService } from './parser'
import { firecrawlClient } from '../firecrawl/client'

export interface ScrapedDocument {
  content: string
  title: string
  description?: string
  sourceUrl: string
  isPdf: boolean
  metadata?: Record<string, any>
}

export class LlamaParseUrlScraper {
  /**
   * Scrape a URL and return the content as markdown
   * Uses LlamaParse for PDFs and fallback scraping for HTML pages
   */
  async scrapeUrl(url: string): Promise<ScrapedDocument> {
    console.log('📄 LlamaParse URL Scraper: Starting scrape for URL:', url)
    
    // Check if this is a direct PDF URL
    const isPdfUrl = llamaParseService.isPdfUrl(url)
    
    if (isPdfUrl) {
      console.log('📄 LlamaParse URL Scraper: Detected PDF URL, using LlamaParse')
      return await this.scrapePdfUrl(url)
    } else {
      console.log('📄 LlamaParse URL Scraper: Detected HTML page, using fallback scraper')
      return await this.scrapeHtmlUrl(url)
    }
  }

  /**
   * Scrape PDF URL using LlamaParse
   */
  private async scrapePdfUrl(url: string): Promise<ScrapedDocument> {
    try {
      const parsed = await llamaParseService.parsePdfFromUrl(url)
      
      return {
        content: parsed.content,
        title: parsed.title,
        description: parsed.description,
        sourceUrl: url,
        isPdf: true,
        metadata: {
          ...parsed.metadata,
          sourceType: 'pdf-url',
          originalUrl: url,
        }
      }
    } catch (error) {
      console.error('📄 LlamaParse URL Scraper: Failed to parse PDF with LlamaParse:', error)
      
      // Fallback to basic PDF handling if LlamaParse fails
      return {
        content: '',
        title: this.extractFilenameFromUrl(url),
        description: `PDF document from ${new URL(url).hostname} (LlamaParse failed)`,
        sourceUrl: url,
        isPdf: true,
        metadata: {
          sourceType: 'pdf-url-fallback',
          originalUrl: url,
          parseError: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    }
  }

  /**
   * Scrape HTML URL using existing Firecrawl client as fallback
   */
  private async scrapeHtmlUrl(url: string): Promise<ScrapedDocument> {
    try {
      // Use existing Firecrawl client for HTML pages
      const result = await firecrawlClient.scrape({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 60000,
        excludeTags: ['nav', 'footer', 'aside', 'script', 'style', 'iframe', 'noscript'],
      })
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to scrape HTML URL')
      }
      
      const { markdown, metadata } = result.data
      
      if (!markdown) {
        throw new Error('No content extracted from HTML URL')
      }
      
      // Clean up the markdown content
      const cleanedContent = this.cleanMarkdown(markdown)
      
      // Extract title and description
      const title = metadata?.ogTitle || metadata?.title || this.extractTitleFromMarkdown(cleanedContent) || 'Untitled Document'
      const description = metadata?.ogDescription || metadata?.description || this.extractDescriptionFromMarkdown(cleanedContent)
      
      console.log('📄 LlamaParse URL Scraper: HTML scrape complete:', {
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
    } catch (error) {
      console.error('📄 LlamaParse URL Scraper: Failed to scrape HTML URL:', error)
      
      // Return basic fallback result
      return {
        content: `Failed to scrape content from ${url}`,
        title: 'Scraping Failed',
        description: `Unable to extract content from ${new URL(url).hostname}`,
        sourceUrl: url,
        isPdf: false,
        metadata: {
          sourceType: 'web-scrape-failed',
          scrapeError: error instanceof Error ? error.message : 'Unknown error',
          scrapedAt: new Date().toISOString(),
        }
      }
    }
  }

  /**
   * Download a PDF from a URL (for backward compatibility)
   */
  async downloadPdf(url: string): Promise<Buffer> {
    console.log('📥 LlamaParse URL Scraper: Downloading PDF from:', url)
    
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
}

// Export singleton instance
export const llamaParseUrlScraper = new LlamaParseUrlScraper()