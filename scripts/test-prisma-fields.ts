#!/usr/bin/env npx tsx

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testPrismaFields() {
  console.log('🔍 Testing Prisma client with agentSetDocumentId field')
  
  try {
    // Try to query documents with the new fields
    const documents = await prisma.document.findMany({
      select: {
        id: true,
        title: true,
        agentSetJobId: true,
        agentSetDocumentId: true,
        processingStatus: true,
        createdAt: true
      },
      take: 5,
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    console.log(`✅ Found ${documents.length} documents`)
    console.log('✅ Prisma client successfully recognizes agentSetDocumentId field!')
    
    if (documents.length > 0) {
      console.log('\n📄 Sample documents:')
      documents.forEach((doc, index) => {
        console.log(`   ${index + 1}. ${doc.title} (${doc.processingStatus})`)
        console.log(`      ID: ${doc.id}`)
        console.log(`      AgentSet Job ID: ${doc.agentSetJobId || 'None'}`)
        console.log(`      AgentSet Doc ID: ${doc.agentSetDocumentId || 'None'}`)
        console.log(`      Created: ${doc.createdAt}`)
        console.log('')
      })
    }
    
  } catch (error) {
    console.error('❌ Prisma field test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testPrismaFields().catch(console.error)