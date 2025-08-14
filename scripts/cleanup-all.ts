#!/usr/bin/env tsx

/**
 * Complete cleanup script to reset the compliance hub
 * This will clear:
 * - All documents from the database
 * - All vector embeddings from ChromaDB collections
 * - All uploaded files from the filesystem
 * - All document relationships (verticals, types, annotations)
 * - Search history
 */

import { PrismaClient } from '@prisma/client'
import { ChromaClient } from 'chromadb'
import { promises as fs } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

async function cleanupDatabase() {
  console.log('🗑️ Starting database cleanup...')
  
  try {
    // Delete in correct order due to foreign key constraints
    console.log('📝 Deleting annotations...')
    await prisma.annotation.deleteMany()
    
    console.log('📊 Deleting search history...')
    await prisma.searchHistory.deleteMany()
    
    console.log('🔗 Deleting document relationships...')
    await prisma.documentVertical.deleteMany()
    await prisma.documentDocumentType.deleteMany()
    
    console.log('📄 Deleting all documents...')
    const documentCount = await prisma.document.count()
    await prisma.document.deleteMany()
    
    console.log(`✅ Database cleanup complete! Deleted ${documentCount} documents and all related data.`)
  } catch (error) {
    console.error('❌ Database cleanup failed:', error)
    throw error
  }
}

async function cleanupChromaDB() {
  console.log('🔍 Starting ChromaDB cleanup...')
  
  try {
    const chroma = new ChromaClient({
      host: process.env.CHROMADB_HOST || 'localhost',
      port: parseInt(process.env.CHROMADB_PORT || '8002')
    })
    
    // List all collections
    const collections = await chroma.listCollections()
    console.log('📚 Found collections:', collections.map(c => c.name))
    
    // Delete known collections
    const collectionsToDelete = [
      'compliance_documents_llamaindex',
      'compliance-documents'
    ]
    
    for (const collectionName of collectionsToDelete) {
      try {
        console.log(`🗑️ Attempting to delete collection: ${collectionName}`)
        await chroma.deleteCollection({ name: collectionName })
        console.log(`✅ Deleted collection: ${collectionName}`)
      } catch (error: any) {
        if (error.message?.includes('does not exist')) {
          console.log(`ℹ️ Collection ${collectionName} doesn't exist, skipping`)
        } else {
          console.error(`❌ Failed to delete collection ${collectionName}:`, error)
        }
      }
    }
    
    console.log('✅ ChromaDB cleanup complete!')
  } catch (error) {
    console.error('❌ ChromaDB cleanup failed:', error)
    throw error
  }
}

async function cleanupFiles() {
  console.log('📁 Starting file system cleanup...')
  
  try {
    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    
    try {
      // Check if uploads directory exists
      await fs.access(uploadsDir)
      
      // Read all files in uploads directory
      const files = await fs.readdir(uploadsDir)
      console.log(`📄 Found ${files.length} files in uploads directory`)
      
      // Delete all files
      for (const file of files) {
        const filePath = join(uploadsDir, file)
        await fs.unlink(filePath)
        console.log(`🗑️ Deleted: ${file}`)
      }
      
      console.log(`✅ File cleanup complete! Deleted ${files.length} files.`)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log('ℹ️ Uploads directory doesn\'t exist, nothing to clean')
      } else {
        throw error
      }
    }
  } catch (error) {
    console.error('❌ File cleanup failed:', error)
    throw error
  }
}

async function resetUserStats() {
  console.log('📊 Resetting user statistics...')
  
  try {
    // Clear user recent documents and other stats if needed
    // This would be where you'd reset any user-specific caches or statistics
    
    console.log('✅ User statistics reset complete!')
  } catch (error) {
    console.error('❌ User statistics reset failed:', error)
    throw error
  }
}

async function main() {
  console.log('🚀 Starting complete cleanup of Compliance Hub...')
  console.log('⚠️ This will delete ALL documents, embeddings, and uploaded files!')
  
  try {
    // Run all cleanup operations
    await cleanupDatabase()
    await cleanupChromaDB()
    await cleanupFiles()
    await resetUserStats()
    
    console.log('🎉 Complete cleanup successful!')
    console.log('📝 You can now start fresh with the updated URL scraping flow.')
    console.log('')
    console.log('Next steps:')
    console.log('1. Upload some PDFs using the file upload')
    console.log('2. Try scraping some URLs using the URL input')
    console.log('3. Test the search functionality with both types')
    
  } catch (error) {
    console.error('💥 Cleanup failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Check for confirmation flag
const args = process.argv.slice(2)
if (!args.includes('--confirm')) {
  console.log('⚠️ This script will delete ALL data from the compliance hub!')
  console.log('📝 To proceed, run: npm run cleanup:all -- --confirm')
  console.log('🔄 Or use tsx: npx tsx scripts/cleanup-all.ts --confirm')
  process.exit(0)
}

main().catch(console.error)