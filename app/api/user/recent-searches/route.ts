import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { promises as fs } from 'fs'
import path from 'path'

// File-based storage for development - in production, use database
const STORAGE_FILE = path.join(process.cwd(), 'recent-searches.json')

interface RecentSearch {
  id: string
  query: string
  timestamp: Date
  resultsCount: number
  searchType: string
  states?: string
}

async function loadRecentSearches(): Promise<Map<string, RecentSearch[]>> {
  try {
    const data = await fs.readFile(STORAGE_FILE, 'utf-8')
    const parsed = JSON.parse(data)
    const searches = new Map<string, RecentSearch[]>()
    
    for (const [userId, userSearches] of Object.entries(parsed)) {
      searches.set(userId, (userSearches as any[]).map(search => ({
        ...search,
        timestamp: new Date(search.timestamp)
      })))
    }
    
    return searches
  } catch (error) {
    // File doesn't exist or is invalid, return empty map
    return new Map<string, RecentSearch[]>()
  }
}

async function saveRecentSearches(searches: Map<string, RecentSearch[]>): Promise<void> {
  try {
    const data = Object.fromEntries(searches.entries())
    await fs.writeFile(STORAGE_FILE, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Error saving recent searches:', error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const recentSearches = await loadRecentSearches()
    const userSearches = recentSearches.get(session.user.id) || []
    
    // Sort by most recent and limit to 10
    const recent = userSearches
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)
      .map(search => ({
        ...search,
        timestamp: search.timestamp.toISOString()
      }))

    return NextResponse.json({ recent })
  } catch (error) {
    console.error('Error fetching recent searches:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query, resultsCount, searchType, states } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const userId = session.user.id
    const recentSearches = await loadRecentSearches()
    const userSearches = recentSearches.get(userId) || []

    // Remove existing entry for this exact query
    const filtered = userSearches.filter(search => search.query !== query)

    // Add new entry at the beginning
    const newEntry = {
      id: Date.now().toString(),
      query,
      timestamp: new Date(),
      resultsCount: resultsCount || 0,
      searchType: searchType || 'ai',
      states: states || undefined
    }

    filtered.unshift(newEntry)

    // Keep only last 50 searches
    const updated = filtered.slice(0, 50)
    recentSearches.set(userId, updated)
    await saveRecentSearches(recentSearches)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error tracking search:', error)
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
    const searchId = searchParams.get('id')

    if (!searchId) {
      return NextResponse.json({ error: 'Search ID is required' }, { status: 400 })
    }

    const userId = session.user.id
    const recentSearches = await loadRecentSearches()
    const userSearches = recentSearches.get(userId) || []

    // Remove the specific search
    const filtered = userSearches.filter(search => search.id !== searchId)
    recentSearches.set(userId, filtered)
    await saveRecentSearches(recentSearches)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting search:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}