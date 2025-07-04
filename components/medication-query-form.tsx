'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Send, ChevronDown, ChevronUp } from 'lucide-react'
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
  const followUpRef = useRef<HTMLTextAreaElement>(null)
  const { toast } = useToast()
  const { session } = useAuth()
  
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([
    { id: 'identify', label: 'Identifying medication & intent', status: 'pending' },
    { id: 'search', label: 'Searching FDA documents', status: 'pending' },
    { id: 'generate', label: 'Generating query', status: 'pending' },
    { id: 'respond', label: 'Generating response', status: 'pending' },
  ])

  // Effect to handle selected query
  useEffect(() => {
    if (selectedQuery) {
      setQuery(selectedQuery.user_query)
      setResponse({
        response: selectedQuery.ai_response,
        medication: selectedQuery.medication_name,
        intents: selectedQuery.detected_intents,
        fdaSections: selectedQuery.fda_sections,
        fdaData: selectedQuery.fda_response || null,
        queryId: selectedQuery.id
      })
      setCurrentQueryId(selectedQuery.id)
      setIsCollapsed(true)
      
      // Load follow-up messages for this query
      loadFollowUpMessages(selectedQuery.id)
    }
  }, [selectedQuery])

  // Effect to handle new query trigger
  useEffect(() => {
    if (newQueryTrigger && newQueryTrigger > 0) {
      handleNewQuery()
    }
  }, [newQueryTrigger])

  // Helper function to load follow-up messages
  const loadFollowUpMessages = async (queryId: string) => {
    try {
      const headers: Record<string, string> = {}
      
      // Add authorization header for production (not localhost)
      if (!isLocalhost() && session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch(`/api/messages?queryId=${queryId}`, { headers })
      if (!response.ok) {
        throw new Error('Failed to fetch messages')
      }

      const data = await response.json()
      const messages = data.messages || []

      // Convert database messages to follow-up messages format
      const followUpMessages = messages.map((msg: any) => ({
        id: msg.id,
        type: msg.message_type,
        content: msg.content,
        timestamp: new Date(msg.created_at)
      }))

      setFollowUpMessages(followUpMessages)
    } catch (error) {
      console.error('Error loading follow-up messages:', error)
    }
  }

  // Helper function to start a new query
  const handleNewQuery = () => {
    setQuery('')
    setResponse(null)
    setFollowUpMessages([])
    setCurrentQueryId(null)
    setIsCollapsed(false)
    setFollowUpQuestion('')
    resetProgress()
  }

  // Helper function to get auth headers
  const getAuthHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    // Add authorization header for production (not localhost)
    if (!isLocalhost() && session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    
    return headers
  }

  const updateStepStatus = (stepId: string, status: ProgressStep['status']) => {
    setProgressSteps(prev => 
      prev.map(step => 
        step.id === stepId ? { ...step, status } : step
      )
    )
  }

  const resetProgress = () => {
    setProgressSteps([
      { id: 'identify', label: 'Identifying medication & intent', status: 'pending' },
      { id: 'search', label: 'Searching FDA documents', status: 'pending' },
      { id: 'generate', label: 'Generating query', status: 'pending' },
      { id: 'respond', label: 'Generating response', status: 'pending' },
    ])
  }

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
    
    if (!query.trim()) {
      toast({
        title: "Please enter a question",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    setResponse(null)
    setFollowUpMessages([])
    setCurrentQueryId(null)
    resetProgress()

    try {
      // Step 1: Extract medication name and intent
      updateStepStatus('identify', 'active')
      const extractResponse = await fetch('/api/extract-medication', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ query }),
      })

      if (!extractResponse.ok) {
        updateStepStatus('identify', 'error')
        throw new Error('Failed to extract medication and intent')
      }

      const { medication, intents, fdaSections } = await extractResponse.json()
      updateStepStatus('identify', 'completed')

      // Step 2: Generate AI response with FDA data
      updateStepStatus('search', 'active')
      
      setTimeout(() => {
        updateStepStatus('search', 'completed')
        updateStepStatus('generate', 'active')
      }, 500)

      const generateResponse = await fetch('/api/generate-response', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          query, 
          medication, 
          intents, 
          fdaSections 
        }),
      })

      if (!generateResponse.ok) {
        updateStepStatus('generate', 'error')
        throw new Error('Failed to generate response')
      }

      updateStepStatus('generate', 'completed')
      updateStepStatus('respond', 'active')

      const responseData = await generateResponse.json()
      setResponse(responseData)
      updateStepStatus('respond', 'completed')

      // Step 3: Save query to database
      try {
        const saveResponse = await fetch('/api/queries', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            userQuery: query,
            extractedMedication: medication,
            detectedIntents: intents,
            fdaSections: fdaSections,
            openfdaResponse: responseData.fdaData,
            aiResponse: responseData.response,
          }),
        })

        if (saveResponse.ok) {
          const savedQuery = await saveResponse.json()
          setCurrentQueryId(savedQuery.query.id)
          
          // Notify parent component to update query history
          if (onQuerySaved) {
            onQuerySaved(savedQuery.query)
          }
        }
      } catch (saveError) {
        console.error('Failed to save query:', saveError)
      }

      // Collapse the form after successful submission
      setIsCollapsed(true)

      toast({
        title: "Response generated successfully",
      })
    } catch (error) {
      console.error('Error processing query:', error)
      toast({
        title: "Error processing your question",
        description: "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!followUpQuestion.trim() || !currentQueryId) {
      return
    }

    setIsFollowUpLoading(true)

    try {
      const response = await fetch('/api/follow-up', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          queryId: currentQueryId,
          followUpQuestion: followUpQuestion.trim(),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get follow-up response')
      }

      const { response: followUpResponse } = await response.json()

      // Add both question and answer to the conversation
      setFollowUpMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          type: 'question',
          content: followUpQuestion.trim(),
          timestamp: new Date(),
        },
        {
          id: (Date.now() + 1).toString(),
          type: 'answer',
          content: followUpResponse,
          timestamp: new Date(),
        },
      ])

      setFollowUpQuestion('')
      
      toast({
        title: "Follow-up response generated",
      })
    } catch (error) {
      console.error('Error processing follow-up:', error)
      toast({
        title: "Error processing follow-up question",
        description: "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsFollowUpLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  const handleFollowUpKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleFollowUpSubmit(e as any)
    }
  }

  const startNewQuery = () => {
    setQuery('')
    setResponse(null)
    setIsCollapsed(false)
    setFollowUpMessages([])
    setCurrentQueryId(null)
    setFollowUpQuestion('')
    resetProgress()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Query Input Section */}
      <Card className="border-2 border-border">
        <CardHeader 
          className={`${isCollapsed ? 'cursor-pointer hover:bg-muted/50' : ''} transition-colors`}
          onClick={isCollapsed ? () => setIsCollapsed(false) : undefined}
        >
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isCollapsed && (
                <span className="text-lg">💊 Ask a Medication Question</span>
              )}
              {isCollapsed && response && (
                <span className="text-lg">💊 Medication Query</span>
              )}
              {isCollapsed && response && (
                <div className="text-sm font-normal text-muted-foreground bg-muted px-2 py-1 rounded">
                  Query complete
                </div>
              )}
            </div>
            {isCollapsed ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-sm font-normal">
                  Click to expand
                </span>
                <ChevronDown className="h-4 w-4" />
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(true)}
                className="text-muted-foreground hover:text-foreground"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        
        {!isCollapsed && (
          <CardContent className="border-t bg-muted/20">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Textarea
                  placeholder="Ask any question about medications, side effects, interactions, dosages, etc. For example: 'What are the side effects of ibuprofen?' or 'Can I take aspirin with food?'"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[100px] resize-none bg-background focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
                  disabled={isLoading}
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Press Ctrl+Enter to submit
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isLoading || !query.trim()}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Ask Question
                    </>
                  )}
                </Button>
                {response && (
                  <Button type="button" variant="outline" onClick={startNewQuery}>
                    Ask Another Question
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        )}

        {/* Show query as read-only text when collapsed and response exists */}
        {isCollapsed && response && query && (
          <CardContent className="border-t bg-muted/10">
            <div className="py-2">
              <span className="text-sm font-medium text-muted-foreground">Query:</span>
              <span className="text-sm text-muted-foreground/70 ml-2">{query}</span>
            </div>
          </CardContent>
        )}
      </Card>

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

      {/* Response Section */}
      {response && (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-lg">📋 Response</span>
              {response.medication && (
                <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-1 rounded">
                  Medication: {response.medication}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {(() => {
                const { bottomLine, restOfText } = parseBottomLine(response.response)
                return (
                  <div>
                    {bottomLine && (
                      <div className="mb-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg dark:bg-blue-950/50 dark:border-blue-400">
                        <div className="flex items-start gap-2">
                          <div className="bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                            TL;DR
                          </div>
                          <div className="font-medium text-blue-900 dark:text-blue-100">
                            {bottomLine}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground prose-blockquote:text-muted-foreground prose-code:text-foreground prose-pre:bg-muted prose-pre:text-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {restOfText}
                      </ReactMarkdown>
                    </div>
                  </div>
                )
              })()}
            </div>
            
            {response.fdaData && response.fdaData.results && (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">FDA Data Source</h4>
                <p className="text-sm text-muted-foreground">
                  This response includes official FDA drug labeling information.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Follow-up Messages */}
      {followUpMessages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex-1 border-t"></div>
            <span>💬 Follow-up Conversation</span>
            <div className="flex-1 border-t"></div>
          </div>
          {followUpMessages.map((message) => (
            <Card key={message.id} className={`${message.type === 'question' ? 'ml-8 border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-900/10' : 'mr-8 border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-900/10'}`}>
              <CardContent className="pt-4">
                {message.type === 'question' ? (
                  <div>
                    <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                      <span>❓</span>
                      Follow-up Question:
                    </div>
                    <div className="text-sm pl-6">{message.content}</div>
                  </div>
                ) : (
                  <div>
                    <div className="text-sm font-medium text-green-700 dark:text-green-300 mb-2 flex items-center gap-2">
                      <span>💡</span>
                      Follow-up Answer:
                    </div>
                    <div className="prose prose-sm max-w-none dark:prose-invert pl-6">
                      {(() => {
                        const { bottomLine, restOfText } = parseBottomLine(message.content)
                        return (
                          <div>
                            {bottomLine && (
                              <div className="mb-3 p-3 bg-green-50 border-l-4 border-green-500 rounded-r-lg dark:bg-green-950/50 dark:border-green-400">
                                <div className="flex items-start gap-2">
                                  <div className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                                    TL;DR
                                  </div>
                                  <div className="font-medium text-green-900 dark:text-green-100 text-sm">
                                    {bottomLine}
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="whitespace-pre-wrap text-sm">{restOfText}</div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Follow-up Input */}
      {response && currentQueryId && (
        <Card className="border-purple-200 bg-purple-50/30 dark:border-purple-800 dark:bg-purple-900/10">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span>💭</span>
              Follow-up Question
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFollowUpSubmit} className="space-y-4">
              <div>
                <Textarea
                  ref={followUpRef}
                  placeholder="Ask a follow-up question about this medication..."
                  value={followUpQuestion}
                  onChange={(e) => setFollowUpQuestion(e.target.value)}
                  onKeyDown={handleFollowUpKeyDown}
                  className="min-h-[60px] resize-none bg-background"
                  disabled={isFollowUpLoading}
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Press Ctrl+Enter to submit
                </p>
              </div>
              <Button 
                type="submit" 
                disabled={isFollowUpLoading || !followUpQuestion.trim()}
                size="sm"
              >
                {isFollowUpLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Ask Follow-up
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
