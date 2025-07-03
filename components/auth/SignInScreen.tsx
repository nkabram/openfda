'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Chrome, Shield, Zap, Database } from 'lucide-react'

export function SignInScreen() {
  const { signInWithGoogle, loading } = useAuth()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
            <Database className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            OpenFDA Medication QA
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            AI-powered medication information using FDA data
          </p>
        </div>

        {/* Sign In Card */}
        <Card className="shadow-xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Welcome Back</CardTitle>
            <CardDescription>
              Sign in to access medication information and AI-powered Q&A
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button
              onClick={signInWithGoogle}
              disabled={loading}
              className="w-full h-12 text-base font-medium bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 shadow-sm"
              variant="outline"
            >
              <Chrome className="w-5 h-5 mr-3 text-blue-500" />
              {loading ? 'Signing in...' : 'Continue with Google'}
            </Button>

            {/* Features */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
                What you'll get access to:
              </p>
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                  <Shield className="w-4 h-4 mr-3 text-green-500 flex-shrink-0" />
                  <span>Secure access to FDA medication data</span>
                </div>
                <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                  <Zap className="w-4 h-4 mr-3 text-yellow-500 flex-shrink-0" />
                  <span>AI-powered medication Q&A</span>
                </div>
                <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                  <Database className="w-4 h-4 mr-3 text-blue-500 flex-shrink-0" />
                  <span>Query history and personalized experience</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            By signing in, you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  )
}
