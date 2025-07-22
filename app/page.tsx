'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { MedicationQueryForm } from '../components/medication-query-form'
import { MedicationQueryHelpModal } from '../components/medication-query-help-modal'
import { QueryHistory } from '../components/query-history'
import { AuthWrapper } from '../components/auth/AuthWrapper'
import { DisclaimerModal } from '../components/disclaimer-modal'
import { ProjectConsentModal } from '../components/ProjectConsentModal'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { PanelLeft, PanelLeftOpen, Plus, User, Users, Settings, Search } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useQueryCache } from '@/contexts/QueryCacheContext'
import { ThemeToggle } from '@/components/theme-toggle'


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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [selectedQuery, setSelectedQuery] = useState<any>(null)
  const [queryRefreshTrigger, setQueryRefreshTrigger] = useState(0)
  const [newQueryTrigger, setNewQueryTrigger] = useState(0)
  const [drugSearchFilter, setDrugSearchFilter] = useState('')
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const [isResizing, setIsResizing] = useState(false)
  const { isAdmin } = useAuth()
  


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
    // Trigger a refresh of the query history
    setQueryRefreshTrigger(prev => prev + 1)
  }

  const handleNewQuery = () => {
    setSelectedQuery(null)
    setNewQueryTrigger(prev => prev + 1)
  }

  const handleQuerySelected = (query: any) => {
    setSelectedQuery(query)
    
    // If query is null (from delete operation), trigger new query form reset
    if (query === null) {
      setNewQueryTrigger(prev => prev + 1)
    }
    
    // Auto-close sidebar on mobile when a query is selected
    if (isMobile && isSidebarOpen) {
      console.log('📱 Auto-closing sidebar after query selection on mobile')
      toggleSidebar(false)
    }
  }

  // Resize handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      
      const newWidth = e.clientX
      if (newWidth >= 250 && newWidth <= 600) {
        setSidebarWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  return (
    <>
      <AuthGuard>
        <div className="min-h-screen bg-background relative">
          {/* Mobile overlay backdrop */}
          {isMobile && isSidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300" 
              onClick={() => {
                console.log('📱 Backdrop clicked - closing sidebar')
                toggleSidebar(false)
              }}
            />
          )}
          
          <div className="flex">
            {/* Sidebar */}
            <div className={`
              transition-all duration-300 ease-in-out
              bg-background border-r border-border relative
              ${isMobile 
                ? `fixed left-0 top-0 h-full z-50 transform ${
                    isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                  }` 
                : `${isSidebarOpen ? '' : 'w-0'} overflow-hidden`
              }
              ${isSidebarOpen ? 'shadow-2xl' : ''}
            `}
            style={{
              width: isMobile ? '280px' : (isSidebarOpen ? `${sidebarWidth}px` : '0px')
            }}>
            <div className="h-full flex flex-col">
              {/* Header with collapse button and search */}
              <div className="p-3 border-b border-border bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground">Query History</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSidebar(false)}
                    title="Collapse sidebar"
                    className="h-7 w-7 p-0 hover:bg-muted transition-colors"
                  >
                    <PanelLeft className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {/* Drug search filter */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search medications..."
                    value={drugSearchFilter}
                    onChange={(e) => setDrugSearchFilter(e.target.value)}
                    className="pl-10 h-9 text-sm"
                  />
                </div>
              </div>
              
              {/* Query History List */}
              <div className="flex-1 overflow-hidden">
                <QueryHistory 
                  refreshTrigger={queryRefreshTrigger} 
                  onQuerySelected={handleQuerySelected}
                  selectedQueryId={selectedQuery?.id}
                  searchFilter={drugSearchFilter}
                />
              </div>
            </div>
            
            {/* Resize handle - only show on desktop when sidebar is open */}
            {!isMobile && isSidebarOpen && (
              <div 
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-border hover:bg-primary/50 transition-colors group"
                onMouseDown={handleMouseDown}
              >
                <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-3 h-8 bg-muted border border-border rounded opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0"> {/* min-w-0 prevents flex overflow */}
              <div className="p-2 sm:p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {/* Mobile toggle button - always show on mobile */}
                  {isMobile && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        console.log('🔘 Toggle button clicked!', { isMobile, isSidebarOpen })
                        toggleSidebar(true)
                      }}
                      title="View Query History"
                      className="hover:bg-muted transition-colors flex-shrink-0 relative"
                    >
                      <PanelLeftOpen className="h-4 w-4" />
                      {/* Small indicator dot to show there are queries */}
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full opacity-60" />
                    </Button>
                  )}
                  {/* Desktop expand button - show when sidebar is closed */}
                  {!isMobile && !isSidebarOpen && (
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
                  {!isMobile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNewQuery}
                      className="hover:bg-muted transition-colors flex-shrink-0"
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
                  <MedicationQueryHelpModal />
                  <ThemeToggle />
                  <AuthWrapper />
                </div>
              </div>
              
              <div className="p-3 sm:p-6">
                <MedicationQueryForm 
                  onQuerySaved={handleQuerySaved}
                  selectedQuery={selectedQuery}
                  newQueryTrigger={newQueryTrigger}
                />
              </div>
            </div>
        </div>
        
          {/* Fixed Disclaimer and Project Info - responsive positioning */}
          <div className="fixed bottom-2 right-2 sm:bottom-4 sm:right-4 z-30 flex flex-col items-end gap-2">
            <ProjectConsentModal />
            <DisclaimerModal />
          </div>
          

        </div>
      </AuthGuard>
    </>
  )
}
