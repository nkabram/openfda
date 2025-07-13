'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Database, 
  RefreshCw, 
  Trash2, 
  Clock, 
  Users, 
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { useQueryCache } from '@/contexts/QueryCacheContext'
import { useAuth } from '@/contexts/AuthContext'
import { formatDistanceToNow } from 'date-fns'

interface CacheDebuggerProps {
  isVisible?: boolean
  onToggle?: () => void
}

export function CacheDebugger({ isVisible = false, onToggle }: CacheDebuggerProps) {
  const [logs, setLogs] = useState<Array<{
    timestamp: Date
    level: 'info' | 'warn' | 'error'
    message: string
    data?: any
  }>>([])
  
  const { 
    cache, 
    getCacheStats, 
    getCacheHealth, 
    getCacheStorageInfo,
    clearCache, 
    refreshCache,
    lastError,
    clearError,
    resetCache,
  } = useQueryCache()
  
  const { user } = useAuth()
  const cacheStats = getCacheStats()
  const cacheStorageInfo = getCacheStorageInfo()

  // Add logging functionality
  const addLog = useCallback((level: 'info' | 'warn' | 'error', message: string, data?: any) => {
    setLogs(prev => [...prev.slice(-49), { // Keep last 50 logs
      timestamp: new Date(),
      level,
      message,
      data
    }])
  }, [])

  // Monitor cache changes
  useEffect(() => {
    addLog('info', `Cache stats updated`, cacheStats)
  }, [addLog, cacheStats.userCount, cacheStats.adminCount, cacheStats.lastUserFetch, cacheStats.lastAdminFetch])

  useEffect(() => {
    if (lastError) {
      addLog('error', `Cache error: ${lastError.message}`, lastError)
    }
  }, [addLog, lastError])
  
  // Monitor storage usage
  useEffect(() => {
    if (cacheStorageInfo.isNearLimit) {
      addLog('warn', `Storage usage high: ${cacheStorageInfo.percentage}% (${cacheStorageInfo.used}KB used)`, cacheStorageInfo)
    }
  }, [addLog, cacheStorageInfo.percentage, cacheStorageInfo.used, cacheStorageInfo.isNearLimit])

  const handleClearCache = () => {
    addLog('warn', 'Cache manually cleared by user')
    clearCache()
  }

  const handleRefreshCache = async () => {
    addLog('info', 'Cache refresh initiated by user')
    try {
      refreshCache('both')
      addLog('info', 'Cache refresh completed successfully')
    } catch (error) {
      addLog('error', 'Cache refresh failed', error)
    }
  }

  const handleClearLogs = () => {
    setLogs([])
  }

  const health = getCacheHealth()

  if (!isVisible) {
    return (
      <Button
        onClick={onToggle}
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50 bg-background/80 backdrop-blur-sm"
      >
        <Database className="h-4 w-4 mr-2" />
        Cache Debug
      </Button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-[80vh] overflow-hidden">
      <Card className="bg-background/95 backdrop-blur-sm border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5" />
              Cache Debugger
            </CardTitle>
            <Button onClick={onToggle} variant="ghost" size="sm">
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Cache Health Status */}
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              {health.status === 'healthy' && <CheckCircle className="h-4 w-4 text-green-500" />}
              {health.status === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
              {health.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
              Cache Health
            </h4>
            <Badge 
              variant={health.status === 'healthy' ? 'default' : 
                      health.status === 'warning' ? 'secondary' : 'destructive'}
            >
              {health.message}
            </Badge>
          </div>

          <Separator />

          {/* Cache Statistics */}
          <div className="space-y-2">
            <h4 className="font-semibold">Statistics</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3" />
                <span>User: {cacheStats.userCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3" />
                <span>Admin: {cacheStats.adminCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                <span>Version: {cache.version}</span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="h-3 w-3" />
                <span>Storage: {cacheStorageInfo.used}KB</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${
                  cacheStorageInfo.percentage > 80 ? 'bg-red-100 text-red-800' :
                  cacheStorageInfo.percentage > 60 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {cacheStorageInfo.percentage}% used
                </span>
              </div>
              {cacheStats.lastUserFetch && (
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-3 w-3" />
                  <span>Last: {formatDistanceToNow(cacheStats.lastUserFetch)} ago</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Cache Actions */}
          <div className="space-y-2">
            <h4 className="font-semibold">Actions</h4>
            <div className="flex gap-2">
              <Button 
                onClick={handleRefreshCache} 
                variant="outline" 
                size="sm"
                className="flex-1"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
              <Button 
                onClick={handleClearCache} 
                variant="outline" 
                size="sm"
                className="flex-1"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          </div>

          <Separator />

          {/* Recent Logs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Recent Logs</h4>
              <Button onClick={handleClearLogs} variant="ghost" size="sm">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {logs.slice(-10).reverse().map((log, index) => (
                <div 
                  key={index} 
                  className={`text-xs p-2 rounded border-l-2 ${
                    log.level === 'error' ? 'border-red-500 bg-red-50 dark:bg-red-950/20' :
                    log.level === 'warn' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' :
                    'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono">{log.message}</span>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(log.timestamp)} ago
                    </span>
                  </div>
                  {log.data && (
                    <pre className="mt-1 text-xs text-muted-foreground overflow-hidden">
                      {JSON.stringify(log.data, null, 2).slice(0, 100)}...
                    </pre>
                  )}
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">
                  No logs yet
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
