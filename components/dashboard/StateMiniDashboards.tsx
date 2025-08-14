import Link from 'next/link'
import { MapPin, Clock, AlertTriangle, CheckCircle, FileText, Calendar } from 'lucide-react'

// Mock data - in production, this would come from your API
const stateData = [
  {
    id: 'nj',
    name: 'New Jersey',
    status: 'current',
    lastUpdate: '2 hours ago',
    documentCount: 42,
    urgentItems: 0,
    nextDeadline: null,
    recentActivity: 'Updated advertising guidelines',
    licenseStatus: 'Active',
    statusColor: 'green'
  },
  {
    id: 'mi',
    name: 'Michigan',
    status: 'urgent',
    lastUpdate: '30 minutes ago',
    documentCount: 38,
    urgentItems: 1,
    nextDeadline: {
      title: 'License Renewal',
      date: '2025-01-20',
      daysLeft: 3
    },
    recentActivity: 'License renewal notice',
    licenseStatus: 'Renewal Due',
    statusColor: 'red'
  },
  {
    id: 'in',
    name: 'Indiana',
    status: 'current',
    lastUpdate: '1 day ago',
    documentCount: 29,
    urgentItems: 0,
    nextDeadline: {
      title: 'Q4 Report Due',
      date: '2025-01-31',
      daysLeft: 14
    },
    recentActivity: 'New guidance document',
    licenseStatus: 'Active',
    statusColor: 'green'
  },
  {
    id: 'nh',
    name: 'New Hampshire',
    status: 'review',
    lastUpdate: '3 days ago',
    documentCount: 21,
    urgentItems: 0,
    nextDeadline: {
      title: 'Annual Filing',
      date: '2025-02-15',
      daysLeft: 28
    },
    recentActivity: 'Sports betting rules update',
    licenseStatus: 'Review Needed',
    statusColor: 'yellow'
  },
  {
    id: 'ct',
    name: 'Connecticut',
    status: 'current',
    lastUpdate: '5 days ago',
    documentCount: 18,
    urgentItems: 0,
    nextDeadline: null,
    recentActivity: 'No recent changes',
    licenseStatus: 'Active',
    statusColor: 'green'
  },
  {
    id: 'pa',
    name: 'Pennsylvania',
    status: 'review',
    lastUpdate: '1 week ago',
    documentCount: 35,
    urgentItems: 0,
    nextDeadline: {
      title: 'Compliance Review',
      date: '2025-02-28',
      daysLeft: 41
    },
    recentActivity: 'Responsible gaming update',
    licenseStatus: 'Review Needed',
    statusColor: 'yellow'
  }
]

export function StateMiniDashboards() {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'current':
        return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
      case 'urgent':
        return <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
      case 'review':
        return <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
      default:
        return <CheckCircle className="h-5 w-5 text-gray-400 dark:text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'current':
        return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
      case 'urgent':
        return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
      case 'review':
        return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950'
      default:
        return 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
    }
  }

  const formatDaysLeft = (days: number) => {
    if (days === 0) return 'Today'
    if (days === 1) return 'Tomorrow'
    if (days <= 7) return `${days} days`
    if (days <= 30) return `${Math.ceil(days / 7)} weeks`
    return `${Math.ceil(days / 30)} months`
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">State Overview</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Quick status for each jurisdiction</p>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          {stateData.map((state) => (
            <Link
              key={state.id}
              href={`/documents?state=${state.id}`}
              className={`block p-4 rounded-lg border-2 transition-colors hover:border-indigo-300 dark:hover:border-indigo-600 ${getStatusColor(state.status)}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">{state.name}</h3>
                </div>
                {getStatusIcon(state.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">License Status</p>
                  <p className={`font-medium ${
                    state.statusColor === 'green' ? 'text-green-600 dark:text-green-400' :
                    state.statusColor === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {state.licenseStatus}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Documents</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{state.documentCount}</p>
                </div>
              </div>

              {state.nextDeadline && (
                <div className="mt-3 p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{state.nextDeadline.title}</span>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      state.nextDeadline.daysLeft <= 7 ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                      state.nextDeadline.daysLeft <= 30 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    }`}>
                      {formatDaysLeft(state.nextDeadline.daysLeft)}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{state.recentActivity}</span>
                <span>Updated {state.lastUpdate}</span>
              </div>

              {state.urgentItems > 0 && (
                <div className="mt-2 flex items-center text-red-600 dark:text-red-400 text-sm">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  <span>{state.urgentItems} urgent item{state.urgentItems > 1 ? 's' : ''}</span>
                </div>
              )}
            </Link>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                {stateData.filter(s => s.status === 'current').length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Current</p>
            </div>
            <div>
              <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                {stateData.filter(s => s.status === 'review').length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Review</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">
                {stateData.filter(s => s.status === 'urgent').length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Urgent</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/admin"
              className="p-2 rounded text-center text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
            >
              Manage States
            </Link>
            <Link
              href="/documents"
              className="p-2 rounded text-center text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
            >
              View All Docs
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}