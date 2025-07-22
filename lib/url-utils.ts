import { NextRequest } from 'next/server'

/**
 * Get the base URL for internal API calls from the request headers
 * This works in both development and production environments
 */
export function getBaseUrl(request: NextRequest): string {
  // In production, use the forwarded protocol and host
  const protocol = request.headers.get('x-forwarded-proto') || 
                  (request.headers.get('host')?.includes('localhost') ? 'http' : 'https')
  const host = request.headers.get('host') || 'localhost:3000'
  
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
