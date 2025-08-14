#!/usr/bin/env npx tsx

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkNewDocument() {
  console.log('🔍 Checking for your newly uploaded document')
  
  try {
    // Get the latest document from database
    const latestDoc = await prisma.document.findFirst({
      where: {
        processingStatus: 'COMPLETED'
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        agentSetJobId: true,
        agentSetDocumentId: true,
        createdAt: true,
        updatedAt: true
      }
    })
    
    if (!latestDoc) {
      console.log('❌ No completed documents found')
      return
    }
    
    console.log('\n📄 Latest Document:')
    console.log(`   Title: ${latestDoc.title}`)
    console.log(`   ID: ${latestDoc.id}`)
    console.log(`   Source URL: ${latestDoc.sourceUrl}`)
    console.log(`   Created: ${latestDoc.createdAt}`)
    console.log(`   Updated: ${latestDoc.updatedAt}`)
    console.log('\n🔗 AgentSet Integration:')
    console.log(`   Job ID: ${latestDoc.agentSetJobId || 'Not uploaded yet'}`)
    console.log(`   Document ID: ${latestDoc.agentSetDocumentId || 'Not assigned yet'}`)
    
    if (!latestDoc.agentSetJobId) {
      console.log('\n⚠️ Document has not been uploaded to AgentSet yet')
      console.log('The automatic upload may not have triggered. Try uploading a new document.')
    }
    
  } catch (error) {
    console.error('❌ Failed to check document:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkNewDocument().catch(console.error)