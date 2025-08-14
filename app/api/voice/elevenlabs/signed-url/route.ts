import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    const agentId = process.env.ELEVENLABS_AGENT_ID
    
    if (!apiKey) {
      console.error('ELEVENLABS_API_KEY not found in environment variables')
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      )
    }
    
    if (!agentId) {
      console.error('ELEVENLABS_AGENT_ID not found in environment variables')
      return NextResponse.json(
        { error: 'ElevenLabs agent ID not configured' },
        { status: 500 }
      )
    }

    console.log('🔑 Generating ElevenLabs signed URL for user:', session.user.id)
    
    // Request signed URL from ElevenLabs API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ ElevenLabs signed URL failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      })
      
      return NextResponse.json(
        { 
          error: 'Failed to get signed URL',
          details: errorText,
          status: response.status 
        },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    console.log('✅ ElevenLabs signed URL generated successfully')
    
    return NextResponse.json({
      signed_url: data.signed_url,
      expires_at: data.expires_at,
      agent_id: agentId
    })
    
  } catch (error) {
    console.error('❌ ElevenLabs signed URL error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Optional: Add a GET endpoint for testing
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
  
  return NextResponse.json({
    message: 'ElevenLabs signed URL API is running',
    endpoint: '/api/voice/elevenlabs/signed-url',
    methods: ['POST'],
    description: 'Generate signed URLs for private ElevenLabs agents'
  })
}