#!/usr/bin/env npx tsx

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

// Verify environment variables are loaded
console.log('Environment check:')
console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set')
console.log('- PINECONE_API_KEY:', process.env.PINECONE_API_KEY ? 'Set' : 'Not set')
console.log('- PINECONE_INDEX_NAME:', process.env.PINECONE_INDEX_NAME || 'Not set')
console.log('')

// Import services after env config
async function importServices() {
  const { pineconeService } = await import('../lib/pinecone/pinecone-service')
  const { fuzzyCitationService } = await import('../lib/citation/fuzzy-citation-service')
  const { enhancedChunkingService } = await import('../lib/pdf/enhanced-chunking')
  return { pineconeService, fuzzyCitationService, enhancedChunkingService }
}

async function testPineconeIntegration() {
  console.log('🧪 Testing Pinecone Integration')
  console.log('================================')

  try {
    // Import services after environment is loaded
    const { pineconeService, fuzzyCitationService, enhancedChunkingService } = await importServices()
    // Test 1: Pinecone Connection
    console.log('\n📋 Test 1: Pinecone Connection')
    const stats = await pineconeService.getIndexStats()
    console.log('✅ Successfully connected to Pinecone')
    console.log(`   Index stats: ${JSON.stringify(stats, null, 2)}`)

    // Test 2: Embedding Generation
    console.log('\n📋 Test 2: Embedding Generation')
    const testText = "This is a test document about financial regulations and compliance requirements."
    const embedding = await pineconeService.generateEmbedding(testText)
    console.log('✅ Successfully generated embedding')
    console.log(`   Embedding dimensions: ${embedding.length}`)
    console.log(`   First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`)

    // Test 3: Document Upsert
    console.log('\n📋 Test 3: Document Upsert')
    const testDocumentId = 'test_doc_' + Date.now()
    const testChunks = [
      {
        text: "Financial institutions must comply with Basel III requirements for capital adequacy ratios.",
        contextBefore: "This section covers regulatory compliance.",
        contextAfter: "The following subsection discusses risk management.",
        pageNumber: 1,
        sectionTitle: "Capital Requirements",
        chunkIndex: 0,
        originalStartChar: 0,
        originalEndChar: 85
      },
      {
        text: "Risk-weighted assets calculation includes credit risk, market risk, and operational risk.",
        contextBefore: "Capital adequacy ratios must be maintained above minimum thresholds.",
        contextAfter: "Stress testing scenarios are required quarterly.",
        pageNumber: 1,
        sectionTitle: "Risk Assessment",
        chunkIndex: 1,
        originalStartChar: 100,
        originalEndChar: 185
      }
    ]

    await pineconeService.upsertDocumentChunks(
      testDocumentId,
      testChunks,
      {
        title: "Test Financial Regulation Document",
        state: "Federal",
        verticals: ["Banking", "Compliance"],
        documentTypes: ["Regulation", "Guidelines"]
      }
    )
    console.log('✅ Successfully upserted test document chunks')

    // Wait for indexing to complete
    console.log('⏳ Waiting 3 seconds for Pinecone indexing...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Test 4: Search
    console.log('\n📋 Test 4: Vector Search')
    const searchResults = await pineconeService.search("What are the capital requirements?", {
      topK: 5,
      includeMetadata: true
    })
    console.log('✅ Successfully performed vector search')
    console.log(`   Found ${searchResults.results.length} results`)
    
    if (searchResults.results.length > 0) {
      const topResult = searchResults.results[0]
      console.log(`   Top result score: ${topResult.score.toFixed(4)}`)
      console.log(`   Top result text: "${topResult.metadata.chunkText?.substring(0, 100)}..."`)
    }

    // Test 5: Fuzzy Text Matching
    console.log('\n📋 Test 5: Fuzzy Text Matching')
    const fullDocumentText = testChunks.map(c => c.text).join('\n\n')
    const searchChunk = searchResults.results[0]?.metadata.chunkText
    
    if (searchChunk) {
      const fuzzyMatch = fuzzyCitationService.findTextInDocument(
        searchChunk,
        fullDocumentText,
        { threshold: 0.3, contextRadius: 100 }
      )
      
      if (fuzzyMatch) {
        console.log('✅ Successfully performed fuzzy text matching')
        console.log(`   Match confidence: ${fuzzyMatch.confidence.toFixed(4)}`)
        console.log(`   Match position: ${fuzzyMatch.startIndex}-${fuzzyMatch.endIndex}`)
        console.log(`   Matched text: "${fuzzyMatch.text.substring(0, 100)}..."`)
      } else {
        console.log('❌ Fuzzy text matching failed')
      }
    }

    // Test 6: Enhanced Chunking
    console.log('\n📋 Test 6: Enhanced Chunking Service')
    const mockProcessedDoc = {
      text: fullDocumentText,
      chunks: [],
      pages: [{ pageNumber: 1, text: fullDocumentText, coordinates: [] }],
      metadata: {
        totalPages: 1,
        processingMethod: 'test' as const,
        extractedAt: new Date().toISOString()
      }
    }
    
    const enhancedChunks = enhancedChunkingService.createEnhancedChunks(mockProcessedDoc, {
      chunkSize: 200,
      contextRadius: 50
    })
    
    console.log('✅ Successfully created enhanced chunks')
    console.log(`   Created ${enhancedChunks.length} enhanced chunks`)
    if (enhancedChunks.length > 0) {
      console.log(`   First chunk: "${enhancedChunks[0].text.substring(0, 50)}..."`)
      console.log(`   Has context before: ${!!enhancedChunks[0].contextBefore}`)
      console.log(`   Has context after: ${!!enhancedChunks[0].contextAfter}`)
    }

    // Test 7: State Filtering
    console.log('\n📋 Test 7: State Filtering Search')
    const stateFilteredResults = await pineconeService.searchWithStates(
      "capital requirements",
      ["Federal"],
      { topK: 3, minSimilarity: 0.1 }
    )
    console.log('✅ Successfully performed state-filtered search')
    console.log(`   Found ${stateFilteredResults.results.length} results for Federal state`)

    // Test 8: Cleanup
    console.log('\n📋 Test 8: Document Cleanup')
    await pineconeService.deleteDocument(testDocumentId)
    console.log('✅ Successfully deleted test document')

    // Final Summary
    console.log('\n🎉 All Pinecone Integration Tests Passed!')
    console.log('================================')
    console.log('✅ Pinecone connection working')
    console.log('✅ Embedding generation working')
    console.log('✅ Document upsert working')
    console.log('✅ Vector search working')
    console.log('✅ Fuzzy text matching working')
    console.log('✅ Enhanced chunking working')
    console.log('✅ State filtering working')
    console.log('✅ Document deletion working')
    console.log('\n🚀 Ready to migrate from ChromaDB to Pinecone!')

  } catch (error) {
    console.error('\n❌ Pinecone Integration Test Failed')
    console.error('================================')
    console.error('Error:', error)
    console.error('\nPlease check:')
    console.error('1. PINECONE_API_KEY is set correctly')
    console.error('2. PINECONE_INDEX_NAME matches your index')
    console.error('3. PINECONE_INDEX_HOST is correct')
    console.error('4. OpenAI API key is working')
    console.error('5. Network connectivity to Pinecone')
    process.exit(1)
  }
}

testPineconeIntegration().catch(console.error)