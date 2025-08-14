
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function checkDocument() {
  const doc = await prisma.document.findUnique({
    where: { id: 'cmd1qdnc8000i8ch95ac1xfh5' },
    select: { title: true, content: true }
  })
  
  if (doc) {
    console.log('Document Title:', doc.title)
    console.log('Content Length:', doc.content?.length || 0)
    console.log('Contains Moral turpitude:', doc.content?.includes('Moral turpitude') || false)
    console.log('Content preview:', doc.content?.substring(0, 200) || 'No content')
  }
  
  await prisma.$disconnect()
}

checkDocument()

