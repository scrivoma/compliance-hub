#!/usr/bin/env npx tsx

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const testUsers = [
  {
    email: 'alice@compliance.com',
    name: 'Alice Johnson',
    organization: 'Legal Team',
    role: 'USER' as const,
    password: 'password123'
  },
  {
    email: 'bob@compliance.com', 
    name: 'Bob Smith',
    organization: 'Regulatory Affairs',
    role: 'USER' as const,
    password: 'password123'
  },
  {
    email: 'charlie@compliance.com',
    name: 'Charlie Brown',
    organization: 'Compliance Team',
    role: 'USER' as const,
    password: 'password123'
  },
  {
    email: 'diana@compliance.com',
    name: 'Diana Wilson',
    organization: 'Risk Management',
    role: 'ADMIN' as const,
    password: 'password123'
  }
]

async function createTestUsers() {
  try {
    console.log('Creating test users...')
    
    for (const userData of testUsers) {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      })
      
      if (existingUser) {
        console.log(`User ${userData.email} already exists, skipping...`)
        continue
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 12)
      
      // Create user
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          organization: userData.organization,
          role: userData.role,
          password: hashedPassword
        }
      })
      
      console.log(`✅ Created user: ${user.name} (${user.email}) - ${user.role}`)
    }
    
    console.log('\n🎉 Test users created successfully!')
    console.log('\nYou can now log in with any of these accounts:')
    console.log('Password for all accounts: password123')
    console.log('')
    
    testUsers.forEach(user => {
      console.log(`- ${user.name}: ${user.email} (${user.role})`)
    })
    
  } catch (error) {
    console.error('Error creating test users:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestUsers().catch(console.error)