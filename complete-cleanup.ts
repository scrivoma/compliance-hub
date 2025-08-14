import { PrismaClient } from '@prisma/client'
import { ChromaClient } from 'chromadb'

const prisma = new PrismaClient()

async function completeCleanup() {
  try {
    console.log('🧹 Starting complete system cleanup...\n')
    
    // 1. Clear all ChromaDB collections
    console.log('🗑️ Clearing ChromaDB collections...')
    const chroma = new ChromaClient({ path: 'http://localhost:8002' })
    
    // Delete original collection
    try {
      await chroma.deleteCollection({ name: 'compliance_documents' })
      console.log('✅ Deleted original ChromaDB collection')
    } catch (error) {
      console.log('⚠️ Original collection not found (this is fine)')
    }
    
    // Delete LlamaIndex collection
    try {
      await chroma.deleteCollection({ name: 'compliance_documents_llamaindex' })
      console.log('✅ Deleted LlamaIndex ChromaDB collection')
    } catch (error) {
      console.log('⚠️ LlamaIndex collection not found (this is fine)')
    }
    
    // Recreate both collections fresh
    try {
      await chroma.createCollection({ name: 'compliance_documents' })
      console.log('✅ Created fresh original collection')
    } catch (error) {
      console.log('ℹ️ Original collection already exists')
    }
    
    try {
      await chroma.createCollection({ 
        name: 'compliance_documents_llamaindex',
        metadata: { "hnsw:space": "cosine" }
      })
      console.log('✅ Created fresh LlamaIndex collection')
    } catch (error) {
      console.log('ℹ️ LlamaIndex collection already exists')
    }
    
    // 2. Delete all documents from database
    console.log('\n🗑️ Clearing database...')
    
    // Delete junction table records first (foreign key constraints)
    const verticalDeleted = await prisma.documentVertical.deleteMany({})
    console.log(`✅ Deleted ${verticalDeleted.count} document-vertical relationships`)
    
    const typeDeleted = await prisma.documentDocumentType.deleteMany({})
    console.log(`✅ Deleted ${typeDeleted.count} document-type relationships`)
    
    // Delete all documents
    const docsDeleted = await prisma.document.deleteMany({})
    console.log(`✅ Deleted ${docsDeleted.count} documents from database`)
    
    // 3. Clean up file system
    console.log('\n🗑️ Cleaning upload directory...')
    const fs = await import('fs/promises')
    const path = await import('path')
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    
    try {
      const files = await fs.readdir(uploadDir)
      let fileCount = 0
      
      for (const file of files) {
        if (file.endsWith('.pdf')) {
          await fs.unlink(path.join(uploadDir, file))
          fileCount++
        }
      }
      
      console.log(`✅ Deleted ${fileCount} PDF files from uploads directory`)
    } catch (error) {
      console.log('⚠️ Could not clean uploads directory:', error instanceof Error ? error.message : error)
    }
    
    // 4. Summary
    console.log('\n' + '='.repeat(50))
    console.log('🎉 Complete cleanup finished!')
    console.log('='.repeat(50))
    console.log('\n📋 System Status:')
    console.log('  ✅ ChromaDB: Both collections cleared and recreated')
    console.log('  ✅ Database: All documents and relationships removed')
    console.log('  ✅ File System: Upload directory cleaned')
    console.log('\n🚀 Ready for Testing:')
    console.log('  1. Go to Admin → LlamaIndex Test tab')
    console.log('  2. Upload new documents with coordinate tracking')
    console.log('  3. Test citation search and highlighting')
    console.log('  4. Enjoy perfect citation highlighting! 🎯')
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
  } finally {
    await prisma.$disconnect()
  }
}

completeCleanup()