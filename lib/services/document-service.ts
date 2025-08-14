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

export interface ProcessedDocument {
  id: string
  title: string
  filePath: string
  chunks: string[]
  vectorIds: string[]
}

class DocumentService {
  constructor() {
    console.log('⚠️ DocumentService: ChromaDB functionality disabled for Vercel deployment')
  }
  
  async uploadDocument(upload: DocumentUpload): Promise<ProcessedDocument> {
    throw new Error('DocumentService temporarily disabled - use async LlamaIndex upload endpoint instead')
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
    console.log('⚠️ DocumentService deletion temporarily disabled for Vercel deployment')
    
    // Delete from database only
    await prisma.document.delete({
      where: { id }
    })
  }
}

export const documentService = new DocumentService()
export { DocumentService }