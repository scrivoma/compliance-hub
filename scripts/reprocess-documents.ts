#!/usr/bin/env npx tsx

/**
 * Script to re-process existing documents with real PDF text extraction
 * This replaces the mock content with actual PDF content
 */

import { PrismaClient } from '@prisma/client'
import { promises as fs } from 'fs'
import path from 'path'
import { extractTextFromPDF, chunkText } from '../lib/pdf/processor'
import { openai } from '../lib/openai'
import { ChromaClient } from 'chromadb'

const prisma = new PrismaClient()

async function initChromaDB() {
  console.log('Connecting to ChromaDB...')
  const chroma = new ChromaClient({
    path: process.env.CHROMADB_URL || 'http://localhost:8002'
  })
  
  let collection
  try {
    collection = await chroma.getCollection({ name: 'compliance_documents' })
    console.log('Connected to existing ChromaDB collection')
  } catch (error) {
    console.log('Creating new ChromaDB collection...')
    collection = await chroma.createCollection({ name: 'compliance_documents' })
  }
  
  return { chroma, collection }
}

async function reprocessDocument(documentId: string, filePath: string, title: string) {
  console.log(`\n--- Processing document: ${title} ---`)
  console.log(`Document ID: ${documentId}`)
  console.log(`File path: ${filePath}`)
  
  try {
    // Read the PDF file 
    const fullPath = path.join(process.cwd(), 'public', 'uploads', filePath)
    console.log(`Reading PDF from: ${fullPath}`)
    
    const fileBuffer = await fs.readFile(fullPath)
    console.log(`File size: ${fileBuffer.length} bytes`)
    
    // Extract text from PDF
    const extracted = await extractTextFromPDF(fileBuffer.buffer)
    console.log(`Extracted ${extracted.text.length} characters from ${extracted.pages.length} pages`)
    
    // Update document in database with real content
    await prisma.document.update({
      where: { id: documentId },
      data: {
        content: extracted.text,
        metadata: {
          pages: extracted.pages.length,
          textLength: extracted.text.length,
          extractedAt: new Date().toISOString()
        }
      }
    })
    console.log('✓ Updated document in database')
    
    // Create chunks
    const chunks = chunkText(extracted.text, 1000, 100)
    console.log(`Created ${chunks.length} chunks`)
    
    // Generate embeddings and update ChromaDB
    const { chroma, collection } = await initChromaDB()
    
    // Delete existing chunks for this document
    try {
      await collection.delete({
        where: { metadata: { documentId } }
      })
      console.log('✓ Deleted old chunks from ChromaDB')
    } catch (error) {
      console.log('No existing chunks to delete (this is fine)')
    }
    
    // Add new chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      console.log(`Processing chunk ${i + 1}/${chunks.length}...`)
      
      try {
        // Generate embedding
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunk,
        })
        
        const embedding = response.data[0].embedding
        
        // Add to ChromaDB
        await collection.add({
          ids: [`${documentId}_chunk_${i}`],
          embeddings: [embedding],
          documents: [chunk],
          metadatas: [{
            documentId,
            title,
            chunkIndex: i,
            filePath
          }]
        })
        
        console.log(`✓ Added chunk ${i + 1} to ChromaDB`)
      } catch (error) {
        console.error(`✗ Error processing chunk ${i + 1}:`, error)
      }
    }
    
    console.log(`✅ Successfully reprocessed document: ${title}`)
    return true
    
  } catch (error) {
    console.error(`❌ Error reprocessing document ${title}:`, error)
    return false
  }
}

async function main() {
  console.log('🔄 Starting document reprocessing...')
  
  try {
    // Get all documents from database
    const documents = await prisma.document.findMany({
      select: {
        id: true,
        title: true,
        filePath: true
      }
    })
    
    console.log(`Found ${documents.length} documents to reprocess`)
    
    let successCount = 0
    let errorCount = 0
    
    for (const doc of documents) {
      const success = await reprocessDocument(doc.id, doc.filePath, doc.title)
      if (success) {
        successCount++
      } else {
        errorCount++
      }
    }
    
    console.log('\n📊 Reprocessing Summary:')
    console.log(`✅ Successfully processed: ${successCount} documents`)
    console.log(`❌ Failed to process: ${errorCount} documents`)
    console.log('🎉 Reprocessing complete!')
    
  } catch (error) {
    console.error('❌ Fatal error during reprocessing:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
main().catch(console.error)