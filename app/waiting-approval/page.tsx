'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { Loader2, RefreshCw, LogOut } from 'lucide-react'

export default function WaitingForApproval() {
  const { user, signOut, checkApprovalStatus, refreshAuthState, isApproved, isAdmin, loading: authLoading, approvalLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [waitingSince, setWaitingSince] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [shouldRedirect, setShouldRedirect] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    // Only check redirect on client side
    if (!isClient) return
    
    console.log('🔍 WaitingForApproval page - Auth status:', { 
      isApproved, 
      isAdmin, 
      authLoading, 
      approvalLoading,
      isClient 
    })
    
    if ((isApproved || isAdmin) && !authLoading && !approvalLoading) {
      console.log('✅ User is approved or admin, setting redirect flag')
      setShouldRedirect(true)
    }
  }, [isApproved, isAdmin, authLoading, approvalLoading, isClient])

  useEffect(() => {
    if (shouldRedirect) {
      console.log('🚀 Executing redirect to home')
      router.push('/')
    }
  }, [shouldRedirect, router])

  useEffect(() => {
    const fetchWaitingSince = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('created_at')
                .eq('id', user.id)
                .single()

            if (error) throw error
            
            if (data?.created_at) {
                setWaitingSince(new Date(data.created_at).toLocaleDateString())
            }
        } catch (err) {
            console.error("Error fetching registration date:", err)
        }
    }
    fetchWaitingSince();
  }, [user])


  const handleRefresh = async () => {
    setLoading(true)
    setError(null)
    try {
      // Force a refresh by calling the auth context refresh method
      await refreshAuthState()
    } catch (err) {
      setError('Failed to refresh approval status. Please try again.')
      console.error('Error refreshing approval status:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/') // Or a dedicated login page
  }

  // During server-side rendering or hydration, return a simple div
  // This prevents hydration errors by ensuring the server and client render the same content
  if (!isClient) {
    return <div data-waiting-approval-loading></div>
  }

  // If user should redirect, show loading while redirect happens
  // The actual redirect is handled by the useEffect above
  if (shouldRedirect) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="mt-2 text-sm text-muted-foreground">Redirecting to application...</p>
        </div>
      </div>
    )
  }
  
  // While checking status, show a loader
  if (authLoading || approvalLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle>Approval Pending</CardTitle>
          <CardDescription>
            Your account is currently awaiting administrator approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Thank you for signing up! We've received your registration and an administrator will review your account shortly.</p>
          {waitingSince && (
            <p className="text-sm text-muted-foreground">
              You registered on: {waitingSince}
            </p>
          )}
          <p className="text-sm">
            If you have any questions, please contact support at <a href="mailto:support@example.com" className="text-primary hover:underline">support@example.com</a>.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
          <Button onClick={handleRefresh} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh Status
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
