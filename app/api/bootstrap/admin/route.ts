import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    console.log('🔐 Bootstrap admin endpoint called')
    
    // Check if any users exist in the database
    const userCount = await prisma.user.count()
    
    if (userCount > 0) {
      return NextResponse.json(
        { error: 'Bootstrap denied - Users already exist in the database' },
        { status: 400 }
      )
    }
    
    console.log('✅ No users found - proceeding with admin creation')
    
    const { email, password, name = 'System Administrator' } = await request.json()
    
    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }
    
    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }
    
    console.log('🔒 Hashing password...')
    const hashedPassword = await bcrypt.hash(password, 10)
    
    console.log('👤 Creating admin user...')
    const admin = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: 'ADMIN',
        organization: 'Compliance Hub'
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organization: true,
        createdAt: true
      }
    })
    
    console.log('✅ Admin user created successfully:', admin.email)
    
    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully',
      user: admin
    }, { status: 201 })
    
  } catch (error) {
    console.error('❌ Bootstrap admin creation failed:', error)
    return NextResponse.json(
      { error: 'Failed to create admin user' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}