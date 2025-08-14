import { processDocumentWithFallback } from './lib/pdf/llamaindex-processor'
import path from 'path'

async function testProcessor() {
  try {
    // Find the uploaded PDF file
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    const fs = await import('fs/promises')
    const files = await fs.readdir(uploadDir)
    const pdfFile = files.find(f => f.endsWith('.pdf'))
    
    if (!pdfFile) {
      console.log('❌ No PDF file found in uploads directory')
      return
    }
    
    const filePath = path.join(uploadDir, pdfFile)
    console.log('🔄 Testing processor with:', filePath)
    
    const result = await processDocumentWithFallback(filePath)
    
    console.log('✅ Processing result:')
    console.log('📄 Text length:', result.text.length)
    console.log('📊 Chunks count:', result.chunks.length)
    console.log('📖 Pages count:', result.metadata.totalPages)
    console.log('🔧 Processing method:', result.metadata.processingMethod)
    
    if (result.chunks.length > 0) {
      console.log('\n📋 Sample chunk:')
      console.log('Text:', result.chunks[0].text.substring(0, 200) + '...')
      console.log('Metadata:', result.chunks[0].metadata)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testProcessor()