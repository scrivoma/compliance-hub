import { NextResponse } from 'next/server'
import { vectorDB } from '@/lib/vector-db/chroma'

export async function GET() {
  try {
    console.log('Testing ChromaDB connection...')
    
    // Test environment variables
    console.log('CHROMA_HOST:', process.env.CHROMA_HOST)
    console.log('CHROMA_PORT:', process.env.CHROMA_PORT)
    console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY)
    
    // Test ChromaDB initialization
    await vectorDB.initialize()
    console.log('ChromaDB initialized successfully')
    
    return NextResponse.json({
      success: true,
      message: 'ChromaDB connection successful',
      config: {
        host: process.env.CHROMA_HOST,
        port: process.env.CHROMA_PORT,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY
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
          host: process.env.CHROMA_HOST,
          port: process.env.CHROMA_PORT,
          hasOpenAIKey: !!process.env.OPENAI_API_KEY
        }
      },
      { status: 500 }
    )
  }
}