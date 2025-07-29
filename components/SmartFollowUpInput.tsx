'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Pill, Globe, Brain, Send } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import ProcessStream from '@/components/process-stream'

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

interface SmartFollowUpInputProps {
  queryId: string
  onMessageAdded: (messages: FollowUpMessage[]) => void
  disabled?: boolean
}

interface ProgressStep {
  id: string
  label: string
  status: 'pending' | 'active' | 'completed' | 'error'
}

interface IntentConfirmationProps {
  intent: 'fda_search' | 'web_search'
  message: string
  onConfirm: () => void
  onCancel: () => void
  onAlternative: (alternativeIntent: 'clarification' | 'web_search' | 'fda_search') => void
}

const IntentConfirmation = ({ intent, message, onConfirm, onCancel, onAlternative }: IntentConfirmationProps) => {
  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1">
              {intent === 'fda_search' ? (
                <Pill className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              ) : (
                <Globe className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                {message}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={onConfirm}
              size="sm"
              className={`${
                intent === 'fda_search' 
                  ? 'bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600'
                  : 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600'
              }`}
            >
              {intent === 'fda_search' ? (
                <>
                  <Pill className="h-4 w-4 mr-2" />
                  Yes, Search FDA Database
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4 mr-2" />
                  Yes, Search Web
                </>
              )}
            </Button>
            
            {intent === 'fda_search' && (
              <Button
                onClick={() => onAlternative('web_search')}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600"
              >
                <Globe className="h-4 w-4 mr-2" />
                Search Web Instead
              </Button>
            )}
            
            {intent === 'web_search' && (
              <Button
                onClick={() => onAlternative('fda_search')}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600"
              >
                <Pill className="h-4 w-4 mr-2" />
                Search FDA Instead
              </Button>
            )}
            
            <Button
              onClick={() => onAlternative('clarification')}
              size="sm"
              variant="outline"
              className="border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800"
            >
              <Brain className="h-4 w-4 mr-2" />
              Answer from Previous Info
            </Button>
            
            <Button
              onClick={onCancel}
              size="sm"
              variant="ghost"
              className="text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-800"
            >
              Cancel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SmartFollowUpInput({ queryId, onMessageAdded, disabled = false }: SmartFollowUpInputProps) {
  const [question, setQuestion] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState<{
    intent: 'fda_search' | 'web_search'
    message: string
    questionId?: string
  } | null>(null)
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([
    { id: 'detect', label: 'Detecting intent', status: 'pending' },
    { id: 'process', label: 'Processing question', status: 'pending' },
    { id: 'respond', label: 'Generating response', status: 'pending' },
  ])
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { toast } = useToast()
  const { session } = useAuth()

  const updateStepStatus = (stepId: string, status: ProgressStep['status']) => {
    setProgressSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ))
  }

  const resetProgress = () => {
    setProgressSteps([
      { id: 'detect', label: 'Detecting intent', status: 'pending' },
      { id: 'process', label: 'Processing question', status: 'pending' },
      { id: 'fda_search', label: 'Doing new FDA search', status: 'pending' },
      { id: 'respond', label: 'Generating response', status: 'pending' },
    ])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim() || isLoading || disabled) return
    
    await processFollowUp(question.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isLoading && question.trim()) {
        handleSubmit(e)
      }
    }
  }

  const processFollowUp = async (queryText: string, forceIntent?: 'clarification' | 'fda_search' | 'web_search') => {
    setIsLoading(true)
    resetProgress()
    
    try {
      // Step 1: Detect intent
      updateStepStatus('detect', 'active')
      
      // Add a small delay to make the progress visible
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      
      // Add authorization header if session exists
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      updateStepStatus('detect', 'completed')
      updateStepStatus('process', 'active')
      
      // Add another small delay
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const response = await fetch('/api/smart-followup', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: queryText,
          queryId,
          forceIntent
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Smart follow-up API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        })
        throw new Error(`Failed to process follow-up: ${response.status} ${response.statusText}`)
      }

      updateStepStatus('process', 'completed')
      updateStepStatus('respond', 'active')
      
      // Add final delay before completing
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const result = await response.json()
      console.log('Smart follow-up result:', result)

      if (result.needsConfirmation) {
        // Show confirmation dialog for ambiguous intent
        setShowConfirmation({
          intent: result.intent,
          message: result.message,
          questionId: result.questionId
        })
        setIsLoading(false)
        resetProgress()
        return
      }

      // Success - create the messages immediately for UI display
      updateStepStatus('respond', 'completed')
      
      // Create the new messages from the API response
      const newMessages: FollowUpMessage[] = [
        {
          id: `question-${Date.now()}`,
          type: 'question',
          content: queryText,
          timestamp: new Date()
        },
        {
          id: `answer-${Date.now() + 1}`,
          type: 'answer', 
          content: result.response,
          timestamp: new Date(),
          citations: result.citations || [],
          websearchUsed: result.websearchUsed || false
        }
      ]
      
      // Add messages to UI immediately (database save happens in background via API)
      onMessageAdded(newMessages)

      // Clear the input
      setQuestion('')
      setShowConfirmation(null)

      // Show success toast with intent info
      const intentLabels = {
        clarification: 'Answered from previous information',
        fda_search: 'Searched FDA database',
        web_search: 'Searched the web'
      }
      
      toast({
        title: 'Follow-up processed',
        description: intentLabels[result.intent as keyof typeof intentLabels] || 'Response generated',
      })

    } catch (error) {
      console.error('Follow-up error:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      
      // Mark current active step as error
      const activeStep = progressSteps.find(step => step.status === 'active')
      if (activeStep) {
        updateStepStatus(activeStep.id, 'error')
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast({
        title: 'Error',
        description: `Failed to process your follow-up question: ${errorMessage}`,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmIntent = async () => {
    if (!showConfirmation) return

    if (showConfirmation.intent === 'fda_search') {
      // For FDA search, redirect to new FDA search
      handleNewFDASearch()
    } else {
      // For web search, process with forced intent
      await processFollowUp(question, 'web_search')
    }
  }

  const handleAlternativeIntent = async (intent: 'clarification' | 'web_search' | 'fda_search') => {
    if (!showConfirmation) return
    
    if (intent === 'fda_search') {
      handleNewFDASearch()
    } else {
      await processFollowUp(question, intent)
    }
  }

  const handleNewFDASearch = () => {
    toast({
      title: 'New FDA Search',
      description: 'Please use the main search form above to search for new medication information.',
    })
    setShowConfirmation(null)
    setQuestion('')
  }

  const handleCancel = () => {
    setShowConfirmation(null)
    setIsLoading(false)
  }

  // Get the current status for display
  const activeStep = progressSteps.find(step => step.status === 'active')
  const completedSteps = progressSteps.filter(step => step.status === 'completed')
  const errorStep = progressSteps.find(step => step.status === 'error')
  const progressPercentage = (completedSteps.length / progressSteps.length) * 100

  return (
    <Card className="border-0 shadow-none">
      <CardContent className="p-0 bg-background">
        <div className="space-y-4">
          {/* Intent Confirmation Dialog */}
          {showConfirmation && (
            <IntentConfirmation
              intent={showConfirmation.intent}
              message={showConfirmation.message}
              onConfirm={handleConfirmIntent}
              onCancel={handleCancel}
              onAlternative={handleAlternativeIntent}
            />
          )}

          {/* Progress Indicator */}
          {isLoading && (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-in-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                {activeStep && !errorStep && (
                  <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                )}
                {errorStep ? (
                  <span className="text-red-500">Error: {errorStep.label}</span>
                ) : activeStep ? (
                  <span>{activeStep.label}</span>
                ) : completedSteps.length === progressSteps.length ? (
                  <span>✅ Complete!</span>
                ) : (
                  <span>Processing...</span>
                )}
              </div>
            </div>
          )}

          {/* Smart Follow-up Input */}
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <Textarea
                ref={textareaRef}
                placeholder="Ask a follow-up question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[60px] resize-none bg-white dark:bg-slate-700/70 border border-slate-300 dark:border-slate-600/60 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none focus:border-ring/50 pr-12 md:pr-3"
                disabled={isLoading || disabled}
              />
              {/* Mobile Submit Button - positioned in lower right corner */}
              <Button
                type="submit"
                size="sm"
                disabled={!question.trim() || isLoading || disabled}
                className="absolute bottom-2 right-2 h-8 w-8 p-0 md:hidden bg-blue-500 hover:bg-blue-600 text-white border-0"
                title="Submit follow-up question"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}

export default SmartFollowUpInput
