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
  searchFilter?: string
}

export function QueryHistory({ refreshTrigger, onQuerySelected, selectedQueryId, searchFilter }: QueryHistoryProps) {
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
  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        <p>Failed to load query history</p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          className="mt-2"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  // Filter queries based on search filter
  const filteredQueries = queries.filter(query => {
    if (!searchFilter || searchFilter.trim() === '') return true
    
    const searchTerm = searchFilter.toLowerCase().trim()
    const medicationMatch = query.medication_name?.toLowerCase().includes(searchTerm)
    const queryMatch = query.user_query.toLowerCase().includes(searchTerm)
    
    return medicationMatch || queryMatch
  })

  // Refresh when trigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      refetch()
    }
  }, [refreshTrigger, refetch])

  const handleDeleteQuery = useCallback(async (queryId: string) => {
    try {
      // Immediately reset form to new query screen
      if (onQuerySelected) {
        onQuerySelected(null as any)
      }
      
      // Delete query (optimistic update removes from UI immediately)
      await deleteQuery(queryId)
      
      toast({
        title: "Query deleted",
        description: "The query has been removed from your history.",
      })
      
    } catch (error) {
      console.error('Error deleting query:', error)
      toast({
        title: "Failed to delete query",
        description: "Please try again.",
        variant: "destructive",
      })
      // Note: If delete fails, useQueries hook will restore the query via refetch
    }
  }, [deleteQuery, toast, onQuerySelected])

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

  if (filteredQueries.length === 0 && searchFilter && searchFilter.trim() !== '') {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>No queries found for "{searchFilter}"</p>
        <p className="text-sm">Try a different drug name or clear the search.</p>
      </div>
    )
  }

  return (
    <div className="h-full">
      <ScrollArea className="h-full">
        <div className="p-3 space-y-2">
          {filteredQueries.map((query) => (
            <div 
              key={query.id} 
              className={`group p-3 rounded-md border cursor-pointer hover:bg-muted/20 transition-all duration-200 ${
                selectedQueryId === query.id ? 'ring-1 ring-primary bg-primary/5 border-primary/30' : 'bg-card hover:border-muted-foreground/20'
              }`}
              onClick={() => onQuerySelected?.(query)}
            >
              {/* Main query text with drug name or general icon */}
              <div className="mb-2">
                <div className="flex items-start gap-2 mb-1">
                  <h3 className="text-sm font-medium text-foreground leading-tight line-clamp-2 flex-1">
                    {truncateText(query.user_query, 85)}
                  </h3>
                  {query.medication_name ? (
                    <div className="flex items-center gap-1 text-xs font-medium shrink-0 text-blue-600 dark:text-blue-400">
                      <Pill className="w-3 h-3" />
                      <span className="truncate max-w-20">{query.medication_name}</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-xs text-muted-foreground/60 shrink-0">
                      <MessageSquare className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </div>
              
              {/* Metadata row */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center text-muted-foreground">
                  <Calendar className="w-3 h-3 mr-1" />
                  <span>{formatDate(query.created_at)}</span>
                </div>
                <AlertDialog>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-2 border-border shadow-lg">
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem className="text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-300 focus:bg-red-50 dark:focus:bg-red-950/20 font-medium">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Query
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Query</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this query? This action cannot be undone.
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
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
