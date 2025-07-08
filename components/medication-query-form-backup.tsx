'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Send, ChevronDown, ChevronUp, Globe } from 'lucide-react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { useToast } from '@/hooks/use-toast'
import { ProgressIndicator, ProgressStep } from '@/components/ui/progress-indicator'
import { useAuth } from '@/contexts/AuthContext'
import { isLocalhost } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface QueryResponse {
  response: string
  medication: string | null
  intents: string[]
  fdaSections: string[]
  fdaData: any
  queryId?: string
}

interface FollowUpMessage {
  id: string
  type: 'question' | 'answer'
  content: string
  timestamp: Date
  citations?: Array<{
    title: string
    url: string
    snippet: string
    display_url: string
    position: number
  }>
  websearchUsed?: boolean
}

interface MedicationQueryFormProps {
  onQuerySaved?: (query: any) => void
  selectedQuery?: any
  newQueryTrigger?: number
}

export function MedicationQueryForm({ onQuerySaved, selectedQuery, newQueryTrigger }: MedicationQueryFormProps) {
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState<QueryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [followUpQuestion, setFollowUpQuestion] = useState('')
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false)
  const [followUpMessages, setFollowUpMessages] = useState<FollowUpMessage[]>([])
  const [currentQueryId, setCurrentQueryId] = useState<string | null>(null)
  const [websearchEnabled, setWebsearchEnabled] = useState(true)
  const [isDetailedExplanationOpen, setIsDetailedExplanationOpen] = useState(false)
  const [followUpDetailStates, setFollowUpDetailStates] = useState<{[key: string]: boolean}>({})
  const followUpRef = useRef<HTMLTextAreaElement>(null)
  const { toast } = useToast()
  const { session } = useAuth()
  
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([
    { id: 'identify', label: 'Identifying medication & intent', status: 'pending' },
    { id: 'search', label: 'Searching FDA documents', status: 'pending' },
    { id: 'generate', label: 'Generating query', status: 'pending' },
    { id: 'respond', label: 'Generating response', status: 'pending' },
  ])

  // Helper function to parse bottom line from response
  const parseBottomLine = (text: string) => {
    const bottomLineMatch = text.match(/\*\*Bottom Line:\*\*\s*([^*\n]+)/i)
    if (bottomLineMatch) {
      const bottomLine = bottomLineMatch[1].trim()
      const restOfText = text.replace(bottomLineMatch[0], '').trim()
      return { bottomLine, restOfText }
    }
    return { bottomLine: null, restOfText: text }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Simplified for testing
    console.log('Submit:', query)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Chat-style Query Input */}
      <div className="space-y-6">
        {!response && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold text-foreground mb-2">Ask about any medication</h1>
              <p className="text-muted-foreground">Get FDA-verified information about side effects, interactions, dosages, and more</p>
            </div>
            
            <form onSubmit={handleSubmit} className="relative">
              <div className="relative">
                <Textarea
                  placeholder="Ask any question about medications... (e.g., 'What are the side effects of ibuprofen?')"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[120px] resize-none bg-background border-2 border-border rounded-xl px-4 py-4 pr-16 text-base placeholder:text-muted-foreground/70"
                  disabled={isLoading}
                />
                <Button 
                  type="submit" 
                  disabled={isLoading || !query.trim()} 
                  className="absolute right-3 bottom-3 h-10 w-10 p-0 rounded-lg"
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Progress Indicator */}
      {isLoading && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing Your Query
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProgressIndicator steps={progressSteps} />
          </CardContent>
        </Card>
      )}

      {/* Chat-style Response Section */}
      {response && (
        <div className="space-y-6">
          {/* User Query Bubble */}
          <div className="flex justify-end">
            <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-3">
              <p className="text-sm">{query}</p>
            </div>
          </div>
          
          {/* AI Response Bubble */}
          <div className="flex justify-start">
            <div className="max-w-[85%] bg-muted/50 border rounded-2xl rounded-bl-md px-4 py-4 space-y-4">
              {response.medication && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Information about <strong>{response.medication}</strong></span>
                </div>
              )}
          
              {/* Main Response Content */}
              <div className="space-y-3">
                {(() => {
                  const { bottomLine, restOfText } = parseBottomLine(response.response)
                  return (
                    <>
                      {/* Summary - Always Visible */}
                      {bottomLine && (
                        <div className="text-sm leading-relaxed">
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {bottomLine}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                      
                      {/* Expandable Details */}
                      {restOfText && (
                        <Collapsible.Root open={isDetailedExplanationOpen} onOpenChange={setIsDetailedExplanationOpen}>
                          <Collapsible.Trigger asChild>
                            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2">
                              <span>Show details</span>
                              {isDetailedExplanationOpen ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </button>
                          </Collapsible.Trigger>
                          
                          <Collapsible.Content className="overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
                            <div className="mt-3 pt-3 border-t border-border/50">
                              <div className="text-sm text-muted-foreground leading-relaxed">
                                <div className="prose prose-sm max-w-none dark:prose-invert">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {restOfText}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            </div>
                          </Collapsible.Content>
                        </Collapsible.Root>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
