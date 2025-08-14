#!/usr/bin/env npx tsx

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { pineconeService } from '@/lib/pinecone/pinecone-service'

async function testNewIndex() {
  try {
    console.log('🧪 Testing new Pinecone index configuration...')
    
    // Test index connection
    const stats = await pineconeService.getIndexStats()
    console.log('📊 Index stats:', stats)
    console.log(`✅ Connected to index with ${stats.dimension} dimensions`)
    
    // Test embedding generation
    console.log('🔍 Testing embedding generation...')
    const testEmbedding = await pineconeService.generateEmbedding('test text for embedding')
    console.log(`✅ Generated embedding with ${testEmbedding.length} dimensions`)
    
    if (testEmbedding.length === 3072) {
      console.log('🎉 Perfect! Using full 3072 dimensions from text-embedding-3-large')
    } else {
      console.log(`⚠️ Expected 3072 dimensions but got ${testEmbedding.length}`)
    }
    
  } catch (error) {
    console.error('❌ Error testing new index:', error)
  }
}

testNewIndex().catch(console.error)