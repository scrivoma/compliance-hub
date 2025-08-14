#!/usr/bin/env npx tsx

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { agentSetIntegration } from '../lib/agentset/agentset-integration'

async function testDeletionSync() {
  console.log('🔍 Testing AgentSet deletion sync')
  
  try {
    // Test with a non-existent document ID to see if the query works
    console.log('📝 Testing deletion sync with non-existent document...')
    await agentSetIntegration.deleteDocument('test-doc-id-123')
    console.log('✅ Deletion sync test completed successfully!')
    console.log('✅ Prisma client can now access agentSetDocumentId field without errors')
    
  } catch (error) {
    console.error('❌ Deletion sync test failed:', error)
  }
}

testDeletionSync().catch(console.error)