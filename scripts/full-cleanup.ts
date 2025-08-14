#!/usr/bin/env npx tsx

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { Pinecone } from '@pinecone-database/pinecone'

const prisma = new PrismaClient()

async function fullCleanup() {
  try {
    console.log('🧹 Starting full cleanup of documents and Pinecone vectors...')
    
    // 1. Clear Pinecone vectors
    console.log('\n🌲 Clearing Pinecone index...')
    const apiKey = process.env.PINECONE_API_KEY
    const indexName = process.env.PINECONE_INDEX_NAME || 'playbook2026'
    
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY environment variable is required')
    }

    const pinecone = new Pinecone({ apiKey })
    const index = pinecone.index(indexName)
    
    // Get current stats
    const stats = await index.describeIndexStats()
    console.log('📊 Current Pinecone stats:', stats)
    
    if (stats.totalVectorCount > 0) {
      console.log(`🗑️ Deleting ${stats.totalVectorCount} vectors from Pinecone...`)
      await index.deleteAll()
      console.log('✅ All Pinecone vectors deleted')
    } else {
      console.log('✅ Pinecone index already empty')
    }
    
    // 2. Clear database documents
    console.log('\n🗄️ Clearing database documents...')
    
    // Delete junction table records first (foreign key constraints)
    console.log('🔗 Deleting document relationships...')
    await prisma.documentVertical.deleteMany({})
    await prisma.documentDocumentType.deleteMany({})
    console.log('✅ Document relationships deleted')
    
    // Delete annotations
    console.log('📝 Deleting annotations...')
    await prisma.annotation.deleteMany({})
    console.log('✅ Annotations deleted')
    
    // Delete search history
    console.log('🔍 Deleting search history...')
    await prisma.searchHistory.deleteMany({})
    console.log('✅ Search history deleted')
    
    // Finally delete documents
    console.log('📄 Deleting documents...')
    const deletedDocs = await prisma.document.deleteMany({})
    console.log(`✅ ${deletedDocs.count} documents deleted`)
    
    // 3. Verify cleanup
    console.log('\n🔍 Verifying cleanup...')
    
    // Check Pinecone
    const newStats = await index.describeIndexStats()
    console.log('📊 Pinecone after cleanup:', newStats)
    
    // Check database
    const docCount = await prisma.document.count()
    const verticalCount = await prisma.documentVertical.count()
    const typeCount = await prisma.documentDocumentType.count()
    
    console.log('📊 Database after cleanup:', {
      documents: docCount,
      documentVerticals: verticalCount,
      documentTypes: typeCount
    })
    
    if (newStats.totalVectorCount === 0 && docCount === 0) {
      console.log('\n🎉 Full cleanup completed successfully!')
      console.log('✅ Pinecone index: EMPTY')
      console.log('✅ Database documents: EMPTY')
      console.log('🚀 Ready for fresh document uploads!')
    } else {
      console.log('⚠️ Cleanup may not be complete')
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fullCleanup().catch(console.error)