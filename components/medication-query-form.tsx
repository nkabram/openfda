'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { ChevronDown, ChevronUp, Loader2, Send, HelpCircle, ArrowUp, MessageCircleQuestion, CircleHelp, Pill, Globe } from 'lucide-react'
import * as Collapsible from '@radix-ui/react-collapsible'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import SmartFollowUpInput from '@/components/SmartFollowUpInput'
import { useQuerySubmission } from '@/hooks/useQuerySubmission'
import { QueryInputForm } from '@/components/query/QueryInputForm'
import { QueryResponse } from '@/components/query/QueryResponse'
import { QueryProgress } from '@/components/query/QueryProgress'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'

interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

interface MedicationQueryResponse {
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
  // Use the custom hook for query submission logic
  const {
    submitQuery,
    clearResponse,
    isLoading,
    response,
    currentQueryId,
    progressSteps,
    setResponse,
    setCurrentQueryId,
    setProgressSteps
  } = useQuerySubmission({ onQuerySaved, isAdminView })

  // Local state for UI management
  const [query, setQuery] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [followUpMessages, setFollowUpMessages] = useState<FollowUpMessage[]>([])
  const [isDetailedExplanationOpen, setIsDetailedExplanationOpen] = useState(false)
  const [followUpDetailStates, setFollowUpDetailStates] = useState<{[key: string]: boolean}>({})
  const [needsMoreInfoPrompt, setNeedsMoreInfoPrompt] = useState<{
    show: boolean
    searchedSections: string[]
    medication: string
    originalQuestion: string
  } | null>(null)

  // Hooks
  const { toast } = useToast()
  const { session } = useAuth()

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
        timestamp: new Date(msg.created_at),
        citations: msg.citations || [],
        websearchUsed: msg.websearch_enabled || false
      }))

      setFollowUpMessages(followUpMessages)
    } catch (error) {
      console.error('Error loading follow-up messages:', error)
    }
  }

  // Helper function to start a new query
  const handleNewQuery = () => {
    setQuery('')
    clearResponse()
    setFollowUpMessages([])
    setIsCollapsed(false)
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

  // Note: Mode switching is now handled by SmartFollowUpInput component

  const parseBottomLine = (text: string) => {
    // Try formatted version first (with asterisks)
    let bottomLineMatch = text.match(/\*\*Bottom Line:\*\*\s*([^*\n]+)/i)
    if (bottomLineMatch) {
      const bottomLine = bottomLineMatch[1].trim()
      const restOfText = text.replace(bottomLineMatch[0], '').trim()
      return { bottomLine, restOfText }
    }
    
    // Try unformatted version (without asterisks)
    bottomLineMatch = text.match(/Bottom line:\s*([^\n]+)/i)
    if (bottomLineMatch) {
      const bottomLine = bottomLineMatch[1].trim()
      const restOfText = text.replace(bottomLineMatch[0], '').trim()
      return { bottomLine, restOfText }
    }
    
    return { bottomLine: null, restOfText: text }
  }

  const handleSuggestedQuestion = (suggestedQuery: string) => {
    setQuery(suggestedQuery)
    // Optionally auto-submit the suggested question
    // You can uncomment the next line if you want auto-submission
    // setTimeout(() => handleSubmit({ preventDefault: () => {} } as React.FormEvent), 100)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!query.trim()) {
      return
    }

    // Clear follow-up messages when starting new query
    setFollowUpMessages([])
    
    // Use the hook's submitQuery function
    const result = await submitQuery(query)
    
    if (result) {
      // Collapse the form after successful submission
      setIsCollapsed(true)
    }
  }

  // Handler for smart follow-up input component
  const handleSmartFollowUpAdded = async (newMessages: FollowUpMessage[]) => {
    // Since the API saves messages to database, reload from database instead of adding locally
    // This prevents duplication when messages are loaded from database
    if (currentQueryId) {
      await loadFollowUpMessages(currentQueryId)
    }
    
    // Clear any existing "needs more info" prompt since we have a new response
    setNeedsMoreInfoPrompt(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  const startNewQuery = () => {
    setQuery('')
    clearResponse()
    setIsCollapsed(false)
    setFollowUpMessages([])
    setNeedsMoreInfoPrompt(null)
  }

  const handleNewFDASearch = async () => {
    if (!needsMoreInfoPrompt) return
    
    // Dismiss the prompt
    setNeedsMoreInfoPrompt(null)
    
    // Set the query to the original question and trigger a new search
    setQuery(needsMoreInfoPrompt.originalQuestion)
    clearResponse()
    setIsCollapsed(false)
    setFollowUpMessages([])
    
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
    
    // Dismiss the prompt - SmartFollowUpInput will handle web search
    setNeedsMoreInfoPrompt(null)
  }

  const dismissMoreInfoPrompt = () => {
    setNeedsMoreInfoPrompt(null)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Query Input Section */}
      <Card className="border-0 shadow-none">
        <CardContent className="p-6 bg-background">
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
                <div className="relative">
                  <Textarea
                    placeholder="Ask a medication question"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="min-h-[120px] resize-none bg-background text-foreground placeholder:text-muted-foreground border-input focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
                    disabled={isLoading}
                  />
                </div>
                {response && (
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" onClick={startNewQuery} className="border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950">
                      Ask Another Question
                    </Button>
                  </div>
                )}
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


        {isLoading && (
          <CardContent>
            <QueryProgress 
              steps={progressSteps}
              isVisible={true}
              title="Processing Your Query"
            />
          </CardContent>
        )}
      </Card>

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
                  <div className="space-y-3">
                    <div className="p-4 bg-gradient-to-r from-sky-50 to-sky-100 border border-sky-200 rounded-xl shadow-sm dark:from-sky-950/30 dark:to-sky-900/30 dark:border-sky-800/50">
                      <div className="font-semibold text-sky-900 dark:text-sky-100 text-base leading-relaxed">
                        {bottomLine}
                      </div>
                    </div>
                    
                    {/* More details section with fixed button position */}
                    <Collapsible.Root open={isDetailedExplanationOpen} onOpenChange={setIsDetailedExplanationOpen}>
                      <div className="flex justify-end">
                        <Collapsible.Trigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 h-auto p-1 text-xs"
                          >
                            <div className="flex items-center gap-1">
                              <span className="font-medium">More details</span>
                              {isDetailedExplanationOpen ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </div>
                          </Button>
                        </Collapsible.Trigger>
                      </div>
                  
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
                                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      This response was generated using data from the FDA. For complete and official information, please refer to the official labeling.
                                    </p>
                                    <div className="mt-2 text-xs">
                                      <a 
                                        href={`https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=${response.medication}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline font-medium"
                                      >
                                        View official FDA labeling on DailyMed →
                                      </a>
                                    </div>
                                  </div>

                                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">FDA Sections Used:</h4>
                                    <ul className="flex flex-wrap gap-2">
                                      {response.fdaSections?.map((section, index) => (
                                        <li key={index} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded px-2 py-1 font-mono">
                                          {section}
                                        </li>
                                      )) || []}
                                    </ul>
                                  </div>

                                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Suggested Questions:</h4>
                                    <ul className="list-disc pl-5 space-y-1">
                                      {response.intents.map((intent, index) => (
                                        <li key={index} className="text-sm">
                                          <button 
                                            onClick={() => handleSuggestedQuestion(intent)}
                                            className="text-left w-full text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                                          >
                                            {intent}
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </Collapsible.Content>
                    </Collapsible.Root>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Follow-up Messages */}
      {followUpMessages && followUpMessages.length > 0 && (
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
                  <div className="flex-1">
                    {(() => {
                      const { bottomLine, restOfText } = parseBottomLine(message.content)
                      return (
                        <div className="space-y-3">
                          {/* Summary and collapsible section in one container */}
                          <div className="relative">
                            {/* Always visible summary */}
                            {bottomLine && (
                              <div className="p-3 bg-gradient-to-r from-sky-50 to-sky-100 border border-sky-200 rounded-lg shadow-sm dark:from-sky-950/30 dark:to-sky-900/30 dark:border-sky-800/50">
                                <p className="text-sky-900 dark:text-sky-100 font-medium">
                                  {bottomLine}
                                </p>
                              </div>
                            )}
                            
                            {/* Collapsible content */}
                            {restOfText && (
                              <Collapsible.Root 
                                open={followUpDetailStates[message.id] || false}
                                onOpenChange={(open) => 
                                  setFollowUpDetailStates(prev => ({ ...prev, [message.id]: open }))
                                }
                                className="mt-2"
                              >
                                <div className="relative">
                                  {/* Toggle button - now at the top */}
                                  <div className="flex justify-end mb-1">
                                    <Collapsible.Trigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 h-auto p-1 text-xs transition-colors"
                                      >
                                        <div className="flex items-center gap-1">
                                          <span className="font-medium">
                                            {followUpDetailStates[message.id] ? 'Hide details' : 'More details'}
                                          </span>
                                          {followUpDetailStates[message.id] ? (
                                            <ChevronUp className="h-3 w-3" />
                                          ) : (
                                            <ChevronDown className="h-3 w-3" />
                                          )}
                                        </div>
                                      </Button>
                                    </Collapsible.Trigger>
                                  </div>

                                  {/* Content that expands/collapses */}
                                  <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                                    {followUpDetailStates[message.id] && (
                                      <div className="p-4 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/30 dark:to-gray-900/30 border border-slate-200 dark:border-slate-700 rounded-xl shadow-inner">
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
                                            <ol className="space-y-1 list-decimal pl-5">
                                              {message.citations?.map((citation: any, index: number) => (
                                                <li key={index} className="text-sm pl-2">
                                                  <a 
                                                    href={citation.url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium underline decoration-blue-300 dark:decoration-blue-600 underline-offset-2"
                                                  >
                                                    {citation.title}
                                                  </a>
                                                </li>
                                              )) || []}
                                            </ol>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </Collapsible.Content>
                                </div>
                              </Collapsible.Root>
                            )}
                          </div>
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
      
      {/* Smart Follow-up Input */}
      {response && currentQueryId && !isAdminView && (
        <SmartFollowUpInput
          queryId={currentQueryId}
          onMessageAdded={handleSmartFollowUpAdded}
          disabled={isLoading}
        />
      )}
    </div>
  )
}
