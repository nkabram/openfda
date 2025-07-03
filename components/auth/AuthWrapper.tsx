'use client'

import { useAuth } from '@/contexts/AuthContext'
import { LoginButton } from './LoginButton'
import { UserProfile } from './UserProfile'
import { Skeleton } from '@/components/ui/skeleton'

export function AuthWrapper() {
  const { user, loading } = useAuth()

  if (loading) {
    return <Skeleton className="h-8 w-8 rounded-full" />
  }

  return user ? <UserProfile /> : <LoginButton />
}
