'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { useFeedback } from '@/hooks/useFeedback'
import { ThumbsUp, ThumbsDown, Send, X } from 'lucide-react'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  feedbackType: 'thumbs_up' | 'thumbs_down'
  queryId?: string
  messageId?: string
  responseType: 'original' | 'follow_up'
}

export function FeedbackModal({ 
  isOpen, 
  onClose, 
  feedbackType, 
  queryId, 
  messageId, 
  responseType 
}: FeedbackModalProps) {
  const [feedbackText, setFeedbackText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const { session } = useAuth()
  const { submitFeedback } = useFeedback()

  const handleSubmit = async () => {
    if (!session?.user?.id) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to provide feedback.",
        variant: "destructive"
      })
      return
    }

    if (!queryId && !messageId) {
      toast({
        title: "Error",
        description: "Unable to identify the response for feedback.",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)

    try {
      await submitFeedback({
        queryId,
        messageId,
        feedbackType,
        feedbackText: feedbackText.trim() || undefined,
      })

      toast({
        title: "Feedback Submitted",
        description: "Thank you for your feedback! It helps us improve our responses.",
        variant: "default"
      })

      setFeedbackText('')
      onClose()
    } catch (error) {
      console.error('Error submitting feedback:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit feedback. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setFeedbackText('')
    onClose()
  }

  const getModalTitle = () => {
    const responseTypeText = responseType === 'original' ? 'response' : 'follow-up answer'
    return feedbackType === 'thumbs_up' 
      ? `What did this ${responseTypeText} get right?`
      : `What did this ${responseTypeText} get wrong?`
  }

  const getModalDescription = () => {
    if (feedbackType === 'thumbs_up') {
      return "Please share what was helpful or accurate about this response. Your feedback helps us understand what works well."
    } else {
      return "Please share what was incorrect, unhelpful, or missing from this response. Your feedback helps us improve our accuracy."
    }
  }

  const getPlaceholderText = () => {
    if (feedbackType === 'thumbs_up') {
      return "e.g., The dosage information was clear and accurate, the warnings were comprehensive..."
    } else {
      return "e.g., The dosage was incorrect, missing important warnings, didn't address my specific question..."
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            {feedbackType === 'thumbs_up' ? (
              <ThumbsUp className="h-5 w-5 text-green-600" />
            ) : (
              <ThumbsDown className="h-5 w-5 text-red-600" />
            )}
            {getModalTitle()}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {getModalDescription()}
          </p>
          
          <div className="space-y-2">
            <Label htmlFor="feedback-text" className="text-sm font-medium">
              Your feedback (optional)
            </Label>
            <Textarea
              id="feedback-text"
              placeholder={getPlaceholderText()}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="min-h-[100px] resize-none"
              maxLength={2000}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {feedbackText.length}/2000 characters
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Feedback
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
