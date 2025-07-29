'use client'

import { useAuth } from '@/contexts/AuthContext'

export function useFeedback() {
  const { session } = useAuth()

  const getAuthHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    
    return headers
  }

  const submitFeedback = async ({
    queryId,
    messageId,
    feedbackType,
    feedbackText
  }: {
    queryId?: string
    messageId?: string
    feedbackType: 'thumbs_up' | 'thumbs_down'
    feedbackText?: string
  }) => {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        queryId,
        messageId,
        feedbackType,
        feedbackText: feedbackText?.trim() || null,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to submit feedback')
    }

    return await response.json()
  }

  const getFeedback = async (queryId: string) => {
    const response = await fetch(`/api/feedback?queryId=${queryId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to fetch feedback')
    }

    return await response.json()
  }

  return {
    submitFeedback,
    getFeedback
  }
}
