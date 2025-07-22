'use client'

// Updated callback page - route.ts has been removed to fix the deployment conflict
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)

  // Ensure we only run client-side code after hydration
  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    const handleAuthCallback = async () => {
      try {
        console.log('🔄 Auth callback started')
        console.log('🌐 Current URL:', window.location.href)
        console.log('🌐 Origin:', window.location.origin)
        console.log('🌐 Hash:', window.location.hash)
        console.log('🌐 Search:', window.location.search)
        
        // Get the URL hash/fragment which contains the OAuth tokens
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        
        console.log('🔑 Access token present:', !!accessToken)
        console.log('🔑 Refresh token present:', !!refreshToken)
        
        if (accessToken) {
          // Exchange the tokens for a session
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ''
          })
          
          if (error) {
            console.error('Auth callback error:', error)
            // Clean redirect without exposing tokens
            window.history.replaceState({}, document.title, '/')
            router.push('/?error=auth_error')
            return
          }

          if (data.session) {
            console.log('✅ Auth callback successful, session created')
            console.log('👤 User:', data.session.user.email)
            console.log('↩️ Redirecting to home page')
            // Clean redirect to home page without URL fragments
            window.history.replaceState({}, document.title, '/')
            router.push('/')
          } else {
            console.log('⚠️ No session created, redirecting to home')
            window.history.replaceState({}, document.title, '/')
            router.push('/')
          }
        } else {
          console.log('⚠️ No access token in URL hash')
          // No tokens in URL, try to get existing session
          const { data, error } = await supabase.auth.getSession()
          console.log('🔍 Existing session check:', !!data.session)
          
          if (error) {
            console.error('Auth callback error:', error)
            router.push('/?error=auth_error')
            return
          }

          // Clean redirect regardless of session status
          window.history.replaceState({}, document.title, '/')
          router.push('/')
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        // Clean redirect without exposing any tokens
        window.history.replaceState({}, document.title, '/')
        router.push('/?error=auth_error')
      }
    }

    handleAuthCallback()
  }, [router, isClient])

  // Prevent hydration mismatch by not rendering until client-side
  if (!isClient) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-sm text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  )
}
