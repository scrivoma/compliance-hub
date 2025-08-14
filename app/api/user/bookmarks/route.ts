import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { promises as fs } from 'fs'
import path from 'path'

// File-based storage for development - in production, use database
const STORAGE_FILE = path.join(process.cwd(), 'bookmarks.json')

interface Bookmark {
  id: string
  documentId: string
  title: string
  state: string
  type: string
  bookmarkedAt: Date
}

async function loadBookmarks(): Promise<Map<string, Bookmark[]>> {
  try {
    const data = await fs.readFile(STORAGE_FILE, 'utf-8')
    const parsed = JSON.parse(data)
    const bookmarks = new Map<string, Bookmark[]>()
    
    for (const [userId, userBookmarks] of Object.entries(parsed)) {
      bookmarks.set(userId, (userBookmarks as any[]).map(bookmark => ({
        ...bookmark,
        bookmarkedAt: new Date(bookmark.bookmarkedAt)
      })))
    }
    
    return bookmarks
  } catch (error) {
    // File doesn't exist or is invalid, return empty map
    return new Map<string, Bookmark[]>()
  }
}

async function saveBookmarks(bookmarks: Map<string, Bookmark[]>): Promise<void> {
  try {
    const data = Object.fromEntries(bookmarks.entries())
    await fs.writeFile(STORAGE_FILE, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Error saving bookmarks:', error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bookmarks = await loadBookmarks()
    const userBookmarks = bookmarks.get(session.user.id) || []
    
    // Sort by most recent and return all
    const recent = userBookmarks
      .sort((a, b) => new Date(b.bookmarkedAt).getTime() - new Date(a.bookmarkedAt).getTime())
      .map(bookmark => ({
        ...bookmark,
        bookmarkedAt: bookmark.bookmarkedAt.toISOString()
      }))

    return NextResponse.json({ bookmarks: recent })
  } catch (error) {
    console.error('Error fetching bookmarks:', error)
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
    const bookmarks = await loadBookmarks()
    const userBookmarks = bookmarks.get(userId) || []

    // Check if already bookmarked
    const existingBookmark = userBookmarks.find(bookmark => bookmark.documentId === documentId)
    
    if (existingBookmark) {
      return NextResponse.json({ error: 'Document already bookmarked' }, { status: 400 })
    }

    // Add new bookmark
    const newBookmark = {
      id: Date.now().toString(),
      documentId,
      title,
      state: state || 'Unknown',
      type: type || 'Document',
      bookmarkedAt: new Date()
    }

    userBookmarks.unshift(newBookmark)
    bookmarks.set(userId, userBookmarks)
    await saveBookmarks(bookmarks)

    return NextResponse.json({ success: true, bookmark: newBookmark })
  } catch (error) {
    console.error('Error adding bookmark:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
    }

    const userId = session.user.id
    const bookmarks = await loadBookmarks()
    const userBookmarks = bookmarks.get(userId) || []

    // Remove the bookmark
    const filtered = userBookmarks.filter(bookmark => bookmark.documentId !== documentId)
    bookmarks.set(userId, filtered)
    await saveBookmarks(bookmarks)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing bookmark:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Check if a document is bookmarked
export async function HEAD(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return new NextResponse(null, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      return new NextResponse(null, { status: 400 })
    }

    const userId = session.user.id
    const bookmarks = await loadBookmarks()
    const userBookmarks = bookmarks.get(userId) || []

    const isBookmarked = userBookmarks.some(bookmark => bookmark.documentId === documentId)
    
    return new NextResponse(null, { 
      status: isBookmarked ? 200 : 404,
      headers: {
        'X-Is-Bookmarked': isBookmarked.toString()
      }
    })
  } catch (error) {
    console.error('Error checking bookmark:', error)
    return new NextResponse(null, { status: 500 })
  }
}