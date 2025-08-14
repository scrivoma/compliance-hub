import { LlamaParseReader } from 'llamaindex'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

export interface ParsedDocument {
  content: string
  title: string
  description?: string
  metadata: {
    pages?: number
    fileSize?: number
    processingMethod: string
    [key: string]: any
  }
}

export class LlamaParseService {
  private reader: LlamaParseReader | null = null

  private initializeReader() {
    if (!this.reader) {
      if (!process.env.LLAMAPARSE_API_KEY) {
        throw new Error('LLAMAPARSE_API_KEY is required but not set in environment variables')
      }

      this.reader = new LlamaParseReader({
        resultType: 'markdown',
        apiKey: process.env.LLAMAPARSE_API_KEY,
        verbose: true
      })
    }
    return this.reader
  }

  /**
   * Parse a PDF file and return clean markdown
   */
  async parsePdfFile(filePath: string): Promise<ParsedDocument> {
    console.log('📄 LlamaParse: Starting PDF parsing for file:', filePath)
    
    try {
      const reader = this.initializeReader()
      
      // Parse the document with LlamaParse
      const documents = await reader.loadData(filePath)
      
      if (!documents || documents.length === 0) {
        throw new Error('No content extracted from PDF')
      }

      // DEBUG: Log individual document texts before combining
      console.log('🔍 DEBUG - LlamaParseReader documents:', {
        documentCount: documents.length,
        documentTexts: documents.map((doc, i) => ({
          index: i,
          textLength: doc.text.length,
          firstChars: doc.text.substring(0, 200),
          lastChars: doc.text.substring(Math.max(0, doc.text.length - 200)),
          hasFeeText: doc.text.includes('fee'),
          hasThousandText: doc.text.includes('thousand'),
          has125Text: doc.text.includes('125')
        }))
      })

      // Combine all document content
      const content = documents.map(doc => doc.text).join('\n\n')
      
      // DEBUG: Log combined content
      console.log('🔍 DEBUG - Combined content from LlamaParseReader:', {
        contentLength: content.length,
        firstChars: content.substring(0, 500),
        lastChars: content.substring(Math.max(0, content.length - 500)),
        hasFeeText: content.includes('fee'),
        hasThousandText: content.includes('thousand'),
        has125Text: content.includes('125')
      })
      
      if (!content || content.trim().length === 0) {
        throw new Error('PDF parsing resulted in empty content')
      }

      // Extract title from first heading or filename
      const title = this.extractTitleFromMarkdown(content) || 
                   this.extractFilenameFromPath(filePath)

      // Extract description from first paragraph
      const description = this.extractDescriptionFromMarkdown(content)

      // Get metadata from the first document
      const firstDoc = documents[0]
      const metadata = {
        pages: documents.length,
        processingMethod: 'llamaparse',
        fileSize: Buffer.byteLength(content, 'utf8'),
        llamaParseMetadata: firstDoc.metadata || {}
      }

      console.log('📄 LlamaParse: Successfully parsed PDF:', {
        contentLength: content.length,
        pages: documents.length,
        title
      })

      // DEBUG: Log content before and after cleanMarkdown
      const cleanedContent = this.cleanMarkdown(content)
      console.log('🔍 DEBUG - Content after cleanMarkdown:', {
        originalLength: content.length,
        cleanedLength: cleanedContent.length,
        lengthChanged: content.length !== cleanedContent.length,
        cleanedFirstChars: cleanedContent.substring(0, 500),
        cleanedLastChars: cleanedContent.substring(Math.max(0, cleanedContent.length - 500)),
        cleanedHasFeeText: cleanedContent.includes('fee'),
        cleanedHasThousandText: cleanedContent.includes('thousand'),
        cleanedHas125Text: cleanedContent.includes('125')
      })

      return {
        content: cleanedContent,
        title,
        description,
        metadata
      }
    } catch (error) {
      console.error('📄 LlamaParse: Error parsing PDF:', error)
      throw new Error(`LlamaParse parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Download PDF from URL and parse it
   */
  async parsePdfFromUrl(url: string): Promise<ParsedDocument> {
    console.log('📄 LlamaParse: Downloading and parsing PDF from URL:', url)
    
    let tempFilePath: string | null = null
    
    try {
      // Download PDF to temporary file
      tempFilePath = await this.downloadPdfToTemp(url)
      
      // Parse the downloaded file
      const result = await this.parsePdfFile(tempFilePath)
      
      // Add URL to metadata
      result.metadata.sourceUrl = url
      result.metadata.downloadedFrom = url
      
      return result
    } finally {
      // Clean up temporary file
      if (tempFilePath) {
        try {
          await unlink(tempFilePath)
          console.log('📄 LlamaParse: Cleaned up temporary file:', tempFilePath)
        } catch (cleanupError) {
          console.warn('📄 LlamaParse: Failed to clean up temporary file:', cleanupError)
        }
      }
    }
  }

  /**
   * Download PDF from URL to temporary file
   */
  private async downloadPdfToTemp(url: string): Promise<string> {
    console.log('📥 LlamaParse: Downloading PDF from URL:', url)
    
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
        console.warn('📥 LlamaParse: Response content-type is not PDF:', contentType)
      }
      
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      
      // Create temporary file
      const tempFileName = `llamaparse_${uuidv4()}.pdf`
      const tempFilePath = join(process.cwd(), 'tmp', tempFileName)
      
      // Ensure tmp directory exists
      const { mkdir } = await import('fs/promises')
      await mkdir(join(process.cwd(), 'tmp'), { recursive: true })
      
      // Write file
      await writeFile(tempFilePath, buffer)
      
      console.log('📥 LlamaParse: PDF downloaded successfully:', {
        size: buffer.length,
        tempFile: tempFilePath
      })
      
      return tempFilePath
    } catch (error) {
      console.error('📥 LlamaParse: Failed to download PDF:', error)
      throw new Error(`Failed to download PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check if a URL points to a PDF file
   */
  isPdfUrl(url: string): boolean {
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
   * Extract filename from file path
   */
  private extractFilenameFromPath(filePath: string): string {
    const filename = filePath.split('/').pop() || 'document.pdf'
    return filename.replace('.pdf', '').replace(/[^a-zA-Z0-9-_ ]/g, ' ').trim()
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
}

// Export singleton instance
export const llamaParseService = new LlamaParseService()