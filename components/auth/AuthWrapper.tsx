'use client'

import { useAuth } from '@/contexts/AuthContext'
import { LoginButton } from './LoginButton'
import { UserProfile } from './UserProfile'
import { AuthModeToggle } from './AuthModeToggle'
import { Skeleton } from '@/components/ui/skeleton'
import { shouldUseDevMode, isLocalhost } from '@/lib/utils'
import { useEffect, useState } from 'react'

export function AuthWrapper() {
  const [isClient, setIsClient] = useState(false)
  const [isDevMode, setIsDevMode] = useState(false)

  // Handle hydration by waiting for client-side render
  useEffect(() => {
    setIsClient(true)
    setIsDevMode(shouldUseDevMode())
    
    // Listen for auth mode changes from localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'authMode') {
        setIsDevMode(shouldUseDevMode())
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  // During SSR or initial client render, show loading
  if (!isClient) {
    return <Skeleton className="h-8 w-8 rounded-full" />
  }

  const { user, loading } = useAuth()

  // Show loading skeleton during auth check
  if (loading) {
    return (
      <div className="flex items-center gap-2">
        {isLocalhost() && <AuthModeToggle />}
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    )
  }

  // Show auth toggle and appropriate auth component
  return (
    <div className="flex items-center gap-2">
      {isLocalhost() && <AuthModeToggle />}
      {isDevMode ? null : (user ? <UserProfile /> : <LoginButton />)}
    </div>
  )
}
