'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, XCircle, PlayCircle, Settings } from 'lucide-react'

interface TestResult {
  success: boolean
  message?: string
  error?: string
  details?: string
  data?: any
  instructions?: string[]
}

export default function AgentSetPilotPage() {
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionResult, setConnectionResult] = useState<TestResult | null>(null)
  const [isCreatingNamespace, setIsCreatingNamespace] = useState(false)
  const [namespaceResult, setNamespaceResult] = useState<TestResult | null>(null)

  const testConnection = async () => {
    setIsTestingConnection(true)
    setConnectionResult(null)
    
    try {
      const response = await fetch('/api/agentset/test')
      const result = await response.json()
      setConnectionResult(result)
    } catch (error) {
      setConnectionResult({
        success: false,
        error: 'Network error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  const createTestNamespace = async () => {
    setIsCreatingNamespace(true)
    setNamespaceResult(null)
    
    try {
      const response = await fetch('/api/agentset/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `compliance-hub-pilot-${Date.now()}`,
          description: 'Pilot test namespace for evaluating citation accuracy vs ChromaDB'
        })
      })
      
      const result = await response.json()
      setNamespaceResult(result)
    } catch (error) {
      setNamespaceResult({
        success: false,
        error: 'Network error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsCreatingNamespace(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          AgentSet.ai Pilot Test
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Testing AgentSet.ai's RAG platform for better citation accuracy vs our current ChromaDB setup.
        </p>
      </div>

      {/* Connection Test */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            API Connection Test
          </CardTitle>
          <CardDescription>
            Verify AgentSet.ai API connectivity and configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={testConnection} 
            disabled={isTestingConnection}
            className="w-full sm:w-auto"
          >
            {isTestingConnection ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing Connection...
              </>
            ) : (
              <>
                <PlayCircle className="mr-2 h-4 w-4" />
                Test API Connection
              </>
            )}
          </Button>

          {connectionResult && (
            <Alert className={connectionResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <div className="flex items-center gap-2">
                {connectionResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription className="font-medium">
                  {connectionResult.success ? 'Success' : 'Failed'}
                </AlertDescription>
              </div>
              
              {connectionResult.message && (
                <div className="mt-2 text-sm">{connectionResult.message}</div>
              )}
              
              {connectionResult.error && (
                <div className="mt-2 text-sm text-red-600">{connectionResult.error}</div>
              )}
              
              {connectionResult.details && (
                <div className="mt-2 text-xs text-gray-600 font-mono bg-gray-100 p-2 rounded">
                  {connectionResult.details}
                </div>
              )}
              
              {connectionResult.data && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline">
                      {connectionResult.data.namespacesCount} namespaces found
                    </Badge>
                    <Badge variant="outline">
                      API Key: {connectionResult.data.apiKeyConfigured ? 'Configured' : 'Missing'}
                    </Badge>
                  </div>
                  
                  {connectionResult.data.namespaces?.length > 0 && (
                    <div className="mt-2">
                      <div className="text-sm font-medium mb-1">Existing Namespaces:</div>
                      <div className="space-y-1">
                        {connectionResult.data.namespaces.map((ns: any) => (
                          <div key={ns.id} className="text-xs bg-gray-100 p-2 rounded">
                            <div className="font-medium">{ns.name}</div>
                            <div className="text-gray-600">{ns.description}</div>
                            <div className="text-gray-500">Created: {new Date(ns.createdAt).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {connectionResult.instructions && (
                <div className="mt-3">
                  <div className="text-sm font-medium mb-1">Next Steps:</div>
                  <ul className="text-sm space-y-1">
                    {connectionResult.instructions.map((instruction, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-gray-400">•</span>
                        <span>{instruction}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Namespace Creation Test */}
      {connectionResult?.success && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5" />
              Create Test Namespace
            </CardTitle>
            <CardDescription>
              Create a pilot namespace for testing document ingestion and citation accuracy
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={createTestNamespace} 
              disabled={isCreatingNamespace}
              className="w-full sm:w-auto"
            >
              {isCreatingNamespace ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Namespace...
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Create Test Namespace
                </>
              )}
            </Button>

            {namespaceResult && (
              <Alert className={namespaceResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-center gap-2">
                  {namespaceResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription className="font-medium">
                    {namespaceResult.success ? 'Namespace Created' : 'Creation Failed'}
                  </AlertDescription>
                </div>
                
                {namespaceResult.message && (
                  <div className="mt-2 text-sm">{namespaceResult.message}</div>
                )}
                
                {namespaceResult.error && (
                  <div className="mt-2 text-sm text-red-600">{namespaceResult.error}</div>
                )}
                
                {namespaceResult.data?.namespace && (
                  <div className="mt-3 text-xs bg-gray-100 p-3 rounded">
                    <div><strong>Namespace ID:</strong> {namespaceResult.data.namespace.id}</div>
                    <div><strong>Name:</strong> {namespaceResult.data.namespace.name}</div>
                    <div><strong>Description:</strong> {namespaceResult.data.namespace.description}</div>
                    <div><strong>Created:</strong> {new Date(namespaceResult.data.namespace.createdAt).toLocaleString()}</div>
                  </div>
                )}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Next Steps */}
      {connectionResult?.success && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Ready for Testing
            </CardTitle>
            <CardDescription>
              AgentSet.ai is connected and ready for pilot testing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                AgentSet.ai API is working! We can use existing namespaces for testing.
              </p>
              
              {connectionResult.data?.namespaces && connectionResult.data.namespaces.length > 0 && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-sm font-medium text-green-900 mb-2">
                    Available Namespaces for Testing:
                  </div>
                  {connectionResult.data.namespaces.map((ns: any) => (
                    <div key={ns.id} className="text-xs bg-white p-2 rounded border mb-1">
                      <div className="font-medium text-green-800">{ns.name}</div>
                      <div className="text-gray-600">ID: {ns.id}</div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Next Steps:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Upload documents to test citation accuracy</li>
                  <li>Compare results with current ChromaDB system</li>
                  <li>Evaluate performance and integration complexity</li>
                  <li>Make migration decision based on results</li>
                </ol>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm font-medium text-blue-900 mb-2">
                  Run Pilot Test (using existing namespace):
                </div>
                <code className="text-xs bg-blue-100 px-2 py-1 rounded text-blue-800 font-mono block">
                  npx tsx scripts/agentset-pilot-test.ts
                </code>
                <div className="text-xs text-blue-700 mt-1">
                  The script will automatically use one of your existing namespaces for testing.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}