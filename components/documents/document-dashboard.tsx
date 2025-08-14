'use client'

import { useState, useEffect } from 'react'
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  MapPin,
  Calendar,
  Eye,
  Download,
  Filter
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Document {
  id: string
  title: string
  state: string
  fileSize: number
  processingStatus: string
  createdAt: string
  verticals: Array<{
    vertical: {
      id: string
      name: string
      displayName: string
    }
  }>
  documentTypes: Array<{
    documentType: {
      id: string
      name: string
      displayName: string
    }
  }>
}

interface DocumentStats {
  total: number
  completed: number
  processing: number
  failed: number
  recentCount: number
  byState: Record<string, number>
  byType: Record<string, number>
  byVertical: Record<string, number>
}

interface DocumentDashboardProps {
  documents: Document[]
  selectedState: string
  onStateChange: (state: string) => void
  onView: (doc: Document) => void
  onDownload: (doc: Document) => void
}

// State abbreviation to full name mapping
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

export function DocumentDashboard({ 
  documents, 
  selectedState, 
  onStateChange,
  onView,
  onDownload
}: DocumentDashboardProps) {
  const [stats, setStats] = useState<DocumentStats>({
    total: 0,
    completed: 0,
    processing: 0,
    failed: 0,
    recentCount: 0,
    byState: {},
    byType: {},
    byVertical: {}
  })

  useEffect(() => {
    calculateStats()
  }, [documents])

  const calculateStats = () => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const newStats: DocumentStats = {
      total: documents.length,
      completed: 0,
      processing: 0,
      failed: 0,
      recentCount: 0,
      byState: {},
      byType: {},
      byVertical: {}
    }

    documents.forEach(doc => {
      // Status counts
      if (doc.processingStatus === 'COMPLETED') {
        newStats.completed++
      } else if (doc.processingStatus === 'FAILED') {
        newStats.failed++
      } else {
        newStats.processing++
      }

      // Recent documents
      if (new Date(doc.createdAt) > sevenDaysAgo) {
        newStats.recentCount++
      }

      // By state
      newStats.byState[doc.state] = (newStats.byState[doc.state] || 0) + 1

      // By document type
      doc.documentTypes.forEach(docType => {
        newStats.byType[docType.documentType.displayName] = 
          (newStats.byType[docType.documentType.displayName] || 0) + 1
      })

      // By vertical
      doc.verticals.forEach(vertical => {
        newStats.byVertical[vertical.vertical.displayName] = 
          (newStats.byVertical[vertical.vertical.displayName] || 0) + 1
      })
    })

    setStats(newStats)
  }

  const getRecentDocuments = () => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    return documents
      .filter(doc => new Date(doc.createdAt) > sevenDaysAgo)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
  }

  const getTopStates = () => {
    return Object.entries(stats.byState)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([state, count]) => ({ state, count, name: STATE_NAMES[state] || state }))
  }

  const getTopDocumentTypes = () => {
    return Object.entries(stats.byType)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }))
  }

  const filteredDocuments = selectedState 
    ? documents.filter(doc => doc.state === selectedState)
    : documents

  const recentDocuments = getRecentDocuments()
  const topStates = getTopStates()
  const topDocumentTypes = getTopDocumentTypes()

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FileText className="h-8 w-8 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Documents</p>
                <p className="text-2xl font-semibold text-foreground">{stats.total.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-8 w-8 text-slate-700 dark:text-slate-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Ready to Use</p>
                <p className="text-2xl font-semibold text-foreground">{stats.completed.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">
                  {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% complete
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="h-8 w-8 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Processing</p>
                <p className="text-2xl font-semibold text-foreground">{stats.processing.toLocaleString()}</p>
                {stats.failed > 0 && (
                  <p className="text-sm text-destructive">{stats.failed} failed</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-8 w-8 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Added This Week</p>
                <p className="text-2xl font-semibold text-foreground">{stats.recentCount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Documents */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Documents</CardTitle>
              <p className="text-sm text-muted-foreground">Documents added in the last 7 days</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {recentDocuments.length > 0 ? (
                  recentDocuments.map(doc => (
                    <div key={doc.id} className="px-6 py-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-foreground truncate">
                            {doc.title}
                          </h4>
                          <div className="flex items-center space-x-2 mt-1 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>{STATE_NAMES[doc.state] || doc.state}</span>
                            <span>•</span>
                            <Calendar className="h-4 w-4" />
                            <span>{formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <div className="flex items-center">
                            {doc.processingStatus === 'COMPLETED' ? (
                              <CheckCircle className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                            ) : doc.processingStatus === 'FAILED' ? (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            ) : (
                              <Clock className="h-4 w-4 text-slate-600 dark:text-slate-400 animate-spin" />
                            )}
                          </div>
                          <button
                            onClick={() => onView(doc)}
                            className="p-1 text-muted-foreground hover:text-primary transition-colors"
                            title="View Document"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onDownload(doc)}
                            className="p-1 text-muted-foreground hover:text-primary transition-colors"
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-6 py-8 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No recent documents</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Statistics Sidebar */}
        <div className="space-y-6">
          {/* Top States */}
          <Card>
            <CardHeader>
              <CardTitle>Top States</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topStates.map(({ state, count, name }) => (
                  <div key={state} className="flex items-center justify-between">
                    <button
                      onClick={() => onStateChange(state)}
                      className={`flex items-center space-x-2 text-sm font-medium transition-colors ${
                        selectedState === state
                          ? 'text-primary'
                          : 'text-foreground hover:text-primary'
                      }`}
                    >
                      <MapPin className="h-4 w-4" />
                      <span>{name}</span>
                    </button>
                    <span className="text-sm text-muted-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Document Types */}
          <Card>
            <CardHeader>
              <CardTitle>Document Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topDocumentTypes.map(({ type, count }) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">{type}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}