import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    console.log('🌱 Seeding dropdown reference data...')
    
    // Security check - only allow in development or with a key
    const { key } = await request.json()
    const expectedKey = process.env.MIGRATION_KEY || 'dev-only'
    
    if (key !== expectedKey) {
      return NextResponse.json(
        { error: 'Invalid seed key' },
        { status: 403 }
      )
    }
    
    // Seed Verticals
    const verticals = [
      { name: 'fantasy-sports', displayName: 'Fantasy Sports', description: 'Daily fantasy sports and fantasy contests' },
      { name: 'landbased', displayName: 'Landbased', description: 'Land-based gaming and casinos' },
      { name: 'lottery', displayName: 'Lottery', description: 'Traditional lottery games' },
      { name: 'sports-online', displayName: 'Sports (Online)', description: 'Online sports betting' },
      { name: 'sports-retail', displayName: 'Sports (Retail)', description: 'Retail sports betting' },
      { name: 'igaming', displayName: 'iGaming', description: 'Online casino and gaming' },
      { name: 'ilottery', displayName: 'iLottery', description: 'Online lottery games' }
    ]

    console.log('📊 Seeding verticals...')
    for (const vertical of verticals) {
      await prisma.vertical.upsert({
        where: { name: vertical.name },
        update: vertical,
        create: vertical
      })
    }

    // Seed Document Types
    const documentTypes = [
      { name: 'aml', displayName: 'Anti-Money Laundering', description: 'AML regulations and guidance' },
      { name: 'data', displayName: 'Data', description: 'Data protection and privacy regulations' },
      { name: 'formal-guidance', displayName: 'Formal Guidance', description: 'Official regulatory guidance documents' },
      { name: 'informal-guidance', displayName: 'Informal Guidance', description: 'Informal guidance and interpretations' },
      { name: 'licensing-forms', displayName: 'Licensing Forms / Instructions', description: 'Application forms and instructions' },
      { name: 'other', displayName: 'Other', description: 'Other regulatory documents' },
      { name: 'regulation', displayName: 'Regulation', description: 'Regulatory rules and regulations' },
      { name: 'statute', displayName: 'Statute', description: 'Laws and statutes' },
      { name: 'technical-bulletin', displayName: 'Technical Bulletin', description: 'Technical bulletins and notices' }
    ]

    console.log('📄 Seeding document types...')
    for (const documentType of documentTypes) {
      await prisma.documentType.upsert({
        where: { name: documentType.name },
        update: documentType,
        create: documentType
      })
    }

    // Get counts for response
    const verticalCount = await prisma.vertical.count()
    const documentTypeCount = await prisma.documentType.count()

    console.log(`✅ Seeded ${verticalCount} verticals and ${documentTypeCount} document types`)

    return NextResponse.json({
      success: true,
      message: 'Dropdown reference data seeded successfully',
      verticalCount,
      documentTypeCount
    })
    
  } catch (error) {
    console.error('❌ Error seeding dropdown data:', error)
    return NextResponse.json(
      { 
        error: 'Failed to seed dropdown data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}