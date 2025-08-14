import { PrismaClient } from '@prisma/client'
import { ChromaClient } from 'chromadb'

const prisma = new PrismaClient()

async function checkVectorConsistency() {
  try {
    console.log('🔍 Checking vector-database consistency...\n')
    
    // Connect to ChromaDB
    const chroma = new ChromaClient({ path: 'http://localhost:8002' })
    let collection
    try {
      collection = await chroma.getCollection({ name: 'compliance_documents' })
    } catch {
      console.log('❌ ChromaDB collection not found')
      return
    }
    
    // Get all documents from database
    const documents = await prisma.document.findMany({
      select: { id: true, title: true }
    })
    
    console.log(`📄 Found ${documents.length} documents in database:`)
    documents.forEach(doc => {
      console.log(`  - ${doc.id}: ${doc.title}`)
    })
    
    // Get all vectors from ChromaDB
    const vectorData = await collection.get({
      include: ['metadatas']
    })
    
    console.log(`\n🔢 Found ${vectorData.ids?.length || 0} vector chunks in ChromaDB\n`)
    
    // Group vectors by document ID
    const vectorsByDoc = new Map<string, number>()
    const orphanedVectors: Array<{vectorId: string, documentId: any, title: any}> = []
    
    if (vectorData.ids && vectorData.metadatas) {
      for (let i = 0; i < vectorData.ids.length; i++) {
        const vectorId = vectorData.ids[i]
        const metadata = vectorData.metadatas[i]
        const documentId = metadata?.documentId
        
        if (documentId) {
          // Check if document exists in database
          const docExists = documents.find(doc => doc.id === documentId)
          
          if (docExists) {
            // Valid vector - count it
            const currentCount = vectorsByDoc.get(String(documentId)) || 0
            vectorsByDoc.set(String(documentId), currentCount + 1)
          } else {
            // Orphaned vector
            orphanedVectors.push({
              vectorId,
              documentId,
              title: metadata?.title || 'Unknown'
            })
          }
        } else {
          // Vector with no documentId metadata
          orphanedVectors.push({
            vectorId,
            documentId: 'MISSING',
            title: 'No metadata'
          })
        }
      }
    }
    
    // Report results
    console.log('📊 Vector Distribution by Document:')
    documents.forEach(doc => {
      const vectorCount = vectorsByDoc.get(doc.id) || 0
      const status = vectorCount > 0 ? '✅' : '❌'
      console.log(`  ${status} ${doc.title}: ${vectorCount} chunks`)
    })
    
    if (orphanedVectors.length > 0) {
      console.log(`\n🚨 Found ${orphanedVectors.length} ORPHANED vectors:`)
      const orphansByDoc = new Map<string, number>()
      
      orphanedVectors.forEach(orphan => {
        const count = orphansByDoc.get(orphan.documentId) || 0
        orphansByDoc.set(orphan.documentId, count + 1)
      })
      
      orphansByDoc.forEach((count, docId) => {
        const title = orphanedVectors.find(o => o.documentId === docId)?.title || 'Unknown'
        console.log(`  ❌ Document ${docId} (${title}): ${count} orphaned chunks`)
      })
      
      console.log('\n💡 RECOMMENDATION: Clear ChromaDB and re-upload documents')
    } else {
      console.log('\n✅ No orphaned vectors found! Database is consistent.')
    }
    
    console.log(`\n📈 Summary:`)
    console.log(`  - Documents in DB: ${documents.length}`)
    console.log(`  - Total vector chunks: ${vectorData.ids?.length || 0}`)
    console.log(`  - Orphaned chunks: ${orphanedVectors.length}`)
    console.log(`  - Consistency: ${orphanedVectors.length === 0 ? '✅ GOOD' : '❌ NEEDS CLEANUP'}`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkVectorConsistency()