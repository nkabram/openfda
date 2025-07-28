import { NextRequest } from 'next/server'

/**
 * Get the base URL for internal API calls from the request headers
 * This works in both development and production environments
 */
export function getBaseUrl(request: NextRequest): string {
  // Priority order: x-forwarded-host (for proxied environments like Codespaces), then host
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = forwardedHost || request.headers.get('host') || 'localhost:3000'
  
  // Use forwarded protocol if available, otherwise detect based on host
  const protocol = request.headers.get('x-forwarded-proto') || 
                  (host.includes('localhost') ? 'http' : 'https')
  
  return `${protocol}://${host}`
}

/**
 * Alternative method using environment variables with fallback
 * Use this when request headers are not available
 */
export function getBaseUrlFromEnv(): string {
  // Check for Vercel deployment
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  
  // Check for custom base URL
  if (process.env.NEXT_PUBLIC_BASE_URL && !process.env.NEXT_PUBLIC_BASE_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_BASE_URL
  }
  
  // Development fallback
  return 'http://localhost:3000'
}
