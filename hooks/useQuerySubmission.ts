import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { useUserQueries } from '@/hooks/useQueries'

interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

interface QueryResponse {
  response: string
  medication: string | null
  intents: string[]
  fdaSections: string[]
  fdaData: any
  queryId?: string
}

interface UseQuerySubmissionProps {
  onQuerySaved?: (query: any) => void
  isAdminView?: boolean
  onProgressUpdate?: (steps: ProgressStep[]) => void
}

export function useQuerySubmission({
  onQuerySaved,
  isAdminView = false,
  onProgressUpdate
}: UseQuerySubmissionProps = {}) {
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<QueryResponse | null>(null)
  const [currentQueryId, setCurrentQueryId] = useState<string | null>(null)
  const { toast } = useToast()
  const { session } = useAuth()
  const { addQuery } = useUserQueries()

  // Progress tracking
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([
    { id: 'identify', label: 'Identifying medication and intent', status: 'pending' },
    { id: 'search', label: 'Searching FDA database', status: 'pending' },
    { id: 'generate', label: 'Generating AI response', status: 'pending' },
    { id: 'respond', label: 'Finalizing response', status: 'pending' },
  ])

  const getAuthHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    
    return headers
  }

  const updateStepStatus = (stepId: string, status: ProgressStep['status']) => {
    setProgressSteps(prev => {
      const updated = prev.map(step => 
        step.id === stepId ? { ...step, status } : step
      )
      onProgressUpdate?.(updated)
      return updated
    })
  }

  const resetProgress = () => {
    const resetSteps = progressSteps.map(step => ({ ...step, status: 'pending' as const }))
    setProgressSteps(resetSteps)
    onProgressUpdate?.(resetSteps)
  }

  const submitQuery = async (query: string) => {
    if (!query.trim()) {
      toast({
        title: "Please enter a question",
        variant: "destructive",
      })
      return null
    }

    setIsLoading(true)
    setResponse(null)
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
        
        // Create a query object for cache and parent component
        const newQuery = {
          id: responseData.queryId,
          user_query: query,
          medication_name: responseData.medication,
          detected_intents: responseData.intents,
          fda_sections: responseData.fdaSections,
          fda_response: responseData.fdaData,
          ai_response: responseData.response,
          created_at: new Date().toISOString(),
          message_count: 0
        }
        
        // Add to cache for immediate UI update
        if (!isAdminView) {
          addQuery(newQuery)
        }
        
        // Notify parent component to update query history if needed
        if (onQuerySaved) {
          onQuerySaved(newQuery)
        }
      }

      toast({
        title: "Response generated successfully",
      })

      return responseData
    } catch (error) {
      console.error('Error processing query:', error)
      toast({
        title: "Error processing your question",
        description: "Please try again later.",
        variant: "destructive",
      })
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const clearResponse = () => {
    setResponse(null)
    setCurrentQueryId(null)
    resetProgress()
  }

  return {
    // State
    isLoading,
    response,
    currentQueryId,
    progressSteps,
    
    // State setters (for compatibility)
    setResponse,
    setCurrentQueryId,
    setProgressSteps,
    
    // Actions
    submitQuery,
    clearResponse,
    updateStepStatus,
    resetProgress,
  }
}
