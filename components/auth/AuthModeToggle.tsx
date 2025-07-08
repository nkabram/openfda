'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Shield, ShieldOff, RotateCcw } from 'lucide-react'
import { isLocalhost, getAuthModePreference, setAuthModePreference } from '@/lib/utils'

export function AuthModeToggle() {
  const [authMode, setAuthMode] = useState<'dev' | 'auth'>('dev')
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    setAuthMode(getAuthModePreference())
  }, [])

  // Only show on localhost
  if (!isClient || !isLocalhost()) {
    return null
  }

  const toggleAuthMode = () => {
    const newMode = authMode === 'dev' ? 'auth' : 'dev'
    setAuthMode(newMode)
    setAuthModePreference(newMode)
    
    // Reload the page to apply the new auth mode
    window.location.reload()
  }

  return (
    <div className="flex items-center gap-2">
      {authMode === 'dev' && (
        <Badge 
          variant="secondary"
          className="text-xs"
        >
          Development Mode
        </Badge>
      )}
      
      <Button
        onClick={toggleAuthMode}
        size="sm"
        variant="outline"
        className="flex items-center gap-2 text-xs"
        title={authMode === 'dev' ? 'Switch to Authentication Mode' : 'Switch to Development Mode'}
      >
        {authMode === 'dev' ? (
          <>
            <Shield className="h-3 w-3" />
            Enable Auth
          </>
        ) : (
          <>
            <ShieldOff className="h-3 w-3" />
            Disable Auth
          </>
        )}
        <RotateCcw className="h-3 w-3" />
      </Button>
    </div>
  )
}
