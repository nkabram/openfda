'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { FeedbackModal } from './FeedbackModal'

interface FeedbackButtonsProps {
  queryId?: string
  messageId?: string
  responseType: 'original' | 'follow_up'
  className?: string
}

export function FeedbackButtons({ 
  queryId, 
  messageId, 
  responseType, 
  className = "" 
}: FeedbackButtonsProps) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean
    feedbackType: 'thumbs_up' | 'thumbs_down' | null
  }>({
    isOpen: false,
    feedbackType: null
  })

  const openFeedbackModal = (type: 'thumbs_up' | 'thumbs_down') => {
    setModalState({
      isOpen: true,
      feedbackType: type
    })
  }

  const closeFeedbackModal = () => {
    setModalState({
      isOpen: false,
      feedbackType: null
    })
  }

  return (
    <>
      <div className={`flex items-center gap-1 ${className}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openFeedbackModal('thumbs_up')}
          className="h-8 w-8 p-0 text-slate-500 hover:text-green-600 hover:bg-green-50 dark:hover:text-green-400 dark:hover:bg-green-950/30 transition-colors"
          title="This response was helpful"
        >
          <ThumbsUp className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openFeedbackModal('thumbs_down')}
          className="h-8 w-8 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/30 transition-colors"
          title="This response was not helpful"
        >
          <ThumbsDown className="h-4 w-4" />
        </Button>
      </div>

      {modalState.feedbackType && (
        <FeedbackModal
          isOpen={modalState.isOpen}
          onClose={closeFeedbackModal}
          feedbackType={modalState.feedbackType}
          queryId={queryId}
          messageId={messageId}
          responseType={responseType}
        />
      )}
    </>
  )
}
