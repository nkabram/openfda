'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ProgressStep {
  id: string
  label: string
  status: 'pending' | 'active' | 'completed' | 'error'
}

interface ProgressIndicatorProps {
  steps: ProgressStep[]
  className?: string
}

export function ProgressIndicator({ steps, className }: ProgressIndicatorProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-col space-y-3">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center space-x-3">
            {/* Step indicator */}
            <div className="flex-shrink-0">
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300",
                  {
                    "bg-muted text-muted-foreground": step.status === 'pending',
                    "bg-blue-500 text-white animate-pulse": step.status === 'active',
                    "bg-green-500 text-white": step.status === 'completed',
                    "bg-red-500 text-white": step.status === 'error',
                  }
                )}
              >
                {step.status === 'completed' ? (
                  <Check className="w-3 h-3" />
                ) : step.status === 'error' ? (
                  '!'
                ) : (
                  index + 1
                )}
              </div>
            </div>

            {/* Step label */}
            <div className="flex-1">
              <p
                className={cn(
                  "text-sm font-medium transition-colors duration-300",
                  {
                    "text-muted-foreground": step.status === 'pending',
                    "text-blue-600 dark:text-blue-400": step.status === 'active',
                    "text-green-600 dark:text-green-400": step.status === 'completed',
                    "text-red-600 dark:text-red-400": step.status === 'error',
                  }
                )}
              >
                {step.label}
              </p>
            </div>

            {/* Loading indicator for active step */}
            {step.status === 'active' && (
              <div className="flex-shrink-0">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
