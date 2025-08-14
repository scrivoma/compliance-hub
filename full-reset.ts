import { PrismaClient } from '@prisma/client'
import { ChromaClient } from 'chromadb'

const prisma = new PrismaClient()

async function fullReset() {
  try {
    console.log('🔄 Starting complete database reset...\n')
    
    // 1. Clear ChromaDB completely
    console.log('🗑️ Clearing ChromaDB...')
    const chroma = new ChromaClient({ path: 'http://localhost:8002' })
    
    try {
      // Delete the entire collection
      await chroma.deleteCollection({ name: 'compliance_documents' })
      console.log('✅ ChromaDB collection deleted')
    } catch (error) {
      console.log('⚠️ Collection not found (this is fine)')
    }
    
    // Recreate the collection
    try {
      await chroma.createCollection({ name: 'compliance_documents' })
      console.log('✅ ChromaDB collection recreated')
    } catch (error) {
      console.log('ℹ️ Collection already exists or error creating:', error.message)
    }
    
    // 2. Delete all documents from database
    console.log('\n🗑️ Clearing document database...')
    
    // Delete junction table records first (foreign key constraints)
    await prisma.documentVertical.deleteMany({})
    console.log('✅ Cleared document-vertical relationships')
    
    await prisma.documentDocumentType.deleteMany({})
    console.log('✅ Cleared document-type relationships')
    
    // Delete all documents
    const deleteResult = await prisma.document.deleteMany({})
    console.log(`✅ Deleted ${deleteResult.count} documents from database`)
    
    // 3. Summary
    console.log('\n🎉 Complete reset finished!')
    console.log('📋 Next steps:')
    console.log('  1. Upload your documents again through the UI')
    console.log('  2. Documents will be processed with fresh text extraction')
    console.log('  3. New vector embeddings will be created')
    console.log('  4. Everything will be perfectly synchronized')
    
    console.log('\n✨ Your system is now ready for clean document uploads!')
    
  } catch (error) {
    console.error('❌ Error during reset:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fullReset()