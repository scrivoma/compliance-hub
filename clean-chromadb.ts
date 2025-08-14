import { ChromaClient } from 'chromadb'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanChromaDB() {
  try {
    console.log('🧹 Starting ChromaDB cleanup...\n')
    
    // Connect to ChromaDB
    const chroma = new ChromaClient({ path: 'http://localhost:8002' })
    let collection
    try {
      collection = await chroma.getCollection({ name: 'compliance_documents' })
    } catch {
      console.log('❌ ChromaDB collection not found')
      return
    }
    
    // Get valid document IDs from database
    const validDocs = await prisma.document.findMany({
      select: { id: true, title: true }
    })
    
    const validDocIds = new Set(validDocs.map(doc => doc.id))
    console.log(`📄 Valid documents (${validDocIds.size}):`)
    validDocs.forEach(doc => {
      console.log(`  ✅ ${doc.id}: ${doc.title}`)
    })
    
    // Get all vectors
    const vectorData = await collection.get({
      include: ['metadatas']
    })
    
    console.log(`\n🔢 Found ${vectorData.ids?.length || 0} total vector chunks`)
    
    if (!vectorData.ids || !vectorData.metadatas) {
      console.log('No vectors to process')
      return
    }
    
    // Identify orphaned vectors
    const orphanedIds = []
    const validIds = []
    
    for (let i = 0; i < vectorData.ids.length; i++) {
      const vectorId = vectorData.ids[i]
      const metadata = vectorData.metadatas[i]
      const documentId = metadata?.documentId
      
      if (documentId && validDocIds.has(String(documentId))) {
        validIds.push(vectorId)
      } else {
        orphanedIds.push(vectorId)
      }
    }
    
    console.log(`\n📊 Analysis:`)
    console.log(`  ✅ Valid chunks: ${validIds.length}`)
    console.log(`  ❌ Orphaned chunks: ${orphanedIds.length}`)
    
    if (orphanedIds.length > 0) {
      console.log(`\n🗑️ Deleting ${orphanedIds.length} orphaned chunks...`)
      
      // Delete in batches to avoid overwhelming the system
      const batchSize = 50
      for (let i = 0; i < orphanedIds.length; i += batchSize) {
        const batch = orphanedIds.slice(i, i + batchSize)
        
        await collection.delete({
          ids: batch
        })
        
        console.log(`  ✅ Deleted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(orphanedIds.length/batchSize)} (${batch.length} chunks)`)
      }
      
      console.log(`\n🎉 Cleanup complete! Deleted ${orphanedIds.length} orphaned chunks`)
    } else {
      console.log(`\n✅ No cleanup needed - database is already consistent`)
    }
    
    // Verify cleanup
    const finalData = await collection.get({
      include: ['metadatas']
    })
    
    console.log(`\n📈 Final state:`)
    console.log(`  - Remaining chunks: ${finalData.ids?.length || 0}`)
    console.log(`  - Expected chunks: ${validIds.length}`)
    console.log(`  - Status: ${(finalData.ids?.length || 0) === validIds.length ? '✅ CLEAN' : '❌ INCONSISTENT'}`)
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanChromaDB()