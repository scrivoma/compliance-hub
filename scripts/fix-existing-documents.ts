import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixExistingDocuments() {
  try {
    console.log('Fixing existing documents...')
    
    // Update all documents that have vectorId (are processed) but don't have the new status fields
    const updatedDocuments = await prisma.document.updateMany({
      where: {
        vectorId: {
          not: null
        },
        processingStatus: {
          equals: 'UPLOADED' // Default value from migration
        }
      },
      data: {
        processingStatus: 'COMPLETED',
        processingProgress: 100
      }
    })
    
    console.log(`Updated ${updatedDocuments.count} documents to COMPLETED status`)
    
    // Update documents without vectorId to show as failed (since they never completed processing)
    const failedDocuments = await prisma.document.updateMany({
      where: {
        vectorId: null,
        processingStatus: 'UPLOADED',
        createdAt: {
          lt: new Date(Date.now() - 10 * 60 * 1000) // More than 10 minutes old
        }
      },
      data: {
        processingStatus: 'FAILED',
        processingProgress: 0,
        processingError: 'Processing timeout or old upload'
      }
    })
    
    console.log(`Marked ${failedDocuments.count} old documents as FAILED`)
    
    // List all documents and their status
    const allDocuments = await prisma.document.findMany({
      select: {
        id: true,
        title: true,
        processingStatus: true,
        processingProgress: true,
        vectorId: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    console.log('\nCurrent document status:')
    allDocuments.forEach(doc => {
      console.log(`- ${doc.title}: ${doc.processingStatus} (${doc.processingProgress}%) - vectorId: ${doc.vectorId ? 'Yes' : 'No'}`)
    })
    
  } catch (error) {
    console.error('Error fixing documents:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixExistingDocuments().catch(console.error)