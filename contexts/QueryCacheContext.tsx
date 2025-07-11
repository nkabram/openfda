'use client'

import React, { createContext, useContext, useState, useCallback, useRef } from 'react'

interface Query {
  id: string
  user_query: string
  medication_name: string
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

interface QueryCache {
  userQueries: Query[]
  adminQueries: Query[]
  lastFetchTime: {
    user: number | null
    admin: number | null
  }
}

interface QueryCacheContextType {
  cache: QueryCache
  setUserQueries: (queries: Query[]) => void
  setAdminQueries: (queries: Query[]) => void
  invalidateUserQueries: () => void
  invalidateAdminQueries: () => void
  shouldRefetch: (type: 'user' | 'admin', maxAge?: number) => boolean
  updateQuery: (queryId: string, updates: Partial<Query>) => void
  removeQuery: (queryId: string) => void
  addQuery: (query: Query) => void
}

const QueryCacheContext = createContext<QueryCacheContextType | undefined>(undefined)

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes default cache

export function QueryCacheProvider({ children }: { children: React.ReactNode }) {
  const [cache, setCache] = useState<QueryCache>({
    userQueries: [],
    adminQueries: [],
    lastFetchTime: {
      user: null,
      admin: null
    }
  })

  // Track pending updates to avoid race conditions
  const pendingUpdates = useRef(new Set<string>())

  const setUserQueries = useCallback((queries: Query[]) => {
    setCache(prev => ({
      ...prev,
      userQueries: queries,
      lastFetchTime: {
        ...prev.lastFetchTime,
        user: Date.now()
      }
    }))
  }, [])

  const setAdminQueries = useCallback((queries: Query[]) => {
    setCache(prev => ({
      ...prev,
      adminQueries: queries,
      lastFetchTime: {
        ...prev.lastFetchTime,
        admin: Date.now()
      }
    }))
  }, [])

  const invalidateUserQueries = useCallback(() => {
    setCache(prev => ({
      ...prev,
      lastFetchTime: {
        ...prev.lastFetchTime,
        user: null
      }
    }))
  }, [])

  const invalidateAdminQueries = useCallback(() => {
    setCache(prev => ({
      ...prev,
      lastFetchTime: {
        ...prev.lastFetchTime,
        admin: null
      }
    }))
  }, [])

  const shouldRefetch = useCallback((type: 'user' | 'admin', maxAge: number = CACHE_DURATION) => {
    const lastFetch = cache.lastFetchTime[type]
    if (!lastFetch) return true
    return Date.now() - lastFetch > maxAge
  }, [cache.lastFetchTime])

  const updateQuery = useCallback((queryId: string, updates: Partial<Query>) => {
    // Add to pending updates to prevent race conditions
    pendingUpdates.current.add(queryId)

    setCache(prev => ({
      ...prev,
      userQueries: prev.userQueries.map(q => 
        q.id === queryId ? { ...q, ...updates } : q
      ),
      adminQueries: prev.adminQueries.map(q => 
        q.id === queryId ? { ...q, ...updates } : q
      )
    }))

    // Remove from pending after a short delay
    setTimeout(() => {
      pendingUpdates.current.delete(queryId)
    }, 100)
  }, [])

  const removeQuery = useCallback((queryId: string) => {
    setCache(prev => ({
      ...prev,
      userQueries: prev.userQueries.filter(q => q.id !== queryId),
      adminQueries: prev.adminQueries.filter(q => q.id !== queryId)
    }))
  }, [])

  const addQuery = useCallback((query: Query) => {
    setCache(prev => ({
      ...prev,
      userQueries: [query, ...prev.userQueries],
      adminQueries: [query, ...prev.adminQueries]
    }))
  }, [])

  const value: QueryCacheContextType = {
    cache,
    setUserQueries,
    setAdminQueries,
    invalidateUserQueries,
    invalidateAdminQueries,
    shouldRefetch,
    updateQuery,
    removeQuery,
    addQuery
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
