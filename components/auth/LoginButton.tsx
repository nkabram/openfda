'use client'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { Chrome } from 'lucide-react'

export function LoginButton() {
  const { signInWithGoogle, loading } = useAuth()

  return (
    <Button
      onClick={signInWithGoogle}
      disabled={loading}
      className="w-full flex items-center gap-2"
      variant="outline"
    >
      <Chrome className="w-4 h-4" />
      Sign in with Google
    </Button>
  )
}
