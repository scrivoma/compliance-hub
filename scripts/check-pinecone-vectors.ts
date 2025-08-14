#!/usr/bin/env npx tsx

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { Pinecone } from '@pinecone-database/pinecone'

async function checkPineconeVectors() {
  try {
    console.log('🔍 Checking what vectors are currently in Pinecone...')
    
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
    const index = pinecone.index('playbook2026')
    
    // Get index stats
    const stats = await index.describeIndexStats()
    console.log('📊 Index stats:', stats)
    
    // Try to list some vectors by doing a dummy search
    console.log('\n🔍 Sampling vectors with dummy search...')
    const dummyVector = new Array(3072).fill(0.1) // Dummy vector
    
    const searchResults = await index.query({
      vector: dummyVector,
      topK: 20,
      includeMetadata: true
    })
    
    console.log(`\n📋 Found ${searchResults.matches?.length || 0} vectors:`)
    
    if (searchResults.matches) {
      // Group by document
      const docGroups: { [key: string]: any[] } = {}
      
      searchResults.matches.forEach(match => {
        const docId = match.metadata?.documentId as string
        const title = match.metadata?.title as string
        const key = `${docId} (${title})`
        
        if (!docGroups[key]) {
          docGroups[key] = []
        }
        docGroups[key].push(match)
      })
      
      Object.entries(docGroups).forEach(([docKey, vectors]) => {
        console.log(`\n📄 ${docKey}:`)
        console.log(`   Vector count: ${vectors.length}`)
        console.log(`   Sample vector IDs: ${vectors.slice(0, 3).map(v => v.id).join(', ')}`)
        if (vectors.length > 3) {
          console.log(`   ... and ${vectors.length - 3} more`)
        }
      })
    }
    
  } catch (error) {
    console.error('❌ Error checking Pinecone vectors:', error)
  }
}

checkPineconeVectors().catch(console.error)