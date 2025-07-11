'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface AdminGuardProps {
  children: React.ReactNode
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { isAdmin, loading, approvalLoading, user } = useAuth()
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Debug logging
  console.log('🛡️ AdminGuard state:', { 
    isAdmin, 
    loading, 
    approvalLoading, 
    hasUser: !!user, 
    isClient 
  })

  useEffect(() => {
    // Only redirect if we're client-side and not in loading states
    if (isClient && !loading && !approvalLoading && !isAdmin) {
      console.log('🛡️ AdminGuard: Redirecting to home - not admin')
      router.push('/')
    }
  }, [isAdmin, loading, approvalLoading, router, isClient])

  // During server-side rendering or hydration, return a simple div
  // This prevents hydration errors by ensuring the server and client render the same content
  if (!isClient) {
    return <div data-admin-guard-loading></div>
  }
  
  // Show loading during auth checks
  if (loading || approvalLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </div>
    )
  }

  // Check if user is admin
  if (!isAdmin) {
    console.log('🛡️ AdminGuard: Access denied - not admin')
    // Use useEffect for navigation to avoid hydration issues
    // The actual redirect is handled in the useEffect above
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    )
  }

  console.log('🛡️ AdminGuard: Access granted - user is admin')
  return <>{children}</>
}
