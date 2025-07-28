'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getAuthConfig } from '@/lib/auth-utils'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<{ error: any }>
  signUpWithEmail: (email: string, password: string, fullName?: string) => Promise<{ error: any }>
  resetPassword: (email: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      
      setLoading(false)
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('� Auth state changed:', event, session?.user?.email || 'No session')
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false) // Set loading to false after auth state change

  useEffect(() => {
    if (!isClient) return

    const initAuth = async () => {
      console.log('🚀 Initializing auth...')
      const { data: { session } } = await supabase.auth.getSession()
      console.log('📱 Initial session:', session?.user?.email || 'No session')
      
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        await checkAdminStatus(session.user.id)
      }
      
      setLoading(false)
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user?.email || 'No session')
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        // User signed in, set loading to false
        setLoading(false)
      } else {
        setLoading(false) // Set loading to false when there's no user
      }
      
      // Clean up URL fragments after successful authentication
      if (event === 'SIGNED_IN' && typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        if (url.hash.includes('access_token') || url.hash.includes('refresh_token')) {
          window.history.replaceState({}, document.title, url.pathname + url.search)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [isClient])

  const signInWithGoogle = async () => {
    const authConfig = getAuthConfig()
    
    console.log('🔑 Starting Google OAuth sign in...')
    console.log('🌐 Current origin:', window.location.origin)
    console.log('↩️ Redirect URL:', authConfig.redirectUrl)
    console.log('🛠️ Development mode:', authConfig.isDevelopment)
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo: authConfig.redirectUrl,
        queryParams: authConfig.queryParams
      },
    })
    
    if (error) {
      console.error('❌ Error signing in with Google:', error.message)
      console.error('❌ Error details:', error)
      
      if (error.message.includes('redirect') || error.message.includes('URL')) {
        console.error('🚨 REDIRECT URL ERROR:')
        console.error('🚨 Make sure the following URL is added to your Supabase project\'s OAuth settings:')
        console.error('🚨', authConfig.redirectUrl)
        console.error('🚨 Go to: Supabase Dashboard > Authentication > URL Configuration > Redirect URLs')
      }
    } else {
      console.log('✅ Google OAuth initiated successfully')
    }
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
    const authConfig = getAuthConfig()
    const resetUrl = authConfig.redirectUrl.replace('/auth/callback', '/reset-password')
    
    console.log('🔄 Sending password reset email to:', email)
    console.log('↩️ Reset redirect URL:', resetUrl)
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetUrl,
    })
    
    if (error) {
      console.error('❌ Password reset error:', error)
    } else {
      console.log('✅ Password reset email sent successfully')
    }
    
    return { error }
  }

  const signOut = async () => {
    console.log('🚪 Starting sign out process...')
    
    try {
      // Clear local state immediately
      setUser(null)
      setSession(null)
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
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    signOut,
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
