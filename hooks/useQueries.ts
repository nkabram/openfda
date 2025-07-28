'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useQueryCache } from '@/contexts/QueryCacheContext'
import { useAuth } from '@/contexts/AuthContext'

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

interface UseQueriesOptions {
  onError?: (error: Error) => void
  autoFetch?: boolean
  debounceMs?: number
  filterFn?: (query: any) => boolean
  sortFn?: (a: any, b: any) => number
  limit?: number
}

interface UseQueriesReturn {
  queries: Query[]
  loading: boolean
  error: Error | null
  refetch: (force?: boolean) => Promise<void>
  addQuery: (query: Query) => void
  updateQuery: (queryId: string, updates: Partial<Query>) => void
  deleteQuery: (queryId: string) => Promise<void>
  refreshCache: () => void
  cacheStats: {
    userCount: number
    adminCount: number
    lastUserFetch: number | null
    lastAdminFetch: number | null
  }
  allQueries: Query[]
  batchUpdate: (updateFn: () => void) => void
  flushPendingUpdates: () => void
}

export function useQueries(isAdmin: boolean = false, options: UseQueriesOptions = {}) {
  const { onError, autoFetch = true, debounceMs = 300, filterFn, sortFn, limit } = options
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const { session } = useAuth()
  const { cache, addQuery, updateQuery: updateQueryInCache, removeQuery, setUserQueries, setAdminQueries, refreshCache, clearCache, getCacheStats } = useQueryCache()
  
  // Prevent infinite loops
  const fetchInProgressRef = useRef(false)
  const hasInitializedRef = useRef(false)
  
  // Debouncing refs
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingUpdatesRef = useRef<Array<() => void>>([])

  // Debounced batch update function
  const executeBatchedUpdates = useCallback(() => {
    if (pendingUpdatesRef.current.length === 0) return
    
    const updates = [...pendingUpdatesRef.current]
    pendingUpdatesRef.current = []
    
    // Execute all pending updates in a single batch
    updates.forEach(update => update())
  }, [])
  
  // Debounced function to batch multiple rapid updates
  const debouncedBatchUpdate = useCallback((updateFn: () => void) => {
    pendingUpdatesRef.current.push(updateFn)
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      executeBatchedUpdates()
    }, debounceMs)
  }, [debounceMs, executeBatchedUpdates])

  const fetchQueries = useCallback(async (force: boolean = false) => {
    if (!session?.access_token) {
      console.log('useQueries: No session token available')
      return
    }

    // Prevent infinite loops
    if (fetchInProgressRef.current) {
      console.log('useQueries: Fetch already in progress, skipping')
      return
    }

    // Check cache without depending on cache object to avoid infinite loops
    const cacheStats = getCacheStats()
    const relevantCount = isAdmin ? cacheStats.adminCount : cacheStats.userCount
    const lastFetch = isAdmin ? cacheStats.lastAdminFetch : cacheStats.lastUserFetch
    const cacheAge = lastFetch ? Date.now() - lastFetch : Infinity
    const cacheExpired = cacheAge > (24 * 60 * 60 * 1000) // 24 hours
    
    if (!force && relevantCount > 0 && !cacheExpired) {
      console.log(`useQueries: Using cached ${isAdmin ? 'admin' : 'user'} queries (${relevantCount} items, age: ${Math.round(cacheAge / 1000 / 60)}min)`)
      return
    }

    console.log(`useQueries: Fetching fresh queries (force: ${force}, cached: ${relevantCount}, expired: ${cacheExpired})`)
    
    fetchInProgressRef.current = true
    setLoading(true)
    setError(null)

    try {
      const url = isAdmin ? '/api/queries?view=admin' : '/api/queries'
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch queries: ${response.statusText}`)
      }

      const data = await response.json()
      const fetchedQueries = data.queries || []
      
      console.log(`useQueries: Fetched ${fetchedQueries.length} queries from API`)
      
      // Update cache with fresh data
      if (isAdmin) {
        setAdminQueries(fetchedQueries)
      } else {
        setUserQueries(fetchedQueries)
      }
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred')
      console.error('useQueries: Error fetching queries:', error)
      setError(error)
      onError?.(error)
    } finally {
      setLoading(false)
      fetchInProgressRef.current = false
    }
  }, [session?.access_token, isAdmin, setUserQueries, setAdminQueries, onError, getCacheStats])

  // Auto-fetch on mount and when user/session changes
  useEffect(() => {
    if (autoFetch && session?.access_token && !hasInitializedRef.current) {
      hasInitializedRef.current = true
      fetchQueries()
    }
  }, [session?.access_token, autoFetch]) // Remove fetchQueries from deps to prevent infinite loop

  // Wrapper functions for cache operations
  const addQueryToCache = useCallback((query: any) => {
    console.log('useQueries: Adding query to cache:', query.id)
    debouncedBatchUpdate(() => {
      addQuery(query)
    })
  }, [addQuery, debouncedBatchUpdate])

  const updateQuery = useCallback((queryId: string, updates: Partial<Query>) => {
    console.log('📝 Updating query in cache:', queryId, updates)
    updateQueryInCache(queryId, updates)
  }, [updateQueryInCache])

  const deleteQuery = useCallback(async (queryId: string) => {
    if (!session?.access_token) {
      throw new Error('No session token available')
    }

    try {
      // Optimistic update - remove from cache immediately using batched update
      debouncedBatchUpdate(() => {
        removeQuery(queryId)
      })
      
      const response = await fetch(`/api/queries/${queryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        // If delete failed, we should refetch to restore the query
        await fetchQueries(true)
        throw new Error(`Failed to delete query: ${response.statusText}`)
      }
      
      console.log(`useQueries: Successfully deleted query ${queryId}`)
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred')
      console.error('useQueries: Error deleting query:', error)
      throw error
    }
  }, [session?.access_token, removeQuery, fetchQueries])

  const refetch = useCallback(async (force = false) => {
    await fetchQueries(force)
  }, [fetchQueries])

  const cacheStats = getCacheStats()

  // Memoize queries access to prevent unnecessary re-renders
  const queries = useMemo(() => {
    return isAdmin ? cache.adminQueries : cache.userQueries
  }, [cache.adminQueries, cache.userQueries, isAdmin])
  
  // Memoized processed queries with filtering, sorting, and limiting
  const processedQueries = useMemo(() => {
    let result = queries
    
    // Apply filter if provided
    if (filterFn) {
      result = result.filter(filterFn)
    }
    
    // Apply sort if provided
    if (sortFn) {
      result = [...result].sort(sortFn)
    }
    
    // Apply limit if provided
    if (limit && limit > 0) {
      result = result.slice(0, limit)
    }
    
    return result
  }, [queries, filterFn, sortFn, limit])
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      // Execute any pending updates before cleanup
      if (pendingUpdatesRef.current.length > 0) {
        pendingUpdatesRef.current.forEach(updateFn => updateFn())
        pendingUpdatesRef.current = []
      }
    }
  }, []) // Empty deps - only run on unmount

  return {
    queries: processedQueries,
    allQueries: queries, // Provide access to unfiltered queries if needed
    loading,
    error,
    refetch,
    deleteQuery,
    addQuery: addQueryToCache,
    updateQuery,
    clearCache,
    cacheStats: getCacheStats(),
    // Performance utilities
    batchUpdate: debouncedBatchUpdate,
    flushPendingUpdates: executeBatchedUpdates
  }
}

// Convenience hooks for specific query types
export function useUserQueries(options?: Omit<UseQueriesOptions, 'type'>) {
  return useQueries(false, options)
}

export function useAdminQueries(options: UseQueriesOptions = {}) {
  return useQueries(true, options)
}
