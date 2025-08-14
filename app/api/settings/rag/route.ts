import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { getCurrentSettings, saveSettings, RAGSettings } from '@/lib/rag-settings'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const settings = await getCurrentSettings()
    
    return NextResponse.json({
      settings
    })
    
  } catch (error) {
    console.error('Failed to get RAG settings:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { settings } = await request.json()
    
    // Validate settings
    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'Invalid settings data' },
        { status: 400 }
      )
    }

    // Validate required fields
    const validProviders = ['anthropic', 'openai', 'google']
    if (!validProviders.includes(settings.llmProvider)) {
      return NextResponse.json(
        { error: 'Invalid LLM provider' },
        { status: 400 }
      )
    }

    if (settings.sourceDocuments < 1 || settings.sourceDocuments > 20) {
      return NextResponse.json(
        { error: 'Source documents must be between 1 and 20' },
        { status: 400 }
      )
    }

    if (settings.temperature < 0 || settings.temperature > 2) {
      return NextResponse.json(
        { error: 'Temperature must be between 0 and 2' },
        { status: 400 }
      )
    }

    if (settings.maxTokens < 100 || settings.maxTokens > 8000) {
      return NextResponse.json(
        { error: 'Max tokens must be between 100 and 8000' },
        { status: 400 }
      )
    }
    
    await saveSettings(settings)
    
    return NextResponse.json({
      success: true,
      settings
    })
    
  } catch (error) {
    console.error('Failed to save RAG settings:', error)
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    )
  }
}

