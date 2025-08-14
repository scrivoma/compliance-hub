import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Fetch documents with their relationships
    const documents = await prisma.document.findMany({
      include: {
        verticals: {
          include: {
            vertical: {
              select: {
                id: true,
                name: true,
                displayName: true
              }
            }
          }
        },
        documentTypes: {
          include: {
            documentType: {
              select: {
                id: true,
                name: true,
                displayName: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    return NextResponse.json({
      documents
    })
    
  } catch (error) {
    console.error('Failed to get documents:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve documents' },
      { status: 500 }
    )
  }
}