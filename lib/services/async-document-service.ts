import { PrismaClient } from '@prisma/client'

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
  constructor() {
    console.log('⚠️ AsyncDocumentService: ChromaDB functionality disabled for Vercel deployment')
  }
  
  // Quick upload - just save file and create database record
  async quickUpload(upload: DocumentUpload): Promise<QuickUploadResult> {
    throw new Error('AsyncDocumentService temporarily disabled - use async LlamaIndex upload endpoint instead')
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