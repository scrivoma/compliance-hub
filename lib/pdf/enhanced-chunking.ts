/**
 * Enhanced Chunking Strategy with Context Preservation
 * Designed for Pinecone vector storage and fuzzy text matching
 */

import { ProcessedDocument, DocumentChunk } from './llamaindex-processor'

export interface EnhancedChunk {
  text: string
  contextBefore?: string
  contextAfter?: string
  pageNumber?: number
  sectionTitle?: string
  chunkIndex: number
  originalStartChar: number
  originalEndChar: number
  chunkType: 'paragraph' | 'section_header' | 'list_item' | 'table' | 'mixed'
}

export interface EnhancedChunkingOptions {
  chunkSize?: number
  contextRadius?: number
  preserveSentences?: boolean
  preserveParagraphs?: boolean
  minChunkSize?: number
  maxChunkSize?: number
}

export class EnhancedChunkingService {
  /**
   * Create enhanced chunks with context preservation for better fuzzy matching
   */
  createEnhancedChunks(
    processedDoc: ProcessedDocument,
    options: EnhancedChunkingOptions = {}
  ): EnhancedChunk[] {
    const {
      chunkSize = 800,
      contextRadius = 300,
      preserveSentences = true,
      preserveParagraphs = true,
      minChunkSize = 100,
      maxChunkSize = 1200
    } = options

    console.log('🔧 Creating enhanced chunks with context preservation')

    const fullText = processedDoc.text
    const markdownStructure = this.analyzeMarkdownStructure(fullText)
    
    const chunks: EnhancedChunk[] = []
    let currentPosition = 0
    let chunkIndex = 0

    // Process text using markdown-aware chunking
    const sections = this.splitIntoSections(fullText)
    
    for (const section of sections) {
      const sectionChunks = this.chunkSection(
        section,
        section.startPosition, // Use actual section position in full text
        chunkSize,
        contextRadius,
        preserveSentences,
        preserveParagraphs,
        minChunkSize,
        maxChunkSize
      )

      for (const chunk of sectionChunks) {
        const enhancedChunk: EnhancedChunk = {
          ...chunk,
          chunkIndex: chunkIndex++,
          contextBefore: this.extractContext(fullText, chunk.originalStartChar, -contextRadius),
          contextAfter: this.extractContext(fullText, chunk.originalEndChar, contextRadius),
          pageNumber: this.findPageNumber(chunk.originalStartChar, processedDoc.pages),
          sectionTitle: this.findSectionTitle(chunk.originalStartChar, markdownStructure)
        }

        chunks.push(enhancedChunk)
      }
    }

    console.log(`✅ Created ${chunks.length} enhanced chunks with context`)
    return chunks
  }

  /**
   * Analyze markdown structure to identify sections and headers
   */
  private analyzeMarkdownStructure(text: string): Array<{
    title: string
    level: number
    startPosition: number
    endPosition: number
  }> {
    const headers: Array<{
      title: string
      level: number
      startPosition: number
      endPosition: number
    }> = []

    // Find markdown headers
    const lines = text.split('\n')
    let currentPosition = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Check for markdown headers (# ## ### etc.)
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
      if (headerMatch) {
        const level = headerMatch[1].length
        const title = headerMatch[2].trim()
        
        headers.push({
          title,
          level,
          startPosition: currentPosition,
          endPosition: currentPosition + line.length
        })
      }

      currentPosition += lines[i].length + 1 // +1 for newline
    }

    return headers
  }

  /**
   * Split document into logical sections
   */
  private splitIntoSections(text: string): Array<{
    text: string
    type: 'section' | 'paragraph' | 'list' | 'table'
    startPosition: number
  }> {
    const sections: Array<{
      text: string
      type: 'section' | 'paragraph' | 'list' | 'table'
      startPosition: number
    }> = []

    // Split by double newlines (paragraph breaks)
    const paragraphs = text.split(/\n\s*\n/)
    let currentPosition = 0

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim()
      if (trimmed.length > 0) {
        sections.push({
          text: trimmed,
          type: this.classifyTextType(trimmed),
          startPosition: currentPosition
        })
      }
      currentPosition += paragraph.length + 2 // +2 for double newlines
    }

    return sections
  }

  /**
   * Classify the type of text content
   */
  private classifyTextType(text: string): 'section' | 'paragraph' | 'list' | 'table' {
    // Check for markdown headers
    if (text.match(/^#{1,6}\s+/)) {
      return 'section'
    }

    // Check for lists
    if (text.match(/^\s*[-*+]\s+/) || text.match(/^\s*\d+\.\s+/)) {
      return 'list'
    }

    // Check for tables (simple markdown table detection)
    if (text.includes('|') && text.split('\n').some(line => line.includes('|'))) {
      return 'table'
    }

    return 'paragraph'
  }

  /**
   * Chunk a section with intelligent boundaries
   */
  private chunkSection(
    section: { text: string; type: string; startPosition: number },
    globalStartPosition: number,
    chunkSize: number,
    contextRadius: number,
    preserveSentences: boolean,
    preserveParagraphs: boolean,
    minChunkSize: number,
    maxChunkSize: number
  ): Omit<EnhancedChunk, 'chunkIndex' | 'contextBefore' | 'contextAfter' | 'pageNumber' | 'sectionTitle'>[] {
    const chunks: Omit<EnhancedChunk, 'chunkIndex' | 'contextBefore' | 'contextAfter' | 'pageNumber' | 'sectionTitle'>[] = []
    const text = section.text

    // For small sections, keep as single chunk
    if (text.length <= maxChunkSize) {
      chunks.push({
        text,
        originalStartChar: globalStartPosition,
        originalEndChar: globalStartPosition + text.length,
        chunkType: section.type as any
      })
      return chunks
    }

    // For larger sections, use intelligent chunking
    let currentPos = 0
    
    while (currentPos < text.length) {
      let endPos = Math.min(currentPos + chunkSize, text.length)
      
      // Try to break at sentence boundaries if preserveSentences is true
      if (preserveSentences && endPos < text.length) {
        const sentenceEnd = this.findSentenceBoundary(text, currentPos, endPos)
        if (sentenceEnd > currentPos + minChunkSize) {
          endPos = sentenceEnd
        }
      }

      // Try to break at paragraph boundaries if preserveParagraphs is true
      if (preserveParagraphs && endPos < text.length) {
        const paragraphEnd = this.findParagraphBoundary(text, currentPos, endPos)
        if (paragraphEnd > currentPos + minChunkSize) {
          endPos = paragraphEnd
        }
      }

      const chunkText = text.substring(currentPos, endPos).trim()
      
      if (chunkText.length >= minChunkSize) {
        chunks.push({
          text: chunkText,
          originalStartChar: globalStartPosition + currentPos,
          originalEndChar: globalStartPosition + endPos,
          chunkType: section.type as any
        })
      }

      currentPos = endPos
      
      // Avoid infinite loop
      if (currentPos === endPos && endPos < text.length) {
        currentPos++
      }
    }

    return chunks
  }

  /**
   * Find the best sentence boundary near the target position
   */
  private findSentenceBoundary(text: string, start: number, target: number): number {
    // Look for sentence endings within a reasonable range
    const searchRange = Math.min(200, target - start)
    const searchStart = Math.max(start, target - searchRange)
    
    const sentenceEnders = /[.!?]+\s+/g
    let match
    let bestEnd = target
    
    const searchText = text.substring(searchStart, target + 100)
    
    while ((match = sentenceEnders.exec(searchText)) !== null) {
      const absolutePos = searchStart + match.index + match[0].length
      if (absolutePos <= target + 50 && absolutePos >= start + 100) {
        bestEnd = absolutePos
      }
    }
    
    return bestEnd
  }

  /**
   * Find the best paragraph boundary near the target position
   */
  private findParagraphBoundary(text: string, start: number, target: number): number {
    // Look for double newlines
    const searchRange = Math.min(300, target - start)
    const searchStart = Math.max(start, target - searchRange)
    
    const searchText = text.substring(searchStart, target + 150)
    const paragraphBreak = searchText.indexOf('\n\n')
    
    if (paragraphBreak !== -1) {
      const absolutePos = searchStart + paragraphBreak + 2
      if (absolutePos >= start + 100 && absolutePos <= target + 100) {
        return absolutePos
      }
    }
    
    return target
  }

  /**
   * Extract context text around a position
   */
  private extractContext(fullText: string, position: number, radius: number): string {
    if (radius > 0) {
      // After context
      const start = position
      const end = Math.min(fullText.length, position + radius)
      return fullText.substring(start, end).trim()
    } else {
      // Before context
      const start = Math.max(0, position + radius) // radius is negative
      const end = position
      return fullText.substring(start, end).trim()
    }
  }

  /**
   * Find which page a character position belongs to
   */
  private findPageNumber(
    charPosition: number,
    pages: Array<{ pageNumber: number; text: string }>
  ): number {
    let currentPos = 0
    
    for (const page of pages) {
      const pageEnd = currentPos + page.text.length
      if (charPosition >= currentPos && charPosition <= pageEnd) {
        return page.pageNumber
      }
      currentPos = pageEnd + 1 // +1 for newline between pages
    }
    
    return 1 // Default to first page
  }

  /**
   * Find the section title for a character position
   */
  private findSectionTitle(
    charPosition: number,
    headers: Array<{ title: string; startPosition: number; endPosition: number }>
  ): string | undefined {
    // Find the most recent header before this position
    let nearestHeader: { title: string; startPosition: number } | undefined
    
    for (const header of headers) {
      if (header.startPosition <= charPosition) {
        if (!nearestHeader || header.startPosition > nearestHeader.startPosition) {
          nearestHeader = header
        }
      }
    }
    
    return nearestHeader?.title
  }
}

// Export singleton instance
export const enhancedChunkingService = new EnhancedChunkingService()