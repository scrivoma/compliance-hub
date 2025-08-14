import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedVerticalsAndTypes() {
  try {
    console.log('Seeding verticals...')
    
    // Create verticals
    const verticals = [
      { name: 'sports-online', displayName: 'Sports (Online)', description: 'Online sports betting operations' },
      { name: 'sports-retail', displayName: 'Sports (Retail)', description: 'Retail/land-based sports betting' },
      { name: 'igaming', displayName: 'iGaming', description: 'Online casino and gaming' },
      { name: 'landbased', displayName: 'Landbased', description: 'Physical casino operations' },
      { name: 'lottery', displayName: 'Lottery', description: 'Traditional lottery operations' },
      { name: 'ilottery', displayName: 'iLottery', description: 'Online lottery services' },
      { name: 'fantasy-sports', displayName: 'Fantasy Sports', description: 'Daily and season-long fantasy sports' }
    ]
    
    for (const vertical of verticals) {
      await prisma.vertical.upsert({
        where: { name: vertical.name },
        update: {},
        create: vertical
      })
    }
    
    console.log(`✓ Created/updated ${verticals.length} verticals`)
    
    // Create document types
    const documentTypes = [
      { name: 'statute', displayName: 'Statute', description: 'Legislative acts and laws' },
      { name: 'regulation', displayName: 'Regulation', description: 'Administrative rules and regulations' },
      { name: 'formal-guidance', displayName: 'Formal Guidance', description: 'Official guidance documents' },
      { name: 'informal-guidance', displayName: 'Informal Guidance', description: 'Unofficial guidance and interpretations' },
      { name: 'technical-bulletin', displayName: 'Technical Bulletin', description: 'Technical specifications and bulletins' },
      { name: 'licensing-forms', displayName: 'Licensing Forms / Instructions', description: 'License application forms and instructions' },
      { name: 'aml', displayName: 'Anti-Money Laundering', description: 'AML compliance requirements' },
      { name: 'data', displayName: 'Data', description: 'Data protection and privacy requirements' },
      { name: 'other', displayName: 'Other', description: 'Other document types' }
    ]
    
    for (const docType of documentTypes) {
      await prisma.documentType.upsert({
        where: { name: docType.name },
        update: {},
        create: docType
      })
    }
    
    console.log(`✓ Created/updated ${documentTypes.length} document types`)
    
    // List all verticals and types
    const allVerticals = await prisma.vertical.findMany({ orderBy: { displayName: 'asc' } })
    const allTypes = await prisma.documentType.findMany({ orderBy: { displayName: 'asc' } })
    
    console.log('\nVerticals:')
    allVerticals.forEach(v => console.log(`- ${v.displayName} (${v.name})`))
    
    console.log('\nDocument Types:')
    allTypes.forEach(t => console.log(`- ${t.displayName} (${t.name})`))
    
  } catch (error) {
    console.error('Error seeding verticals and types:', error)
  } finally {
    await prisma.$disconnect()
  }
}

seedVerticalsAndTypes().catch(console.error)