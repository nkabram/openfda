'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Send, ChevronDown, ChevronUp } from 'lucide-react'
import * as Collapsible from '@radix-ui/react-collapsible'

interface QueryInputFormProps {
  onSubmit: (query: string) => void
  isLoading?: boolean
  disabled?: boolean
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  placeholder?: string
  currentQuery?: string
}

export function QueryInputForm({
  onSubmit,
  isLoading = false,
  disabled = false,
  isCollapsed = false,
  onToggleCollapse,
  placeholder = "Ask a question about a specific medication (e.g., 'What are the side effects of ibuprofen?')",
  currentQuery = ''
}: QueryInputFormProps) {
  const [query, setQuery] = useState(currentQuery)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || isLoading || disabled) return
    onSubmit(query.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  return (
    <Card>
      <Collapsible.Root open={!isCollapsed}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Ask a Question</CardTitle>
            {onToggleCollapse && (
              <Collapsible.Trigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={onToggleCollapse}
                  className="p-1 h-8 w-8"
                >
                  {isCollapsed ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </Button>
              </Collapsible.Trigger>
            )}
          </div>
        </CardHeader>
        
        <Collapsible.Content>
          <CardContent className="pt-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  className="min-h-[100px] resize-none bg-background text-foreground placeholder:text-muted-foreground border-input"
                  disabled={isLoading || disabled}
                />
                <div className="text-xs text-muted-foreground">
                  Press Enter to submit, Shift+Enter for new line
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  disabled={!query.trim() || isLoading || disabled}
                  className="min-w-[120px]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Collapsible.Content>
      </Collapsible.Root>
      
      {/* Show current query when collapsed */}
      {isCollapsed && currentQuery && (
        <CardContent className="border-t bg-muted/10">
          <div className="py-2">
            <span className="text-sm font-medium text-muted-foreground">Query:</span>
            <span className="text-sm text-muted-foreground/70 ml-2">{currentQuery}</span>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
