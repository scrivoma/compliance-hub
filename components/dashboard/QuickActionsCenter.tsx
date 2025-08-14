import Link from 'next/link'
import { Search, Upload, BarChart3, Map, Calendar, Users, FileText, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const quickActions = [
  {
    title: 'AI Search',
    description: 'Natural language search',
    icon: Search,
    href: '/search',
    color: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100',
    primary: true
  },
  {
    title: 'Document Library',
    description: 'Browse by state & type',
    icon: FileText,
    href: '/documents',
    color: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    primary: true
  },
  {
    title: 'Upload Document',
    description: 'Add new compliance docs',
    icon: Upload,
    href: '/admin',
    color: 'bg-green-50 text-green-600 hover:bg-green-100',
    primary: false
  },
  {
    title: 'Generate Report',
    description: 'Compliance summary',
    icon: BarChart3,
    href: '/documents',
    color: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
    primary: false
  },
  {
    title: 'State Map',
    description: 'Visual state overview',
    icon: Map,
    href: '/documents',
    color: 'bg-orange-50 text-orange-600 hover:bg-orange-100',
    primary: false
  },
  {
    title: 'Calendar',
    description: 'Deadlines & events',
    icon: Calendar,
    href: '/documents',
    color: 'bg-pink-50 text-pink-600 hover:bg-pink-100',
    primary: false
  }
]

const shortcuts = [
  {
    title: 'Michigan Documents',
    query: 'state:Michigan',
    count: 23
  },
  {
    title: 'License Renewals',
    query: 'type:license renewal',
    count: 8
  },
  {
    title: 'Responsible Gaming',
    query: 'responsible gaming requirements',
    count: 15
  },
  {
    title: 'Tax Regulations',
    query: 'tax rate sports betting',
    count: 12
  }
]

export function QuickActionsCenter() {
  return (
    <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl flex items-center">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900 mr-3">
            <Settings className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          Quick Actions
        </CardTitle>
        <p className="text-muted-foreground text-sm">Fast access to common tasks</p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Primary Actions */}
        <div className="space-y-3">
          {quickActions.filter(action => action.primary).map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.title}
                asChild
                variant="outline"
                size="lg"
                className="h-auto p-4 justify-start group transition-all duration-200 hover:shadow-md hover:scale-105 border-gray-200 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-600 bg-white dark:bg-gray-800 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 dark:hover:from-indigo-950 dark:hover:to-blue-950"
              >
                <Link href={action.href} className="flex items-center space-x-4">
                  <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 transition-colors">
                    <Icon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">{action.title}</h3>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </div>
                </Link>
              </Button>
            )
          })}
        </div>

        {/* Secondary Actions */}
        <div className="grid grid-cols-2 gap-3">
          {quickActions.filter(action => !action.primary).map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.title}
                asChild
                variant="ghost"
                className="h-auto p-4 flex-col group transition-all duration-200 hover:shadow-md hover:scale-105 border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Link href={action.href} className="flex flex-col items-center text-center space-y-2">
                  <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700 group-hover:bg-gray-100 dark:group-hover:bg-gray-600 transition-colors">
                    <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100">{action.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                  </div>
                </Link>
              </Button>
            )
          })}
        </div>

        {/* Quick Search Shortcuts */}
        <div className="border-t border-gray-100 dark:border-gray-700 pt-6">
          <div className="flex items-center mb-4">
            <Search className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mr-2" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Quick Searches</h3>
          </div>
          <div className="space-y-2">
            {shortcuts.map((shortcut) => (
              <Button
                key={shortcut.title}
                asChild
                variant="ghost"
                className="w-full justify-between h-auto p-3 group transition-all duration-200 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:border-indigo-100 dark:hover:border-indigo-800 border border-transparent rounded-lg"
              >
                <Link href={`/search?q=${encodeURIComponent(shortcut.query)}`}>
                  <div className="flex items-center">
                    <div className="p-1 rounded bg-gray-100 dark:bg-gray-700 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 transition-colors mr-3">
                      <Search className="h-3 w-3 text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">{shortcut.title}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs bg-gray-100 dark:bg-gray-700 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                    {shortcut.count}
                  </Badge>
                </Link>
              </Button>
            ))}
          </div>
        </div>

        {/* Help & Settings */}
        <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <Button 
              asChild 
              variant="ghost" 
              size="sm"
              className="justify-center transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-700 dark:hover:text-blue-300 border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
            >
              <Link href="/help" className="flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Help & Support
              </Link>
            </Button>
            <Button 
              asChild 
              variant="ghost" 
              size="sm"
              className="justify-center transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
            >
              <Link href="/settings" className="flex items-center">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}