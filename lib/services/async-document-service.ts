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

export interface QuickUploadResult {
  id: string
  title: string
  filePath: string
  processingStatus: string
}

class AsyncDocumentService {
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
  
  // Quick upload - just save file and create database record
  async quickUpload(upload: DocumentUpload): Promise<QuickUploadResult> {
    try {
      console.log('=== Quick Upload Started ===')
      
      // Generate unique filename
      const fileExtension = upload.file.name.split('.').pop()
      const filename = `${uuidv4()}.${fileExtension}`
      const filePath = join(this.uploadsDir, filename)
      
      // Save file to disk
      const buffer = await upload.file.arrayBuffer()
      await writeFile(filePath, new Uint8Array(buffer))
      console.log('✓ File saved to disk')
      
      // Create document record in database
      const document = await prisma.document.create({
        data: {
          title: upload.title,
          description: upload.description,
          filePath: filename, // Store relative path
          fileSize: buffer.byteLength,
          state: upload.state,
          categoryId: upload.categoryId,
          uploadedBy: upload.uploadedBy,
          processingStatus: 'UPLOADED',
          processingProgress: 0
        }
      })
      console.log('✓ Document record created:', document.id)
      
      // Start background processing (don't await)
      this.processDocumentAsync(document.id, buffer).catch(error => {
        console.error('Background processing failed:', error)
        this.updateProcessingStatus(document.id, 'FAILED', 0, error.message)
      })
      
      return {
        id: document.id,
        title: document.title,
        filePath: filename,
        processingStatus: document.processingStatus
      }
      
    } catch (error) {
      console.error('Quick upload failed:', error)
      throw new Error(`Failed to upload document: ${error.message}`)
    }
  }
  
  // Background processing
  private async processDocumentAsync(documentId: string, buffer: ArrayBuffer) {
    try {
      console.log(`=== Background Processing Started for ${documentId} ===`)
      
      // Update status to EXTRACTING
      await this.updateProcessingStatus(documentId, 'EXTRACTING', 10)
      
      // Extract text from PDF
      console.log('Extracting text from PDF...')
      const extractedText = await extractTextFromPDF(buffer)
      console.log('✓ Text extraction completed')
      
      // Update status to CHUNKING
      await this.updateProcessingStatus(documentId, 'CHUNKING', 30)
      
      // Chunk the text for embeddings
      console.log('Creating text chunks...')
      const chunks = chunkText(extractedText.text, 1000, 100)
      console.log(`✓ Created ${chunks.length} text chunks`)
      
      // Update document with content and total chunks
      await prisma.document.update({
        where: { id: documentId },
        data: {
          content: extractedText.text,
          totalChunks: chunks.length,
          processingStatus: 'EMBEDDING',
          processingProgress: 40
        }
      })
      
      // Initialize vector DB
      await vectorDB.initialize()
      
      // Process chunks one by one with progress updates
      const vectorIds: string[] = []
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const chunkId = `${documentId}-chunk-${i}`
        
        try {
          console.log(`Processing chunk ${i + 1}/${chunks.length}`)
          
          await vectorDB.addDocument({
            id: chunkId,
            content: chunk,
            metadata: {
              documentId: documentId,
              chunkIndex: i,
              totalChunks: chunks.length
            }
          })
          
          vectorIds.push(chunkId)
          
          // Update progress (40% to 90% for embedding phase)
          const progress = 40 + Math.floor((i + 1) / chunks.length * 50) // 40-90%
          console.log(`Progress update: chunk ${i + 1}/${chunks.length} = ${progress}%`)
          await this.updateProcessingProgress(documentId, i + 1, progress)
          
          // Small delay to avoid overwhelming the APIs
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
          
        } catch (error) {
          console.error(`Error processing chunk ${i + 1}:`, error)
          throw error
        }
      }
      
      // Update document with completion
      console.log(`Updating document ${documentId} to COMPLETED status with 100% progress`)
      await prisma.document.update({
        where: { id: documentId },
        data: {
          vectorId: vectorIds[0], // Store first chunk ID as reference
          processingStatus: 'COMPLETED',
          processingProgress: 100
        }
      })
      
      console.log(`✅ Background processing completed for ${documentId} - Status: COMPLETED, Progress: 100%`)
      
    } catch (error) {
      console.error(`Background processing failed for ${documentId}:`, error)
      await this.updateProcessingStatus(documentId, 'FAILED', 0, error.message)
      throw error
    }
  }
  
  private async updateProcessingStatus(
    documentId: string, 
    status: 'UPLOADED' | 'EXTRACTING' | 'CHUNKING' | 'EMBEDDING' | 'COMPLETED' | 'FAILED', 
    progress: number, 
    error?: string
  ) {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        processingStatus: status,
        processingProgress: progress,
        processingError: error || null,
        updatedAt: new Date()
      }
    })
  }
  
  private async updateProcessingProgress(documentId: string, processedChunks: number, progress: number) {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        processedChunks,
        processingProgress: progress,
        updatedAt: new Date()
      }
    })
  }
  
  // Get processing status for a document
  async getProcessingStatus(documentId: string) {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        processingStatus: true,
        processingProgress: true,
        processingError: true,
        totalChunks: true,
        processedChunks: true,
        updatedAt: true
      }
    })
    
    return document
  }
  
  // Get all processing documents for status monitoring
  async getProcessingDocuments(userId: string) {
    const documents = await prisma.document.findMany({
      where: {
        uploadedBy: userId,
        processingStatus: {
          in: ['UPLOADED', 'EXTRACTING', 'CHUNKING', 'EMBEDDING']
        }
      },
      select: {
        id: true,
        title: true,
        processingStatus: true,
        processingProgress: true,
        processingError: true,
        totalChunks: true,
        processedChunks: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    return documents
  }
}

export const asyncDocumentService = new AsyncDocumentService()
export { AsyncDocumentService }