'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TestAuthPage() {
  const { 
    user, 
    loading, 
    signInWithGoogle, 
    signOut
  } = useAuth()
  
  const [isClient, setIsClient] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  useEffect(() => {
    setIsClient(true)
    addLog('Component mounted')
  }, [])

  useEffect(() => {
    addLog(`Auth state changed - User: ${user?.email || 'none'}`)
  }, [user])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  const handleRefreshStatus = async () => {
    addLog('Auth status refresh no longer needed - approval system removed')
  }

  if (!isClient) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Authentication Test Page</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Current Auth State</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div><strong>Loading:</strong> {String(loading)}</div>
            <div><strong>User:</strong> {user?.email || 'Not logged in'}</div>
            <div><strong>User ID:</strong> {user?.id || 'N/A'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!user ? (
              <Button onClick={signInWithGoogle}>Sign In with Google</Button>
            ) : (
              <>
                <Button onClick={signOut} variant="outline">Sign Out</Button>
                <Button onClick={handleRefreshStatus} className="ml-2">
                  Refresh Approval Status
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debug Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-sm space-y-1 max-h-96 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="text-muted-foreground">{log}</div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Navigation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <a href="/" className="text-blue-500 hover:underline">Go to Main App (with AuthGuard)</a>
            </div>
            <div>
              <a href="/admin" className="text-blue-500 hover:underline">Go to Admin Dashboard</a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
