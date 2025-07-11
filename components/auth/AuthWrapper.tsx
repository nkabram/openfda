'use client'

import { useAuth } from '@/contexts/AuthContext'
import { LoginButton } from './LoginButton'
import { UserProfile } from './UserProfile'
import { Skeleton } from '@/components/ui/skeleton'
import { useState, useEffect } from 'react'

export function AuthWrapper() {
  const { user, loading } = useAuth()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Show loading skeleton during auth check or hydration
  if (loading || !isClient) {
    return <Skeleton className="h-8 w-8 rounded-full" />
  }

  // Show appropriate auth component
  return user ? <UserProfile /> : <LoginButton />
}
