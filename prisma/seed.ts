import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')
  
  try {
    // Seed Verticals
    console.log('📊 Seeding verticals...')
    const verticals = [
      { name: 'fantasy-sports', displayName: 'Fantasy Sports', description: 'Daily and season-long fantasy sports' },
      { name: 'igaming', displayName: 'iGaming', description: 'Online casino and gaming' },
      { name: 'ilottery', displayName: 'iLottery', description: 'Online lottery services' },
      { name: 'landbased', displayName: 'Landbased', description: 'Physical casino operations' },
      { name: 'lottery', displayName: 'Lottery', description: 'Traditional lottery operations' },
      { name: 'sports-online', displayName: 'Sports (Online)', description: 'Online sports betting operations' },
      { name: 'sports-retail', displayName: 'Sports (Retail)', description: 'Retail/land-based sports betting' }
    ]
    
    for (const vertical of verticals) {
      await prisma.vertical.upsert({
        where: { name: vertical.name },
        update: {
          displayName: vertical.displayName,
          description: vertical.description
        },
        create: vertical
      })
    }
    
    console.log(`✅ Seeded ${verticals.length} verticals`)
    
    // Seed Document Types
    console.log('📄 Seeding document types...')
    const documentTypes = [
      { name: 'aml', displayName: 'Anti-Money Laundering', description: 'AML compliance requirements' },
      { name: 'data', displayName: 'Data', description: 'Data protection and privacy requirements' },
      { name: 'formal-guidance', displayName: 'Formal Guidance', description: 'Official guidance documents' },
      { name: 'informal-guidance', displayName: 'Informal Guidance', description: 'Unofficial guidance and interpretations' },
      { name: 'licensing-forms', displayName: 'Licensing Forms / Instructions', description: 'License application forms and instructions' },
      { name: 'other', displayName: 'Other', description: 'Other document types' },
      { name: 'regulation', displayName: 'Regulation', description: 'Administrative rules and regulations' },
      { name: 'statute', displayName: 'Statute', description: 'Legislative acts and laws' },
      { name: 'technical-bulletin', displayName: 'Technical Bulletin', description: 'Technical specifications and bulletins' }
    ]
    
    for (const docType of documentTypes) {
      await prisma.documentType.upsert({
        where: { name: docType.name },
        update: {
          displayName: docType.displayName,
          description: docType.description
        },
        create: docType
      })
    }
    
    console.log(`✅ Seeded ${documentTypes.length} document types`)
    
    // Verify seeding results
    const verticalCount = await prisma.vertical.count()
    const documentTypeCount = await prisma.documentType.count()
    
    console.log(`📊 Database seeding completed:`)
    console.log(`   - ${verticalCount} verticals in database`)
    console.log(`   - ${documentTypeCount} document types in database`)
    
  } catch (error) {
    console.error('❌ Error during seeding:', error)
    throw error
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })