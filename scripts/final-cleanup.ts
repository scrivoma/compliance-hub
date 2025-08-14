import { PrismaClient } from '@prisma/client'
import { vectorDB } from '../lib/vector-db/chroma'

const prisma = new PrismaClient()

async function finalCleanup() {
  try {
    console.log('=== FINAL CLEANUP ===\n')
    
    // Get valid document IDs
    const validDocs = await prisma.document.findMany({ select: { id: true } })
    const validDocIds = new Set(validDocs.map(d => d.id))
    console.log(`Valid document IDs: ${Array.from(validDocIds).join(', ')}`)
    
    await vectorDB.initialize()
    
    // Try several different search terms to find all vectors
    const searchTerms = ['', 'licensing', 'application', 'requirements', 'the', 'and', 'for', 'a']
    const allVectorIds = new Set()
    const orphanedVectorIds = new Set()
    
    for (const term of searchTerms) {
      console.log(`Searching for vectors with term: "${term}"`)
      const results = await vectorDB.searchDocuments(term, 200)
      
      if (results.ids?.[0] && results.metadatas?.[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const vectorId = results.ids[0][i]
          const metadata = results.metadatas[0][i]
          allVectorIds.add(vectorId)
          
          if (metadata?.documentId && !validDocIds.has(metadata.documentId)) {
            orphanedVectorIds.add(vectorId)
            console.log(`Found orphaned vector: ${vectorId} (doc: ${metadata.documentId})`)
          }
        }
      }
    }
    
    console.log(`\nTotal unique vectors found: ${allVectorIds.size}`)
    console.log(`Orphaned vectors found: ${orphanedVectorIds.size}`)
    
    if (orphanedVectorIds.size > 0) {
      console.log('\nDeleting remaining orphaned vectors...')
      let deleted = 0
      for (const vectorId of orphanedVectorIds) {
        try {
          await vectorDB.deleteDocument(vectorId)
          deleted++
        } catch (error) {
          console.error(`Failed to delete ${vectorId}:`, error.message)
        }
      }
      console.log(`Deleted ${deleted} additional orphaned vectors`)
    } else {
      console.log('\n✅ No orphaned vectors found!')
    }
    
    // Final verification
    console.log('\nFinal verification with search test...')
    const testResults = await vectorDB.searchDocuments('licensing', 10)
    
    if (testResults.metadatas?.[0]) {
      const foundDocIds = testResults.metadatas[0]
        .map(m => m?.documentId)
        .filter(id => id)
      
      const stillOrphaned = foundDocIds.filter(id => !validDocIds.has(id))
      
      if (stillOrphaned.length > 0) {
        console.log(`⚠️  Still found ${stillOrphaned.length} orphaned references:`, stillOrphaned)
      } else {
        console.log('🎉 All search results now reference valid documents!')
      }
    }
    
  } catch (error) {
    console.error('Final cleanup error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

finalCleanup()