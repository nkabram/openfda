'use client'

import { useAuth } from '@/contexts/AuthContext'
import { SignInScreen } from './SignInScreen'
import { Skeleton } from '@/components/ui/skeleton'
import { isLocalhost } from '@/lib/utils'
import { useEffect, useState } from 'react'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [isClient, setIsClient] = useState(false)
  const [isDevMode, setIsDevMode] = useState(false)

  // Handle hydration by waiting for client-side render
  useEffect(() => {
    setIsClient(true)
    setIsDevMode(isLocalhost())
  }, [])

  // During SSR or initial client render, show loading
  if (!isClient) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="h-8 w-64 bg-muted rounded animate-pulse" />
            <div className="h-8 w-8 bg-muted rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  // Skip authentication completely for localhost (after hydration)
  if (isDevMode) {
    return <>{children}</>
  }

  const { user, loading } = useAuth()

  // Show loading skeleton while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show sign-in screen if user is not authenticated
  if (!user) {
    return <SignInScreen />
  }

  // User is authenticated, show the protected content
  return <>{children}</>
}
