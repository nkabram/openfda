'use client'

import { useState, useEffect } from 'react'
import { MedicationQueryForm } from '../components/medication-query-form'
import { QueryHistory } from '../components/query-history'
import { AuthWrapper } from '../components/auth/AuthWrapper'
import { AuthGuard } from '../components/auth/AuthGuard'
import { DisclaimerModal } from '../components/disclaimer-modal'
import { Button } from '../components/ui/button'
import { PanelLeft, PanelLeftOpen, Plus } from 'lucide-react'

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [queryRefreshTrigger, setQueryRefreshTrigger] = useState(0)
  const [selectedQuery, setSelectedQuery] = useState<any>(null)
  const [newQueryTrigger, setNewQueryTrigger] = useState(0)

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

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background relative">
        <div className="flex">
          {/* Sidebar */}
          <div className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 ease-in-out overflow-hidden border-r border-border ${isSidebarOpen ? 'shadow-sm' : ''}`}>
            <div className="h-full">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-semibold">Query History</h2>
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
              <QueryHistory 
                refreshTrigger={queryRefreshTrigger} 
                onQuerySelected={handleQuerySelected}
                selectedQueryId={selectedQuery?.id}
              />
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
              <AuthWrapper />
            </div>
            
            <div className="p-6">
              <MedicationQueryForm 
                onQuerySaved={handleQuerySaved}
                selectedQuery={selectedQuery}
                newQueryTrigger={newQueryTrigger}
              />
            </div>
          </div>
        </div>
        
        {/* Fixed Disclaimer in bottom right */}
        <div className="fixed bottom-4 right-4 z-50">
          <DisclaimerModal />
        </div>
      </div>
    </AuthGuard>
  )
}
