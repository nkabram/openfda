'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Send, ChevronDown, ChevronUp, Globe, Pill } from 'lucide-react'
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
  isAdminView?: boolean
  viewOnlyQuery?: any
}

export function MedicationQueryForm({ onQuerySaved, selectedQuery, newQueryTrigger, isAdminView = false, viewOnlyQuery }: MedicationQueryFormProps) {
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState<QueryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [followUpQuestion, setFollowUpQuestion] = useState('')
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false)
  const [followUpMessages, setFollowUpMessages] = useState<FollowUpMessage[]>([])
  const [currentQueryId, setCurrentQueryId] = useState<string | null>(null)
  const [websearchEnabled, setWebsearchEnabled] = useState(false)
  const [fdaDocsEnabled, setFdaDocsEnabled] = useState(true)
  const [followUpMode, setFollowUpMode] = useState<'fda_docs' | 'websearch' | 'llm_only'>('fda_docs')
  const [isDetailedExplanationOpen, setIsDetailedExplanationOpen] = useState(false)
  const [followUpDetailStates, setFollowUpDetailStates] = useState<{[key: string]: boolean}>({})
  const [needsMoreInfoPrompt, setNeedsMoreInfoPrompt] = useState<{
    show: boolean
    searchedSections: string[]
    medication: string
    originalQuestion: string
  } | null>(null)
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

  // Effect to handle view-only query for admin
  useEffect(() => {
    if (viewOnlyQuery) {
      setQuery(viewOnlyQuery.user_query)
      setResponse({
        response: viewOnlyQuery.ai_response,
        medication: viewOnlyQuery.medication_name,
        intents: viewOnlyQuery.detected_intents || [],
        fdaSections: viewOnlyQuery.fda_sections_used || [],
        fdaData: viewOnlyQuery.fda_response || null,
        queryId: viewOnlyQuery.id
      })
      setCurrentQueryId(viewOnlyQuery.id)
      setIsCollapsed(true)
      
      // Load follow-up messages for this query
      loadFollowUpMessages(viewOnlyQuery.id)
    }
  }, [viewOnlyQuery])

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
      
      // Always add authorization header if session exists
      if (session?.access_token) {
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
    
    // Always add authorization header if session exists
    if (session?.access_token) {
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

  // Mode switching functions
  const handleFdaDocsToggle = () => {
    if (!fdaDocsEnabled) {
      setFdaDocsEnabled(true)
      setWebsearchEnabled(false)
      setFollowUpMode('fda_docs')
    } else {
      setFdaDocsEnabled(false)
      if (!websearchEnabled) {
        setFollowUpMode('llm_only')
      }
    }
  }

  const handleWebsearchToggle = () => {
    if (!websearchEnabled) {
      setWebsearchEnabled(true)
      setFdaDocsEnabled(false)
      setFollowUpMode('websearch')
    } else {
      setWebsearchEnabled(false)
      if (!fdaDocsEnabled) {
        setFollowUpMode('llm_only')
      }
    }
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
          fdaSections,
          saveToDatabase: true
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

      // Set the query ID from the response (saved by generate-response API)
      if (responseData.queryId) {
        setCurrentQueryId(responseData.queryId)
        
        // Notify parent component to update query history if needed
        if (onQuerySaved) {
          // Create a query object for the parent component
          const queryForParent = {
            id: responseData.queryId,
            user_query: query,
            medication_name: responseData.medication,
            detected_intents: responseData.intents,
            fda_sections: responseData.fdaSections,
            fda_response: responseData.fdaData,
            ai_response: responseData.response,
            created_at: new Date().toISOString()
          }
          onQuerySaved(queryForParent)
        }
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
      let apiEndpoint = '/api/follow-up'
      let requestBody: any = {
        queryId: currentQueryId,
        followUpQuestion: followUpQuestion.trim(),
      }

      // Choose API endpoint based on follow-up mode
      if (followUpMode === 'websearch') {
        apiEndpoint = '/api/follow-up-websearch'
      } else if (followUpMode === 'fda_docs') {
        apiEndpoint = '/api/follow-up-fda'
        requestBody.mode = 'fda_docs'
      } else if (followUpMode === 'llm_only') {
        apiEndpoint = '/api/follow-up-fda'
        requestBody.mode = 'llm_only'
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get follow-up response')
      }

      const followUpResponse = data.response

      // Check if more info is needed and show prompt
      if (data.needsMoreInfo && followUpMode === 'fda_docs') {
        setNeedsMoreInfoPrompt({
          show: true,
          searchedSections: data.searchedSections || [],
          medication: data.medication || 'the medication',
          originalQuestion: followUpQuestion.trim()
        })
      } else {
        // Clear any existing prompt
        setNeedsMoreInfoPrompt(null)
      }

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
          websearchUsed: data.websearchUsed || followUpMode === 'websearch',
          citations: data.citations || [],
        },
      ])

      setFollowUpQuestion('')
      
      toast({
        title: "Follow-up response generated",
        description: followUpMode === 'fda_docs' ? 'Using saved FDA documentation' : 
                    followUpMode === 'websearch' ? 'Using web search' : 
                    'Using general knowledge'
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
    if (e.key === 'Enter' && !e.shiftKey) {
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
    setNeedsMoreInfoPrompt(null)
    resetProgress()
  }

  const handleNewFDASearch = async () => {
    if (!needsMoreInfoPrompt) return
    
    // Dismiss the prompt
    setNeedsMoreInfoPrompt(null)
    
    // Set the query to the original question and trigger a new search
    setQuery(needsMoreInfoPrompt.originalQuestion)
    setResponse(null)
    setIsCollapsed(false)
    setFollowUpMessages([])
    setCurrentQueryId(null)
    setFollowUpQuestion('')
    
    // Auto-submit the query
    setTimeout(() => {
      const form = document.querySelector('form')
      if (form) {
        form.requestSubmit()
      }
    }, 100)
  }

  const handleNewWebSearch = () => {
    if (!needsMoreInfoPrompt) return
    
    // Dismiss the prompt and switch to web search mode
    setNeedsMoreInfoPrompt(null)
    setFollowUpMode('websearch')
    setFollowUpQuestion(needsMoreInfoPrompt.originalQuestion)
    
    // Focus the follow-up input
    setTimeout(() => {
      followUpRef.current?.focus()
    }, 100)
  }

  const dismissMoreInfoPrompt = () => {
    setNeedsMoreInfoPrompt(null)
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
                <span className="text-lg">
                  💊 {isAdminView ? 'View Query' : 'Ask a Medication Question'}
                </span>
              )}
              {isCollapsed && response && (
                <span className="text-lg">💊 Medication Query</span>
              )}
              {isCollapsed && response && (
                <div className="text-sm font-normal text-muted-foreground bg-muted px-2 py-1 rounded">
                  Query complete
                </div>
              )}
              {isAdminView && (
                <div className="text-sm font-normal text-blue-600 bg-blue-100 px-2 py-1 rounded dark:text-blue-400 dark:bg-blue-900/50">
                  Admin View (Read Only)
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
            {/* User Information in Admin View */}
            {isAdminView && (selectedQuery?.profiles || viewOnlyQuery) && (() => {
              const queryData = viewOnlyQuery || selectedQuery
              const userInfo = selectedQuery?.profiles || {
                full_name: viewOnlyQuery?.full_name,
                email: viewOnlyQuery?.email
              }
              
              return (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-blue-700 dark:text-blue-300">User:</span>
                    <span className="text-blue-600 dark:text-blue-400">
                      {userInfo?.full_name || userInfo?.email || 'Unknown User'}
                    </span>
                    {userInfo?.full_name && userInfo?.email && (
                      <span className="text-blue-500 dark:text-blue-400 text-xs">({userInfo.email})</span>
                    )}
                    <span className="text-blue-500 dark:text-blue-400 text-xs ml-auto">
                      {new Date(queryData.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              )
            })()}
            
            {!isAdminView ? (
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
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    User's Question:
                  </label>
                  <div className="min-h-[100px] p-3 bg-muted/50 rounded-md border text-sm">
                    {viewOnlyQuery?.user_query || selectedQuery?.user_query || query}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  This query is read-only in admin view. Use "Create Personal Query" to ask your own questions.
                </div>
              </div>
            )}
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
            <span className="text-lg font-semibold">Response</span>
            {response.medication && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">for {response.medication}</span>
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
                    <div className="font-semibold text-blue-900 dark:text-blue-100 text-base leading-relaxed">
                      {bottomLine}
                    </div>
                  </div>
                )}
                
                {/* Collapsible Detailed Explanation */}
                <Collapsible.Root open={isDetailedExplanationOpen} onOpenChange={setIsDetailedExplanationOpen}>
                  <Collapsible.Trigger asChild>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-center p-2 h-auto hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all duration-200"
                    >
                      <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 text-xs">
                        <span className="font-medium">Show detailed explanation</span>
                        {isDetailedExplanationOpen ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </div>
                    </Button>
                  </Collapsible.Trigger>
                  
                  <Collapsible.Content className="data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp overflow-hidden">
                    <div className="p-4 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/30 dark:to-gray-900/30 border border-slate-200 dark:border-slate-700 rounded-xl shadow-inner mt-2">
                      <div className="prose prose-sm max-w-none dark:prose-invert
                        prose-headings:text-slate-900 dark:prose-headings:text-slate-100 prose-headings:font-semibold prose-headings:mb-3 prose-headings:mt-4 first:prose-headings:mt-0
                        prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-4
                        prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-strong:font-semibold
                        prose-ul:text-slate-700 dark:prose-ul:text-slate-300 prose-ul:mb-4 prose-ul:space-y-1
                        prose-ol:text-slate-700 dark:prose-ol:text-slate-300 prose-ol:mb-4 prose-ol:space-y-1
                        prose-li:text-slate-700 dark:prose-li:text-slate-300 prose-li:leading-relaxed
                        prose-blockquote:text-slate-600 dark:prose-blockquote:text-slate-400 prose-blockquote:border-slate-300 dark:prose-blockquote:border-slate-600 prose-blockquote:bg-slate-100/50 dark:prose-blockquote:bg-slate-800/50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded
                        prose-code:text-slate-800 dark:prose-code:text-slate-200 prose-code:bg-slate-200 dark:prose-code:bg-slate-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                        prose-pre:bg-slate-100 dark:prose-pre:bg-slate-800 prose-pre:text-slate-800 dark:prose-pre:text-slate-200 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto
                        prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:font-medium prose-a:no-underline hover:prose-a:text-blue-800 dark:hover:prose-a:text-blue-300 hover:prose-a:underline
                        prose-hr:border-slate-300 dark:prose-hr:border-slate-600 prose-hr:my-6
                        [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                            h1: ({ children }) => <h1 className="text-lg font-semibold mb-3 mt-6 first:mt-0">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-base font-semibold mb-3 mt-5 first:mt-0">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-semibold mb-2 mt-4 first:mt-0">{children}</h3>,
                            ul: ({ children }) => <ul className="mb-4 space-y-1 pl-4">{children}</ul>,
                            ol: ({ children }) => <ol className="mb-4 space-y-1 pl-4">{children}</ol>,
                            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                          }}
                        >
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
                  <div className="flex-1">
                    <p className="text-foreground font-medium">{message.content}</p>
                  </div>
                </div>
              )}
              
              {message.type === 'answer' && (
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-3">
                    {(() => {
                      const { bottomLine, restOfText } = parseBottomLine(message.content)
                      return (
                        <div>
                          {/* Always visible summary */}
                          {bottomLine && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                              <p className="text-blue-900 dark:text-blue-100 font-medium">
                                {bottomLine}
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
                                  className="w-full justify-center p-2 h-auto hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all duration-200"
                                >
                                  <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 text-xs">
                                    <span className="font-medium">Show detailed explanation</span>
                                    {followUpDetailStates[message.id] ? (
                                      <ChevronUp className="h-3 w-3" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3" />
                                    )}
                                  </div>
                                </Button>
                              </Collapsible.Trigger>
                              
                              <Collapsible.Content className="data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp overflow-hidden">
                                <div className="p-4 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/30 dark:to-gray-900/30 border border-slate-200 dark:border-slate-700 rounded-xl shadow-inner mt-2">
                                  <div className="prose prose-sm max-w-none dark:prose-invert
                                    prose-headings:text-slate-900 dark:prose-headings:text-slate-100 prose-headings:font-semibold prose-headings:mb-3 prose-headings:mt-4 first:prose-headings:mt-0
                                    prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-4
                                    prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-strong:font-semibold
                                    prose-ul:text-slate-700 dark:prose-ul:text-slate-300 prose-ul:mb-4 prose-ul:space-y-1
                                    prose-ol:text-slate-700 dark:prose-ol:text-slate-300 prose-ol:mb-4 prose-ol:space-y-1
                                    prose-li:text-slate-700 dark:prose-li:text-slate-300 prose-li:leading-relaxed
                                    prose-blockquote:text-slate-600 dark:prose-blockquote:text-slate-400 prose-blockquote:border-slate-300 dark:prose-blockquote:border-slate-600 prose-blockquote:bg-slate-100/50 dark:prose-blockquote:bg-slate-800/50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded
                                    prose-code:text-slate-800 dark:prose-code:text-slate-200 prose-code:bg-slate-200 dark:prose-code:bg-slate-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                                    prose-pre:bg-slate-100 dark:prose-pre:bg-slate-800 prose-pre:text-slate-800 dark:prose-pre:text-slate-200 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto
                                    prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:font-medium prose-a:no-underline hover:prose-a:text-blue-800 dark:hover:prose-a:text-blue-300 hover:prose-a:underline
                                    prose-hr:border-slate-300 dark:prose-hr:border-slate-600 prose-hr:my-6
                                    [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                                    <ReactMarkdown 
                                      remarkPlugins={[remarkGfm]}
                                      components={{
                                        p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                                        h1: ({ children }) => <h1 className="text-lg font-semibold mb-3 mt-6 first:mt-0">{children}</h1>,
                                        h2: ({ children }) => <h2 className="text-base font-semibold mb-3 mt-5 first:mt-0">{children}</h2>,
                                        h3: ({ children }) => <h3 className="text-sm font-semibold mb-2 mt-4 first:mt-0">{children}</h3>,
                                        ul: ({ children }) => <ul className="mb-4 space-y-1 pl-4">{children}</ul>,
                                        ol: ({ children }) => <ol className="mb-4 space-y-1 pl-4">{children}</ol>,
                                        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                      }}
                                    >
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

      {/* Need More Info Prompt */}
      {needsMoreInfoPrompt?.show && (
        <Card className="border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                <span className="text-slate-600 dark:text-slate-400 text-sm font-bold">!</span>
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    Information not found in saved FDA sections
                  </h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                    I couldn't find information about "{needsMoreInfoPrompt.originalQuestion}" for {needsMoreInfoPrompt.medication} in the limited sections found in the previous search.
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    I recommend doing one of the following actions:
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleNewFDASearch}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600"
                  >
                    <Pill className="h-4 w-4 mr-2" />
                    New FDA Search
                  </Button>
                  <Button
                    onClick={handleNewWebSearch}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600"
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    Web Search Instead
                  </Button>
                  <Button
                    onClick={dismissMoreInfoPrompt}
                    size="sm"
                    variant="outline"
                    className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Continue Anyway
                  </Button>
                </div>
                
                <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                  💡 Tip: You can also just type a new follow-up question below to dismiss this prompt
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Follow-up Input - Simplified Chat Style */}
      {response && currentQueryId && !isAdminView && (
        <div className="space-y-4">
          <form onSubmit={handleFollowUpSubmit} className="relative">
            <Textarea
              ref={followUpRef}
              placeholder="Ask a follow-up question..."
              value={followUpQuestion}
              onChange={(e) => {
                setFollowUpQuestion(e.target.value)
                // Dismiss the more info prompt when user starts typing
                if (needsMoreInfoPrompt?.show && e.target.value.trim()) {
                  setNeedsMoreInfoPrompt(null)
                }
              }}
              onKeyDown={handleFollowUpKeyDown}
              className="min-h-[60px] resize-none bg-background pr-20"
              disabled={isFollowUpLoading}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              {/* FDA Docs Toggle */}
              <Button 
                type="button" 
                size="sm"
                onClick={handleFdaDocsToggle}
                className={`h-8 w-8 p-0 ${
                  followUpMode === 'fda_docs'
                    ? 'bg-green-100 hover:bg-green-200 text-green-600 dark:bg-green-900/50 dark:hover:bg-green-800/50 dark:text-green-400' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-500 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-400'
                }`}
                title={followUpMode === 'fda_docs' ? 'Using FDA documentation' : 'Click to use FDA documentation'}
              >
                <Pill className="h-4 w-4" />
              </Button>
              
              {/* Web Search Toggle */}
              <Button 
                type="button" 
                size="sm"
                onClick={handleWebsearchToggle}
                className={`h-8 w-8 p-0 ${
                  followUpMode === 'websearch'
                    ? 'bg-blue-100 hover:bg-blue-200 text-blue-600 dark:bg-blue-900/50 dark:hover:bg-blue-800/50 dark:text-blue-400' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-500 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-400'
                }`}
                title={followUpMode === 'websearch' ? 'Using web search' : 'Click to use web search'}
              >
                <Globe className="h-4 w-4" />
              </Button>
              
              {/* LLM Only Toggle */}
              <Button 
                type="button" 
                size="sm"
                onClick={() => {
                  setFdaDocsEnabled(false)
                  setWebsearchEnabled(false)
                  setFollowUpMode('llm_only')
                }}
                className={`h-8 w-8 p-0 ${
                  followUpMode === 'llm_only'
                    ? 'bg-purple-100 hover:bg-purple-200 text-purple-600 dark:bg-purple-900/50 dark:hover:bg-purple-800/50 dark:text-purple-400' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-500 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-400'
                }`}
                title={followUpMode === 'llm_only' ? 'Using general knowledge only' : 'Click to use general knowledge only'}
              >
                <span className="text-xs font-bold">AI</span>
              </Button>
              <Button 
                type="submit" 
                size="sm"
                disabled={!followUpQuestion.trim() || isFollowUpLoading}
                className="h-8 w-8 p-0"
              >
                {isFollowUpLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
