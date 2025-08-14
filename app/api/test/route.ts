import { NextResponse } from 'next/server'
import { pineconeService } from '@/lib/pinecone/pinecone-service'

export async function GET() {
  try {
    console.log('Testing Pinecone connection...')
    
    // Test environment variables
    console.log('PINECONE_API_KEY exists:', !!process.env.PINECONE_API_KEY)
    console.log('PINECONE_INDEX_NAME:', process.env.PINECONE_INDEX_NAME)
    console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY)
    
    // Test Pinecone search
    const testResults = await pineconeService.searchDocuments('test', {
      topK: 1,
      minSimilarity: 0.1
    })
    console.log('Pinecone search successful, results:', testResults.length)
    
    return NextResponse.json({
      success: true,
      message: 'Pinecone connection successful',
      config: {
        indexName: process.env.PINECONE_INDEX_NAME,
        hasPineconeKey: !!process.env.PINECONE_API_KEY,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        testResults: testResults.length
      }
    })
    
  } catch (error) {
    console.error('Test error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : undefined)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        config: {
          indexName: process.env.PINECONE_INDEX_NAME,
          hasPineconeKey: !!process.env.PINECONE_API_KEY,
          hasOpenAIKey: !!process.env.OPENAI_API_KEY
        }
      },
      { status: 500 }
    )
  }
}