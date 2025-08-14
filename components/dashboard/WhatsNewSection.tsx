'use client'

import Link from 'next/link'
import { Sparkles, FileText, AlertCircle, Calendar, TrendingUp } from 'lucide-react'
import { useState, useEffect } from 'react'

interface NewDocument {
  id: string
  documentId: string
  title: string
  state: string
  type: string
  addedAt: string
}

// Mock data for other sections - in production, this would come from your API
const whatsNewData = {
  regulatoryChanges: [
    {
      id: '1',
      title: 'Michigan increases responsible gaming fund requirements',
      state: 'Michigan',
      effectiveDate: 'March 1, 2025',
      impact: 'High',
      summary: 'New rule requires 0.5% of gross gaming revenue contribution to problem gambling fund'
    },
    {
      id: '2',
      title: 'New Jersey updates advertising restrictions',
      state: 'New Jersey',
      effectiveDate: 'February 15, 2025',
      impact: 'Medium',
      summary: 'Enhanced restrictions on sports betting advertisements near schools and colleges'
    }
  ],
  upcomingDeadlines: [
    {
      id: '1',
      title: 'Michigan Sports Betting License Renewal',
      date: '2025-01-20',
      daysLeft: 3,
      type: 'License Renewal',
      priority: 'urgent'
    },
    {
      id: '2',
      title: 'Q4 2024 Compliance Report Due',
      date: '2025-01-31',
      daysLeft: 14,
      type: 'Reporting',
      priority: 'medium'
    }
  ],
  industryTrends: [
    {
      topic: 'Responsible Gaming Initiatives',
      mentions: '+45%',
      trend: 'up'
    },
    {
      topic: 'Mobile App Regulations',
      mentions: '+23%',
      trend: 'up'
    },
    {
      topic: 'Tax Rate Discussions',
      mentions: '+12%',
      trend: 'up'
    }
  ]
}

export function WhatsNewSection() {
  const [newDocuments, setNewDocuments] = useState<NewDocument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchNewDocuments = async () => {
      try {
        const response = await fetch('/api/user/new-documents')
        if (response.ok) {
          const data = await response.json()
          setNewDocuments(data.recent.slice(0, 3))
        }
      } catch (error) {
        console.error('Error fetching new documents:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchNewDocuments()
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950'
      case 'high': return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950'
      case 'medium': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950'
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800'
    }
  }

  const formatDaysLeft = (days: number) => {
    if (days === 0) return 'Today'
    if (days === 1) return 'Tomorrow'
    return `${days} days`
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mr-2" />
          What's New
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Latest updates, changes, and important deadlines</p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* New Documents */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <FileText className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                New Documents
              </h3>
              <Link href="/documents?filter=new" className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
                View all new
              </Link>
            </div>
            <div className="space-y-3">
              {loading ? (
                <div className="space-y-3">
                  <div className="animate-pulse">
                    <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                </div>
              ) : newDocuments.length > 0 ? (
                newDocuments.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/documents?view=${doc.documentId}`}
                    className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
                            {doc.title}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {doc.state} • {doc.type} • {formatTimeAgo(doc.addedAt)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm">No new documents</p>
                  <p className="text-xs mt-1">Recently added documents will appear here</p>
                </div>
              )}
            </div>
          </div>

          {/* Regulatory Changes */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mr-2" />
                Regulatory Changes
              </h3>
              <Link href="/changes" className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
                View all changes
              </Link>
            </div>
            <div className="space-y-3">
              {whatsNewData.regulatoryChanges.map((change) => (
                <div key={change.id} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1">
                      {change.title}
                    </h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      change.impact === 'High' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                      change.impact === 'Medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    }`}>
                      {change.impact}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {change.state} • Effective: {change.effectiveDate}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                    {change.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
              Upcoming Deadlines
            </h3>
            <Link href="/deadlines" className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
              View calendar
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {whatsNewData.upcomingDeadlines.map((deadline) => (
              <div key={deadline.id} className={`p-4 rounded-lg border-l-4 ${
                deadline.priority === 'urgent' ? 'border-red-500 bg-red-50 dark:border-red-400 dark:bg-red-950' :
                deadline.priority === 'high' ? 'border-orange-500 bg-orange-50 dark:border-orange-400 dark:bg-orange-950' :
                'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {deadline.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {deadline.type} • Due: {new Date(deadline.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${
                      deadline.priority === 'urgent' ? 'text-red-600 dark:text-red-400' :
                      deadline.priority === 'high' ? 'text-orange-600 dark:text-orange-400' :
                      'text-blue-600 dark:text-blue-400'
                    }`}>
                      {formatDaysLeft(deadline.daysLeft)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">left</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Industry Trends */}
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
            <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
            Trending Topics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {whatsNewData.industryTrends.map((trend, index) => (
              <div key={index} className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">
                    {trend.topic}
                  </p>
                  <div className="flex items-center">
                    <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400 mr-1" />
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">
                      {trend.mentions}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}