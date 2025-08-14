// Stub version for Vercel deployment - ChromaDB functionality disabled
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export class LlamaIndexDocumentService {
  constructor() {
    console.log('⚠️ LlamaIndexDocumentService: ChromaDB functionality disabled for Vercel deployment')
  }

  async initCollection() {
    console.log('⚠️ ChromaDB collection initialization skipped')
    return null
  }

  async uploadDocument() {
    throw new Error('LlamaIndex document service temporarily disabled - use Pinecone service instead')
  }

  async searchDocuments() {
    throw new Error('LlamaIndex search temporarily disabled - use Pinecone search instead')  
  }

  async deleteDocument() {
    console.log('⚠️ ChromaDB document deletion skipped')
    return true
  }
}