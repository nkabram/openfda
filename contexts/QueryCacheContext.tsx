'use client'

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useAuth } from './AuthContext'

interface Query {
  id: string
  user_query: string
  medication_name: string | null
  ai_response: string
  created_at: string
  message_count?: number
  user_id?: string
  profiles?: {
    email: string
    full_name: string
  }
  user_email?: string
  user_name?: string
}

interface CacheHealth {
  status: 'healthy' | 'warning' | 'error'
  message: string
  lastError?: Error
}

interface QueryCache {
  userQueries: Query[]
  adminQueries: Query[]
  lastFetchTime: {
    user: number | null
    admin: number | null
  }
  version: number
  userId?: string
}

interface PersistedQueryCache {
  userQueries: Query[]
  adminQueries: Query[]
  lastFetchTime: {
    user: number | null
    admin: number | null
  }
  version: number
  userId: string
  timestamp: number
}

interface QueryCacheContextType {
  cache: QueryCache
  setUserQueries: (queries: Query[]) => void
  setAdminQueries: (queries: Query[]) => void
  invalidateUserQueries: () => void
  invalidateAdminQueries: () => void
  lastError: Error | null
  clearError: () => void
  resetCache: () => void
  getCacheHealth: () => {
    status: 'healthy' | 'warning' | 'error'
    message: string
    lastError?: Error
  }
  getCacheStorageInfo: () => {
    used: number
    cacheUsed?: number
    available: number
    percentage: number
    isNearLimit?: boolean
  }
  shouldRefetch: (type: 'user' | 'admin', maxAge?: number) => boolean
  updateQuery: (queryId: string, updates: Partial<Query>) => void
  removeQuery: (queryId: string) => void
  addQuery: (query: Query) => void
  refreshCache: (type?: 'user' | 'admin' | 'both') => void
  clearCache: () => void
  getCacheStats: () => { userCount: number; adminCount: number; lastUserFetch: number | null; lastAdminFetch: number | null }
}

const QueryCacheContext = createContext<QueryCacheContextType | undefined>(undefined)

// Cache configuration
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours default cache
const CACHE_EXPIRY_TIME = CACHE_DURATION // Alias for consistency
const QUERY_CACHE_KEY = 'medguard_query_cache'
const CACHE_VERSION = 1
const isClient = typeof window !== 'undefined'

export function QueryCacheProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [cache, setCache] = useState<QueryCache>({
    userQueries: [],
    adminQueries: [],
    lastFetchTime: {
      user: null,
      admin: null
    },
    version: CACHE_VERSION,
    userId: user?.id
  })
  const [cacheLoaded, setCacheLoaded] = useState(false)
  const [lastError, setLastError] = useState<Error | null>(null)
  const [errorCount, setErrorCount] = useState(0)

  // Track pending updates to avoid race conditions
  const pendingUpdates = useRef(new Set<string>())
  const currentUserId = useRef<string | null>(null)

  // Error handling utilities
  const handleError = useCallback((error: Error, context: string) => {
    console.error(`QueryCache Error [${context}]:`, error)
    setLastError(error)
    setErrorCount(prev => {
      const newCount = prev + 1
      
      // If we have too many errors, reset the cache
      if (newCount > 5) {
        console.warn('QueryCache: Too many errors, resetting cache')
        // Reset cache directly to avoid circular dependency
        setTimeout(() => {
          if (isClient) {
            try {
              localStorage.removeItem(QUERY_CACHE_KEY)
            } catch (clearError) {
              console.warn('Failed to clear localStorage:', clearError)
            }
          }
          
          setCache({
            userQueries: [],
            adminQueries: [],
            lastFetchTime: {
              user: null,
              admin: null
            },
            version: CACHE_VERSION,
            userId: user?.id
          })
          
          setLastError(null)
          setErrorCount(0)
          setCacheLoaded(true)
        }, 0)
      }
      
      return newCount
    })
  }, [user?.id])

  const clearError = useCallback(() => {
    setLastError(null)
    setErrorCount(0)
  }, [])

  const resetCache = useCallback(() => {
    console.log('🔄 QueryCache: Resetting cache to default state')
    if (isClient) {
      try {
        localStorage.removeItem(QUERY_CACHE_KEY)
      } catch (error) {
        console.warn('Failed to clear localStorage:', error)
      }
    }
    
    setCache({
      userQueries: [],
      adminQueries: [],
      lastFetchTime: {
        user: null,
        admin: null
      },
      version: CACHE_VERSION,
      userId: user?.id
    })
    
    setLastError(null)
    setErrorCount(0)
    setCacheLoaded(true)
  }, [user?.id])

  // Utility functions for localStorage operations
  const getPersistedCache = useCallback((): PersistedQueryCache | null => {
    if (!isClient) return null
    
    try {
      const cached = localStorage.getItem(QUERY_CACHE_KEY)
      if (!cached) return null
      
      const parsed: PersistedQueryCache = JSON.parse(cached)
      
      // Validate cache structure
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid cache structure')
      }
      
      // Validate required fields
      if (!parsed.userQueries || !Array.isArray(parsed.userQueries) ||
          !parsed.adminQueries || !Array.isArray(parsed.adminQueries) ||
          !parsed.lastFetchTime || typeof parsed.lastFetchTime !== 'object') {
        throw new Error('Missing required cache fields')
      }
      
      // Validate cache version
      if (!parsed.version || parsed.version !== CACHE_VERSION) {
        console.log('🗑️ Query cache version mismatch, clearing cache')
        localStorage.removeItem(QUERY_CACHE_KEY)
        return null
      }
      
      // Check if cache is expired
      if (!parsed.timestamp || Date.now() - parsed.timestamp > CACHE_DURATION) {
        console.log('⏰ Query cache expired, clearing cache')
        localStorage.removeItem(QUERY_CACHE_KEY)
        return null
      }
      
      // Validate user ID if available
      if (currentUserId.current && parsed.userId !== currentUserId.current) {
        console.log('👤 Query cache user mismatch, clearing cache')
        localStorage.removeItem(QUERY_CACHE_KEY)
        return null
      }
      
      console.log('💾 Loaded query cache from localStorage', {
        userQueries: parsed.userQueries.length,
        adminQueries: parsed.adminQueries.length,
        age: Math.round((Date.now() - parsed.timestamp) / 1000 / 60) + ' minutes'
      })
      
      return parsed
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown cache error')
      handleError(err, 'getPersistedCache')
      
      // Try to recover by clearing corrupted cache
      try {
        localStorage.removeItem(QUERY_CACHE_KEY)
      } catch (clearError) {
        console.warn('Failed to clear corrupted cache:', clearError)
      }
      
      return null
    }
  }, [handleError])
  
  const persistCache = useCallback((cacheData: QueryCache, userId: string) => {
    if (!isClient) return
    
    try {
      // Create a lightweight version of queries for caching
      const createLightweightQuery = (query: Query) => ({
        id: query.id,
        user_query: query.user_query,
        medication_name: query.medication_name,
        // Truncate AI response to save space (keep first 500 chars)
        ai_response: query.ai_response.length > 500 ? 
          query.ai_response.substring(0, 500) + '...[truncated]' : 
          query.ai_response,
        created_at: query.created_at,
        message_count: query.message_count,
        user_id: query.user_id,
        // Keep profile info but remove large fields
        profiles: query.profiles ? {
          email: query.profiles.email,
          full_name: query.profiles.full_name
        } : undefined,
        user_email: query.user_email,
        user_name: query.user_name
      })
      
      const persistedCache: PersistedQueryCache = {
        userQueries: cacheData.userQueries.map(createLightweightQuery),
        adminQueries: cacheData.adminQueries.map(createLightweightQuery),
        lastFetchTime: cacheData.lastFetchTime,
        version: CACHE_VERSION,
        userId,
        timestamp: Date.now()
      }
      
      const cacheString = JSON.stringify(persistedCache)
      const cacheSizeKB = Math.round(cacheString.length / 1024)
      
      // Check if cache is too large (limit to 4MB to be safe)
      if (cacheString.length > 4 * 1024 * 1024) {
        console.warn(`Cache too large (${cacheSizeKB}KB), reducing data...`)
        
        // Keep only the most recent 20 queries for each type
        const recentUserQueries = cacheData.userQueries
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 20)
          .map(createLightweightQuery)
          
        const recentAdminQueries = cacheData.adminQueries
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 20)
          .map(createLightweightQuery)
        
        const reducedCache: PersistedQueryCache = {
          userQueries: recentUserQueries,
          adminQueries: recentAdminQueries,
          lastFetchTime: cacheData.lastFetchTime,
          version: CACHE_VERSION,
          userId,
          timestamp: Date.now()
        }
        
        localStorage.setItem(QUERY_CACHE_KEY, JSON.stringify(reducedCache))
        console.log('💾 Persisted reduced query cache to localStorage', {
          userQueries: recentUserQueries.length,
          adminQueries: recentAdminQueries.length,
          sizeKB: Math.round(JSON.stringify(reducedCache).length / 1024)
        })
      } else {
        localStorage.setItem(QUERY_CACHE_KEY, cacheString)
        console.log('💾 Persisted query cache to localStorage', {
          userQueries: cacheData.userQueries.length,
          adminQueries: cacheData.adminQueries.length,
          sizeKB: cacheSizeKB
        })
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown persist error')
      handleError(err, 'persistCache')
      
      // If localStorage is full, try to clear old data
      if (err.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, clearing cache')
        try {
          localStorage.removeItem(QUERY_CACHE_KEY)
          // Also clear any other large items that might be taking space
          const keysToCheck = ['medguard_auth_cache', 'supabase.auth.token']
          keysToCheck.forEach(key => {
            try {
              const item = localStorage.getItem(key)
              if (item && item.length > 10000) {
                console.log(`Clearing large localStorage item: ${key} (${Math.round(item.length/1024)}KB)`)
                localStorage.removeItem(key)
              }
            } catch (e) {
              // Ignore errors when checking individual items
            }
          })
        } catch (clearError) {
          console.error('Failed to clear cache:', clearError)
        }
      }
    }
  }, [isClient, handleError])
  
  const clearPersistedCache = useCallback(() => {
    if (!isClient) return
    
    try {
      localStorage.removeItem(QUERY_CACHE_KEY)
      console.log('🗑️ Cleared persisted query cache')
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown clear error')
      handleError(err, 'clearPersistedCache')
    }
  }, [handleError])
  
  // Cache health monitoring
  const getCacheHealth = useCallback((): CacheHealth => {
    const now = Date.now()
    const userCacheAge = cache.lastFetchTime.user ? now - cache.lastFetchTime.user : Infinity
    const adminCacheAge = cache.lastFetchTime.admin ? now - cache.lastFetchTime.admin : Infinity
    const oldestCacheAge = Math.max(userCacheAge, adminCacheAge)
    
    if (lastError) {
      return {
        status: 'error',
        message: `Cache error: ${lastError.message}`,
        lastError
      }
    }
    
    if (oldestCacheAge > CACHE_EXPIRY_TIME) {
      return {
        status: 'warning',
        message: 'Cache is stale and needs refresh'
      }
    }
    
    return {
      status: 'healthy',
      message: 'Cache is fresh and healthy'
    }
  }, [cache.lastFetchTime, lastError])
  
  const getCacheStorageInfo = useCallback(() => {
    if (!isClient) return { used: 0, available: 0, percentage: 0 }
    
    try {
      let totalUsed = 0
      let cacheUsed = 0
      
      // Calculate total localStorage usage
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          const item = localStorage.getItem(key)
          if (item) {
            const size = item.length
            totalUsed += size
            if (key === QUERY_CACHE_KEY) {
              cacheUsed = size
            }
          }
        }
      }
      
      // Estimate available space (most browsers limit to ~5-10MB)
      const estimatedLimit = 5 * 1024 * 1024 // 5MB conservative estimate
      const available = Math.max(0, estimatedLimit - totalUsed)
      const percentage = Math.round((totalUsed / estimatedLimit) * 100)
      
      return {
        used: Math.round(totalUsed / 1024), // KB
        cacheUsed: Math.round(cacheUsed / 1024), // KB
        available: Math.round(available / 1024), // KB
        percentage,
        isNearLimit: percentage > 80
      }
    } catch (error) {
      console.warn('Failed to calculate storage info:', error)
      return { used: 0, available: 0, percentage: 0 }
    }
  }, [isClient])
  
  // Load cache from localStorage on mount and when user changes
  useEffect(() => {
    if (!isClient) return
    
    // Update current user ID
    currentUserId.current = user?.id || null
    
    // Clear cache if user changed
    if (user?.id && cache.userId && cache.userId !== user.id) {
      console.log('👤 User changed, clearing cache')
      clearPersistedCache()
      setCache({
        userQueries: [],
        adminQueries: [],
        lastFetchTime: {
          user: null,
          admin: null
        },
        version: CACHE_VERSION,
        userId: user.id
      })
      setCacheLoaded(true)
      return
    }
    
    // Load persisted cache if user matches
    const persistedCache = getPersistedCache()
    if (persistedCache && user?.id === persistedCache.userId) {
      setCache({
        userQueries: persistedCache.userQueries,
        adminQueries: persistedCache.adminQueries,
        lastFetchTime: persistedCache.lastFetchTime,
        version: CACHE_VERSION,
        userId: persistedCache.userId
      })
    } else if (user?.id) {
      // Set user ID for new cache
      setCache(prev => ({
        ...prev,
        userId: user.id
      }))
    }
    
    setCacheLoaded(true)
  }, [user?.id, clearPersistedCache])

  const setUserQueries = useCallback((queries: Query[]) => {
    setCache(prev => {
      const newCache = {
        ...prev,
        userQueries: queries,
        lastFetchTime: {
          ...prev.lastFetchTime,
          user: Date.now()
        }
      }
      
      // Persist to localStorage if user ID is available
      if (currentUserId.current) {
        persistCache(newCache, currentUserId.current)
      }
      
      return newCache
    })
  }, [persistCache])

  const setAdminQueries = useCallback((queries: Query[]) => {
    setCache(prev => {
      const newCache = {
        ...prev,
        adminQueries: queries,
        lastFetchTime: {
          ...prev.lastFetchTime,
          admin: Date.now()
        }
      }
      
      // Persist to localStorage if user ID is available
      if (currentUserId.current) {
        persistCache(newCache, currentUserId.current)
      }
      
      return newCache
    })
  }, [persistCache])

  const invalidateUserQueries = useCallback(() => {
    setCache(prev => {
      const newCache = {
        ...prev,
        lastFetchTime: {
          ...prev.lastFetchTime,
          user: null
        }
      }
      
      // Update persisted cache
      if (currentUserId.current) {
        persistCache(newCache, currentUserId.current)
      }
      
      return newCache
    })
  }, [persistCache])

  const invalidateAdminQueries = useCallback(() => {
    setCache(prev => {
      const newCache = {
        ...prev,
        lastFetchTime: {
          ...prev.lastFetchTime,
          admin: null
        }
      }
      
      // Update persisted cache
      if (currentUserId.current) {
        persistCache(newCache, currentUserId.current)
      }
      
      return newCache
    })
  }, [persistCache])

  const shouldRefetch = useCallback((type: 'user' | 'admin', maxAge: number = CACHE_DURATION) => {
    const lastFetch = cache.lastFetchTime[type]
    if (!lastFetch) return true
    return Date.now() - lastFetch > maxAge
  }, [cache.lastFetchTime])

  const updateQuery = useCallback((queryId: string, updates: Partial<Query>) => {
    // Add to pending updates to prevent race conditions
    pendingUpdates.current.add(queryId)

    setCache(prev => {
      const newCache = {
        ...prev,
        userQueries: prev.userQueries.map(q => 
          q.id === queryId ? { ...q, ...updates } : q
        ),
        adminQueries: prev.adminQueries.map(q => 
          q.id === queryId ? { ...q, ...updates } : q
        )
      }
      
      // Persist updated cache
      if (currentUserId.current) {
        persistCache(newCache, currentUserId.current)
      }
      
      return newCache
    })

    // Remove from pending after a short delay
    setTimeout(() => {
      pendingUpdates.current.delete(queryId)
    }, 100)
  }, [persistCache])

  const removeQuery = useCallback((queryId: string) => {
    setCache(prev => {
      const newCache = {
        ...prev,
        userQueries: prev.userQueries.filter(q => q.id !== queryId),
        adminQueries: prev.adminQueries.filter(q => q.id !== queryId)
      }
      
      // Persist updated cache
      if (currentUserId.current) {
        persistCache(newCache, currentUserId.current)
      }
      
      return newCache
    })
  }, [persistCache])

  const addQuery = useCallback((query: Query) => {
    setCache(prev => {
      const newCache = {
        ...prev,
        userQueries: [query, ...prev.userQueries],
        adminQueries: [query, ...prev.adminQueries]
      }
      
      // Persist updated cache
      if (currentUserId.current) {
        persistCache(newCache, currentUserId.current)
      }
      
      return newCache
    })
  }, [persistCache])
  
  // New utility functions
  const refreshCache = useCallback((type: 'user' | 'admin' | 'both' = 'both') => {
    console.log('🔄 Refreshing query cache:', type)
    
    if (type === 'user' || type === 'both') {
      invalidateUserQueries()
    }
    if (type === 'admin' || type === 'both') {
      invalidateAdminQueries()
    }
  }, [invalidateUserQueries, invalidateAdminQueries])
  
  const clearCache = useCallback(() => {
    console.log('🗑️ Clearing all query cache')
    
    setCache({
      userQueries: [],
      adminQueries: [],
      lastFetchTime: {
        user: null,
        admin: null
      },
      version: CACHE_VERSION
    })
    
    clearPersistedCache()
    currentUserId.current = null
  }, [clearPersistedCache])
  
  const getCacheStats = useCallback(() => {
    return {
      userCount: cache.userQueries.length,
      adminCount: cache.adminQueries.length,
      lastUserFetch: cache.lastFetchTime.user,
      lastAdminFetch: cache.lastFetchTime.admin
    }
  }, [cache])
  
  // Clear cache when user logs out
  useEffect(() => {
    if (!user && cache.userQueries.length > 0) {
      console.log('🚪 User logged out, clearing cache')
      clearCache()
    }
  }, [user, cache.userQueries.length, clearCache])

  const value: QueryCacheContextType = useMemo(() => ({
    cache,
    setUserQueries,
    setAdminQueries,
    invalidateUserQueries,
    invalidateAdminQueries,
    shouldRefetch,
    updateQuery,
    removeQuery,
    addQuery,
    refreshCache,
    clearCache,
    getCacheStats,
    lastError,
    clearError,
    resetCache,
    getCacheHealth,
    getCacheStorageInfo
  }), [
    cache,
    setUserQueries,
    setAdminQueries,
    invalidateUserQueries,
    invalidateAdminQueries,
    shouldRefetch,
    updateQuery,
    removeQuery,
    addQuery,
    refreshCache,
    clearCache,
    getCacheStats,
    lastError,
    clearError,
    resetCache,
    getCacheHealth,
    getCacheStorageInfo
  ])
  
  // Don't render until cache is loaded to prevent hydration issues
  if (!cacheLoaded) {
    return null
  }

  return (
    <QueryCacheContext.Provider value={value}>
      {children}
    </QueryCacheContext.Provider>
  )
}

export function useQueryCache() {
  const context = useContext(QueryCacheContext)
  if (!context) {
    throw new Error('useQueryCache must be used within a QueryCacheProvider')
  }
  return context
}
