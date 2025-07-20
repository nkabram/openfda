'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

interface QueryProgressProps {
  steps: ProgressStep[]
  isVisible: boolean
  title?: string
  hideDelay?: number
}

export function QueryProgress({ 
  steps, 
  isVisible, 
  title = "Processing Your Query",
  hideDelay = 5000 
}: QueryProgressProps) {
  const [displayText, setDisplayText] = useState('')
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [dots, setDots] = useState('')

  // Animate dots for active step
  useEffect(() => {
    if (!isVisible) return
    
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return ''
        return prev + '.'
      })
    }, 500)

    return () => clearInterval(interval)
  }, [isVisible])

  // Update display text based on current step
  useEffect(() => {
    if (!isVisible) {
      setDisplayText('')
      return
    }

    const activeStep = steps.find(step => step.status === 'active')
    const completedSteps = steps.filter(step => step.status === 'completed')
    const errorStep = steps.find(step => step.status === 'error')

    if (errorStep) {
      setDisplayText(`❌ Error: ${errorStep.label}`)
    } else if (activeStep) {
      setDisplayText(`${activeStep.label}${dots}`)
    } else if (completedSteps.length === steps.length) {
      setDisplayText('✅ Complete!')
    } else {
      setDisplayText('Preparing...')
    }
  }, [steps, isVisible, dots])

  if (!isVisible || !displayText) return null

  // Find the active step
  const activeStep = steps.find(step => step.status === 'active')
  const completedSteps = steps.filter(step => step.status === 'completed')
  const errorStep = steps.find(step => step.status === 'error')

  return (
    <div className="py-2">
      <div className="space-y-2">
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-in-out"
            style={{
              width: `${(completedSteps.length / steps.length) * 100}%`,
              maxWidth: activeStep ? `${((steps.findIndex(step => step.id === activeStep.id) + 0.5) / steps.length) * 100}%` : '100%'
            }}
          />
        </div>
        
        {/* Status text */}
        <div className={cn(
          "text-sm font-medium transition-colors duration-300 flex items-center gap-2",
          "text-muted-foreground"
        )}>
          {activeStep && !errorStep && (
            <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
          )}
          {errorStep ? (
            <span className="text-red-500">❌ Error: {errorStep.label}</span>
          ) : activeStep ? (
            <span>{activeStep.label}{dots}</span>
          ) : completedSteps.length === steps.length ? (
            <span>✅ Complete!</span>
          ) : (
            <span>Preparing...</span>
          )}
        </div>
      </div>
    </div>
  )
}
