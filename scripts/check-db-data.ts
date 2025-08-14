import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkData() {
  try {
    const verticals = await prisma.vertical.findMany()
    const documentTypes = await prisma.documentType.findMany()
    
    console.log('Verticals count:', verticals.length)
    console.log('Verticals:', verticals.map(v => v.displayName))
    
    console.log('\nDocument Types count:', documentTypes.length)
    console.log('Document Types:', documentTypes.map(d => d.displayName))
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkData()