/**
 * Authentication utilities for handling OAuth redirects in different environments
 */

/**
 * Get the appropriate redirect URL for OAuth based on the current environment
 */
export function getOAuthRedirectUrl(): string {
  if (typeof window === 'undefined') {
    // Server-side fallback - use environment variable or default
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    return `${baseUrl}/auth/callback`
  }

  // For GitHub Codespaces, use the codespace URL
  if (window.location.hostname.includes('.app.github.dev')) {
    const origin = window.location.origin
    console.log('🚀 GitHub Codespace detected:', origin)
    return `${origin}/auth/callback`
  }
  
  // For local development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const origin = window.location.origin
    console.log('🏠 Local development detected:', origin)
    return `${origin}/auth/callback`
  }

  // Always use the current window location origin for maximum compatibility
  const origin = window.location.origin
  console.log('🌐 Using current origin for OAuth:', origin)
  
  return `${origin}/auth/callback`
}

/**
 * Check if we're in a development environment
 */
export function isDevelopment(): boolean {
  if (typeof window === 'undefined') {
    return process.env.NODE_ENV === 'development'
  }
  
  return window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1' ||
         window.location.hostname.includes('.local') ||
         window.location.hostname.includes('.app.github.dev')  // GitHub Codespaces
}

/**
 * Get environment-specific configuration for Supabase auth
 */
export function getAuthConfig() {
  const redirectUrl = getOAuthRedirectUrl()
  const isDev = isDevelopment()
  
  console.log('🔧 Auth config generated:', {
    redirectUrl,
    isDevelopment: isDev,
    currentOrigin: typeof window !== 'undefined' ? window.location.origin : 'server-side'
  })
  
  return {
    redirectUrl,
    isDevelopment: isDev,
    // Add additional query params for development to help with debugging
    queryParams: {
      prompt: 'select_account',
      ...(isDev && { dev: '1' })
    }
  }
}
