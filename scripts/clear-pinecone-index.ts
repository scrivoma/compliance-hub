#!/usr/bin/env npx tsx

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { Pinecone } from '@pinecone-database/pinecone'

async function clearPineconeIndex() {
  try {
    console.log('🗑️ Clearing all embeddings from Pinecone index...')
    
    const apiKey = process.env.PINECONE_API_KEY
    const indexName = process.env.PINECONE_INDEX_NAME || 'playbook2026'
    
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY environment variable is required')
    }

    const pinecone = new Pinecone({ apiKey })
    const index = pinecone.index(indexName)
    
    // Get index stats first
    const stats = await index.describeIndexStats()
    console.log('📊 Current index stats:', stats)
    
    if (stats.totalVectorCount === 0) {
      console.log('✅ Index is already empty')
      return
    }
    
    // Delete all vectors in the index
    console.log(`🗑️ Deleting ${stats.totalVectorCount} vectors...`)
    await index.deleteAll()
    
    console.log('✅ Successfully cleared all embeddings from Pinecone index')
    
    // Wait a moment and verify it's empty
    await new Promise(resolve => setTimeout(resolve, 2000))
    const newStats = await index.describeIndexStats()
    console.log('📊 Index stats after clearing:', newStats)
    
  } catch (error) {
    console.error('❌ Error clearing Pinecone index:', error)
  }
}

clearPineconeIndex().catch(console.error)