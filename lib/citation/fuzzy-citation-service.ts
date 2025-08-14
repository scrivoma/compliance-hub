/**
 * Fuzzy Citation Service
 * Provides accurate text matching and highlighting without relying on stored character positions
 */

import Fuse from 'fuse.js'

export interface FuzzyMatchResult {
  text: string
  startIndex: number
  endIndex: number
  confidence: number
  contextMatch?: {
    before: string
    after: string
    beforeIndex: number
    afterIndex: number
  }
}

export interface CitationPosition {
  startIndex: number
  endIndex: number
  confidence: number
  matchedText: string
  highlightText: string
}

export interface FuzzyCitationOptions {
  threshold?: number // 0.0 (exact) to 1.0 (fuzzy), default 0.3
  contextRadius?: number // Characters before/after for context matching, default 200
  minMatchLength?: number // Minimum characters for a valid match, default 20
  includeScore?: boolean // Include Fuse.js scoring details
}

export class FuzzyCitationService {
  /**
   * Find the best match for a text chunk in the original document
   */
  findTextInDocument(
    searchText: string,
    fullDocumentText: string,
    options: FuzzyCitationOptions = {}
  ): FuzzyMatchResult | null {
    const {
      threshold = 0.3,
      contextRadius = 200,
      minMatchLength = 20,
      includeScore = false
    } = options

    // Clean up text for better matching
    const cleanSearchText = this.cleanText(searchText)
    const cleanDocumentText = this.cleanText(fullDocumentText)

    if (cleanSearchText.length < minMatchLength) {
      console.warn('⚠️ Search text too short for reliable matching:', cleanSearchText.length)
      return null
    }

    // Try exact match first
    const exactMatch = this.findExactMatch(cleanSearchText, cleanDocumentText)
    if (exactMatch) {
      console.log('✅ Found exact match')
      return {
        ...exactMatch,
        confidence: 1.0
      }
    }

    // Try fuzzy matching with sliding window
    const fuzzyMatch = this.findFuzzyMatch(cleanSearchText, cleanDocumentText, threshold)
    if (fuzzyMatch) {
      console.log('✅ Found fuzzy match with confidence:', fuzzyMatch.confidence)
      return fuzzyMatch
    }

    // Try table-specific matching if text contains table markers
    if (cleanSearchText.includes('|') || cleanSearchText.includes('--')) {
      const tableMatch = this.findTableMatch(cleanSearchText, cleanDocumentText, threshold)
      if (tableMatch) {
        console.log('✅ Found table match')
        return tableMatch
      }
    }

    // Try sentence-level matching as fallback
    const sentenceMatch = this.findSentenceMatch(cleanSearchText, cleanDocumentText, threshold)
    if (sentenceMatch) {
      console.log('✅ Found sentence-level match')
      return sentenceMatch
    }

    console.warn('❌ No suitable match found for text:', cleanSearchText.substring(0, 100) + '...')
    return null
  }

  /**
   * Find multiple citations in a document from search results
   */
  findMultipleCitations(
    searchResults: Array<{
      chunkText: string
      contextBefore?: string
      contextAfter?: string
      metadata?: any
    }>,
    fullDocumentText: string,
    options: FuzzyCitationOptions = {}
  ): CitationPosition[] {
    console.log(`🔍 Finding ${searchResults.length} citations in document`)

    const citations: CitationPosition[] = []
    const usedRanges: Array<{ start: number; end: number }> = []

    for (const result of searchResults) {
      // Use context if available for better matching
      const searchText = [
        result.contextBefore,
        result.chunkText,
        result.contextAfter
      ].filter(Boolean).join(' ')

      const match = this.findTextInDocument(searchText, fullDocumentText, options)
      
      if (match && !this.overlapsWithUsedRange(match, usedRanges)) {
        citations.push({
          startIndex: match.startIndex,
          endIndex: match.endIndex,
          confidence: match.confidence,
          matchedText: match.text,
          highlightText: result.chunkText // Use original chunk text for highlighting
        })

        // Mark this range as used to avoid overlaps
        usedRanges.push({
          start: match.startIndex,
          end: match.endIndex
        })
      }
    }

    console.log(`✅ Successfully found ${citations.length}/${searchResults.length} citations`)
    return citations.sort((a, b) => a.startIndex - b.startIndex)
  }

  /**
   * Clean text for better matching (remove extra whitespace, normalize)
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[""'']/g, '"') // Normalize quotes
      .replace(/[—–]/g, '-') // Normalize dashes
      .replace(/\|\s+/g, '| ') // Normalize table cell spacing
      .replace(/\s+\|/g, ' |') // Normalize table cell spacing
      .replace(/\-{2,}/g, '--') // Normalize table separators
      .trim()
  }

  /**
   * Find exact substring match
   */
  private findExactMatch(searchText: string, documentText: string): Omit<FuzzyMatchResult, 'confidence'> | null {
    const index = documentText.indexOf(searchText)
    if (index !== -1) {
      return {
        text: searchText,
        startIndex: index,
        endIndex: index + searchText.length
      }
    }
    return null
  }

  /**
   * Find fuzzy match using sliding window approach
   */
  private findFuzzyMatch(
    searchText: string,
    documentText: string,
    threshold: number
  ): FuzzyMatchResult | null {
    const searchLength = searchText.length
    const windowSize = Math.max(searchLength, Math.floor(searchLength * 1.2))
    const stepSize = Math.floor(windowSize * 0.1)

    let bestMatch: FuzzyMatchResult | null = null
    let bestScore = 0

    // Slide window across document
    for (let i = 0; i <= documentText.length - windowSize; i += stepSize) {
      const window = documentText.substring(i, i + windowSize)
      const similarity = this.calculateSimilarity(searchText, window)

      if (similarity > bestScore && similarity >= (1 - threshold)) {
        bestScore = similarity
        bestMatch = {
          text: window,
          startIndex: i,
          endIndex: i + windowSize,
          confidence: similarity
        }
      }
    }

    return bestMatch
  }

  /**
   * Find match at sentence level using Fuse.js
   */
  private findSentenceMatch(
    searchText: string,
    documentText: string,
    threshold: number
  ): FuzzyMatchResult | null {
    // Split document into sentences
    const sentences = this.splitIntoSentences(documentText)
    const sentencesWithPositions = sentences.map((sentence, index) => ({
      text: sentence,
      index,
      startPos: this.findSentencePosition(sentence, documentText, index)
    }))

    // Use Fuse.js for fuzzy sentence matching
    const fuse = new Fuse(sentencesWithPositions, {
      keys: ['text'],
      threshold,
      includeScore: true,
      findAllMatches: true
    })

    const results = fuse.search(searchText)
    
    if (results.length > 0 && results[0].score !== undefined) {
      const bestMatch = results[0]
      const sentence = bestMatch.item
      const confidence = 1 - bestMatch.score

      return {
        text: sentence.text,
        startIndex: sentence.startPos,
        endIndex: sentence.startPos + sentence.text.length,
        confidence
      }
    }

    return null
  }

  /**
   * Calculate text similarity using Jaro-Winkler-like algorithm
   */
  private calculateSimilarity(text1: string, text2: string): number {
    if (text1 === text2) return 1.0
    
    const maxLength = Math.max(text1.length, text2.length)
    if (maxLength === 0) return 1.0

    // Simple character-based similarity
    let matches = 0
    const minLength = Math.min(text1.length, text2.length)
    
    for (let i = 0; i < minLength; i++) {
      if (text1[i] === text2[i]) {
        matches++
      }
    }

    return matches / maxLength
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10) // Filter out very short fragments
  }

  /**
   * Find the position of a sentence in the full document
   */
  private findSentencePosition(sentence: string, documentText: string, approximateIndex: number): number {
    // Look for sentence near the approximate position
    const searchRadius = 1000
    const startSearch = Math.max(0, approximateIndex * 100 - searchRadius)
    const endSearch = Math.min(documentText.length, approximateIndex * 100 + searchRadius)
    
    const searchArea = documentText.substring(startSearch, endSearch)
    const relativeIndex = searchArea.indexOf(sentence.substring(0, 50)) // Use first 50 chars for search
    
    if (relativeIndex !== -1) {
      return startSearch + relativeIndex
    }
    
    // Fallback to global search
    return documentText.indexOf(sentence.substring(0, 50))
  }

  /**
   * Find match for table content with flexible matching
   */
  private findTableMatch(
    searchText: string,
    documentText: string,
    threshold: number
  ): FuzzyMatchResult | null {
    // Extract key table content (cells)
    const searchCells = searchText.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0)
    
    // Look for all cells in the document
    let bestMatch: FuzzyMatchResult | null = null
    let bestScore = 0

    // Try to find regions containing table markers
    const tableRegions: Array<{ start: number; end: number }> = []
    let tableStart = documentText.indexOf('|')
    
    // Safety limit to prevent infinite loops
    let iterations = 0
    const maxIterations = 100
    
    while (tableStart !== -1 && iterations < maxIterations) {
      iterations++
      
      // Find the end of this table region
      let tableEnd = tableStart
      let lineEnd = documentText.indexOf('\n', tableEnd)
      
      // Keep extending while we find more table rows (with safety limit)
      let lineIterations = 0
      const maxLineIterations = 50
      
      while (lineEnd !== -1 && lineIterations < maxLineIterations && 
             documentText.substring(lineEnd + 1).trimStart().startsWith('|')) {
        lineIterations++
        tableEnd = documentText.indexOf('\n', lineEnd + 1)
        if (tableEnd === -1) tableEnd = documentText.length
        lineEnd = documentText.indexOf('\n', tableEnd + 1)
      }
      
      if (tableEnd === -1 || tableEnd <= tableStart) {
        tableEnd = Math.min(tableStart + 1000, documentText.length)
      }
      
      // Ensure valid range
      if (tableStart < tableEnd && tableEnd <= documentText.length) {
        tableRegions.push({ start: tableStart, end: tableEnd })
      }
      
      // Move to next table, ensuring we advance
      const nextTableStart = documentText.indexOf('|', tableEnd)
      if (nextTableStart <= tableStart) {
        // Prevent infinite loop by advancing past current position
        tableStart = documentText.indexOf('|', tableStart + 1)
      } else {
        tableStart = nextTableStart
      }
    }

    // Check each table region for our content
    for (const region of tableRegions) {
      const tableText = documentText.substring(region.start, region.end)
      
      // Count how many search cells are found in this table
      let foundCells = 0
      for (const cell of searchCells) {
        if (tableText.toLowerCase().includes(cell.toLowerCase())) {
          foundCells++
        }
      }
      
      const score = foundCells / searchCells.length
      
      if (score > bestScore && score >= (1 - threshold)) {
        bestScore = score
        bestMatch = {
          text: tableText,
          startIndex: region.start,
          endIndex: region.end,
          confidence: score
        }
      }
    }

    return bestMatch
  }

  /**
   * Check if a match overlaps with already used ranges
   */
  private overlapsWithUsedRange(
    match: FuzzyMatchResult,
    usedRanges: Array<{ start: number; end: number }>
  ): boolean {
    return usedRanges.some(range => 
      (match.startIndex >= range.start && match.startIndex < range.end) ||
      (match.endIndex > range.start && match.endIndex <= range.end) ||
      (match.startIndex <= range.start && match.endIndex >= range.end)
    )
  }

  /**
   * Get context around a text position
   */
  getTextContext(
    text: string,
    startIndex: number,
    endIndex: number,
    contextRadius: number = 200
  ): {
    before: string
    after: string
    beforeIndex: number
    afterIndex: number
  } {
    const beforeStart = Math.max(0, startIndex - contextRadius)
    const afterEnd = Math.min(text.length, endIndex + contextRadius)

    return {
      before: text.substring(beforeStart, startIndex),
      after: text.substring(endIndex, afterEnd),
      beforeIndex: beforeStart,
      afterIndex: afterEnd
    }
  }
}

// Export singleton instance
export const fuzzyCitationService = new FuzzyCitationService()