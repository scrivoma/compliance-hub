#!/usr/bin/env npx tsx

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { agentSetIntegration } from '../lib/agentset/agentset-integration'

async function uploadExisting() {
  const documentId = 'cmdlvb4no00088cax3xbn39nt'  // Your latest document
  
  console.log('📤 Uploading existing document to AgentSet:', documentId)
  
  try {
    await agentSetIntegration.uploadDocument(documentId)
    console.log('✅ Upload initiated!')
    console.log('⏳ Check status in 10-15 seconds for document ID assignment')
  } catch (error) {
    console.error('❌ Upload failed:', error)
  }
}

uploadExisting().catch(console.error)