'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Check, X, Clock, User, Shield } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'

interface PendingUser {
  id: string
  email: string
  full_name: string | null
  created_at: string
  is_approved?: boolean
}

interface PendingUsersProps {
  refreshTrigger?: number
}

export function PendingUsers({ refreshTrigger }: PendingUsersProps) {
  const [users, setUsers] = useState<PendingUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const { toast } = useToast()
  const { session } = useAuth()

  useEffect(() => {
    fetchPendingUsers()
  }, [refreshTrigger, session])

  const fetchPendingUsers = async () => {
    try {
      const headers: Record<string, string> = {}
      
      // Add authorization header for production (not localhost)
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch('/api/admin/pending-users', { headers })
      
      if (!response.ok) {
        if (response.status === 403) {
          toast({
            title: "Access Denied",
            description: "You don't have admin privileges to view pending users.",
            variant: "destructive",
          })
          return
        }
        throw new Error('Failed to fetch pending users')
      }

      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Error fetching pending users:', error)
      toast({
        title: "Error",
        description: "Failed to load pending users. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUserAction = async (userId: string, action: 'approve' | 'reject') => {
    setProcessingId(userId)
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      
      // Add authorization header for production (not localhost)
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch('/api/admin/pending-users', {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId, action })
      })

      if (!response.ok) {
        throw new Error(`Failed to ${action} user`)
      }

      const data = await response.json()
      
      toast({
        title: "Success",
        description: data.message,
        variant: "default",
      })

      // Remove the user from the list
      setUsers(prev => prev.filter(user => user.id !== userId))
      
    } catch (error) {
      console.error(`Error ${action}ing user:`, error)
      toast({
        title: "Error",
        description: `Failed to ${action} user. Please try again.`,
        variant: "destructive",
      })
    } finally {
      setProcessingId(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isTrustedDomain = (email: string) => {
    return email.endsWith('.ah.org') || email.endsWith('@umich.edu')
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending User Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading pending users...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Pending User Approvals
          {users.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {users.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No pending user approvals</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-card"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {user.full_name || 'No name provided'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <span>{user.email}</span>
                      {isTrustedDomain(user.email) && (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          Auto-approve domain
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Requested: {formatDate(user.created_at)}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUserAction(user.id, 'approve')}
                      disabled={processingId === user.id}
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUserAction(user.id, 'reject')}
                      disabled={processingId === user.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
