'use client'

import { useAuth } from '@/contexts/AuthContext'
import { LoginButton } from './LoginButton'
import { UserProfile } from './UserProfile'
import { Skeleton } from '@/components/ui/skeleton'
import { isLocalhost } from '@/lib/utils'
import { useEffect, useState } from 'react'

export function AuthWrapper() {
  const [isClient, setIsClient] = useState(false)
  const [isDevMode, setIsDevMode] = useState(false)

  // Handle hydration by waiting for client-side render
  useEffect(() => {
    setIsClient(true)
    setIsDevMode(isLocalhost())
  }, [])

  // During SSR or initial client render, show loading
  if (!isClient) {
    return <Skeleton className="h-8 w-8 rounded-full" />
  }

  // Show a development indicator on localhost (after hydration)
  if (isDevMode) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
          🚧 Development Mode
        </span>
      </div>
    )
  }

  const { user, loading } = useAuth()

  if (loading) {
    return <Skeleton className="h-8 w-8 rounded-full" />
  }

  return user ? <UserProfile /> : <LoginButton />
}
