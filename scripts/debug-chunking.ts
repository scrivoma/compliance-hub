#!/usr/bin/env npx tsx

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { enhancedChunkingService } from '@/lib/pdf/enhanced-chunking'

const prisma = new PrismaClient()

async function debugChunking() {
  try {
    console.log('🔍 Finding Colorado document...')
    
    // Find the Colorado document
    const document = await prisma.document.findFirst({
      where: { state: 'CO' },
      orderBy: { createdAt: 'desc' }
    })
    
    if (!document) {
      console.log('❌ No Colorado documents found')
      return
    }
    
    console.log('📄 Found document:', document.title)
    console.log('📊 Content length:', document.content?.length || 0)
    
    if (!document.content) {
      console.log('❌ Document has no content')
      return
    }
    
    // Search for the fee text in the full document
    const fullText = document.content
    const searchTerms = ['125', 'twenty-five thousand', 'exceed', 'fee for issuance']
    
    console.log('\n🔍 Searching full document for key terms...')
    for (const term of searchTerms) {
      const positions = []
      let index = fullText.toLowerCase().indexOf(term.toLowerCase())
      while (index !== -1) {
        positions.push(index)
        index = fullText.toLowerCase().indexOf(term.toLowerCase(), index + 1)
      }
      
      if (positions.length > 0) {
        console.log(`\n📍 Found "${term}" at positions: ${positions.slice(0, 3).join(', ')}${positions.length > 3 ? '...' : ''}`)
        
        // Show context around first occurrence
        const pos = positions[0]
        const start = Math.max(0, pos - 300)
        const end = Math.min(fullText.length, pos + 300)
        const context = fullText.substring(start, end)
        
        console.log(`📖 Context around "${term}":`)
        console.log('---')
        console.log(context)
        console.log('---')
      } else {
        console.log(`❌ "${term}" not found in full document`)
      }
    }
    
    // Create mock processed document for chunking
    const processed = {
      text: fullText,
      chunks: [],
      pages: [{ pageNumber: 1, text: fullText, coordinates: [] }],
      metadata: {
        totalPages: 1,
        processingMethod: 'debug' as const,
        extractedAt: new Date().toISOString()
      }
    }
    
    console.log('\n🔧 Testing enhanced chunking...')
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
        console.log('Chunk text length:', chunk.text.length)
        console.log('Original start char:', chunk.originalStartChar)
        console.log('Original end char:', chunk.originalEndChar)
        console.log('---')
        console.log(chunk.text)
        console.log('---')
        
        // Check what the original text should be
        const originalText = fullText.substring(chunk.originalStartChar, chunk.originalEndChar)
        if (originalText !== chunk.text) {
          console.log('🚨 MISMATCH DETECTED!')
          console.log('Expected from originalStartChar/endChar:')
          console.log('---')
          console.log(originalText)
          console.log('---')
        } else {
          console.log('✅ Chunk text matches original position')
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error debugging chunking:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugChunking().catch(console.error)