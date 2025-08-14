import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: {
        name: 'asc'
      }
    })
    
    return NextResponse.json({
      categories
    })
  } catch (error) {
    console.error('Failed to get categories:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve categories' },
      { status: 500 }
    )
  }
}