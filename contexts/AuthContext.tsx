'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'


interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isApproved: boolean
  isAdmin: boolean
  approvalLoading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>
  signUpWithEmail: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  checkApprovalStatus: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isClient, setIsClient] = useState(false)
  const [isApproved, setIsApproved] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [approvalLoading, setApprovalLoading] = useState(true)
  useEffect(() => {
    setIsClient(true)
  }, [])

  const checkApprovalStatus = useCallback(async (currentSession: Session) => {
    console.log('🔍 Checking approval status for user:', currentSession.user?.email)

    setApprovalLoading(true)
    
    try {
      // Use the API endpoint to check status (bypasses RLS issues)
      console.log('📡 Calling /api/auth/status endpoint...')
      
      const response = await fetch('/api/auth/status', {
        headers: {
          'Authorization': `Bearer ${currentSession.access_token}`
        }
      })

      if (!response.ok) {
        console.error('❌ Status API error:', response.status, response.statusText)
        setIsApproved(false)
        setIsAdmin(false)
        return
      }

      const data = await response.json()
      console.log('✅ Status API response:', data)

      setIsApproved(data.isApproved)
      setIsAdmin(data.isAdmin)
    } catch (error) {
      console.error('❌ Error checking approval status:', error)
      setIsApproved(false)
      setIsAdmin(false)
    } finally {
      console.log('🏁 Setting approvalLoading to false')
      setApprovalLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isClient) return

    const initAuth = async () => {
      console.log('🚀 Initializing auth...')
      const { data: { session } } = await supabase.auth.getSession()
      console.log('📱 Initial session:', session?.user?.email || 'No session')
      
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user?.email || 'No session')
      setSession(session)
      setUser(session?.user ?? null)
      
      // Clean up URL fragments after successful authentication
      if (event === 'SIGNED_IN' && typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        if (url.hash.includes('access_token') || url.hash.includes('refresh_token')) {
          // Remove the hash fragment and replace the URL
          window.history.replaceState({}, document.title, url.pathname + url.search)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [isClient])

  useEffect(() => {
    console.log('👤 User/session changed:', {
      hasUser: !!user,
      hasSession: !!session,
      userEmail: user?.email,
      isClient,
      currentApprovalLoading: approvalLoading,
      currentIsApproved: isApproved,
      currentIsAdmin: isAdmin
    })
    
    // Only proceed if client-side
    if (!isClient) {
      console.log('⏳ Not client-side yet, skipping approval checks')
      return
    }
    
    // Check approval status for authenticated users
    if (session && user) {
      console.log('✅ User logged in, checking approval status...')
      checkApprovalStatus(session)
    } else {
      console.log('❌ No user/session, resetting approval state')
      setIsApproved(false)
      setIsAdmin(false)
      setApprovalLoading(false)
    }
  }, [session, user, isClient]) // Remove checkApprovalStatus from deps to avoid infinite loop

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) console.error('Error signing in:', error.message)
  }

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUpWithEmail = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    // If sign up successful and user is created, update the profile
    if (!error && data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', data.user.id)
      
      if (profileError) {
        console.error('Error updating profile:', profileError)
      }
    }

    return { error }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const value = {
    user,
    session,
    loading,
    isApproved,
    isAdmin,
    approvalLoading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    signOut,
    checkApprovalStatus: () => {
      if (session) checkApprovalStatus(session)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
