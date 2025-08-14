import { PrismaClient } from '@prisma/client'
import { vectorDB } from '../lib/vector-db/chroma'

const prisma = new PrismaClient()

async function verifyContentConsistency() {
  try {
    console.log('=== VERIFYING CONTENT CONSISTENCY ===\n')
    
    // 1. Get all documents from database
    console.log('1. Getting documents from database...')
    const documents = await prisma.document.findMany({
      select: {
        id: true,
        title: true,
        content: true
      }
    })
    console.log(`Found ${documents.length} documents in database`)
    
    // 2. Initialize vector DB
    console.log('\n2. Connecting to ChromaDB...')
    await vectorDB.initialize()
    
    // 3. For each document, check vector chunks against database content
    console.log('\n3. Checking content consistency...')
    
    const consistencyResults = []
    
    for (const doc of documents) {
      console.log(`\nChecking document: ${doc.title}`)
      console.log(`Document ID: ${doc.id}`)
      console.log(`Database content length: ${doc.content?.length || 0}`)
      
      if (!doc.content) {
        console.log('⚠️  No content in database - skipping')
        continue
      }
      
      // Search for chunks belonging to this document
      // We'll search for a common word and filter by metadata
      const searchResults = await vectorDB.searchDocuments('the', 100)
      
      let documentChunks = []
      if (searchResults.ids?.[0] && searchResults.metadatas?.[0] && searchResults.documents?.[0]) {
        for (let i = 0; i < searchResults.ids[0].length; i++) {
          const metadata = searchResults.metadatas[0][i]
          if (metadata?.documentId === doc.id) {
            documentChunks.push({
              vectorId: searchResults.ids[0][i],
              content: searchResults.documents[0][i],
              chunkIndex: metadata.chunkIndex || i,
              metadata
            })
          }
        }
      }
      
      console.log(`Found ${documentChunks.length} vector chunks for this document`)
      
      if (documentChunks.length === 0) {
        console.log('⚠️  No vector chunks found for this document')
        consistencyResults.push({
          documentId: doc.id,
          title: doc.title,
          status: 'NO_VECTORS',
          chunksFound: 0,
          matchingChunks: 0
        })
        continue
      }
      
      // Check if vector chunks exist in database content
      let matchingChunks = 0
      let totalChunks = documentChunks.length
      
      for (const chunk of documentChunks.slice(0, 5)) { // Check first 5 chunks
        // Take first 100 characters of chunk to search in database content
        const chunkSample = chunk.content.substring(0, 100).trim()
        
        if (chunkSample && doc.content.includes(chunkSample)) {
          matchingChunks++
          console.log(`✅ Chunk ${chunk.chunkIndex}: Content matches`)
        } else {
          console.log(`❌ Chunk ${chunk.chunkIndex}: Content does NOT match`)
          console.log(`   Vector chunk sample: "${chunkSample.substring(0, 80)}..."`)
          
          // Try to find similar content in database
          const words = chunkSample.split(/\s+/).slice(0, 5)
          const foundWords = words.filter(word => 
            word.length > 3 && doc.content.toLowerCase().includes(word.toLowerCase())
          )
          console.log(`   Found ${foundWords.length}/${words.length} words in database content`)
        }
      }
      
      const matchPercentage = totalChunks > 0 ? (matchingChunks / Math.min(totalChunks, 5)) * 100 : 0
      console.log(`Content consistency: ${matchingChunks}/${Math.min(totalChunks, 5)} chunks match (${matchPercentage.toFixed(1)}%)`)
      
      consistencyResults.push({
        documentId: doc.id,
        title: doc.title,
        status: matchPercentage > 80 ? 'GOOD' : matchPercentage > 50 ? 'PARTIAL' : 'POOR',
        chunksFound: totalChunks,
        matchingChunks,
        matchPercentage
      })
    }
    
    // 4. Summary report
    console.log('\n=== CONSISTENCY SUMMARY ===')
    console.log(`Documents checked: ${consistencyResults.length}`)
    
    const goodDocs = consistencyResults.filter(r => r.status === 'GOOD').length
    const partialDocs = consistencyResults.filter(r => r.status === 'PARTIAL').length
    const poorDocs = consistencyResults.filter(r => r.status === 'POOR').length
    const noVectorsDocs = consistencyResults.filter(r => r.status === 'NO_VECTORS').length
    
    console.log(`✅ Good consistency (>80%): ${goodDocs}`)
    console.log(`⚠️  Partial consistency (50-80%): ${partialDocs}`)
    console.log(`❌ Poor consistency (<50%): ${poorDocs}`)
    console.log(`🔍 No vectors found: ${noVectorsDocs}`)
    
    if (poorDocs > 0 || noVectorsDocs > 0) {
      console.log('\n🚨 ISSUES DETECTED:')
      console.log('Some documents have poor or missing vector consistency.')
      console.log('This explains why search citations don\'t match document content.')
      console.log('\nRecommended actions:')
      console.log('1. Run cleanup-orphaned-vectors.ts to remove stale vectors')
      console.log('2. Re-process documents with poor consistency')
      console.log('3. Update search service to verify content before creating citations')
    } else {
      console.log('\n🎉 All documents have good vector consistency!')
    }
    
  } catch (error) {
    console.error('Verification error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyContentConsistency()