#!/usr/bin/env npx tsx

/**
 * AgentSet.ai Pilot Test Script
 * 
 * This script tests AgentSet.ai's citation accuracy against our current problematic cases
 * to evaluate if we should migrate from ChromaDB + LlamaParse to AgentSet.ai
 */

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { agentSetService } from '../lib/agentset/agentset-service'
import { PrismaClient } from '@prisma/client'
import fs from 'fs/promises'

const prisma = new PrismaClient()

interface TestCase {
  query: string
  description: string
  expectedCitationText?: string
  documentName: string
}

// Test cases based on our current problematic citations
const TEST_CASES: TestCase[] = [
  {
    query: "what are the fees",
    description: "License fee information (currently highlighting wrong text)",
    expectedCitationText: "entitled to receive any refund of the license fee submitted in connection with the license application",
    documentName: "SB 20Bulletin 201_1"
  },
  {
    query: "commission action",
    description: "Commission action procedures",
    expectedCitationText: "Commission action",
    documentName: "SB 20Bulletin 201_1"
  },
  {
    query: "sports betting activities",
    description: "Sports betting activities rules",
    expectedCitationText: "types of sports betting activities to be conducted by sports betting licensees",
    documentName: "Sports Betting Rules"
  },
  {
    query: "temporary license requirements",
    description: "Temporary license conversion requirements", 
    expectedCitationText: "Commission may change a temporary license into a permanent license",
    documentName: "License Requirements"
  }
]

async function getCurrentDocuments() {
  console.log('📋 Fetching current documents from database...')
  
  const documents = await prisma.document.findMany({
    where: {
      processingStatus: 'COMPLETED',
      content: {
        not: null
      }
    },
    select: {
      id: true,
      title: true,
      content: true,
      sourceType: true,
      filePath: true,
      fileSize: true,
    },
    take: 5 // Start with 5 documents for pilot
  })
  
  console.log(`✅ Found ${documents.length} completed documents`)
  return documents
}

async function setupAgentSetNamespace() {
  console.log('🔧 Setting up AgentSet pilot namespace...')
  
  try {
    // First, try to list existing namespaces
    const existingNamespaces = await agentSetService.listNamespaces()
    console.log(`📋 Found ${existingNamespaces.length} existing namespaces`)
    
    if (existingNamespaces.length > 0) {
      // Use the first available namespace for testing
      const namespace = existingNamespaces[0]
      console.log('✅ Using existing AgentSet namespace:', namespace.name, `(${namespace.id})`)
      return namespace
    }
    
    // If no namespaces exist, try to create one
    console.log('📝 No existing namespaces found, attempting to create new one...')
    const namespaceName = `compliance-hub-pilot-${Date.now()}`
    const namespace = await agentSetService.createNamespace(
      namespaceName,
      'Pilot test comparing citation accuracy with current ChromaDB setup'
    )
    
    console.log('✅ Created AgentSet namespace:', namespace.name)
    return namespace
  } catch (error) {
    console.error('❌ Failed to setup namespace:', error)
    throw error
  }
}

async function uploadDocumentsToAgentSet(namespaceId: string, documents: any[]) {
  console.log('📤 Uploading documents to AgentSet...')
  
  // Debug document structure
  console.log('📋 Document data:', {
    count: documents.length,
    firstDoc: documents[0] ? {
      id: documents[0].id,
      title: documents[0].title,
      hasContent: !!documents[0].content,
      contentLength: documents[0].content?.length || 0,
      sourceType: documents[0].sourceType,
      filePath: documents[0].filePath
    } : 'no documents'
  })
  
  const agentSetDocuments = documents.map(doc => ({
    name: doc.title || `Document ${doc.id}`,
    content: doc.content || '',
    type: determineDocumentType(doc.filePath || doc.sourceType || 'txt'),
    metadata: {
      originalId: doc.id,
      sourceType: doc.sourceType,
      fileSize: doc.fileSize,
    }
  }))
  
  console.log('📄 Prepared AgentSet documents:', agentSetDocuments.map(doc => ({
    name: doc.name,
    hasContent: !!doc.content,
    contentLength: doc.content.length,
    type: doc.type
  })))
  
  try {
    const ingestJob = await agentSetService.createIngestJob(namespaceId, agentSetDocuments)
    console.log('⏳ Waiting for document processing to complete...')
    
    const completedJob = await agentSetService.waitForIngestJob(namespaceId, ingestJob.id)
    console.log('✅ Documents processed successfully:', completedJob.documentsCount, 'documents')
    
    return completedJob
  } catch (error) {
    console.error('❌ Failed to upload documents:', error)
    throw error
  }
}

function determineDocumentType(filePath: string): 'pdf' | 'txt' | 'html' | 'md' {
  if (filePath.endsWith('.pdf')) return 'pdf'
  if (filePath.endsWith('.html')) return 'html'
  if (filePath.endsWith('.md')) return 'md'
  return 'txt' // Default fallback
}

async function runCitationAccuracyTests(namespaceId: string) {
  console.log('🧪 Running citation accuracy tests...')
  
  const results = await agentSetService.testCitationAccuracy(namespaceId, TEST_CASES)
  
  console.log('\n📊 CITATION ACCURACY TEST RESULTS')
  console.log('='.repeat(50))
  
  for (const result of results) {
    console.log(`\n📝 Test: ${result.description}`)
    console.log(`Query: "${result.query}"`)
    
    if ('error' in result) {
      console.log('❌ Error:', result.error)
      continue
    }
    
    console.log(`✅ Results found: ${result.totalResults}`)
    console.log(`📎 Citations: ${result.citationsFound}`)
    console.log(`⏱️ Processing time: ${result.processingTime}ms`)
    
    if (result.topResult) {
      console.log(`🎯 Top result score: ${result.topResult.score}`)
      console.log(`📄 Document: ${result.topResult.document.name}`)
      console.log(`📍 Content: ${result.topResult.chunk.content.substring(0, 200)}...`)
      
      if (result.topResult.chunk.startChar && result.topResult.chunk.endChar) {
        console.log(`📐 Position: chars ${result.topResult.chunk.startChar}-${result.topResult.chunk.endChar}`)
      }
    }
    
    if (result.citations && result.citations.length > 0) {
      console.log('📎 Citations found:')
      result.citations.forEach((citation, index) => {
        console.log(`  ${index + 1}. "${citation.text.substring(0, 100)}..." (confidence: ${citation.confidence})`)
      })
    }
  }
  
  return results
}

async function generateComparisonReport(agentSetResults: any[], documents: any[]) {
  console.log('\n📋 GENERATING COMPARISON REPORT')
  console.log('='.repeat(50))
  
  const report = {
    timestamp: new Date().toISOString(),
    testCases: TEST_CASES.length,
    documentsProcessed: documents.length,
    agentSetPerformance: {
      successfulQueries: agentSetResults.filter(r => !('error' in r)).length,
      failedQueries: agentSetResults.filter(r => 'error' in r).length,
      averageProcessingTime: agentSetResults
        .filter(r => !('error' in r))
        .reduce((sum, r) => sum + (r as any).processingTime, 0) / 
        agentSetResults.filter(r => !('error' in r)).length,
      totalCitationsFound: agentSetResults
        .filter(r => !('error' in r))
        .reduce((sum, r) => sum + (r as any).citationsFound, 0),
    },
    recommendations: [] as string[]
  }
  
  // Analyze results and generate recommendations
  if (report.agentSetPerformance.successfulQueries === TEST_CASES.length) {
    report.recommendations.push('✅ All test queries executed successfully')
  } else {
    report.recommendations.push(`❌ ${report.agentSetPerformance.failedQueries} queries failed`)
  }
  
  if (report.agentSetPerformance.totalCitationsFound > 0) {
    report.recommendations.push(`✅ Citations found: ${report.agentSetPerformance.totalCitationsFound} total`)
  } else {
    report.recommendations.push('❌ No citations returned by AgentSet.ai')
  }
  
  if (report.agentSetPerformance.averageProcessingTime < 2000) {
    report.recommendations.push('✅ Fast response times (< 2s average)')
  } else {
    report.recommendations.push('⚠️ Slower response times (> 2s average)')
  }
  
  // Save report to file
  const reportPath = path.join(process.cwd(), 'agentset-pilot-report.json')
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
  
  console.log('\n📊 PILOT TEST SUMMARY')
  console.log('='.repeat(30))
  console.log(`Test cases: ${report.testCases}`)
  console.log(`Documents processed: ${report.documentsProcessed}`)
  console.log(`Successful queries: ${report.agentSetPerformance.successfulQueries}`)
  console.log(`Average response time: ${Math.round(report.agentSetPerformance.averageProcessingTime)}ms`)
  console.log(`Total citations found: ${report.agentSetPerformance.totalCitationsFound}`)
  
  console.log('\n🔍 RECOMMENDATIONS:')
  report.recommendations.forEach(rec => console.log(`  ${rec}`))
  
  console.log(`\n💾 Detailed report saved to: ${reportPath}`)
  
  return report
}

async function cleanup(namespaceId?: string) {
  console.log('\n🧹 Cleaning up pilot test resources...')
  
  if (namespaceId) {
    try {
      await agentSetService.deleteNamespace(namespaceId)
      console.log('✅ Deleted AgentSet namespace')
    } catch (error) {
      console.error('⚠️ Failed to delete namespace:', error)
    }
  }
  
  await prisma.$disconnect()
  console.log('✅ Disconnected from database')
}

async function main() {
  console.log('🚀 Starting AgentSet.ai Pilot Test')
  console.log('='.repeat(40))
  
  let namespaceId: string | undefined
  
  try {
    // Step 1: Get current documents
    const documents = await getCurrentDocuments()
    
    if (documents.length === 0) {
      throw new Error('No completed documents found in database. Please upload some documents first.')
    }
    
    // Step 2: Setup AgentSet namespace
    const namespace = await setupAgentSetNamespace()
    namespaceId = namespace.id
    
    // Step 3: Upload documents to AgentSet (using correct API format)
    await uploadDocumentsToAgentSet(namespace.id, documents)
    
    // Step 4: Run citation accuracy tests
    const agentSetResults = await runCitationAccuracyTests(namespace.id)
    
    // Step 5: Generate comparison report
    const report = await generateComparisonReport(agentSetResults, documents)
    
    console.log('\n🎉 Pilot test completed successfully!')
    console.log('Review the results above to decide if AgentSet.ai should replace the current system.')
    
  } catch (error) {
    console.error('\n❌ Pilot test failed:', error)
    process.exit(1)
  } finally {
    await cleanup(namespaceId)
  }
}

// Run the pilot test
main().catch(console.error)