'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function AuthDebugger() {
  const { user, loading, isAdmin } = useAuth()
  const [isClient, setIsClient] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Only show in development
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    return null
  }

  return (
    <div className="fixed top-20 left-4 bg-black/80 text-white p-3 rounded-lg text-xs font-mono z-50 max-w-xs">
      <div className="font-bold mb-2">🐛 Auth Debug</div>
      <div>pathname: {pathname}</div>
      <div>isClient: {String(isClient)}</div>
      <div>loading: {String(loading)}</div>
      <div>hasUser: {String(!!user)}</div>
      <div>userId: {user?.id?.slice(0, 8) || 'none'}...</div>
      <div>userEmail: {user?.email || 'none'}</div>
      <div>isAdmin: {String(isAdmin)}</div>
    </div>
  )
}
