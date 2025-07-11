'use client'

import { AuthProvider } from '@/contexts/AuthContext'
import { QueryCacheProvider } from '@/contexts/QueryCacheContext'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <QueryCacheProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </QueryCacheProvider>
    </AuthProvider>
  )
}
