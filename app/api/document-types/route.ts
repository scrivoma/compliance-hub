import { NextResponse } from 'next/server'
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