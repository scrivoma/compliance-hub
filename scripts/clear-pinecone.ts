#!/usr/bin/env tsx

import { pineconeService } from '../lib/pinecone/pinecone-service'

async function clearPinecone() {
  try {
    console.log('🧹 Starting Pinecone cleanup...')
    
    // Clear all vectors from the index
    await pineconeService.clearAllVectors()
    
    console.log('✅ Pinecone index cleared successfully')
    
  } catch (error) {
    console.error('❌ Error clearing Pinecone:', error)
    process.exit(1)
  }
}

clearPinecone()