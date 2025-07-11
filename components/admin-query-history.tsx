'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import { Clock, User, Pill, Plus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useQueryCache } from '@/contexts/QueryCacheContext'

interface QueryWithUser {
  id: string
  user_query: string
  medication_name: string
  ai_response: string
  created_at: string
  message_count: number
  profiles?: {
    email: string
    full_name: string
  }
  email?: string
  full_name?: string
}

interface AdminQueryHistoryProps {
  onCreatePersonalQuery: () => void
  selectedQuery: QueryWithUser | null
  onSelectQuery: (query: QueryWithUser) => void
}

export function AdminQueryHistory({ onCreatePersonalQuery, selectedQuery, onSelectQuery }: AdminQueryHistoryProps) {
  const [loading, setLoading] = useState(false)
  const { session } = useAuth()
  const { cache, setAdminQueries, shouldRefetch } = useQueryCache()

  // Use cached admin queries
  const queries = cache.adminQueries as QueryWithUser[]

  const fetchQueries = useCallback(async (forceRefresh = false) => {
    // Only fetch if cache is stale or forced
    if (!forceRefresh && !shouldRefetch('admin')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/queries?view=admin', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setAdminQueries(data.queries || [])
      } else {
        console.error('Failed to fetch admin queries')
      }
    } catch (error) {
      console.error('Error fetching admin queries:', error)
    } finally {
      setLoading(false)
    }
  }, [session?.access_token, shouldRefetch, setAdminQueries])

  useEffect(() => {
    fetchQueries()
  }, [fetchQueries])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getUserDisplayName = (query: QueryWithUser) => {
    if (query.profiles?.full_name) {
      return query.profiles.full_name
    }
    if (query.profiles?.email) {
      return query.profiles.email
    }
    return 'Unknown User'
  }

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            All User Queries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            All User Queries ({queries.length})
          </CardTitle>
          <Button 
            onClick={onCreatePersonalQuery}
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Personal Query
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full px-6 pb-6">
          {queries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No queries found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {queries.map((query) => (
                <div key={query.id}>
                  <div
                    className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedQuery?.id === query.id ? 'bg-muted border-primary' : 'bg-background'
                    }`}
                    onClick={() => onSelectQuery(query)}
                  >
                    <div className="space-y-2">
                      {/* User Info */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span className="font-medium">{getUserDisplayName(query)}</span>
                        {query.profiles?.email && query.profiles?.full_name && (
                          <span className="text-xs">({query.profiles.email})</span>
                        )}
                      </div>
                      
                      {/* Query Text */}
                      <p className="text-sm font-medium line-clamp-2">
                        {query.user_query}
                      </p>
                      
                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {query.medication_name && (
                          <div className="flex items-center gap-1">
                            <Pill className="h-3 w-3" />
                            <span>{query.medication_name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatDate(query.created_at)}</span>
                        </div>
                        {query.message_count > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {query.message_count} follow-ups
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Separator className="my-3" />
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
