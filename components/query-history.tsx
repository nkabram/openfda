'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Clock, Pill, MoreHorizontal, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { isLocalhost } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
  const [queries, setQueries] = useState<Query[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { toast } = useToast()
  const { session } = useAuth()

  useEffect(() => {
    fetchQueries()
  }, [refreshTrigger, session])

  const fetchQueries = async () => {
    try {
      const headers: Record<string, string> = {}
      
      // Add authorization header for production (not localhost)
      if (!isLocalhost() && session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch('/api/queries', { headers })
      if (!response.ok) {
        throw new Error('Failed to fetch queries')
      }
      const data = await response.json()
      setQueries(data.queries || [])
    } catch (error) {
      console.error('Error fetching queries:', error)
      toast({
        title: "Failed to load query history",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteQuery = async (queryId: string) => {
    setDeletingId(queryId)
    try {
      const headers: Record<string, string> = {}
      
      // Add authorization header for production (not localhost)
      if (!isLocalhost() && session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch(`/api/queries?id=${queryId}`, {
        method: 'DELETE',
        headers
      })

      if (!response.ok) {
        throw new Error('Failed to delete query')
      }

      // Remove from local state
      setQueries(prev => prev.filter(q => q.id !== queryId))

      // Clear selection if deleted query was selected
      if (selectedQueryId === queryId) {
        onQuerySelected?.(null as any)
      }

      toast({
        title: "Query deleted successfully",
      })
    } catch (error) {
      console.error('Error deleting query:', error)
      toast({
        title: "Failed to delete query",
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
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
    <ScrollArea className="h-[calc(100vh-8rem)]">
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
                          disabled={deletingId === query.id}
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
  )
}
