import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { promises as fs } from 'fs'
import path from 'path'

// File-based storage for development - in production, use database
const STORAGE_FILE = path.join(process.cwd(), 'recent-documents.json')

interface RecentDocument {
  id: string
  title: string
  state: string
  type: string
  viewedAt: Date
  documentId: string
}

async function loadRecentDocuments(): Promise<Map<string, RecentDocument[]>> {
  try {
    const data = await fs.readFile(STORAGE_FILE, 'utf-8')
    const parsed = JSON.parse(data)
    const documents = new Map<string, RecentDocument[]>()
    
    for (const [userId, userDocuments] of Object.entries(parsed)) {
      documents.set(userId, (userDocuments as any[]).map(doc => ({
        ...doc,
        viewedAt: new Date(doc.viewedAt || doc.addedAt) // Handle legacy data
      })))
    }
    
    return documents
  } catch (error) {
    // File doesn't exist or is invalid, return empty map
    return new Map<string, RecentDocument[]>()
  }
}

async function saveRecentDocuments(documents: Map<string, RecentDocument[]>): Promise<void> {
  try {
    const data = Object.fromEntries(documents.entries())
    await fs.writeFile(STORAGE_FILE, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Error saving recent documents:', error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const recentDocuments = await loadRecentDocuments()
    const userRecent = recentDocuments.get(session.user.id) || []
    
    // Sort by most recent and limit to 10
    const recent = userRecent
      .sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime())
      .slice(0, 10)
      .map(doc => ({
        ...doc,
        viewedAt: doc.viewedAt.toISOString()
      }))

    return NextResponse.json({ recent })
  } catch (error) {
    console.error('Error fetching recent documents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId, title, state, type } = await request.json()

    if (!documentId || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const userId = session.user.id
    const recentDocuments = await loadRecentDocuments()
    const userRecent = recentDocuments.get(userId) || []

    // Remove existing entry for this document
    const filtered = userRecent.filter(doc => doc.documentId !== documentId)

    // Add new entry at the beginning
    const newEntry = {
      id: Date.now().toString(),
      documentId,
      title,
      state: state || 'Unknown',
      type: type || 'Document',
      viewedAt: new Date()
    }

    filtered.unshift(newEntry)

    // Keep only last 50 entries
    const updated = filtered.slice(0, 50)
    recentDocuments.set(userId, updated)
    await saveRecentDocuments(recentDocuments)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error tracking document view:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}