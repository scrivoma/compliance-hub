#!/usr/bin/env npx tsx

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { agentSetService } from '../lib/agentset/agentset-service'

async function testSearch() {
  console.log('🔍 Testing AgentSet search with uploaded document')
  
  // Use your new namespace ID with correct embeddings
  const namespaceId = 'ns_cmdlupvb60001l8043lcowope'
  
  try {
    console.log('📋 Testing search query: "what are the fees"')
    const results = await agentSetService.search(namespaceId, 'what are the fees', {
      topK: 5,
      rerank: true
    })
    
    console.log('✅ Search Results:')
    console.log(`   Total results: ${results.totalResults}`)
    console.log(`   Citations found: ${results.citations?.length || 0}`)
    console.log(`   Processing time: ${results.processingTime}ms`)
    
    if (results.results && results.results.length > 0) {
      console.log('\n📄 Top result:')
      const topResult = results.results[0]
      console.log(`   Score: ${topResult.score}`)
      console.log(`   Document: ${topResult.document?.name}`)
      console.log(`   Content preview: ${topResult.chunk?.content?.substring(0, 200)}...`)
      
      if (topResult.chunk?.startChar && topResult.chunk?.endChar) {
        console.log(`   Position: chars ${topResult.chunk.startChar}-${topResult.chunk.endChar}`)
      }
    }
    
    if (results.citations && results.citations.length > 0) {
      console.log('\n📎 Citations:')
      results.citations.forEach((citation, index) => {
        console.log(`   ${index + 1}. "${citation.text?.substring(0, 100)}..." (confidence: ${citation.confidence})`)
      })
    }
    
  } catch (error) {
    console.error('❌ Search failed:', error)
  }
}

testSearch().catch(console.error)