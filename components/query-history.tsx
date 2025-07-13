'use client'

import { useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, MessageSquare, Calendar, Pill, RefreshCw, Clock, MoreHorizontal } from 'lucide-react'
import { useUserQueries } from '@/hooks/useQueries'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

interface Query {
  id: string
  user_query: string
  medication_name: string | null
  ai_response: string
  created_at: string
  message_count?: number
}

interface QueryHistoryProps {
  refreshTrigger?: number
  onQuerySelected?: (query: Query) => void
  selectedQueryId?: string
}

export function QueryHistory({ refreshTrigger, onQuerySelected, selectedQueryId }: QueryHistoryProps) {
  const { toast } = useToast()
  const {
    queries,
    loading: isLoading,
    error,
    refetch,
    deleteQuery,
    cacheStats
  } = useUserQueries({
    onError: (error) => {
      toast({
        title: "Failed to load query history",
        description: error.message,
        variant: "destructive",
      })
    }
  })

  // Handle error display
  useEffect(() => {
    if (error) {
      console.error('Query history error:', error)
    }
  }, [error])

  // Force refresh on trigger change
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      refetch(true)
    }
  }, [refreshTrigger, refetch])

  const handleDeleteQuery = useCallback(async (queryId: string) => {
    try {
      // Optimistically remove from cache
      deleteQuery(queryId)
      
      // Clear selection if deleted query was selected
      if (selectedQueryId === queryId) {
        onQuerySelected?.(null as any)
      }
      
      const response = await fetch(`/api/queries?id=${queryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}` // Fallback auth
        }
      })

      if (response.ok) {
        toast({
          title: "Query deleted successfully",
        })
      } else {
        // If API call fails, refresh to restore correct state
        await refetch(true)
        throw new Error('Failed to delete query')
      }
    } catch (error) {
      console.error('Error deleting query:', error)
      toast({
        title: "Failed to delete query",
        description: "The query may still exist. Please refresh to see the current state.",
        variant: "destructive",
      })
      // Refresh to get correct state
      await refetch(true)
    }
  }, [deleteQuery, refetch, toast, selectedQueryId, onQuerySelected])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return format(date, 'MMM d, yyyy h:mm a')
  }

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  if (queries.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>No queries yet.</p>
        <p className="text-sm">Your medication questions will appear here.</p>
      </div>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Query History
          {queries.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {queries.length} {queries.length === 1 ? 'query' : 'queries'}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch(true)}
            disabled={isLoading}
            className="ml-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-12rem)]">
          <div className="p-4 space-y-3">
        {queries.map((query) => (
          <Card 
            key={query.id} 
            className={`cursor-pointer hover:bg-muted/50 transition-colors ${
              selectedQueryId === query.id ? 'ring-2 ring-primary bg-muted/30' : ''
            }`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => onQuerySelected?.(query)}
                >
                  <CardTitle className="text-sm font-medium leading-tight">
                    {truncateText(query.user_query, 80)}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {query.medication_name && (
                    <Badge variant="secondary" className="text-xs">
                      <Pill className="w-3 h-3 mr-1" />
                      {query.medication_name}
                    </Badge>
                  )}
                  <AlertDialog>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem className="text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the query and all associated follow-up messages.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteQuery(query.id)}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0" onClick={() => onQuerySelected?.(query)}>
              <p className="text-xs text-muted-foreground mb-2">
                {truncateText(query.ai_response, 120)}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center text-xs text-muted-foreground">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatDate(query.created_at)}
                </div>
                {query.message_count && query.message_count > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {query.message_count} follow-up{query.message_count > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
