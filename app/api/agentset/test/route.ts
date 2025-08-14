import { NextRequest, NextResponse } from 'next/server'
import { agentSetService } from '@/lib/agentset/agentset-service'

/**
 * Test endpoint for AgentSet.ai API connectivity
 * GET /api/agentset/test - Test basic connectivity and list namespaces
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing AgentSet.ai API connectivity...')
    
    // Test 1: Check if API key is configured
    if (!process.env.AGENTSET_API_KEY || process.env.AGENTSET_API_KEY === 'your-agentset-api-key-here') {
      return NextResponse.json({
        success: false,
        error: 'AGENTSET_API_KEY not configured',
        instructions: [
          '1. Sign up at AgentSet.ai to get an API key',
          '2. Update .env.local with your API key',
          '3. Restart the development server',
        ]
      }, { status: 400 })
    }
    
    // Test 2: Try to list namespaces (basic API connectivity test)
    try {
      console.log('Testing AgentSet.ai API with key:', process.env.AGENTSET_API_KEY?.substring(0, 10) + '...')
      
      const namespaces = await agentSetService.listNamespaces()
      
      console.log('AgentSet.ai API response successful:', {
        namespacesCount: namespaces.length,
        namespacesType: Array.isArray(namespaces) ? 'array' : typeof namespaces
      })
      
      return NextResponse.json({
        success: true,
        message: 'AgentSet.ai API connectivity test successful',
        data: {
          namespacesCount: namespaces.length,
          namespaces: namespaces.map(ns => ({
            id: ns.id,
            name: ns.name,
            description: ns.description,
            createdAt: ns.createdAt
          })),
          apiKeyConfigured: true,
          baseUrl: process.env.AGENTSET_BASE_URL || 'https://api.agentset.ai'
        }
      })
      
    } catch (apiError) {
      console.error('AgentSet.ai API call failed:', apiError)
      
      // Provide more detailed error information
      let errorDetails = 'Unknown API error'
      let statusCode = 500
      
      if (apiError instanceof Error) {
        errorDetails = apiError.message
        
        // Check for specific error types
        if (apiError.message.includes('401')) {
          statusCode = 401
          errorDetails = 'Authentication failed - check your API key'
        } else if (apiError.message.includes('403')) {
          statusCode = 403
          errorDetails = 'Access forbidden - check your account permissions'
        } else if (apiError.message.includes('404')) {
          statusCode = 404
          errorDetails = 'API endpoint not found - check the base URL'
        } else if (apiError.message.includes('429')) {
          statusCode = 429
          errorDetails = 'Rate limit exceeded - try again later'
        }
      }
      
      return NextResponse.json({
        success: false,
        error: 'AgentSet.ai API call failed',
        details: errorDetails,
        apiKey: process.env.AGENTSET_API_KEY ? 'Configured' : 'Missing',
        baseUrl: process.env.AGENTSET_BASE_URL || 'https://api.agentset.ai',
        instructions: [
          '1. Verify your API key is correct',
          '2. Check if your account has access to the API',
          '3. Ensure you have an active subscription if required',
          '4. Try visiting the AgentSet.ai dashboard to verify your account status',
        ]
      }, { status: statusCode })
    }
    
  } catch (error) {
    console.error('❌ AgentSet.ai test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Create a pilot namespace for testing
 * POST /api/agentset/test - Create test namespace
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description } = body
    
    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'Namespace name is required'
      }, { status: 400 })
    }
    
    console.log('🔧 Creating AgentSet.ai test namespace:', name)
    
    const namespace = await agentSetService.createNamespace(
      name,
      description || `Test namespace created at ${new Date().toISOString()}`
    )
    
    return NextResponse.json({
      success: true,
      message: 'Test namespace created successfully',
      data: {
        namespace: {
          id: namespace.id,
          name: namespace.name,
          description: namespace.description,
          createdAt: namespace.createdAt
        }
      }
    })
    
  } catch (error) {
    console.error('❌ Failed to create test namespace:', error)
    
    // Provide more detailed error information
    let errorDetails = 'Unknown error'
    let statusCode = 500
    
    if (error instanceof Error) {
      errorDetails = error.message
      
      // Check for specific error types
      if (error.message.includes('401')) {
        statusCode = 401
        errorDetails = 'Authentication failed during namespace creation'
      } else if (error.message.includes('403')) {
        statusCode = 403
        errorDetails = 'Permission denied - account may not have namespace creation rights'
      } else if (error.message.includes('409')) {
        statusCode = 409
        errorDetails = 'Namespace name already exists - try a different name'
      } else if (error.message.includes('422')) {
        statusCode = 422
        errorDetails = 'Invalid namespace data - check name format'
      }
    }
    
    return NextResponse.json({
      success: false,
      error: 'Failed to create namespace',
      details: errorDetails,
      suggestion: statusCode === 409 ? 'Try using an existing namespace instead' : 'Check your account permissions and try again'
    }, { status: statusCode })
  }
}