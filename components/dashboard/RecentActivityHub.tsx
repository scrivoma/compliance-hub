'use client'

import Link from 'next/link'
import { Clock, FileText, Search, Star, RotateCcw, MapPin } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'

interface RecentDocument {
  id: string
  documentId: string
  title: string
  state: string
  type: string
  viewedAt: string // Keep for compatibility, but represents "addedAt" now
}

interface RecentSearch {
  id: string
  query: string
  timestamp: string
  resultsCount: number
  searchType: string
  states?: string
}

interface Bookmark {
  id: string
  documentId: string
  title: string
  state: string
  type: string
  bookmarkedAt: string
}

// State mapping for display
const STATE_NAMES: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
}

export function RecentActivityHub() {
  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([])
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRecentActivity = async () => {
      try {
        const [docsResponse, searchesResponse, bookmarksResponse] = await Promise.all([
          fetch('/api/user/recent-documents'),
          fetch('/api/user/recent-searches'),
          fetch('/api/user/bookmarks')
        ])

        if (docsResponse.ok) {
          const docsData = await docsResponse.json()
          setRecentDocuments(docsData.recent.slice(0, 3))
        }

        if (searchesResponse.ok) {
          const searchesData = await searchesResponse.json()
          setRecentSearches(searchesData.recent.slice(0, 3))
        }

        if (bookmarksResponse.ok) {
          const bookmarksData = await bookmarksResponse.json()
          setBookmarks(bookmarksData.bookmarks.slice(0, 3))
        }
      } catch (error) {
        console.error('Error fetching recent activity:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRecentActivity()
  }, [])

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes ago`
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)} hours ago`
    } else {
      return `${Math.floor(diffInMinutes / 1440)} days ago`
    }
  }

  const formatSearchStates = (statesString?: string) => {
    if (!statesString) return null
    
    try {
      const states = JSON.parse(statesString)
      if (Array.isArray(states)) {
        if (states.includes('ALL')) {
          return 'All States'
        } else if (states.length === 1) {
          return STATE_NAMES[states[0]] || states[0]
        } else if (states.length <= 3) {
          return states.map(state => STATE_NAMES[state] || state).join(', ')
        } else {
          return `${states.length} states`
        }
      }
    } catch (e) {
      // If parsing fails, return original string
      return statesString
    }
    
    return null
  }

  const handleSearchRerun = async (search: RecentSearch) => {
    const searchParams = new URLSearchParams()
    searchParams.set('q', search.query)
    
    if (search.states) {
      searchParams.set('states', search.states)
    }
    
    window.location.href = `/search?${searchParams.toString()}`
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex space-x-1">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className="shadow-lg border-0">
      <CardHeader>
        <CardTitle className="text-xl">Recent Activity</CardTitle>
        <p className="text-muted-foreground">Your recent documents, searches, and bookmarks</p>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="documents" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="documents" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Documents</span>
              {recentDocuments.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {recentDocuments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="searches" className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <span>Searches</span>
              {recentSearches.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {recentSearches.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="bookmarks" className="flex items-center space-x-2">
              <Star className="h-4 w-4" />
              <span>Bookmarks</span>
              {bookmarks.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {bookmarks.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Recent Documents</h3>
              <Button asChild variant="outline" size="sm">
                <Link href="/documents">View all</Link>
              </Button>
            </div>
            <div className="space-y-3">
              {recentDocuments.length > 0 ? (
                recentDocuments.map((doc) => (
                  <Card key={doc.id} className="transition-all duration-200 hover:shadow-md hover:scale-105">
                    <CardContent className="p-4">
                      <Link
                        href={`/documents?view=${doc.documentId}`}
                        className="flex items-start space-x-4 group"
                      >
                        <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 transition-colors">
                          <FileText className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors line-clamp-2">
                            {doc.title}
                          </p>
                          <div className="flex items-center mt-2 space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {doc.state}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {doc.type}
                            </Badge>
                          </div>
                          <div className="flex items-center mt-2">
                            <Clock className="h-3 w-3 text-muted-foreground mr-1" />
                            <span className="text-xs text-muted-foreground">{formatTimeAgo(doc.viewedAt)}</span>
                          </div>
                        </div>
                      </Link>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm font-medium">No recent documents</p>
                  <p className="text-xs mt-1">Documents you view will appear here</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="searches" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Recent Searches</h3>
              <Button asChild variant="outline" size="sm">
                <Link href="/search">New search</Link>
              </Button>
            </div>
            <div className="space-y-3">
              {recentSearches.length > 0 ? (
                recentSearches.map((search) => (
                  <Card key={search.id} className="transition-all duration-200 hover:shadow-md hover:scale-105 cursor-pointer" onClick={() => handleSearchRerun(search)}>
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-4 group">
                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 group-hover:bg-blue-100 dark:group-hover:bg-blue-900 transition-colors">
                          <Search className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors line-clamp-2">
                            {search.query}
                          </p>
                          <div className="flex items-center mt-2 space-x-2">
                            {formatSearchStates(search.states) && (
                              <Badge variant="outline" className="text-xs flex items-center">
                                <MapPin className="h-3 w-3 mr-1" />
                                {formatSearchStates(search.states)}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {search.resultsCount} results
                            </Badge>
                          </div>
                          <div className="flex items-center mt-2">
                            <Clock className="h-3 w-3 text-muted-foreground mr-1" />
                            <span className="text-xs text-muted-foreground">{formatTimeAgo(search.timestamp)}</span>
                          </div>
                        </div>
                        <div className="p-1 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all">
                          <RotateCcw className="h-4 w-4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-16 w-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm font-medium">No recent searches</p>
                  <p className="text-xs mt-1">Your searches will appear here</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="bookmarks" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Bookmarks</h3>
              <Button asChild variant="outline" size="sm">
                <Link href="/bookmarks">View all</Link>
              </Button>
            </div>
            <div className="space-y-3">
              {bookmarks.length > 0 ? (
                bookmarks.map((bookmark) => (
                  <Card key={bookmark.id} className="transition-all duration-200 hover:shadow-md hover:scale-105">
                    <CardContent className="p-4">
                      <Link
                        href={`/documents?view=${bookmark.documentId}`}
                        className="flex items-start space-x-4 group"
                      >
                        <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 group-hover:bg-yellow-100 dark:group-hover:bg-yellow-900 transition-colors">
                          <Star className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-yellow-700 dark:group-hover:text-yellow-300 transition-colors line-clamp-2">
                            {bookmark.title}
                          </p>
                          <div className="flex items-center mt-2 space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {bookmark.state}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {bookmark.type}
                            </Badge>
                          </div>
                          <div className="flex items-center mt-2">
                            <Clock className="h-3 w-3 text-muted-foreground mr-1" />
                            <span className="text-xs text-muted-foreground">{formatTimeAgo(bookmark.bookmarkedAt)}</span>
                          </div>
                        </div>
                      </Link>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Star className="h-16 w-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm font-medium">No bookmarks yet</p>
                  <p className="text-xs mt-1">Star documents to bookmark them</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}