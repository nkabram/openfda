'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// Constants for localStorage keys and cache duration
const AUTH_CACHE_KEY = 'medguard_auth_cache'
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
const MIN_CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes minimum between checks

// Interface for cached authentication data
interface AuthCache {
  isApproved: boolean
  isAdmin: boolean
  userId: string
  timestamp: number
  lastChecked: number // Last time we checked with server
  version: number // For future cache invalidation if needed
}

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
  refreshAuthState: () => Promise<void>
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
  const [authCacheLoaded, setAuthCacheLoaded] = useState(false)
  const [lastStatusCheck, setLastStatusCheck] = useState<number>(0)
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Utility functions for localStorage operations with error handling
  const getAuthCache = useCallback((): AuthCache | null => {
    if (typeof window === 'undefined') return null
    
    try {
      const cached = localStorage.getItem(AUTH_CACHE_KEY)
      if (!cached) return null
      
      const parsed: AuthCache = JSON.parse(cached)
      
      // Check if cache is expired
      if (Date.now() - parsed.timestamp > CACHE_DURATION) {
        console.log('🕒 Auth cache expired, removing...')
        localStorage.removeItem(AUTH_CACHE_KEY)
        return null
      }
      
      // Check if we need to refresh from server (but keep using cache)
      const needsRefresh = Date.now() - (parsed.lastChecked || 0) > MIN_CHECK_INTERVAL
      if (needsRefresh) {
        console.log('⏰ Auth cache needs refresh from server')
      }
      
      return parsed
    } catch (error) {
      console.error('❌ Error reading auth cache:', error)
      // Clear corrupted cache
      try {
        localStorage.removeItem(AUTH_CACHE_KEY)
      } catch (e) {
        console.error('❌ Error clearing corrupted cache:', e)
      }
      return null
    }
  }, [])

  const setAuthCache = useCallback((isApproved: boolean, isAdmin: boolean, userId: string) => {
    if (typeof window === 'undefined') return
    
    try {
      const now = Date.now()
      const cacheData: AuthCache = {
        isApproved,
        isAdmin,
        userId,
        timestamp: now,
        lastChecked: now,
        version: 1
      }
      
      localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(cacheData))
      setLastStatusCheck(now)
      console.log('💾 Auth cache saved:', { isApproved, isAdmin, userId })
    } catch (error) {
      console.error('❌ Error saving auth cache:', error)
    }
  }, [])

  const clearAuthCache = useCallback(() => {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.removeItem(AUTH_CACHE_KEY)
      console.log('🗑️ Auth cache cleared')
    } catch (error) {
      console.error('❌ Error clearing auth cache:', error)
    }
  }, [])

  // Load cached auth state on client initialization
  const loadCachedAuthState = useCallback((currentUser: User | null) => {
    if (!currentUser || authCacheLoaded) return false
    
    const cached = getAuthCache()
    if (!cached) return false
    
    // Verify cache is for the current user
    if (cached.userId !== currentUser.id) {
      console.log('👤 Cache user mismatch, clearing cache')
      clearAuthCache()
      return false
    }
    
    console.log('📋 Loading cached auth state:', { isApproved: cached.isApproved, isAdmin: cached.isAdmin })
    setIsApproved(cached.isApproved)
    setIsAdmin(cached.isAdmin)
    setApprovalLoading(false)
    setAuthCacheLoaded(true)
    
    return true
  }, [getAuthCache, clearAuthCache, authCacheLoaded])

  const checkApprovalStatus = useCallback(async (currentSession: Session, forceRefresh = false) => {
    console.log('🔍 Checking approval status for user:', currentSession.user?.email, { forceRefresh })

    // Check if we've checked recently (unless forcing refresh)
    if (!forceRefresh) {
      const now = Date.now()
      const timeSinceLastCheck = now - lastStatusCheck
      
      if (timeSinceLastCheck < MIN_CHECK_INTERVAL) {
        console.log(`⏰ Skipping status check, last checked ${Math.round(timeSinceLastCheck / 1000)}s ago`)
        return
      }
      
      // Try to use cached data first
      if (loadCachedAuthState(currentSession.user)) {
        console.log('✅ Using cached auth state, skipping API call')
        return
      }
    }

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
        
        // Try to get error details
        try {
          const errorData = await response.json()
          console.log('📜 Error response data:', errorData)
          
          // If the server says we need to re-authenticate, sign out automatically
          if (errorData.shouldSignOut || errorData.needsReauth) {
            console.log('🔑 Server indicates re-authentication needed, signing out...')
            clearAuthCache()
            setAuthCacheLoaded(false)
            setLastStatusCheck(0)
            
            // Force sign out and redirect
            await signOut()
            return
          }
        } catch (parseError) {
          console.log('⚠️ Could not parse error response')
        }
        
        setIsApproved(false)
        setIsAdmin(false)
        // Don't cache failed responses
        return
      }

      const data = await response.json()
      console.log('✅ Status API response:', data)

      setIsApproved(data.isApproved)
      setIsAdmin(data.isAdmin)
      
      // Cache the successful response
      setAuthCache(data.isApproved, data.isAdmin, currentSession.user.id)
      setAuthCacheLoaded(true)
      setLastStatusCheck(Date.now())
    } catch (error) {
      console.error('❌ Error checking approval status:', error)
      setIsApproved(false)
      setIsAdmin(false)
      // Don't cache error states
    } finally {
      console.log('🏁 Setting approvalLoading to false')
      setApprovalLoading(false)
    }
  }, [loadCachedAuthState, setAuthCache, lastStatusCheck])

  // Force refresh function for manual cache invalidation
  const refreshAuthState = useCallback(async () => {
    if (!session) {
      console.log('⚠️ No session available for refresh')
      return
    }
    
    console.log('🔄 Force refreshing auth state...')
    clearAuthCache()
    setAuthCacheLoaded(false)
    setLastStatusCheck(0)
    await checkApprovalStatus(session, true)
  }, [session, clearAuthCache])

  // Handle window visibility changes to prevent unnecessary checks
  useEffect(() => {
    if (!isClient) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && session && user) {
        const timeSinceLastCheck = Date.now() - lastStatusCheck
        // Only check if it's been more than 15 minutes since last check
        if (timeSinceLastCheck > 15 * 60 * 1000) {
          console.log('👁️ Tab became visible, checking auth status after long absence')
          checkApprovalStatus(session)
        } else {
          console.log('👁️ Tab became visible, but checked recently - skipping')
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isClient, session, user, lastStatusCheck])

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
      
      // Handle session expiry
      if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Token refreshed, session is still valid')
      } else if (event === 'SIGNED_OUT') {
        console.log('🚪 User signed out, clearing auth state')
        clearAuthCache()
        setAuthCacheLoaded(false)
        setLastStatusCheck(0)
      }
    })

    return () => subscription.unsubscribe()
  }, [isClient])

  // Handle user/session changes with debouncing to prevent excessive checks
  useEffect(() => {
    console.log('👤 User/session changed:', {
      hasUser: !!user,
      hasSession: !!session,
      userEmail: user?.email,
      isClient,
      currentApprovalLoading: approvalLoading,
      currentIsApproved: isApproved,
      currentIsAdmin: isAdmin,
      authCacheLoaded
    })
    
    // Only proceed if client-side
    if (!isClient) {
      console.log('⏳ Not client-side yet, skipping approval checks')
      return
    }
    
    // Check approval status for authenticated users
    if (session && user) {
      console.log('✅ User logged in, checking approval status...')
      // Use a timeout to debounce rapid session changes
      const timeoutId = setTimeout(() => {
        checkApprovalStatus(session)
      }, 100)
      
      return () => clearTimeout(timeoutId)
    } else {
      console.log('❌ No user/session, resetting approval state')
      setIsApproved(false)
      setIsAdmin(false)
      setApprovalLoading(false)
      setAuthCacheLoaded(false)
      setLastStatusCheck(0)
      // Clear cache when user logs out
      clearAuthCache()
    }
  }, [session, user, isClient, clearAuthCache])

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: 'select_account'
        }
      },
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

    return { error }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  const signOut = async () => {
    console.log('🚪 Starting sign out process...')
    
    try {
      // Clear auth cache before signing out
      clearAuthCache()
      setAuthCacheLoaded(false)
      setLastStatusCheck(0)
      
      // Clear local state immediately
      setUser(null)
      setSession(null)
      setIsApproved(false)
      setIsAdmin(false)
      setApprovalLoading(false)
      setLoading(false)
      
      // Clear any cached auth state from localStorage first
      if (typeof window !== 'undefined') {
        console.log('🧽 Clearing localStorage auth data...')
        
        // Clear all possible Supabase auth keys
        const keysToRemove = [
          'supabase.auth.token',
          'sb-blftrjkwaxjggsmjyxeq-auth-token',
          'medguard_auth_cache',
          'medguard_query_cache'
        ]
        
        keysToRemove.forEach(key => {
          localStorage.removeItem(key)
        })
        
        // Clear all localStorage keys that start with 'sb-' (Supabase keys)
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-')) {
            localStorage.removeItem(key)
          }
        })
      }
      
      // Try to sign out from Supabase
      console.log('🔑 Attempting Supabase sign out...')
      await supabase.auth.signOut({ scope: 'global' })
      console.log('✅ Supabase sign out successful')
      
      // Force clear session storage as well
      if (typeof window !== 'undefined') {
        sessionStorage.clear()
        
        // Force a brief redirect to Google's logout to clear their session
        // This is done in a hidden iframe to avoid disrupting the user experience
        const iframe = document.createElement('iframe')
        iframe.style.display = 'none'
        iframe.src = 'https://accounts.google.com/logout'
        document.body.appendChild(iframe)
        
        // Remove the iframe after a short delay
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe)
          }
        }, 1000)
        
        // Force a hard refresh after logout to ensure clean state
        setTimeout(() => {
          window.location.href = '/'
        }, 1500)
      }
      
    } catch (error) {
      console.log('⚠️ Supabase sign out failed, forcing local cleanup:', error)
      
      // Even if Supabase signout fails, ensure local state is cleared
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
        
        // Force redirect to clean state
        setTimeout(() => {
          window.location.href = '/'
        }, 500)
      }
    }
    
    console.log('✅ Sign out process completed')
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
    refreshAuthState,
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
