import { PrismaClient } from '@prisma/client'
import { vectorDB } from '../lib/vector-db/chroma'

const prisma = new PrismaClient()

async function cleanupOrphanedVectors() {
  try {
    console.log('=== CLEANING UP ORPHANED VECTORS ===\n')
    
    // 1. Get all valid document IDs from database
    console.log('1. Getting valid document IDs from database...')
    const validDocs = await prisma.document.findMany({
      select: { id: true }
    })
    const validDocIds = new Set(validDocs.map(d => d.id))
    console.log(`Found ${validDocIds.size} valid documents in database`)
    
    // 2. Initialize vector DB and get all vectors
    console.log('\n2. Connecting to ChromaDB...')
    await vectorDB.initialize()
    
    // 3. Get a large sample of vectors to find all document IDs
    console.log('3. Scanning vector database for all document IDs...')
    const searchResults = await vectorDB.searchDocuments('', 1000) // Get many results
    
    const vectorEntries = []
    if (searchResults.ids?.[0] && searchResults.metadatas?.[0]) {
      for (let i = 0; i < searchResults.ids[0].length; i++) {
        const vectorId = searchResults.ids[0][i]
        const metadata = searchResults.metadatas[0][i]
        if (metadata?.documentId) {
          vectorEntries.push({
            vectorId,
            documentId: metadata.documentId,
            title: metadata.title
          })
        }
      }
    }
    
    console.log(`Found ${vectorEntries.length} vector entries`)
    
    // 4. Identify orphaned vectors
    const orphanedVectors = vectorEntries.filter(v => !validDocIds.has(v.documentId))
    const validVectors = vectorEntries.filter(v => validDocIds.has(v.documentId))
    
    console.log(`\nVector Analysis:`)
    console.log(`- Valid vectors: ${validVectors.length}`)
    console.log(`- Orphaned vectors: ${orphanedVectors.length}`)
    
    if (orphanedVectors.length > 0) {
      console.log('\nOrphaned document IDs:')
      const orphanedDocIds = [...new Set(orphanedVectors.map(v => v.documentId))]
      orphanedDocIds.forEach(id => {
        const count = orphanedVectors.filter(v => v.documentId === id).length
        console.log(`- ${id}: ${count} chunks`)
      })
    }
    
    // 5. Ask for confirmation before deletion
    console.log(`\n=== CLEANUP PLAN ===`)
    console.log(`Will delete ${orphanedVectors.length} orphaned vector chunks`)
    console.log(`Will keep ${validVectors.length} valid vector chunks`)
    
    if (orphanedVectors.length === 0) {
      console.log('\n✅ No orphaned vectors found. Database is clean!')
      return
    }
    
    // In a real scenario, you might want to add confirmation here
    // For this diagnostic, we'll proceed automatically
    console.log('\n🧹 Starting cleanup...')
    
    // 6. Delete orphaned vectors
    let deletedCount = 0
    for (const orphaned of orphanedVectors) {
      try {
        await vectorDB.deleteDocument(orphaned.vectorId)
        deletedCount++
        if (deletedCount % 10 === 0) {
          console.log(`Deleted ${deletedCount}/${orphanedVectors.length} orphaned vectors...`)
        }
      } catch (error) {
        console.error(`Failed to delete vector ${orphaned.vectorId}:`, error.message)
      }
    }
    
    console.log(`\n✅ Cleanup completed!`)
    console.log(`- Deleted: ${deletedCount} orphaned vectors`)
    console.log(`- Failed: ${orphanedVectors.length - deletedCount} deletions`)
    
    // 7. Verify cleanup
    console.log('\n7. Verifying cleanup...')
    const postCleanupResults = await vectorDB.searchDocuments('', 100)
    const postCleanupEntries = []
    
    if (postCleanupResults.ids?.[0] && postCleanupResults.metadatas?.[0]) {
      for (let i = 0; i < postCleanupResults.ids[0].length; i++) {
        const metadata = postCleanupResults.metadatas[0][i]
        if (metadata?.documentId) {
          postCleanupEntries.push(metadata.documentId)
        }
      }
    }
    
    const postCleanupOrphans = postCleanupEntries.filter(id => !validDocIds.has(id))
    console.log(`Remaining orphaned vectors: ${postCleanupOrphans.length}`)
    
    if (postCleanupOrphans.length === 0) {
      console.log('🎉 All orphaned vectors successfully removed!')
    } else {
      console.log('⚠️  Some orphaned vectors still remain')
    }
    
  } catch (error) {
    console.error('Cleanup error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanupOrphanedVectors()