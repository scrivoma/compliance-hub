import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const verticals = await prisma.vertical.findMany({
      orderBy: {
        displayName: 'asc'
      }
    })
    
    return NextResponse.json({
      verticals
    })
    
  } catch (error) {
    console.error('Failed to get verticals:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve verticals' },
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
      
      console.log('🌱 Seeding verticals...')
      
      const verticals = [
        { name: 'fantasy-sports', displayName: 'Fantasy Sports', description: 'Daily fantasy sports and fantasy contests' },
        { name: 'landbased', displayName: 'Landbased', description: 'Land-based gaming and casinos' },
        { name: 'lottery', displayName: 'Lottery', description: 'Traditional lottery games' },
        { name: 'sports-online', displayName: 'Sports (Online)', description: 'Online sports betting' },
        { name: 'sports-retail', displayName: 'Sports (Retail)', description: 'Retail sports betting' },
        { name: 'igaming', displayName: 'iGaming', description: 'Online casino and gaming' },
        { name: 'ilottery', displayName: 'iLottery', description: 'Online lottery games' }
      ]

      for (const vertical of verticals) {
        await prisma.vertical.upsert({
          where: { name: vertical.name },
          update: vertical,
          create: vertical
        })
      }

      const count = await prisma.vertical.count()
      console.log(`✅ Seeded ${count} verticals`)

      return NextResponse.json({
        success: true,
        message: `Seeded ${count} verticals`,
        count
      })
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
    
  } catch (error) {
    console.error('Failed to process verticals request:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}