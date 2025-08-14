#!/usr/bin/env npx tsx

import { fuzzyCitationService } from '@/lib/citation/fuzzy-citation-service'

// Test with the actual document content we know exists
const documentText = `CDOR
# November 27, 2019

# SPORTS BETTING INDUSTRY BULLETIN 1

# RE: Rule 3 - Sports Betting Regulations - Licensing & Fees

On November 5, 2019, Colorado voters approved a ten percent (10%) tax on the net proceeds of sports bet wagering, effectively ushering in sports betting in the state of Colorado. The Division of Gaming has been charged with the regulation, and therefore, implementation of sports betting in the state of Colorado in a manner that ensures honesty and integrity in sports betting gaming.

On November 21, 2019, the Colorado Limited Gaming Control Commission adopted emergency rules that allow the

# Licensing Fees

The following fees must be submitted with your application:

| License Type | License Fee | Background Deposit |
| -------------------------------- | ----------- | ------------------ |
| Master | $2,000 | N/A |
| Sports Betting Operator | $1,200 | $10,000 |
| Internet Sports Betting Operator | $1,200 | $10,000 |
| Vendor Major | $1,200 | $10,000 |
| Vendor Minor | $350 | N/A |

A business check is the accepted form of payment for required application fees. Please make checks payable to the Colorado Division of Gaming.`

// Test chunks that might be returned from Pinecone
const testChunks = [
  {
    chunkText: "The following fees must be submitted with your application: | License Type | License Fee | Background Deposit | | Master | $2,000 | N/A |",
    contextBefore: "# Licensing Fees",
    contextAfter: "A business check is the accepted form",
    metadata: {}
  },
  {
    chunkText: "Sports Betting Operator | $1,200 | $10,000 | Internet Sports Betting Operator | $1,200 | $10,000",
    contextBefore: "Master | $2,000 | N/A |",
    contextAfter: "Vendor Major | $1,200 | $10,000",
    metadata: {}
  }
]

console.log('🧪 Testing fuzzy citation matching...')
console.log(`Document length: ${documentText.length} characters`)
console.log(`Test chunks: ${testChunks.length}`)

const citationPositions = fuzzyCitationService.findMultipleCitations(
  testChunks,
  documentText,
  {
    threshold: 0.3,
    contextRadius: 200,
    minMatchLength: 20
  }
)

console.log(`\n🎯 Results: ${citationPositions.length} citation positions found`)

citationPositions.forEach((pos, idx) => {
  console.log(`\nCitation ${idx + 1}:`)
  console.log(`  Position: ${pos.startIndex}-${pos.endIndex}`)
  console.log(`  Confidence: ${pos.confidence}`)
  console.log(`  Matched text: "${pos.matchedText.substring(0, 100)}..."`)
  console.log(`  Highlight text: "${pos.highlightText.substring(0, 100)}..."`)
  
  // Show the actual text at those positions
  if (pos.startIndex >= 0 && pos.endIndex <= documentText.length) {
    const actualText = documentText.substring(pos.startIndex, pos.endIndex)
    console.log(`  Document text: "${actualText.substring(0, 100)}..."`)
  } else {
    console.log(`  ❌ Invalid positions: ${pos.startIndex}-${pos.endIndex} (doc length: ${documentText.length})`)
  }
})