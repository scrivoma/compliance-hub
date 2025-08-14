import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Database migration endpoint called')
    
    // This is a simple approach - in production you'd want more safety checks
    const migrationKey = process.env.MIGRATION_KEY || 'dev-only'
    const { key } = await request.json()
    
    if (key !== migrationKey) {
      return NextResponse.json(
        { error: 'Invalid migration key' },
        { status: 403 }
      )
    }
    
    console.log('⚙️ Running Prisma database push...')
    
    // Run prisma db push to sync schema
    try {
      const output = execSync('npx prisma db push --accept-data-loss', {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 30000 // 30 second timeout
      })
      
      console.log('✅ Database schema updated successfully')
      console.log('Output:', output)
      
      return NextResponse.json({
        success: true,
        message: 'Database schema updated successfully',
        output
      })
      
    } catch (execError) {
      console.error('❌ Migration failed:', execError)
      return NextResponse.json(
        { 
          error: 'Migration failed',
          details: execError instanceof Error ? execError.message : 'Unknown error'
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
  }
}