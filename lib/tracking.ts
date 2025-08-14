// Utility functions for tracking user activity

export const trackDocumentView = async (documentId: string, title: string, state?: string, type?: string) => {
  try {
    await fetch('/api/user/recent-documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentId,
        title,
        state,
        type
      })
    })
  } catch (error) {
    console.error('Error tracking document view:', error)
  }
}

export const trackDocumentAdded = async (documentId: string, title: string, state?: string, type?: string) => {
  try {
    await fetch('/api/user/recent-documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentId,
        title,
        state,
        type
      })
    })
  } catch (error) {
    console.error('Error tracking document addition:', error)
  }
}

export const trackSearch = async (query: string, resultsCount: number, searchType: string = 'ai', states?: string) => {
  try {
    await fetch('/api/user/recent-searches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        resultsCount,
        searchType,
        states
      })
    })
  } catch (error) {
    console.error('Error tracking search:', error)
  }
}

export const addBookmark = async (documentId: string, title: string, state?: string, type?: string) => {
  try {
    const response = await fetch('/api/user/bookmarks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentId,
        title,
        state,
        type
      })
    })
    
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to add bookmark')
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error adding bookmark:', error)
    throw error
  }
}

export const removeBookmark = async (documentId: string) => {
  try {
    const response = await fetch(`/api/user/bookmarks?documentId=${documentId}`, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      throw new Error('Failed to remove bookmark')
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error removing bookmark:', error)
    throw error
  }
}

export const isBookmarked = async (documentId: string): Promise<boolean> => {
  try {
    const response = await fetch(`/api/user/bookmarks?documentId=${documentId}`, {
      method: 'HEAD',
    })
    
    return response.ok
  } catch (error) {
    console.error('Error checking bookmark status:', error)
    return false
  }
}