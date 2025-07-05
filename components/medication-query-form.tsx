'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Send, ChevronDown, ChevronUp, Globe, Search, Eye, EyeOff } from 'lucide-react'
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
  const [websearchEnabled, setWebsearchEnabled] = useState(false)
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
      const response = await fetch(websearchEnabled ? '/api/follow-up-websearch' : '/api/follow-up', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          queryId: currentQueryId,
          followUpQuestion: followUpQuestion.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get follow-up response')
      }

      const followUpResponse = data.response

      // Add both question and answer to messages
      setFollowUpMessages(prev => [
        ...prev,
        {
          id: `question-${Date.now()}`,
          type: 'question',
          content: followUpQuestion.trim(),
          timestamp: new Date(),
        },
        {
          id: `answer-${Date.now()}`,
          type: 'answer',
          content: followUpResponse,
          timestamp: new Date(),
          websearchUsed: data.websearchUsed || websearchEnabled,
          citations: data.citations || [],
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
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold">📋 Response</span>
            {response.medication && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">for</span>
                <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 py-1 rounded-full text-sm font-medium shadow-sm">
                  {response.medication}
                </span>
              </div>
            )}
          </div>
          
          {(() => {
            const { bottomLine, restOfText } = parseBottomLine(response.response)
            return (
              <div className="space-y-4">
                {/* Bottom Line - Always Visible */}
                {bottomLine && (
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-sm dark:from-blue-950/30 dark:to-indigo-950/30 dark:border-blue-800/50">
                    <div className="flex items-start gap-3">
                      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
                        SUMMARY
                      </div>
                      <div className="font-semibold text-blue-900 dark:text-blue-100 text-base leading-relaxed">
                        {bottomLine}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Collapsible Detailed Explanation */}
                <Collapsible.Root open={isDetailedExplanationOpen} onOpenChange={setIsDetailedExplanationOpen}>
                  <Collapsible.Trigger asChild>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-between p-3 h-auto bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg transition-all duration-200"
                    >
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm">
                        {isDetailedExplanationOpen ? (
                          <>
                            <EyeOff className="h-3 w-3" />
                            <span className="font-medium">Hide Details</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-3 w-3" />
                            <span className="font-medium">Show Detailed Explanation</span>
                          </>
                        )}
                      </div>
                      {isDetailedExplanationOpen ? (
                        <ChevronUp className="h-3 w-3 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-slate-500" />
                      )}
                    </Button>
                  </Collapsible.Trigger>
                  
                  <Collapsible.Content className="data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp overflow-hidden">
                    <div className="p-4 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/30 dark:to-gray-900/30 border border-slate-200 dark:border-slate-700 rounded-xl shadow-inner mt-2">
                      <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-slate-800 dark:prose-headings:text-slate-200 prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-strong:font-bold prose-ul:text-slate-700 dark:prose-ul:text-slate-300 prose-ol:text-slate-700 dark:prose-ol:text-slate-300 prose-li:text-slate-700 dark:prose-li:text-slate-300 prose-blockquote:text-slate-600 dark:prose-blockquote:text-slate-400 prose-blockquote:border-slate-300 dark:prose-blockquote:border-slate-600 prose-code:text-slate-800 dark:prose-code:text-slate-200 prose-code:bg-slate-200 dark:prose-code:bg-slate-800 prose-pre:bg-slate-100 dark:prose-pre:bg-slate-800 prose-pre:text-slate-800 dark:prose-pre:text-slate-200 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:font-medium hover:prose-a:text-blue-800 dark:hover:prose-a:text-blue-300">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {restOfText}
                        </ReactMarkdown>
                      </div>
                      
                      {/* FDA Data Source Info - Moved inside details */}
                      {response.fdaData && response.fdaData.results && (
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
                          <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                            <div className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded text-blue-700 dark:text-blue-300 font-medium">
                              FDA SOURCE
                            </div>
                            <div className="flex-1">
                              <p className="mb-1">
                                This response includes official FDA drug labeling information from the FDA's National Drug Code Directory and drug labeling database.
                              </p>
                              <a 
                                href={`https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=${encodeURIComponent(response.medication || '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline font-medium"
                              >
                                View official FDA labeling on DailyMed →
                              </a>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </Collapsible.Content>
                </Collapsible.Root>
              </div>
            )
          })()}
      </div>
      )}

      {/* Follow-up Messages */}
      {followUpMessages.length > 0 && (
        <div className="space-y-6">
          {followUpMessages.map((message) => (
            <div key={message.id} className="space-y-3">
              {message.type === 'question' && (
                <div className="flex items-start gap-3">
                  <span className="text-lg">❓</span>
                  <div className="flex-1">
                    <p className="text-foreground font-medium">{message.content}</p>
                  </div>
                </div>
              )}
              
              {message.type === 'answer' && (
                <div className="flex items-start gap-3">
                  <span className="text-lg">💡</span>
                  <div className="flex-1 space-y-3">
                    {(() => {
                      const { bottomLine, restOfText } = parseBottomLine(message.content)
                      return (
                        <div>
                          {/* Always visible summary */}
                          {bottomLine && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                              <p className="text-blue-900 dark:text-blue-100 font-medium">
                                <strong>Bottom Line:</strong> {bottomLine}
                              </p>
                            </div>
                          )}
                          
                          {/* Collapsible detailed explanation */}
                          {restOfText && (
                            <Collapsible.Root 
                              open={followUpDetailStates[message.id] || false}
                              onOpenChange={(open) => 
                                setFollowUpDetailStates(prev => ({ ...prev, [message.id]: open }))
                              }
                            >
                              <Collapsible.Trigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground p-0 h-auto font-normal"
                                >
                                  {followUpDetailStates[message.id] ? (
                                    <>
                                      <EyeOff className="h-4 w-4" />
                                      <ChevronUp className="h-4 w-4" />
                                      Hide Details
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="h-4 w-4" />
                                      <ChevronDown className="h-4 w-4" />
                                      Show Details
                                    </>
                                  )}
                                </Button>
                              </Collapsible.Trigger>
                              
                              <Collapsible.Content className="data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp overflow-hidden">
                                <div className="p-3 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/30 dark:to-gray-900/30 border border-slate-200 dark:border-slate-700 rounded-lg shadow-inner mt-2">
                                  <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-slate-800 dark:prose-headings:text-slate-200 prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-strong:font-bold prose-ul:text-slate-700 dark:prose-ul:text-slate-300 prose-ol:text-slate-700 dark:prose-ol:text-slate-300 prose-li:text-slate-700 dark:prose-li:text-slate-300 prose-blockquote:text-slate-600 dark:prose-blockquote:text-slate-400 prose-blockquote:border-slate-300 dark:prose-blockquote:border-slate-600 prose-code:text-slate-800 dark:prose-code:text-slate-200 prose-code:bg-slate-200 dark:prose-code:bg-slate-800 prose-pre:bg-slate-100 dark:prose-pre:bg-slate-800 prose-pre:text-slate-800 dark:prose-pre:text-slate-200 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:font-medium hover:prose-a:text-blue-800 dark:hover:prose-a:text-blue-300">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {restOfText}
                                    </ReactMarkdown>
                                  </div>
                                  
                                  {/* Citations for follow-up answers */}
                                  {message.citations && message.citations.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Sources:</h4>
                                      <ol className="space-y-1">
                                        {message.citations.map((citation: any, index: number) => (
                                          <li key={index} className="text-sm">
                                            <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium mr-2">
                                              {index + 1}
                                            </span>
                                            <a 
                                              href={citation.url} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium underline decoration-blue-300 dark:decoration-blue-600 underline-offset-2"
                                            >
                                              {citation.title}
                                            </a>
                                          </li>
                                        ))}
                                      </ol>
                                    </div>
                                  )}
                                </div>
                              </Collapsible.Content>
                            </Collapsible.Root>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Follow-up Input - Simplified Chat Style */}
      {response && currentQueryId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={() => setWebsearchEnabled(!websearchEnabled)}
              className="text-muted-foreground hover:text-foreground"
            >
              {websearchEnabled ? (
                <>
                  <Globe className="mr-2 h-4 w-4" />
                  Web Search: On
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Web Search: Off
                </>
              )}
            </Button>
          </div>
          
          <form onSubmit={handleFollowUpSubmit} className="relative">
            <Textarea
              ref={followUpRef}
              placeholder="Ask a follow-up question..."
              value={followUpQuestion}
              onChange={(e) => setFollowUpQuestion(e.target.value)}
              onKeyDown={handleFollowUpKeyDown}
              className="min-h-[60px] resize-none bg-background pr-12"
              disabled={isFollowUpLoading}
            />
            <Button 
              type="submit" 
              size="sm"
              disabled={!followUpQuestion.trim() || isFollowUpLoading}
              className="absolute right-2 bottom-2 h-8 w-8 p-0"
            >
              {isFollowUpLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
