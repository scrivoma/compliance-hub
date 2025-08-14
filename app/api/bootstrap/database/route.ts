import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    console.log('🗄️ Database bootstrap endpoint called')
    
    // Test database connection
    console.log('📡 Testing database connection...')
    await prisma.$connect()
    console.log('✅ Database connection successful')
    
    // Check if database is already initialized by looking for users table
    try {
      const userCount = await prisma.user.count()
      console.log(`📊 Found ${userCount} users in database`)
      
      return NextResponse.json({
        success: true,
        message: 'Database is already initialized',
        userCount,
        status: 'ready'
      })
    } catch (error) {
      console.log('⚠️ Database tables not found, this is expected for new database')
      console.log('Error details:', error instanceof Error ? error.message : error)
      
      return NextResponse.json({
        success: true,
        message: 'Database connection successful but schema not initialized',
        note: 'Run Prisma migrations to create tables',
        status: 'needs_migration'
      })
    }
    
  } catch (error) {
    console.error('❌ Database bootstrap failed:', error)
    return NextResponse.json(
      { 
        error: 'Database connection failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}