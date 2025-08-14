import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { ComplianceStatusOverview } from '@/components/dashboard/ComplianceStatusOverview'
import { RecentActivityHub } from '@/components/dashboard/RecentActivityHub'
import { WhatsNewSection } from '@/components/dashboard/WhatsNewSection'
import { QuickActionsCenter } from '@/components/dashboard/QuickActionsCenter'
import { StateMiniDashboards } from '@/components/dashboard/StateMiniDashboards'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Welcome back, {session?.user?.email?.split('@')[0] || 'User'}
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Here's your compliance overview and recent activity
        </p>
      </div>

      {/* Compliance Status Overview */}
      <Suspense fallback={<div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse mb-8" />}>
        <ComplianceStatusOverview />
      </Suspense>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Left Column - Recent Activity */}
        <div className="lg:col-span-2 space-y-8">
          <Suspense fallback={<div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />}>
            <RecentActivityHub />
          </Suspense>
          
          <Suspense fallback={<div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />}>
            <WhatsNewSection />
          </Suspense>
        </div>

        {/* Right Column - Quick Actions & State Info */}
        <div className="space-y-8">
          <QuickActionsCenter />
          
          <Suspense fallback={<div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />}>
            <StateMiniDashboards />
          </Suspense>
        </div>
      </div>
    </div>
  )
}