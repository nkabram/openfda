'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'
import * as Collapsible from '@radix-ui/react-collapsible'
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

interface QueryResponseProps {
  response: QueryResponse
  onStartNewQuery?: () => void
}

export function QueryResponse({ response, onStartNewQuery }: QueryResponseProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

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

  const { bottomLine, restOfText } = parseBottomLine(response.response)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-lg font-semibold">Response</span>
        {response.medication && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">for {response.medication}</span>
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        {/* Bottom Line - Always Visible */}
        {bottomLine && (
          <div className="space-y-3">
            <div className="p-3 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg">
              <p className="text-sky-900 dark:text-sky-100 font-medium">
                {bottomLine}
              </p>
            </div>
            
            {restOfText && (
              <div className="relative">
                <Collapsible.Root open={!isCollapsed} onOpenChange={setIsCollapsed}>
                  <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                    <div className="p-3 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="text-sky-900 dark:text-sky-100 mb-2 last:mb-0">{children}</p>,
                          h1: ({ children }) => <h1 className="text-sky-900 dark:text-sky-100 text-lg font-semibold mb-2">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-sky-900 dark:text-sky-100 text-base font-semibold mb-2">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sky-900 dark:text-sky-100 text-sm font-semibold mb-1">{children}</h3>,
                          ul: ({ children }) => <ul className="text-sky-900 dark:text-sky-100 list-disc list-inside mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="text-sky-900 dark:text-sky-100 list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="text-sky-900 dark:text-sky-100">{children}</li>,
                        }}
                      >
                        {restOfText}
                      </ReactMarkdown>
                    </div>
                  </Collapsible.Content>
                  
                  {/* More details button with fixed positioning */}
                  <div className="flex justify-end mt-2">
                    <Collapsible.Trigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 h-auto p-1 text-xs transition-colors"
                      >
                        {isCollapsed ? 'More details' : 'Less details'}
                      </Button>
                    </Collapsible.Trigger>
                  </div>
                </Collapsible.Root>
              </div>
            )}
          </div>
        )}

        {/* Full Response - Collapsible */}
        {!bottomLine && (
          <Collapsible.Root open={!isCollapsed} onOpenChange={setIsCollapsed}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Full Response</span>
              <Collapsible.Trigger asChild>
                <Button variant="ghost" size="sm">
                  {isCollapsed ? (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Show Response
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Hide Response
                    </>
                  )}
                </Button>
              </Collapsible.Trigger>
            </div>
            
            <Collapsible.Content>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
                    h1: ({ children }) => <h1 className="text-xl font-bold mb-4">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-lg font-semibold mb-3">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-base font-medium mb-2">{children}</h3>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-2">{children}</ol>,
                    li: ({ children }) => <li>{children}</li>,
                  }}
                >
                  {response.response}
                </ReactMarkdown>
              </div>
            </Collapsible.Content>
          </Collapsible.Root>
        )}

        {/* Start New Query Button */}
        {onStartNewQuery && (
          <div className="pt-4 border-t">
            <Button 
              onClick={onStartNewQuery}
              variant="outline"
              className="w-full"
            >
              Ask Another Question
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
