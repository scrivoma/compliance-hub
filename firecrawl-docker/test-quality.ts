#!/usr/bin/env tsx

// Test script to verify Firecrawl PDF parsing quality

async function testFirecrawlQuality() {
  const testUrl = 'https://sbg.colorado.gov/sites/sbg/files/documents/SB%20Bulletin%201_1.pdf'
  const firecrawlUrl = process.env.FIRECRAWL_URL || 'http://localhost:3002'
  
  console.log('🧪 Testing Firecrawl PDF quality')
  console.log('📍 Firecrawl URL:', firecrawlUrl)
  console.log('📄 Test PDF:', testUrl)
  console.log('')
  
  try {
    const response = await fetch(`${firecrawlUrl}/v1/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: testUrl,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    })
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }
    
    const result = await response.json()
    
    if (!result.success || !result.data?.markdown) {
      throw new Error('No markdown content received')
    }
    
    const markdown = result.data.markdown
    
    // Quality checks
    console.log('📊 Quality Analysis:')
    console.log('✓ Total length:', markdown.length, 'characters')
    
    // Check for proper markdown headers
    const headerCount = (markdown.match(/^#{1,3}\s+/gm) || []).length
    console.log(headerCount > 0 ? '✅' : '❌', 'Markdown headers (#):', headerCount)
    
    // Check for NaN artifacts
    const hasNaN = markdown.includes('NaN')
    console.log(hasNaN ? '❌' : '✅', 'NaN artifacts:', hasNaN ? 'FOUND' : 'none')
    
    // Check for markdown lists
    const listCount = (markdown.match(/^[-*]\s+/gm) || []).length
    console.log(listCount > 0 ? '✅' : '❌', 'Markdown lists (-):', listCount)
    
    // Check for tables
    const tableCount = (markdown.match(/\|.*\|/g) || []).length
    console.log(tableCount > 0 ? '✅' : '❌', 'Table rows (|):', tableCount)
    
    // Check for bullet characters (should not be present)
    const bulletCount = (markdown.match(/●/g) || []).length
    console.log(bulletCount === 0 ? '✅' : '❌', 'Bullet chars (●):', bulletCount, bulletCount > 0 ? '(should be -)' : '')
    
    // Show sample output
    console.log('\n📝 First 500 characters:')
    console.log('=' .repeat(60))
    console.log(markdown.substring(0, 500))
    console.log('=' .repeat(60))
    
    // Quality score
    let score = 0
    if (headerCount > 0) score += 25
    if (!hasNaN) score += 25
    if (listCount > 0) score += 25
    if (bulletCount === 0) score += 25
    
    console.log('\n🎯 Quality Score:', score + '%')
    
    if (score >= 75) {
      console.log('✅ High quality PDF parsing detected!')
    } else {
      console.log('⚠️  Low quality PDF parsing - check LLAMAPARSE_API_KEY')
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test
testFirecrawlQuality().catch(console.error)