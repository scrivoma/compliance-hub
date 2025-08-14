import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const documentTypes = await prisma.documentType.findMany({
      orderBy: {
        displayName: 'asc'
      }
    })
    
    return NextResponse.json({
      documentTypes
    })
    
  } catch (error) {
    console.error('Failed to get document types:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve document types' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, key } = await request.json()
    
    // Security check for seeding
    if (action === 'seed') {
      const expectedKey = process.env.MIGRATION_KEY || 'dev-only'
      if (key !== expectedKey) {
        return NextResponse.json(
          { error: 'Invalid seed key' },
          { status: 403 }
        )
      }
      
      console.log('🌱 Seeding document types...')
      
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

      for (const documentType of documentTypes) {
        await prisma.documentType.upsert({
          where: { name: documentType.name },
          update: documentType,
          create: documentType
        })
      }

      const count = await prisma.documentType.count()
      console.log(`✅ Seeded ${count} document types`)

      return NextResponse.json({
        success: true,
        message: `Seeded ${count} document types`,
        count
      })
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
    
  } catch (error) {
    console.error('Failed to process document types request:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}