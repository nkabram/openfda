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

// Dynamically import AuthGuard to prevent hydration issues
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [queryRefreshTrigger, setQueryRefreshTrigger] = useState(0)
  const [selectedQuery, setSelectedQuery] = useState<any>(null)
  const [newQueryTrigger, setNewQueryTrigger] = useState(0)
  const [viewMode, setViewMode] = useState<'user' | 'admin'>('user')
  const { isAdmin } = useAuth()
  const { invalidateUserQueries, invalidateAdminQueries } = useQueryCache()

  // Load sidebar state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarOpen')
    if (savedState !== null) {
      setIsSidebarOpen(JSON.parse(savedState))
    }
  }, [])

  // Save sidebar state to localStorage when it changes
  const toggleSidebar = (open: boolean) => {
    setIsSidebarOpen(open)
    localStorage.setItem('sidebarOpen', JSON.stringify(open))
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
        <div className="flex">
          {/* Sidebar */}
          <div className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 ease-in-out overflow-hidden border-r border-border ${isSidebarOpen ? 'shadow-sm' : ''}`}>
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
          <div className="flex-1">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                {!isSidebarOpen && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleSidebar(true)}
                    title="Expand sidebar"
                    className="hover:bg-muted transition-colors"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </Button>
                )}
                <h1 
                  className="text-xl font-bold cursor-pointer hover:text-primary transition-colors" 
                  onClick={handleNewQuery}
                  title="Click to start a new query"
                >
                  OpenFDA Medication QA
                </h1>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNewQuery}
                  className="hover:bg-muted transition-colors ml-3"
                  title="New Query"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Query
                </Button>
              </div>
              <div className="flex items-center gap-3">
                {/* Admin Link - only show for admin users */}
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('/admin', '_blank')}
                    className="hover:bg-muted transition-colors"
                    title="Admin Dashboard"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Admin
                  </Button>
                )}
                <ThemeToggle />
                <AuthWrapper />
              </div>
            </div>
            
            <div className="p-6">
              <MedicationQueryForm 
                onQuerySaved={handleQuerySaved}
                selectedQuery={selectedQuery}
                newQueryTrigger={newQueryTrigger}
                isAdminView={viewMode === 'admin'}
              />
            </div>
          </div>
        </div>
        
          {/* Fixed Disclaimer and Project Info in bottom right */}
          <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
            <ProjectConsentModal />
            <DisclaimerModal />
          </div>
        </div>
      </AuthGuard>
    </>
  )
}
