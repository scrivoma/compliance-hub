import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createTestUser() {
  try {
    console.log('Creating test user account...')
    
    const userEmail = 'user@compliancehub.com'
    const userPassword = 'user123'
    const userName = 'Test User'
    const userOrganization = 'Test Organization'
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: userEmail }
    })
    
    if (existingUser) {
      console.log('Test user account already exists!')
      console.log('Email:', userEmail)
      console.log('If you need to reset the password, delete the user and run this script again.')
      return
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(userPassword, 10)
    
    // Create regular user
    const user = await prisma.user.create({
      data: {
        email: userEmail,
        password: hashedPassword,
        name: userName,
        organization: userOrganization,
        role: 'USER'
      }
    })
    
    console.log('✓ Test user account created successfully!')
    console.log('-----------------------------------')
    console.log('Email:', userEmail)
    console.log('Password:', userPassword)
    console.log('Name:', userName)
    console.log('Role: USER')
    console.log('-----------------------------------')
    console.log('Use this account to test regular user access restrictions.')
    
  } catch (error) {
    console.error('Error creating test user account:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestUser().catch(console.error)