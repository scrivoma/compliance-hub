#!/usr/bin/env npx tsx

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDocumentContent() {
  try {
    // Get the latest document with SB in title (Colorado doc)
    const document = await prisma.document.findFirst({
      where: {
        title: {
          contains: 'SB'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        title: true,
        content: true,
        state: true,
        processingStatus: true,
        vectorId: true
      }
    })

    if (!document) {
      console.log('❌ No document found with SB in title')
      return
    }

    console.log('📄 Document found:')
    console.log(`   ID: ${document.id}`)
    console.log(`   Title: ${document.title}`)
    console.log(`   State: ${document.state}`)
    console.log(`   Status: ${document.processingStatus}`)
    console.log(`   Vector ID: ${document.vectorId}`)
    console.log(`   Content length: ${document.content?.length || 0} characters`)

    if (document.content) {
      // Search for fee-related content
      const feeIndex = document.content.toLowerCase().indexOf('fee')
      const tableIndex = document.content.indexOf('|')
      
      console.log('\n🔍 Content analysis:')
      console.log(`   First "fee" at position: ${feeIndex}`)
      console.log(`   First "|" (table) at position: ${tableIndex}`)

      // Show content around fees
      if (feeIndex >= 0) {
        console.log('\n📝 Content around "fee":')
        const start = Math.max(0, feeIndex - 200)
        const end = Math.min(document.content.length, feeIndex + 500)
        console.log(document.content.substring(start, end))
      }

      // Show table content if found
      if (tableIndex >= 0) {
        console.log('\n📊 Table content found:')
        const tableStart = Math.max(0, tableIndex - 100)
        const tableEnd = Math.min(document.content.length, tableIndex + 800)
        console.log(document.content.substring(tableStart, tableEnd))
      }
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDocumentContent().catch(console.error)