'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { MedicationQueryForm } from '../components/medication-query-form'
import { QueryHistory } from '../components/query-history'
import { AdminQueryHistory } from '../components/admin-query-history'
import { AuthWrapper } from '../components/auth/AuthWrapper'
import { DisclaimerModal } from '../components/disclaimer-modal'
import { ProjectConsentModal } from '../components/ProjectConsentModal'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { PanelLeft, PanelLeftOpen, Plus, User, Users, Settings } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useQueryCache } from '@/contexts/QueryCacheContext'
import { ThemeToggle } from '@/components/theme-toggle'
import { CacheDebugger } from '@/components/debug/CacheDebugger'

// Dynamically import AuthGuard to prevent hydration issues, not sure. 
const AuthGuard = dynamic(() => import('../components/auth/AuthGuard').then(mod => ({ default: mod.AuthGuard })), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
})

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // Default closed on mobile
  const [queryRefreshTrigger, setQueryRefreshTrigger] = useState(0)
  const [selectedQuery, setSelectedQuery] = useState<any>(null)
  const [newQueryTrigger, setNewQueryTrigger] = useState(0)
  const [viewMode, setViewMode] = useState<'user' | 'admin'>('user')
  const [showCacheDebugger, setShowCacheDebugger] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const { isAdmin } = useAuth()
  const { invalidateUserQueries, invalidateAdminQueries } = useQueryCache()
  
  // Show cache debugger in development mode
  const isDevelopment = process.env.NODE_ENV === 'development'

  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      console.log('📱 Mobile check:', { width: window.innerWidth, mobile, currentIsMobile: isMobile })
      setIsMobile(mobile)
      // Auto-close sidebar on mobile, auto-open on desktop
      if (mobile && isSidebarOpen) {
        console.log('📱 Auto-closing sidebar on mobile')
        setIsSidebarOpen(false)
      } else if (!mobile && !isSidebarOpen) {
        const savedState = localStorage.getItem('sidebarOpen')
        if (savedState !== null) {
          setIsSidebarOpen(JSON.parse(savedState))
        } else {
          setIsSidebarOpen(true) // Default open on desktop
        }
      }
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [isSidebarOpen])

  // Load sidebar state from localStorage on mount (desktop only)
  useEffect(() => {
    if (!isMobile) {
      const savedState = localStorage.getItem('sidebarOpen')
      if (savedState !== null) {
        setIsSidebarOpen(JSON.parse(savedState))
      }
    }
  }, [isMobile])

  // Save sidebar state to localStorage when it changes (desktop only)
  const toggleSidebar = (open: boolean) => {
    console.log('🔄 Toggling sidebar:', { open, isMobile, currentState: isSidebarOpen })
    setIsSidebarOpen(open)
    if (!isMobile) {
      localStorage.setItem('sidebarOpen', JSON.stringify(open))
    }
  }

  const handleQuerySaved = () => {
    // Invalidate cache to force refresh
    invalidateUserQueries()
    invalidateAdminQueries()
    // Trigger a refresh of the query history
    setQueryRefreshTrigger(prev => prev + 1)
  }

  const handleNewQuery = () => {
    setSelectedQuery(null)
    setNewQueryTrigger(prev => prev + 1)
  }

  const handleQuerySelected = (query: any) => {
    setSelectedQuery(query)
  }

  const handleCreatePersonalQuery = () => {
    setViewMode('user')
    setSelectedQuery(null)
    setNewQueryTrigger(prev => prev + 1)
  }

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'user' ? 'admin' : 'user')
    setSelectedQuery(null)
  }

  return (
    <>
      <AuthGuard>
        <div className="min-h-screen bg-background relative">
          {/* Mobile overlay backdrop */}
          {isMobile && isSidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-40 md:hidden" 
              onClick={() => toggleSidebar(false)}
            />
          )}
          
          <div className="flex">
            {/* Sidebar */}
            <div className={`
              ${isMobile ? 'fixed left-0 top-0 h-full z-50 w-80' : 'relative'}
              ${!isMobile ? (isSidebarOpen ? 'w-80' : 'w-0') : ''} 
              transition-all duration-300 ease-in-out overflow-hidden 
              bg-background border-r border-border
              ${isSidebarOpen ? 'shadow-lg' : ''}
              ${isMobile ? (isSidebarOpen ? 'translate-x-0' : '-translate-x-full') : ''}
            `}>
            <div className="h-full">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">
                      {viewMode === 'admin' ? 'All Queries' : 'My Queries'}
                    </h2>
                    {viewMode === 'admin' && (
                      <Badge variant="secondary" className="text-xs">
                        Admin View
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleSidebar(false)}
                    title="Collapse sidebar"
                    className="hover:bg-muted transition-colors"
                  >
                    <PanelLeft className="h-4 w-4" />
                  </Button>
                </div>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleViewMode}
                    className="w-full flex items-center gap-2"
                  >
                    {viewMode === 'user' ? (
                      <>
                        <Users className="h-4 w-4" />
                        View All Queries
                      </>
                    ) : (
                      <>
                        <User className="h-4 w-4" />
                        View My Queries
                      </>
                    )}
                  </Button>
                )}
              </div>
              {viewMode === 'admin' ? (
                <AdminQueryHistory 
                  onCreatePersonalQuery={handleCreatePersonalQuery}
                  selectedQuery={selectedQuery}
                  onSelectQuery={handleQuerySelected}
                />
              ) : (
                <QueryHistory 
                  refreshTrigger={queryRefreshTrigger} 
                  onQuerySelected={handleQuerySelected}
                  selectedQueryId={selectedQuery?.id}
                />
              )}
            </div>
          </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0"> {/* min-w-0 prevents flex overflow */}
              <div className="p-2 sm:p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {!isSidebarOpen && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleSidebar(true)}
                      title="Expand sidebar"
                      className="hover:bg-muted transition-colors flex-shrink-0"
                    >
                      <PanelLeftOpen className="h-4 w-4" />
                    </Button>
                  )}
                  <h1 
                    className="text-lg sm:text-xl font-bold cursor-pointer hover:text-primary transition-colors truncate" 
                    onClick={handleNewQuery}
                    title="Click to start a new query"
                  >
                    {isMobile ? 'MedGuard QA' : 'OpenFDA Medication QA'}
                  </h1>
                  {!isMobile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNewQuery}
                      className="hover:bg-muted transition-colors ml-3 flex-shrink-0"
                      title="New Query"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Query
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
                  {/* Mobile New Query Button */}
                  {isMobile && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleNewQuery}
                      className="hover:bg-muted transition-colors"
                      title="New Query"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                  {/* Admin Link - only show for admin users */}
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size={isMobile ? "icon" : "sm"}
                      onClick={() => window.open('/admin', '_blank')}
                      className="hover:bg-muted transition-colors"
                      title="Admin Dashboard"
                    >
                      <Settings className="h-4 w-4" />
                      {!isMobile && <span className="ml-2">Admin</span>}
                    </Button>
                  )}
                  <ThemeToggle />
                  <AuthWrapper />
                </div>
              </div>
              
              <div className="p-3 sm:p-6">
                <MedicationQueryForm 
                  onQuerySaved={handleQuerySaved}
                  selectedQuery={selectedQuery}
                  newQueryTrigger={newQueryTrigger}
                  isAdminView={viewMode === 'admin'}
                />
              </div>
            </div>
        </div>
        
          {/* Fixed Disclaimer and Project Info - responsive positioning */}
          <div className="fixed bottom-2 right-2 sm:bottom-4 sm:right-4 z-30 flex flex-col items-end gap-2">
            <ProjectConsentModal />
            <DisclaimerModal />
          </div>
          
          {/* Cache Debugger for development mode - adjust for mobile */}
          {isDevelopment && (
            <div className={`${isMobile && isSidebarOpen ? 'hidden' : ''}`}>
              <CacheDebugger />
            </div>
          )}
        </div>
      </AuthGuard>
    </>
  )
}
