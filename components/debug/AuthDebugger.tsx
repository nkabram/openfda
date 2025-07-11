'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function AuthDebugger() {
  const { user, loading, isApproved, approvalLoading, isAdmin, checkApprovalStatus } = useAuth()
  const [isClient, setIsClient] = useState(false)
  const pathname = usePathname()
  const [refreshCount, setRefreshCount] = useState(0)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Only show in development
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    return null
  }

  const handleRefresh = async () => {
    console.log('🔄 Manually refreshing approval status...')
    await checkApprovalStatus()
    setRefreshCount(prev => prev + 1)
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
      <div>isApproved: {String(isApproved)}</div>
      <div>approvalLoading: {String(approvalLoading)}</div>
      <div>isAdmin: {String(isAdmin)}</div>
      <div>refreshCount: {refreshCount}</div>
      <button 
        onClick={handleRefresh}
        className="mt-2 px-2 py-1 bg-blue-500 hover:bg-blue-600 rounded text-white"
      >
        Refresh Status
      </button>
    </div>
  )
}
