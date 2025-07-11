'use client'

// Updated callback page - route.ts has been removed to fix the deployment conflict
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the URL hash/fragment which contains the OAuth tokens
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        
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
            console.log('Auth callback successful, redirecting to home')
            // Clean redirect to home page without URL fragments
            window.history.replaceState({}, document.title, '/')
            router.push('/')
          } else {
            console.log('No session created, redirecting to home')
            window.history.replaceState({}, document.title, '/')
            router.push('/')
          }
        } else {
          // No tokens in URL, try to get existing session
          const { data, error } = await supabase.auth.getSession()
          
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
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-sm text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  )
}
