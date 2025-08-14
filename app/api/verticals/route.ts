import { NextResponse } from 'next/server'
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