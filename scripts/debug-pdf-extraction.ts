#!/usr/bin/env npx tsx

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { processDocumentWithFallback } from '@/lib/pdf/llamaindex-processor'
import { enhancedChunkingService } from '@/lib/pdf/enhanced-chunking'

const prisma = new PrismaClient()

async function debugPdfExtraction() {
  try {
    console.log('🔍 Finding latest uploaded document...')
    
    // Find the most recent document
    const document = await prisma.document.findFirst({
      orderBy: { createdAt: 'desc' }
    })
    
    if (!document) {
      console.log('❌ No documents found in database')
      return
    }
    
    console.log('📄 Found document:', document.title)
    console.log('📁 File path:', document.filePath)
    
    const filePath = path.join(process.cwd(), 'public', 'uploads', document.filePath)
    
    console.log('\n🔄 Processing document to debug text extraction...')
    
    // Process document
    const processed = await processDocumentWithFallback(filePath)
    
    console.log('\n📊 Processing results:')
    console.log(`- Total pages: ${processed.metadata.totalPages}`)
    console.log(`- Total text length: ${processed.text.length}`)
    console.log(`- Initial chunks: ${processed.chunks.length}`)
    
    // Search for the specific text about fees
    const searchTerms = ['125', 'thousand', 'exceed', 'fee', 'sports betting', 'license']
    
    console.log('\n🔍 Searching for fee-related text...')
    
    for (const term of searchTerms) {
      const positions = []
      let index = processed.text.toLowerCase().indexOf(term.toLowerCase())
      while (index !== -1) {
        positions.push(index)
        index = processed.text.toLowerCase().indexOf(term.toLowerCase(), index + 1)
      }
      
      if (positions.length > 0) {
        console.log(`\n📍 Found "${term}" at positions: ${positions.join(', ')}`)
        
        // Show context around first occurrence
        const pos = positions[0]
        const start = Math.max(0, pos - 200)
        const end = Math.min(processed.text.length, pos + 200)
        const context = processed.text.substring(start, end)
        
        console.log(`📖 Context around "${term}":`)
        console.log('---')
        console.log(context)
        console.log('---')
      } else {
        console.log(`❌ "${term}" not found in extracted text`)
      }
    }
    
    // Create enhanced chunks
    console.log('\n🔧 Creating enhanced chunks...')
    const enhancedChunks = enhancedChunkingService.createEnhancedChunks(processed, {
      chunkSize: 800,
      contextRadius: 300,
      preserveSentences: true,
      preserveParagraphs: true
    })
    
    console.log(`✅ Created ${enhancedChunks.length} enhanced chunks`)
    
    // Search for fee information in chunks
    console.log('\n🔍 Searching chunks for fee information...')
    
    for (let i = 0; i < enhancedChunks.length; i++) {
      const chunk = enhancedChunks[i]
      const text = chunk.text.toLowerCase()
      
      if (text.includes('fee') && (text.includes('exceed') || text.includes('thousand') || text.includes('125'))) {
        console.log(`\n📦 Chunk ${i} contains fee information:`)
        console.log('---')
        console.log(chunk.text)
        console.log('---')
        console.log(`Context before: ${chunk.contextBefore?.substring(0, 100)}...`)
        console.log(`Context after: ${chunk.contextAfter?.substring(0, 100)}...`)
      }
    }
    
  } catch (error) {
    console.error('❌ Error debugging PDF extraction:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugPdfExtraction().catch(console.error)