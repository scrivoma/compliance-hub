/**
 * AgentSet Integration Service
 * Handles automatic synchronization between local documents and AgentSet
 */

import { agentSetService } from './agentset-service'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Use the new namespace with text-embedding-3-large
const AGENTSET_NAMESPACE_ID = process.env.AGENTSET_NAMESPACE_ID || 'ns_cmdlupvb60001l8043lcowope'

export class AgentSetIntegration {
  /**
   * Upload a document to AgentSet after it's been added to the system
   */
  async uploadDocument(documentId: string): Promise<void> {
    try {
      console.log('🔄 AgentSet: Uploading document', documentId)
      
      // Get document from database
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          title: true,
          content: true,
          sourceType: true,
          filePath: true,
          fileSize: true,
          state: true,
          verticals: {
            select: { 
              vertical: {
                select: { name: true }
              }
            }
          },
          documentTypes: {
            select: { 
              documentType: {
                select: { name: true }
              }
            }
          }
        }
      })
      
      if (!document || !document.content) {
        console.log('⚠️ AgentSet: Document not found or has no content:', documentId)
        return
      }
      
      // Prepare document for AgentSet
      const agentSetDocument = {
        name: document.title || `Document ${document.id}`,
        content: document.content,
        type: 'md' as const, // Always use markdown since LlamaParse outputs markdown
        metadata: {
          originalId: document.id,
          sourceType: document.sourceType,
          fileSize: document.fileSize,
          state: document.state,
          verticals: document.verticals.map(v => v.vertical.name),
          documentTypes: document.documentTypes.map(dt => dt.documentType.name)
        }
      }
      
      // Create ingest job
      const ingestJob = await agentSetService.createIngestJob(AGENTSET_NAMESPACE_ID, [agentSetDocument])
      console.log('✅ AgentSet: Ingest job created:', ingestJob.id)
      
      // Store the AgentSet job ID for tracking
      await prisma.document.update({
        where: { id: documentId },
        data: {
          agentSetJobId: ingestJob.id
        }
      })
      
      // Check job status after a delay to get document ID
      setTimeout(async () => {
        try {
          const documents = await agentSetService.listDocuments(AGENTSET_NAMESPACE_ID)
          const agentSetDoc = documents.find((doc: any) => 
            doc.ingestJobId === ingestJob.id && 
            doc.metadata?.originalId === documentId
          )
          
          if (agentSetDoc) {
            await prisma.document.update({
              where: { id: documentId },
              data: {
                agentSetDocumentId: agentSetDoc.id
              }
            })
            console.log('✅ AgentSet: Document ID stored:', agentSetDoc.id)
          }
        } catch (error) {
          console.error('❌ AgentSet: Failed to get document ID:', error)
        }
      }, 10000) // Check after 10 seconds
      
    } catch (error) {
      console.error('❌ AgentSet: Failed to upload document:', error)
      // Don't throw - we don't want to break the main flow if AgentSet sync fails
    }
  }
  
  /**
   * Remove a document from AgentSet when it's deleted from the system
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      console.log('🔄 AgentSet: Deleting document', documentId)
      
      // Get document to find AgentSet document ID
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          agentSetDocumentId: true
        }
      })
      
      if (!document?.agentSetDocumentId) {
        console.log('⚠️ AgentSet: No AgentSet document ID found for:', documentId)
        return
      }
      
      // Delete from AgentSet
      await agentSetService.deleteDocument(AGENTSET_NAMESPACE_ID, document.agentSetDocumentId)
      console.log('✅ AgentSet: Document deleted')
      
    } catch (error) {
      console.error('❌ AgentSet: Failed to delete document:', error)
      // Don't throw - we don't want to break the deletion flow if AgentSet sync fails
    }
  }
  
  /**
   * Check the status of a document's AgentSet processing
   */
  async checkDocumentStatus(documentId: string): Promise<string | null> {
    try {
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          agentSetJobId: true
        }
      })
      
      if (!document?.agentSetJobId) {
        return null
      }
      
      const job = await agentSetService.getIngestJob(AGENTSET_NAMESPACE_ID, document.agentSetJobId)
      return job.status
      
    } catch (error) {
      console.error('❌ AgentSet: Failed to check status:', error)
      return null
    }
  }
  
  /**
   * Search documents in AgentSet
   */
  async search(query: string, options?: { topK?: number }) {
    try {
      return await agentSetService.search(AGENTSET_NAMESPACE_ID, query, {
        topK: options?.topK || 10,
        rerank: true
      })
    } catch (error) {
      console.error('❌ AgentSet: Search failed:', error)
      throw error
    }
  }
}

// Export singleton instance
export const agentSetIntegration = new AgentSetIntegration()