'use client'

import { useAuth } from '@/contexts/AuthContext'
import { AuthScreen } from './AuthScreen'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading, isApproved, approvalLoading, isAdmin } = useAuth()
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    console.log('🛡️ AuthGuard initialized')
  }, [])

  // Handle redirect for unapproved users
  useEffect(() => {
    if (isClient && !isApproved && !isAdmin && !approvalLoading && !loading && user) {
      console.log('🚀 Redirecting to waiting-approval page')
      router.push('/waiting-approval')
    }
  }, [isClient, isApproved, isAdmin, approvalLoading, loading, user, router])

  // During server-side rendering or hydration, return a simple div
  // This prevents hydration errors by ensuring the server and client render the same content
  if (!isClient) {
    console.log('🛡️ AuthGuard: Server-side rendering or hydrating...')
    return <div data-auth-guard-loading></div>
  }

  console.log('🛡️ AuthGuard state:', { 
    isClient, 
    loading, 
    hasUser: !!user, 
    isApproved, 
    approvalLoading, 
    isAdmin 
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

  // No user - show sign in/sign up
  if (!user) {
    console.log('🛡️ AuthGuard: No user, showing auth screen')
    return <AuthScreen />;
  }

  // User exists but approval status is loading
  if (approvalLoading) {
    console.log('🛡️ AuthGuard: Approval loading...')
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Checking approval status...</p>
        </div>
      </div>
    )
  }

  // User is approved or admin - show content
  if (isApproved || isAdmin) {
    console.log('🔑 AuthGuard: User approved, showing content', {
      isApproved,
      isAdmin,
      email: user?.email,
      userId: user?.id
    })
    return <>{children}</>;
  }

  // User not approved - redirect to waiting page
  console.log('🔑 AuthGuard: User not approved, redirecting', {
    isApproved,
    isAdmin,
    email: user?.email,
    userId: user?.id
  })

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-sm text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  ); // Show loader while redirecting
}
