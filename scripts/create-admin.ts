import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createAdmin() {
  try {
    console.log('Creating admin account...')
    
    const adminEmail = 'admin@compliancehub.com'
    const adminPassword = 'admin123'
    const adminName = 'System Administrator'
    const adminOrganization = 'Compliance Hub'
    
    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    })
    
    if (existingAdmin) {
      console.log('Admin account already exists!')
      console.log('Email:', adminEmail)
      console.log('If you need to reset the password, delete the user and run this script again.')
      return
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10)
    
    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: adminName,
        organization: adminOrganization,
        role: 'ADMIN'
      }
    })
    
    console.log('✓ Admin account created successfully!')
    console.log('-----------------------------------')
    console.log('Email:', adminEmail)
    console.log('Password:', adminPassword)
    console.log('Name:', adminName)
    console.log('Role: ADMIN')
    console.log('-----------------------------------')
    console.log('⚠️  IMPORTANT: Change this password after first login!')
    console.log('⚠️  Store these credentials securely!')
    
  } catch (error) {
    console.error('Error creating admin account:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin().catch(console.error)