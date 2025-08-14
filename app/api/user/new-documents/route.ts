import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { promises as fs } from 'fs'
import path from 'path'

// File-based storage for development - in production, use database
const STORAGE_FILE = path.join(process.cwd(), 'new-documents.json')

interface NewDocument {
  id: string
  title: string
  state: string
  type: string
  addedAt: Date
  documentId: string
}

async function loadNewDocuments(): Promise<Map<string, NewDocument[]>> {
  try {
    const data = await fs.readFile(STORAGE_FILE, 'utf-8')
    const parsed = JSON.parse(data)
    const documents = new Map<string, NewDocument[]>()
    
    for (const [userId, userDocuments] of Object.entries(parsed)) {
      documents.set(userId, (userDocuments as any[]).map(doc => ({
        ...doc,
        addedAt: new Date(doc.addedAt)
      })))
    }
    
    return documents
  } catch (error) {
    // File doesn't exist or is invalid, return empty map
    return new Map<string, NewDocument[]>()
  }
}

async function saveNewDocuments(documents: Map<string, NewDocument[]>): Promise<void> {
  try {
    const data = Object.fromEntries(documents.entries())
    await fs.writeFile(STORAGE_FILE, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Error saving new documents:', error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // For new documents, we show recently added documents (global, not per-user)
    const newDocuments = await loadNewDocuments()
    const globalNew = newDocuments.get('global') || []
    
    // Sort by most recent and limit to 10
    const recent = globalNew
      .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
      .slice(0, 10)
      .map(doc => ({
        ...doc,
        addedAt: doc.addedAt.toISOString()
      }))

    return NextResponse.json({ recent })
  } catch (error) {
    console.error('Error fetching new documents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { documentId, title, state, type, internal } = await request.json()
    
    // Skip authentication check for internal calls
    if (!internal) {
      const session = await getServerSession(authOptions)
      
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    if (!documentId || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const newDocuments = await loadNewDocuments()
    const globalNew = newDocuments.get('global') || []

    // Remove existing entry for this document (if it exists)
    const filtered = globalNew.filter(doc => doc.documentId !== documentId)

    // Add new entry at the beginning
    const newEntry = {
      id: Date.now().toString(),
      documentId,
      title,
      state: state || 'Unknown',
      type: type || 'Document',
      addedAt: new Date()
    }

    filtered.unshift(newEntry)

    // Keep only last 50 entries
    const updated = filtered.slice(0, 50)
    newDocuments.set('global', updated)
    await saveNewDocuments(newDocuments)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error tracking document addition:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}