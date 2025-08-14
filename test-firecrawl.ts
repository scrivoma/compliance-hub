#!/usr/bin/env tsx

import { firecrawlClient } from './lib/firecrawl/client'

async function testFirecrawl() {
  const url = 'https://sbg.colorado.gov/sites/sbg/files/documents/SB%20Bulletin%201_1.pdf'
  
  console.log('🔥 Testing Firecrawl with URL:', url)
  console.log('📊 Configuration:')
  console.log('- formats: ["markdown"]')
  console.log('- onlyMainContent: true')
  console.log('- parsePdf: true')
  console.log('- maxAge: 14400000 (4 hours)')
  console.log('- excludeTags: nav, footer, aside, script, style, iframe, noscript')
  console.log('')
  
  try {
    // Try different parameter combinations
    console.log('🧪 Testing different configurations...\n')
    
    // Test 1: Very basic
    console.log('Test 1: Basic configuration')
    const result1 = await firecrawlClient.scrape({
      url,
      formats: ['markdown'],
    })
    
    if (result1.success) {
      console.log('✅ Basic config - Length:', result1.data?.markdown?.length || 0)
    } else {
      console.log('❌ Basic config failed:', result1.error)
    }
    
    // Test 2: With onlyMainContent false
    console.log('\nTest 2: onlyMainContent: false')
    const result2 = await firecrawlClient.scrape({
      url,
      formats: ['markdown'],
      onlyMainContent: false,
    })
    
    if (result2.success) {
      console.log('✅ Full content - Length:', result2.data?.markdown?.length || 0)
    } else {
      console.log('❌ Full content failed:', result2.error)
    }
    
    // Test 3: Try HTML format and see if it's better
    console.log('\nTest 3: HTML format')
    const result3 = await firecrawlClient.scrape({
      url,
      formats: ['html'],
      onlyMainContent: true,
    })
    
    if (result3.success) {
      console.log('✅ HTML format - Length:', result3.data?.html?.length || 0)
      console.log('HTML preview:', result3.data?.html?.substring(0, 500) + '...')
    } else {
      console.log('❌ HTML format failed:', result3.error)
    }
    
    // Use the best result for final output
    const result = result1.success ? result1 : (result2.success ? result2 : result3)
    
    if (result.success && result.data?.markdown) {
      console.log('✅ Scrape successful!')
      console.log('📄 Markdown length:', result.data.markdown.length)
      console.log('📋 Metadata:', JSON.stringify(result.data.metadata, null, 2))
      console.log('')
      console.log('📝 Markdown content:')
      console.log('=' * 80)
      console.log(result.data.markdown)
      console.log('=' * 80)
    } else {
      console.error('❌ Scrape failed:', result.error)
    }
  } catch (error) {
    console.error('💥 Error:', error)
  }
}

testFirecrawl().catch(console.error)