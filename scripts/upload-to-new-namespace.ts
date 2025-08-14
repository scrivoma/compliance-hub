#!/usr/bin/env npx tsx

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { agentSetService } from '../lib/agentset/agentset-service'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function uploadToNewNamespace() {
  console.log('🚀 Uploading document to new AgentSet namespace with correct embeddings')
  
  // Your new namespace with text-embedding-3-large
  const namespaceId = 'ns_cmdlupvb60001l8043lcowope'
  
  try {
    // Get the current document from database
    console.log('📋 Fetching current document from database...')
    const documents = await prisma.document.findMany({
      where: {
        processingStatus: 'COMPLETED',
        content: {
          not: null
        }
      },
      select: {
        id: true,
        title: true,
        content: true,
        sourceType: true,
        filePath: true,
        fileSize: true,
      },
      take: 1
    })
    
    if (documents.length === 0) {
      throw new Error('No completed documents found in database')
    }
    
    const doc = documents[0]
    console.log('✅ Found document:', {
      title: doc.title,
      contentLength: doc.content?.length || 0,
      sourceType: doc.sourceType
    })
    
    // Prepare document for AgentSet
    const agentSetDocument = {
      name: doc.title || `Document ${doc.id}`,
      content: doc.content || '',
      type: 'md' as const,
      metadata: {
        originalId: doc.id,
        sourceType: doc.sourceType,
        fileSize: doc.fileSize,
      }
    }
    
    console.log('📤 Uploading to AgentSet namespace:', namespaceId)
    
    // Upload document
    const ingestJob = await agentSetService.createIngestJob(namespaceId, [agentSetDocument])
    console.log('✅ Ingest job created:', ingestJob.id)
    
    // Wait for processing (with shorter timeout)
    console.log('⏳ Waiting for document processing...')
    try {
      const completedJob = await agentSetService.waitForIngestJob(namespaceId, ingestJob.id, 60000) // 1 minute timeout
      console.log('🎉 Document processed successfully!')
      console.log('   Documents count:', completedJob.documentsCount)
      
    } catch (waitError) {
      console.log('⚠️ Timeout waiting for completion, but job may still be processing')
      console.log('   Job ID:', ingestJob.id)
      
      // Check status manually
      try {
        const job = await agentSetService.getIngestJob(namespaceId, ingestJob.id)
        console.log('   Current status:', job.status)
        if (job.error) {
          console.log('   Error:', job.error)
        }
      } catch (statusError) {
        console.log('   Could not check status:', statusError)
      }
    }
    
    // Test search immediately
    console.log('\n🔍 Testing search functionality...')
    await testSearch(namespaceId)
    
  } catch (error) {
    console.error('❌ Upload failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

async function testSearch(namespaceId: string) {
  const testQueries = [
    'what are the fees',
    'license fee',
    'sports betting',
    'commission action'
  ]
  
  for (const query of testQueries) {
    try {
      console.log(`\n📝 Testing query: "${query}"`)
      const results = await agentSetService.search(namespaceId, query, {
        topK: 3,
        rerank: true
      })
      
      console.log(`   Results: ${results.totalResults}`)
      console.log(`   Citations: ${results.citations?.length || 0}`)
      console.log(`   Time: ${results.processingTime}ms`)
      
      if (results.results && results.results.length > 0) {
        const topResult = results.results[0]
        console.log(`   Top result score: ${topResult.score}`)
        console.log(`   Content preview: "${topResult.chunk?.content?.substring(0, 100)}..."`)
      }
      
    } catch (searchError) {
      console.log(`   Search failed: ${searchError}`)
    }
  }
}

uploadToNewNamespace().catch(console.error)