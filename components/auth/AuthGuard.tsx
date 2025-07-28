'use client'

import { useAuth } from '@/contexts/AuthContext'
import { LandingPage } from './LandingPage'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    console.log('🛡️ AuthGuard initialized')
  }, [])

  // During server-side rendering or hydration, return a simple div
  // This prevents hydration errors by ensuring the server and client render the same content
  if (!isClient) {
    console.log('🛡️ AuthGuard: Server-side rendering or hydrating...')
    return <div data-auth-guard-loading></div>
  }

  console.log('🛡️ AuthGuard state:', { 
    isClient, 
    loading, 
    hasUser: !!user 
  })

  // Show loading while auth is initializing
  if (loading) {
    console.log('🛡️ AuthGuard: Auth loading...')
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Authenticating...</p>
        </div>
      </div>
    )
  }

  // No user - show landing page
  if (!user) {
    console.log('🛡️ AuthGuard: No user, showing landing page')
    return <LandingPage />;
  }

  // User exists - show content
  console.log('🔑 AuthGuard: User authenticated, showing content', {
    email: user?.email,
    userId: user?.id
  })
  return <>{children}</>;
}
