
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function findMoralTurpitude() {
  const doc = await prisma.document.findUnique({
    where: { id: 'cmd1qdnc8000i8ch95ac1xfh5' },
    select: { content: true }
  })
  
  if (doc && doc.content) {
    const content = doc.content
    const searchTerm = 'moral turpitude'
    const index = content.toLowerCase().indexOf(searchTerm)
    
    if (index \!== -1) {
      console.log('Found at index:', index)
      const start = Math.max(0, index - 100)
      const end = Math.min(content.length, index + 200)
      console.log('Context:')
      console.log(content.substring(start, end))
    } else {
      console.log('Not found')
    }
  }
  
  await prisma.$disconnect()
}

findMoralTurpitude()

