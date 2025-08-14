#!/usr/bin/env npx tsx

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { pineconeDocumentService } from '@/lib/services/pinecone-document-service'

async function testFuzzyCitations() {
  try {
    console.log('🔍 Testing fuzzy citation search for "fee"...')
    
    const searchResults = await pineconeDocumentService.searchWithCitations('fee', {
      topK: 3,
      minSimilarity: 0.1,
      states: ['CO']
    })

    console.log(`📊 Search results: ${searchResults.results.length} results found`)
    
    searchResults.results.forEach((result, index) => {
      console.log(`\n--- Result ${index + 1} ---`)
      console.log(`Score: ${result.score}`)
      console.log(`Text: ${result.text.substring(0, 200)}...`)
      console.log(`Citations found: ${result.citationPositions.length}`)
      
      result.citationPositions.forEach((citation, citIndex) => {
        console.log(`  Citation ${citIndex + 1}: positions ${citation.startIndex}-${citation.endIndex}, confidence: ${citation.confidence}`)
        console.log(`  Matched text: "${citation.matchedText.substring(0, 100)}..."`)
      })
    })

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testFuzzyCitations().catch(console.error)