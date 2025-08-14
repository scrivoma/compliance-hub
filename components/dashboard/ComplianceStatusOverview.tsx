import { Shield, AlertTriangle, CheckCircle, Clock, TrendingUp, Activity } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

// Mock data - in production, this would come from your API
const complianceData = {
  healthScore: 94,
  totalStates: 7,
  upToDate: 5,
  needsReview: 2,
  urgent: 1,
  urgentItem: {
    state: 'Michigan',
    type: 'License Renewal',
    daysLeft: 3
  }
}

export function ComplianceStatusOverview() {
  return (
    <Card className="mb-8 border-slate-200 dark:border-slate-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Compliance Status Overview</CardTitle>
            <CardDescription>Monitor your compliance health across all states</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            <Badge variant="secondary" className="text-xs">
              Last updated: 2 hours ago
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Compliance Health Score */}
          <Card className="transition-all duration-200 hover:shadow-md border-slate-200 dark:border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Health Score</p>
                  <div className="flex items-center space-x-2">
                    <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                      {complianceData.healthScore}%
                    </span>
                    <Badge 
                      variant="secondary"
                      className="bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-400 dark:hover:bg-blue-950/70"
                    >
                      Excellent
                    </Badge>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                  <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Up to Date */}
          <Card className="transition-all duration-200 hover:shadow-md border-slate-200 dark:border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Up to Date</p>
                  <div className="flex items-center space-x-2">
                    <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                      {complianceData.upToDate}
                    </span>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-800/70">
                      Current
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">states current</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                  <CheckCircle className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Needs Review */}
          <Card className="transition-all duration-200 hover:shadow-md border-slate-200 dark:border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Needs Review</p>
                  <div className="flex items-center space-x-2">
                    <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                      {complianceData.needsReview}
                    </span>
                    <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-950/30 dark:text-yellow-400 dark:hover:bg-yellow-950/50">
                      Pending
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">states pending</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                  <Clock className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Urgent Items */}
          <Card className="transition-all duration-200 hover:shadow-md border-slate-200 dark:border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Urgent</p>
                  <div className="flex items-center space-x-2">
                    <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                      {complianceData.urgent}
                    </span>
                    <Badge variant="secondary" className="bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50">
                      Action Required
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">item needs attention</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                  <AlertTriangle className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Urgent Alert */}
        {complianceData.urgent > 0 && (
          <Alert className="mt-6 border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertTitle className="text-slate-900 dark:text-slate-100">
              Urgent: {complianceData.urgentItem.state} {complianceData.urgentItem.type}
            </AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">
                Deadline in {complianceData.urgentItem.daysLeft} days
              </span>
              <Button 
                variant="secondary" 
                size="sm" 
                className="ml-4 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950/50 dark:text-red-400 dark:hover:bg-red-950/70 border-red-200 dark:border-red-900/50"
              >
                Review Now
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}