import pdfParse from 'pdf-parse'

export interface ExtractedText {
  text: string
  pages: Array<{
    pageNumber: number
    text: string
    lines: Array<{
      text: string
      x: number
      y: number
      width: number
      height: number
    }>
  }>
  paragraphs: Array<{
    text: string
    pageNumber: number
    paragraphIndex: number
  }>
}

export async function extractTextFromPDF(buffer: ArrayBuffer): Promise<ExtractedText> {
  try {
    console.log('Extracting text from PDF file, size:', buffer.byteLength, 'bytes')
    
    // Convert ArrayBuffer to Buffer for pdf-parse
    const pdfBuffer = Buffer.from(buffer)
    
    // Extract text using pdf-parse
    const data = await pdfParse(pdfBuffer, {
      // Enable page-level text extraction
      pagerender: async (pageData: any) => {
        // Get text content for this page
        const textContent = await pageData.getTextContent()
        return textContent.items.map((item: any) => item.str).join(' ')
      }
    })
    
    console.log('PDF text extraction completed:')
    console.log('- Total pages:', data.numpages)
    console.log('- Total text length:', data.text.length, 'characters')
    console.log('- Text preview:', data.text.substring(0, 200) + '...')
    
    console.log('Starting text cleanup...')
    // Clean up the text - preserve line breaks but normalize other whitespace
    const cleanedText = data.text
      .replace(/\r\n/g, '\n')                    // Normalize line endings to \n
      .replace(/[ \t]+/g, ' ')                   // Replace multiple spaces/tabs with single space
      .replace(/\n[ \t]+/g, '\n')                // Remove leading spaces on lines
      .replace(/[ \t]+\n/g, '\n')                // Remove trailing spaces on lines
      .replace(/\n{3,}/g, '\n\n')                // Replace 3+ newlines with 2 (paragraph breaks)
      .trim()
    console.log('✓ Text cleanup completed, length:', cleanedText.length)
    
    console.log('Starting paragraph extraction...')
    // Split into paragraphs based on double newlines or numbered/lettered sections
    const paragraphRegex = /(?:\n\n|(?:\n(?=\(\d+\)|\([a-zA-Z]\)|[A-Z][a-z]+:|\d+\.))|$)/g
    const paragraphs: Array<{text: string, pageNumber: number, paragraphIndex: number}> = []
    
    let lastIndex = 0
    let paragraphIndex = 0
    let match
    let matchCount = 0
    
    console.log('Starting regex matching...')
    while ((match = paragraphRegex.exec(cleanedText)) !== null) {
      matchCount++
      if (matchCount % 10 === 0) {
        console.log(`Processing match ${matchCount}, lastIndex: ${lastIndex}`)
      }
      
      const paragraphText = cleanedText.substring(lastIndex, match.index).trim()
      if (paragraphText.length > 0) {
        // Estimate which page this paragraph is on
        const position = lastIndex / cleanedText.length
        const pageNumber = Math.floor(position * data.numpages) + 1
        
        paragraphs.push({
          text: paragraphText,
          pageNumber: Math.min(pageNumber, data.numpages),
          paragraphIndex: paragraphIndex++
        })
      }
      lastIndex = match.index + match[0].length
      
      // Safety break to avoid infinite loops
      if (matchCount > 1000) {
        console.log('Breaking out of regex loop after 1000 matches')
        break
      }
    }
    console.log(`✓ Regex matching completed after ${matchCount} matches`)
    
    console.log('Starting page splitting...')
    // Split text roughly by pages (pdf-parse doesn't give us exact page breaks)
    const textLength = data.text.length
    const avgPageLength = Math.floor(textLength / data.numpages)
    const pages: Array<{pageNumber: number, text: string, lines: Array<{text: string, x: number, y: number, width: number, height: number}>}> = []
    
    console.log(`Splitting into ${data.numpages} pages, avg length: ${avgPageLength}`)
    // Split the text into roughly equal pages
    for (let i = 0; i < data.numpages; i++) {
      console.log(`Processing page ${i + 1}/${data.numpages}`)
      const startIndex = i * avgPageLength
      const endIndex = i === data.numpages - 1 ? textLength : (i + 1) * avgPageLength
      const pageText = data.text.substring(startIndex, endIndex)
      
      // Create mock line data (pdf-parse doesn't provide detailed positioning)
      const lines = pageText.split('\n').map((line, lineIndex) => ({
        text: line.trim(),
        x: 0,
        y: lineIndex * 12,
        width: line.length * 6,
        height: 12
      })).filter(line => line.text.length > 0)
      
      pages.push({
        pageNumber: i + 1,
        text: pageText,
        lines
      })
    }
    console.log('✓ Page splitting completed')
    
    console.log(`- Extracted ${paragraphs.length} paragraphs`)
    
    return {
      text: cleanedText,
      pages,
      paragraphs
    }
  } catch (error) {
    console.error('Error extracting text from PDF:', error)
    
    // Fallback: if PDF text extraction fails, return a basic structure
    const fallbackText = 'Error: Could not extract text from PDF file. This may be a scanned document or have text extraction issues.'
    console.log('Using fallback text due to extraction error')
    
    return {
      text: fallbackText,
      pages: [{
        pageNumber: 1,
        text: fallbackText,
        lines: [{
          text: fallbackText,
          x: 0,
          y: 0,
          width: fallbackText.length * 6,
          height: 12
        }]
      }],
      paragraphs: [{
        text: fallbackText,
        pageNumber: 1,
        paragraphIndex: 0
      }]
    }
  }
}

export function chunkText(text: string, maxChunkSize: number = 1000, overlap: number = 100): string[] {
  const chunks: string[] = []
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  
  let currentChunk = ''
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    
    if (currentChunk.length + trimmedSentence.length + 1 <= maxChunkSize) {
      currentChunk += (currentChunk ? '. ' : '') + trimmedSentence
    } else {
      if (currentChunk) {
        chunks.push(currentChunk + '.')
        
        // Add overlap
        const words = currentChunk.split(' ')
        const overlapWords = words.slice(-Math.floor(overlap / 6))
        currentChunk = overlapWords.join(' ')
      }
      
      if (trimmedSentence.length <= maxChunkSize) {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence
      } else {
        // Handle very long sentences by splitting them
        const words = trimmedSentence.split(' ')
        let tempChunk = ''
        
        for (const word of words) {
          if (tempChunk.length + word.length + 1 <= maxChunkSize) {
            tempChunk += (tempChunk ? ' ' : '') + word
          } else {
            if (tempChunk) {
              chunks.push(tempChunk)
            }
            tempChunk = word
          }
        }
        
        if (tempChunk) {
          currentChunk = tempChunk
        }
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk + '.')
  }
  
  return chunks.filter(chunk => chunk.trim().length > 0)
}