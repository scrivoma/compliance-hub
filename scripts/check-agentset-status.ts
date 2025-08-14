#!/usr/bin/env npx tsx

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { agentSetService } from '../lib/agentset/agentset-service'

async function checkStatus() {
  console.log('🔍 Checking AgentSet namespace and job status')
  
  const namespaceId = 'ns_cmdlupvb60001l8043lcowope'  // Your new namespace
  const jobId = 'job_cmdlvmupd0000l504wt2dd3yg'  // The newest job we just created
  
  try {
    // Check namespace
    console.log('📋 Listing all namespaces:')
    const namespaces = await agentSetService.listNamespaces()
    namespaces.forEach(ns => {
      console.log(`   - ${ns.name} (${ns.id})`)
    })
    
    // Check job status
    console.log('\n📄 Checking ingest job status:')
    try {
      const jobResponse = await agentSetService.instance.makeRequest(`/v1/namespace/${namespaceId}/ingest-jobs/${jobId}`)
      console.log('   Raw job response:', JSON.stringify(jobResponse, null, 2))
      
      const jobData = jobResponse.data || jobResponse
      console.log(`   Status: ${jobData.status}`)
      console.log(`   ID: ${jobData.id}`)
      if (jobData.error) {
        console.log(`   Error: ${jobData.error}`)
      }
    } catch (jobError) {
      console.log(`   Job check failed: ${jobError}`)
    }
    
    // Check documents in namespace
    console.log('\n📚 Listing documents in namespace:')
    try {
      const docsResponse = await agentSetService.instance.makeRequest(`/v1/namespace/${namespaceId}/documents`)
      console.log('   Raw documents response:', JSON.stringify(docsResponse, null, 2))
      
      const documents = docsResponse.data || []
      console.log(`   Found ${documents.length} documents`)
      if (Array.isArray(documents)) {
        documents.forEach((doc: any) => {
          console.log(`   - ${doc.name} (${doc.status})`)
        })
      }
    } catch (docError) {
      console.log(`   Document listing failed: ${docError}`)
    }
    
  } catch (error) {
    console.error('❌ Status check failed:', error)
  }
}

checkStatus().catch(console.error)