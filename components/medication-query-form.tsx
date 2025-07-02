'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Send } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface QueryResponse {
  response: string
  medication: string | null
  fdaData: any
}

export function MedicationQueryForm() {
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState<QueryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

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

    try {
      // Step 1: Extract medication name
      const extractResponse = await fetch('/api/extract-medication', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      })

      if (!extractResponse.ok) {
        throw new Error('Failed to extract medication')
      }

      const { medication } = await extractResponse.json()

      // Step 2: Generate AI response with FDA data
      const generateResponse = await fetch('/api/generate-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, medication }),
      })

      if (!generateResponse.ok) {
        throw new Error('Failed to generate response')
      }

      const responseData = await generateResponse.json()
      setResponse(responseData)

      // Step 3: Save query to database
      try {
        await fetch('/api/queries', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userQuery: query,
            extractedMedication: medication,
            openfdaResponse: responseData.fdaData,
            aiResponse: responseData.response,
          }),
        })
      } catch (saveError) {
        console.error('Failed to save query:', saveError)
        // Don't show error to user as the main functionality worked
      }

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ask a Medication Question</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Textarea
                placeholder="Ask any question about medications, side effects, interactions, dosages, etc. For example: 'What are the side effects of ibuprofen?' or 'Can I take aspirin with food?'"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[100px] resize-none"
                disabled={isLoading}
              />
              <p className="text-sm text-muted-foreground mt-2">
                Press Ctrl+Enter to submit
              </p>
            </div>
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
          </form>
        </CardContent>
      </Card>

      {response && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Response
              {response.medication && (
                <span className="text-sm font-normal text-muted-foreground">
                  • Medication: {response.medication}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <div className="whitespace-pre-wrap">{response.response}</div>
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
    </div>
  )
}
