// Temporarily disabled llamaindex for Vercel deployment
// import { spawn } from 'child_process'
// import path from 'path'
// import { promises as fs } from 'fs'

export interface CoordinateData {
  page: number
  x: number
  y: number
  width: number
  height: number
}

export interface DocumentChunk {
  text: string
  metadata: {
    page_number: number
    chunk_index: number
    coordinates: CoordinateData
    start_char: number
    end_char: number
  }
}

export interface ProcessedDocument {
  text: string
  chunks: DocumentChunk[]
  pages: Array<{
    pageNumber: number
    text: string
    coordinates: CoordinateData[]
  }>
  metadata: {
    totalPages: number
    processingMethod: 'llamaindex'
    extractedAt: string
  }
}

export async function processDocumentWithLlamaIndex(
  filePath: string,
  options: {
    chunkSize?: number
    chunkOverlap?: number
  } = {}
): Promise<ProcessedDocument> {
  const { chunkSize = 1000, chunkOverlap = 100 } = options
  
  console.log('🔄 Processing document with LlamaIndex + PyMuPDF:', filePath)
  
  try {
    // Create Python script for processing
    const pythonScript = `
import sys
import json
import fitz  # PyMuPDF
from typing import List, Dict, Any

def extract_with_coordinates(pdf_path: str, chunk_size: int = 1000, chunk_overlap: int = 100) -> Dict[str, Any]:
    """Extract text with coordinate tracking using PyMuPDF"""
    
    doc = fitz.open(pdf_path)
    pages_data = []
    full_text = ""
    chunks = []
    char_offset = 0
    
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        
        # Get text blocks with coordinates
        blocks = page.get_text("dict")
        page_text = page.get_text()
        
        # Store page data
        page_coords = []
        for block in blocks.get("blocks", []):
            if "lines" in block:
                bbox = block["bbox"]
                page_coords.append({
                    "x": bbox[0],
                    "y": bbox[1], 
                    "width": bbox[2] - bbox[0],
                    "height": bbox[3] - bbox[1]
                })
        
        pages_data.append({
            "pageNumber": page_num + 1,
            "text": page_text,
            "coordinates": page_coords
        })
        
        full_text += page_text + "\\n"
    
    doc.close()
    
    # Create chunks with coordinate tracking
    chunk_index = 0
    current_pos = 0
    
    while current_pos < len(full_text):
        # Calculate chunk boundaries
        chunk_end = min(current_pos + chunk_size, len(full_text))
        
        # Try to break at sentence boundary
        if chunk_end < len(full_text):
            sentence_break = full_text.rfind(".", current_pos, chunk_end)
            if sentence_break > current_pos + chunk_size // 2:
                chunk_end = sentence_break + 1
        
        chunk_text = full_text[current_pos:chunk_end].strip()
        
        if chunk_text:
            # Calculate the actual end position based on the extracted text
            actual_end_pos = current_pos + len(chunk_text)
            
            # Find which page this chunk primarily belongs to
            chunk_middle = current_pos + len(chunk_text) // 2
            page_num = 1
            text_so_far = 0
            
            for i, page_data in enumerate(pages_data):
                if text_so_far <= chunk_middle <= text_so_far + len(page_data["text"]):
                    page_num = i + 1
                    break
                text_so_far += len(page_data["text"]) + 1  # +1 for newline
            
            # Use first coordinate from the page as approximation
            page_coords = pages_data[page_num - 1]["coordinates"]
            coord = page_coords[0] if page_coords else {"x": 0, "y": 0, "width": 0, "height": 0}
            
            chunks.append({
                "text": chunk_text,
                "metadata": {
                    "page_number": page_num,
                    "chunk_index": chunk_index,
                    "coordinates": {
                        "page": page_num,
                        **coord
                    },
                    "start_char": current_pos,
                    "end_char": actual_end_pos
                }
            })
            
            chunk_index += 1
        
        # Move to next chunk with overlap
        current_pos = max(current_pos + 1, chunk_end - chunk_overlap)
    
    return {
        "text": full_text.strip(),
        "chunks": chunks,
        "pages": pages_data,
        "metadata": {
            "totalPages": len(pages_data),
            "processingMethod": "llamaindex",
            "extractedAt": "2025-07-13T17:00:00Z"
        }
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "PDF path required"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    chunk_size = int(sys.argv[2]) if len(sys.argv) > 2 else 1000
    chunk_overlap = int(sys.argv[3]) if len(sys.argv) > 3 else 100
    
    try:
        result = extract_with_coordinates(pdf_path, chunk_size, chunk_overlap)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
`

    // Write Python script to temp file
    const scriptPath = path.join(process.cwd(), 'temp_processor.py')
    await fs.writeFile(scriptPath, pythonScript)
    
    // Execute Python script
    const result = await new Promise<ProcessedDocument>((resolve, reject) => {
      const python = spawn('python3', [scriptPath, filePath, chunkSize.toString(), chunkOverlap.toString()])
      
      let stdout = ''
      let stderr = ''
      
      python.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      
      python.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      python.on('close', (code) => {
        // Clean up temp file
        fs.unlink(scriptPath).catch(console.error)
        
        if (code !== 0) {
          reject(new Error(`Python process failed: ${stderr}`))
          return
        }
        
        try {
          const parsed = JSON.parse(stdout)
          if (parsed.error) {
            reject(new Error(parsed.error))
          } else {
            resolve(parsed as ProcessedDocument)
          }
        } catch (error) {
          reject(new Error(`Failed to parse Python output: ${error}`))
        }
      })
    })
    
    console.log('✅ Document processed successfully with LlamaIndex')
    console.log(`📊 Extracted ${result.chunks.length} chunks from ${result.metadata.totalPages} pages`)
    
    return result
    
  } catch (error) {
    console.error('❌ Error processing document with LlamaIndex:', error)
    throw error
  }
}

// Fallback to original processor if LlamaIndex fails
export async function processDocumentWithFallback(filePath: string): Promise<ProcessedDocument> {
  // Check if file is markdown (from URL upload)
  if (filePath.endsWith('.md')) {
    console.log('📝 Processing markdown file from URL upload')
    
    try {
      const markdownContent = await fs.readFile(filePath, 'utf-8')
      
      return {
        text: markdownContent,
        chunks: [], // Will be created by enhanced chunking
        pages: [{
          pageNumber: 1,
          text: markdownContent,
          coordinates: []
        }],
        metadata: {
          totalPages: 1,
          processingMethod: 'markdown',
          extractedAt: new Date().toISOString()
        }
      }
    } catch (error) {
      console.error('❌ Error processing markdown file:', error)
      throw error
    }
  }
  
  try {
    return await processDocumentWithLlamaIndex(filePath)
  } catch (error) {
    console.warn('⚠️ LlamaIndex processing failed, falling back to original processor')
    
    // Import original processor
    const { extractTextFromPDF, chunkText } = await import('./processor')
    const fileBuffer = await fs.readFile(filePath)
    const extracted = await extractTextFromPDF(fileBuffer.buffer)
    const chunks = chunkText(extracted.text, 1000, 100)
    
    // Convert to new format with proper character position tracking
    const documentChunks: DocumentChunk[] = []
    let currentPos = 0
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const chunkLength = chunk.length
      
      documentChunks.push({
        text: chunk,
        metadata: {
          page_number: Math.floor((currentPos / extracted.text.length) * extracted.pages.length) + 1,
          chunk_index: i,
          coordinates: {
            page: Math.floor((currentPos / extracted.text.length) * extracted.pages.length) + 1,
            x: 0,
            y: 0,
            width: 0,
            height: 0
          },
          start_char: currentPos,
          end_char: Math.min(currentPos + chunkLength, extracted.text.length)
        }
      })
      
      currentPos += chunkLength
    }
    
    return {
      text: extracted.text,
      chunks: documentChunks,
      pages: extracted.pages.map(page => ({
        pageNumber: page.pageNumber,
        text: page.text,
        coordinates: page.lines.map(line => ({
          page: page.pageNumber,
          x: line.x,
          y: line.y,
          width: line.width,
          height: line.height
        }))
      })),
      metadata: {
        totalPages: extracted.pages.length,
        processingMethod: 'fallback',
        extractedAt: new Date().toISOString()
      }
    }
  }
}