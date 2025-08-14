import { PrismaClient } from '@prisma/client'
import { vectorDB } from '@/lib/vector-db/chroma'
import { extractTextFromPDF, chunkText } from '@/lib/pdf/processor'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

export interface DocumentUpload {
  file: File
  title: string
  description?: string
  state: string
  categoryId: string
  uploadedBy: string
}

export interface ProcessedDocument {
  id: string
  title: string
  filePath: string
  chunks: string[]
  vectorIds: string[]
}

class DocumentService {
  private uploadsDir = join(process.cwd(), 'public', 'uploads')
  
  constructor() {
    this.ensureUploadsDir()
  }
  
  private async ensureUploadsDir() {
    try {
      await mkdir(this.uploadsDir, { recursive: true })
    } catch (error) {
      console.error('Failed to create uploads directory:', error)
    }
  }
  
  async uploadDocument(upload: DocumentUpload): Promise<ProcessedDocument> {
    try {
      // Initialize vector DB if not already done
      await vectorDB.initialize()
      
      // Generate unique filename
      const fileExtension = upload.file.name.split('.').pop()
      const filename = `${uuidv4()}.${fileExtension}`
      const filePath = join(this.uploadsDir, filename)
      
      // Save file to disk
      const buffer = await upload.file.arrayBuffer()
      await writeFile(filePath, new Uint8Array(buffer))
      
      // Extract text from PDF
      const extractedText = await extractTextFromPDF(buffer)
      console.log('✓ Text extraction completed')
      
      // Chunk the text for embeddings
      console.log('Creating text chunks...')
      const chunks = chunkText(extractedText.text, 1000, 100)
      console.log(`✓ Created ${chunks.length} text chunks`)
      
      // Log first chunk for debugging
      if (chunks.length > 0) {
        console.log(`Sample chunk: ${chunks[0].substring(0, 150)}...`)
      }
      
      console.log('About to create document record in database...')
      
      // Create document record in database
      console.log('Creating document record in database...')
      const document = await prisma.document.create({
        data: {
          title: upload.title,
          description: upload.description,
          filePath: filename, // Store relative path
          fileSize: buffer.byteLength,
          state: upload.state,
          categoryId: upload.categoryId,
          uploadedBy: upload.uploadedBy,
          content: extractedText.text
        }
      })
      console.log('✓ Document record created:', document.id)
      
      // Add chunks to vector database in batches
      console.log('About to start vector processing...')
      const vectorIds: string[] = []
      const BATCH_SIZE = 1 // Process 1 chunk at a time to avoid API rate limits
      
      console.log(`Processing ${chunks.length} chunks in batches of ${BATCH_SIZE}`)
      console.log('About to initialize vector DB...')
      
      // Ensure vector DB is properly initialized before processing
      await vectorDB.initialize()
      console.log('✓ Vector DB initialized for chunk processing')
      
      for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length)
        const batch = chunks.slice(batchStart, batchEnd)
        
        console.log(`Processing batch ${Math.floor(batchStart/BATCH_SIZE) + 1}/${Math.ceil(chunks.length/BATCH_SIZE)} (chunks ${batchStart + 1}-${batchEnd})`)
        
        // Process batch in parallel
        const batchPromises = batch.map(async (chunk, batchIndex) => {
          const i = batchStart + batchIndex
          const chunkId = `${document.id}-chunk-${i}`
          
          try {
            console.log(`Starting to add chunk ${i + 1} to vector DB...`)
            await vectorDB.addDocument({
              id: chunkId,
              content: chunk,
              metadata: {
                documentId: document.id,
                title: upload.title,
                state: upload.state,
                categoryId: upload.categoryId,
                chunkIndex: i,
                totalChunks: chunks.length
              }
            })
            
            console.log(`✓ Successfully processed chunk ${i + 1}/${chunks.length}`)
            return chunkId
          } catch (error) {
            console.error(`✗ Error processing chunk ${i + 1}:`, error)
            console.error('Error details:', error)
            throw error
          }
        })
        
        const batchResults = await Promise.all(batchPromises)
        vectorIds.push(...batchResults)
        
        // Brief pause between batches to avoid overwhelming the APIs
        if (batchEnd < chunks.length) {
          console.log('Waiting 1 second before next batch...')
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      
      console.log(`✅ Successfully processed all ${chunks.length} chunks`)
      
      // Update document with vector ID (we'll store the first chunk ID as reference)
      await prisma.document.update({
        where: { id: document.id },
        data: { vectorId: vectorIds[0] }
      })
      
      return {
        id: document.id,
        title: document.title,
        filePath: filename,
        chunks,
        vectorIds
      }
      
    } catch (error) {
      console.error('Document upload failed:', error)
      throw new Error(`Failed to upload document: ${error.message}`)
    }
  }
  
  async getDocuments(filters?: {
    state?: string
    categoryId?: string
    search?: string
  }) {
    try {
      const where: any = {}
      
      if (filters?.state) {
        where.state = filters.state
      }
      
      if (filters?.categoryId) {
        where.categoryId = filters.categoryId
      }
      
      if (filters?.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { content: { contains: filters.search, mode: 'insensitive' } }
        ]
      }
      
      const documents = await prisma.document.findMany({
        where,
        include: {
          category: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      
      return documents
    } catch (error) {
      console.error('Failed to get documents:', error)
      throw error
    }
  }
  
  async deleteDocument(id: string) {
    try {
      const document = await prisma.document.findUnique({
        where: { id }
      })
      
      if (!document) {
        throw new Error('Document not found')
      }
      
      // Delete from vector database (all chunks)
      if (document.vectorId) {
        // Find and delete all chunks for this document
        const searchResults = await vectorDB.searchDocuments(
          `documentId:${id}`, 
          10000 // Increased limit to handle very large documents
        )
        
        // Delete each chunk
        for (const resultId of searchResults.ids?.[0] || []) {
          await vectorDB.deleteDocument(resultId)
        }
      }
      
      // Delete from database
      await prisma.document.delete({
        where: { id }
      })
      
      // TODO: Delete file from disk
      
    } catch (error) {
      console.error('Failed to delete document:', error)
      throw error
    }
  }
}

export const documentService = new DocumentService()
export { DocumentService }