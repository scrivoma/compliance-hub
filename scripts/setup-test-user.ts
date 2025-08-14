import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create test user
  const hashedPassword = await bcrypt.hash('password123', 10)
  
  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      password: hashedPassword,
      name: 'Test User',
      organization: 'Test Org',
      role: 'USER'
    }
  })
  
  console.log('Test user created:', user.email)
  
  // Create some categories
  const categories = await prisma.category.createMany({
    data: [
      { name: 'Sports Betting Regulations', description: 'State regulations for sports betting operations' },
      { name: 'Online Gaming Rules', description: 'Rules and requirements for online gaming' },
      { name: 'Licensing Requirements', description: 'Licensing documentation and requirements' },
      { name: 'Tax Compliance', description: 'Tax regulations and compliance requirements' },
    ]
  })
  
  console.log('Categories created:', categories.count)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })