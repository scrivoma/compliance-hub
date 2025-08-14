import { PrismaClient } from '@prisma/client'
import { vectorDB } from '../lib/vector-db/chroma'

const prisma = new PrismaClient()

async function diagnoseSearchIssue() {
  try {
    console.log('=== SEARCH ISSUE DIAGNOSIS ===\n')
    
    // 1. Check database documents
    console.log('1. Checking database documents...')
    const documents = await prisma.document.findMany({
      include: {
        category: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10 // Just check first 10
    })
    
    console.log(`Found ${documents.length} documents in database`)
    
    if (documents.length > 0) {
      const sampleDoc = documents[0]
      console.log(`\nSample document:`)
      console.log(`- ID: ${sampleDoc.id}`)
      console.log(`- Title: ${sampleDoc.title}`)
      console.log(`- Vector ID: ${sampleDoc.vectorId}`)
      console.log(`- Content length: ${sampleDoc.content?.length || 0}`)
      console.log(`- Content preview: ${sampleDoc.content?.substring(0, 200) || 'No content'}...`)
    }
    
    // 2. Check ChromaDB vector data
    console.log('\n2. Checking ChromaDB vector data...')
    try {
      await vectorDB.initialize()
      
      // Search for any content to see what's in the vector DB
      const searchResults = await vectorDB.searchDocuments('licensing', 5)
      
      console.log(`Vector search results found: ${searchResults.ids?.[0]?.length || 0}`)
      
      if (searchResults.ids?.[0]?.length > 0) {
        console.log('\nSample vector search results:')
        for (let i = 0; i < Math.min(3, searchResults.ids[0].length); i++) {
          const id = searchResults.ids[0][i]
          const doc = searchResults.documents?.[0]?.[i]
          const metadata = searchResults.metadatas?.[0]?.[i]
          const distance = searchResults.distances?.[0]?.[i]
          
          console.log(`\nResult ${i + 1}:`)
          console.log(`- Vector ID: ${id}`)
          console.log(`- Document ID from metadata: ${metadata?.documentId}`)
          console.log(`- Title from metadata: ${metadata?.title}`)
          console.log(`- Distance: ${distance}`)
          console.log(`- Content preview: ${doc?.substring(0, 200) || 'No content'}...`)
          
          // Check if this document ID exists in the database
          if (metadata?.documentId) {
            const dbDoc = await prisma.document.findUnique({
              where: { id: metadata.documentId }
            })
            console.log(`- Document exists in DB: ${!!dbDoc}`)
            if (dbDoc) {
              console.log(`- DB document title: ${dbDoc.title}`)
              console.log(`- DB content matches vector content: ${dbDoc.content?.includes(doc?.substring(0, 100) || '') ? 'YES' : 'NO'}`)
            }
          }
        }
      }
      
      // 3. Test specific search that might be problematic
      console.log('\n3. Testing specific search queries...')
      const testQueries = ['requirements', 'licensing', 'application', 'fees']
      
      for (const query of testQueries) {
        console.log(`\nTesting query: "${query}"`)
        const results = await vectorDB.searchDocuments(query, 3)
        console.log(`- Results found: ${results.ids?.[0]?.length || 0}`)
        
        if (results.ids?.[0]?.length > 0) {
          const firstResult = results.documents?.[0]?.[0]
          const firstMetadata = results.metadatas?.[0]?.[0]
          console.log(`- First result document ID: ${firstMetadata?.documentId}`)
          console.log(`- First result preview: ${firstResult?.substring(0, 100) || 'No content'}...`)
        }
      }
      
    } catch (vectorError) {
      console.error('Vector DB error:', vectorError)
    }
    
    // 4. Check for orphaned vector entries
    console.log('\n4. Checking for data consistency issues...')
    const allDocIds = documents.map(d => d.id)
    console.log(`Document IDs in database: ${allDocIds.length}`)
    
    // Search for vectors and check if their document IDs exist
    const allVectorResults = await vectorDB.searchDocuments('', 100) // Get many results
    const vectorDocIds = new Set()
    
    if (allVectorResults.metadatas?.[0]) {
      for (const metadata of allVectorResults.metadatas[0]) {
        if (metadata?.documentId) {
          vectorDocIds.add(metadata.documentId)
        }
      }
    }
    
    console.log(`Unique document IDs in vector DB: ${vectorDocIds.size}`)
    
    // Check for orphaned vectors (vectors that reference deleted documents)
    const orphanedVectors = Array.from(vectorDocIds).filter(id => !allDocIds.includes(id as string))
    console.log(`Orphaned vectors (referencing deleted documents): ${orphanedVectors.length}`)
    if (orphanedVectors.length > 0) {
      console.log(`Orphaned document IDs: ${orphanedVectors.slice(0, 5).join(', ')}${orphanedVectors.length > 5 ? '...' : ''}`)
    }
    
    // Check for documents without vectors
    const documentsWithoutVectors = documents.filter(d => !d.vectorId)
    console.log(`Documents without vector IDs: ${documentsWithoutVectors.length}`)
    
  } catch (error) {
    console.error('Diagnosis error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

diagnoseSearchIssue()