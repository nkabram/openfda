'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Clock, Pill } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Query {
  id: string
  user_query: string
  medication_name: string | null
  ai_response: string
  created_at: string
}

export function QueryHistory() {
  const [queries, setQueries] = useState<Query[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchQueries()
  }, [])

  const fetchQueries = async () => {
    try {
      const response = await fetch('/api/queries')
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
          <Card key={query.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm font-medium leading-tight">
                  {truncateText(query.user_query, 80)}
                </CardTitle>
                {query.medication_name && (
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    <Pill className="w-3 h-3 mr-1" />
                    {query.medication_name}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground mb-2">
                {truncateText(query.ai_response, 120)}
              </p>
              <div className="flex items-center text-xs text-muted-foreground">
                <Clock className="w-3 h-3 mr-1" />
                {formatDate(query.created_at)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  )
}
