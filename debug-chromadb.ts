import { ChromaClient } from 'chromadb'

async function debugChromaDB() {
  try {
    const chroma = new ChromaClient({
      path: process.env.CHROMADB_URL || 'http://localhost:8002'
    })
    
    console.log('🔍 Checking ChromaDB collections...')
    
    // List all collections
    const collections = await chroma.listCollections()
    console.log('Collections:', collections.map(c => c.name))
    
    // Check LlamaIndex collection
    try {
      const collection = await chroma.getCollection({ 
        name: 'compliance_documents_llamaindex' 
      })
      
      const count = await collection.count()
      console.log(`📊 LlamaIndex collection has ${count} documents`)
      
      if (count > 0) {
        // Get a few sample documents
        const peek = await collection.peek({ limit: 3 })
        console.log('Sample documents:')
        peek.documents?.forEach((doc, i) => {
          console.log(`${i + 1}. ${doc?.substring(0, 100)}...`)
          console.log(`   Metadata:`, peek.metadatas?.[i])
        })
      }
    } catch (error) {
      console.log('❌ LlamaIndex collection not found:', error.message)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

debugChromaDB()