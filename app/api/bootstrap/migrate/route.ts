import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Database schema initialization endpoint called')
    
    // This is a bootstrap approach - create tables using raw SQL
    const migrationKey = process.env.MIGRATION_KEY || 'dev-only'
    const { key } = await request.json()
    
    if (key !== migrationKey) {
      return NextResponse.json(
        { error: 'Invalid migration key' },
        { status: 403 }
      )
    }
    
    console.log('⚙️ Creating database schema...')
    
    // Create tables using raw SQL - simplified version for bootstrap
    const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "email" TEXT NOT NULL UNIQUE,
        "password" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "organization" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'USER',
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS "Category" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL UNIQUE,
        "description" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS "Vertical" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL UNIQUE,
        "displayName" TEXT NOT NULL,
        "description" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS "DocumentType" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL UNIQUE,
        "displayName" TEXT NOT NULL,
        "description" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `
    
    try {
      // Execute the SQL to create basic tables
      await prisma.$executeRawUnsafe(createTablesSQL)
      
      console.log('✅ Basic database schema created successfully')
      
      // Test by counting users
      const userCount = await prisma.user.count()
      console.log(`📊 User count: ${userCount}`)
      
      return NextResponse.json({
        success: true,
        message: 'Database schema initialized successfully',
        userCount,
        status: 'ready'
      })
      
    } catch (sqlError) {
      console.error('❌ SQL execution failed:', sqlError)
      return NextResponse.json(
        { 
          error: 'Schema creation failed',
          details: sqlError instanceof Error ? sqlError.message : 'Unknown error'
        },
        { status: 500 }
      )
    }
    
  } catch (error) {
    console.error('❌ Migration endpoint error:', error)
    return NextResponse.json(
      { 
        error: 'Migration endpoint failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}